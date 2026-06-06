const express = require('express');
const router = express.Router();
const db = require('../config/database');
const { authenticateToken } = require('../middleware/auth');

// Get worker profile
router.get('/profile', authenticateToken, async (req, res) => {
    if (req.user.userType !== 'worker') {
        return res.status(403).json({ error: 'Access denied' });
    }
    
    try {
        const [workers] = await db.execute(
            `SELECT u.*, w.skills, w.experience_years, w.looking_for_work, 
                    w.completed_jobs_count, w.total_earnings
             FROM users u
             JOIN workers w ON u.id = w.user_id
             WHERE u.id = ?`,
            [req.user.userId]
        );
        
        if (workers.length === 0) {
            return res.status(404).json({ error: 'Profile not found' });
        }
        
        const [badges] = await db.execute(
            `SELECT b.*, wb.earned_at
             FROM worker_badges wb
             JOIN badges b ON wb.badge_id = b.id
             WHERE wb.worker_id = ?`,
            [req.user.userId]
        );
        
        workers[0].badges = badges;
        res.json(workers[0]);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Failed to fetch profile' });
    }
});

// Update worker profile
router.put('/profile', authenticateToken, async (req, res) => {
    if (req.user.userType !== 'worker') {
        return res.status(403).json({ error: 'Access denied' });
    }
    
    const { name, skills, experience_years, looking_for_work } = req.body;
    
    try {
        if (name) {
            await db.execute('UPDATE users SET name = ? WHERE id = ?', [name, req.user.userId]);
        }
        
        await db.execute(
            `UPDATE workers 
             SET skills = ?, experience_years = ?, looking_for_work = ?
             WHERE user_id = ?`,
            [skills || '', experience_years || 0, looking_for_work !== undefined ? looking_for_work : 1, req.user.userId]
        );
        
        res.json({ success: true, message: 'Profile updated' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Failed to update profile' });
    }
});

// Get worker's completed jobs
router.get('/completed-jobs', authenticateToken, async (req, res) => {
    if (req.user.userType !== 'worker') {
        return res.status(403).json({ error: 'Access denied' });
    }
    
    try {
        const [jobs] = await db.execute(
            `SELECT ja.*, j.title as job_title, j.wage, u.name as employer_name
             FROM job_assignments ja
             JOIN jobs j ON ja.job_id = j.id
             JOIN users u ON ja.employer_id = u.id
             WHERE ja.worker_id = ? AND ja.status = 'completed'
             ORDER BY ja.completed_at DESC`,
            [req.user.userId]
        );
        res.json(jobs);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Failed to fetch completed jobs' });
    }
});

// Get worker's active jobs
router.get('/active-jobs', authenticateToken, async (req, res) => {
    if (req.user.userType !== 'worker') {
        return res.status(403).json({ error: 'Access denied' });
    }
    
    try {
        const [jobs] = await db.execute(
            `SELECT ja.*, j.title, j.wage, j.wage_type, j.address_text, u.name as employer_name
             FROM job_assignments ja
             JOIN jobs j ON ja.job_id = j.id
             JOIN users u ON ja.employer_id = u.id
             WHERE ja.worker_id = ? AND ja.status IN ('assigned', 'in_progress')
             ORDER BY ja.assigned_at DESC`,
            [req.user.userId]
        );
        res.json(jobs);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Failed to fetch active jobs' });
    }
});

// Mark job as completed
router.put('/complete-job/:assignmentId', authenticateToken, async (req, res) => {
    if (req.user.userType !== 'worker') {
        return res.status(403).json({ error: 'Access denied' });
    }
    
    const { assignmentId } = req.params;
    
    try {
        const [assignments] = await db.execute(
            'SELECT * FROM job_assignments WHERE id = ? AND worker_id = ?',
            [assignmentId, req.user.userId]
        );
        
        if (assignments.length === 0) {
            return res.status(404).json({ error: 'Assignment not found' });
        }
        
        await db.execute(
            `UPDATE job_assignments 
             SET status = 'completed', completed_at = NOW()
             WHERE id = ?`,
            [assignmentId]
        );
        
        await db.execute(
            `UPDATE workers 
             SET completed_jobs_count = completed_jobs_count + 1,
                 total_earnings = total_earnings + ?
             WHERE user_id = ?`,
            [assignments[0].payment_amount || 500, req.user.userId]
        );
        
        await db.execute(
            'UPDATE jobs SET status = "completed" WHERE id = ?',
            [assignments[0].job_id]
        );
        
        res.json({ success: true, message: 'Job marked as completed' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Failed to complete job' });
    }
});

module.exports = router;