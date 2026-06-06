const express = require('express');
const router = express.Router();
const db = require('../config/database');
const { authenticateToken } = require('../middleware/auth');

// Get employer profile
router.get('/profile', authenticateToken, async (req, res) => {
    if (req.user.userType !== 'employer') {
        return res.status(403).json({ error: 'Access denied' });
    }
    
    try {
        const [employers] = await db.execute(
            `SELECT u.id, u.name, u.phone as user_phone, u.rating,
                    e.company_name, e.total_jobs_posted, e.total_workers_hired,
                    e.email, e.phone
             FROM users u
             LEFT JOIN employers e ON u.id = e.user_id
             WHERE u.id = ?`,
            [req.user.userId]
        );
        
        if (employers.length === 0) {
            return res.status(404).json({ error: 'Profile not found' });
        }
        
        res.json(employers[0]);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Failed to fetch profile' });
    }
});

// Update employer profile
router.put('/profile', authenticateToken, async (req, res) => {
    if (req.user.userType !== 'employer') {
        return res.status(403).json({ error: 'Access denied' });
    }
    
    const { company_name, email, phone } = req.body;
    
    try {
        await db.execute(
            `UPDATE employers SET 
                company_name = COALESCE(?, company_name),
                email = COALESCE(?, email),
                phone = COALESCE(?, phone)
             WHERE user_id = ?`,
            [company_name || null, email || null, phone || null, req.user.userId]
        );
        
        if (company_name) {
            await db.execute('UPDATE users SET name = ? WHERE id = ?', [company_name, req.user.userId]);
        }
        
        res.json({ success: true, message: 'Profile updated' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Failed to update profile' });
    }
});

// Get hired workers
router.get('/hired-workers', authenticateToken, async (req, res) => {
    if (req.user.userType !== 'employer') {
        return res.status(403).json({ error: 'Access denied' });
    }
    
    try {
        const [workers] = await db.execute(
            `SELECT DISTINCT u.id, u.name, u.phone, u.rating,
                    ja.status, j.title as job_title
             FROM job_assignments ja
             JOIN users u ON ja.worker_id = u.id
             JOIN jobs j ON ja.job_id = j.id
             WHERE ja.employer_id = ?
             ORDER BY ja.assigned_at DESC`,
            [req.user.userId]
        );
        res.json(workers);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Failed to fetch hired workers' });
    }
});

// Rate worker
router.post('/rate-worker', authenticateToken, async (req, res) => {
    if (req.user.userType !== 'employer') {
        return res.status(403).json({ error: 'Access denied' });
    }
    
    const { assignmentId, rating } = req.body;
    
    try {
        await db.execute(
            'UPDATE job_assignments SET employer_rating = ? WHERE id = ? AND employer_id = ?',
            [rating, assignmentId, req.user.userId]
        );
        
        const [assignment] = await db.execute('SELECT worker_id FROM job_assignments WHERE id = ?', [assignmentId]);
        
        if (assignment.length > 0) {
            const [ratings] = await db.execute(
                'SELECT AVG(employer_rating) as avg_rating FROM job_assignments WHERE worker_id = ? AND employer_rating IS NOT NULL',
                [assignment[0].worker_id]
            );
            
            if (ratings[0].avg_rating) {
                await db.execute('UPDATE users SET rating = ? WHERE id = ?', [ratings[0].avg_rating, assignment[0].worker_id]);
            }
        }
        
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: 'Failed' });
    }
});

module.exports = router;