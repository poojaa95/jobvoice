const express = require('express');
const router = express.Router();
const db = require('../config/database');
const { authenticateToken } = require('../middleware/auth');

// Search jobs
router.post('/search', authenticateToken, async (req, res) => {
    const { query } = req.body;
    
    try {
        const searchTerm = `%${query}%`;
        const [jobs] = await db.execute(
            `SELECT j.*, u.name as employer_name 
             FROM jobs j
             JOIN users u ON j.employer_id = u.id
             WHERE j.status = 'open' 
             AND (j.title LIKE ? OR j.description LIKE ?)
             ORDER BY j.created_at DESC`,
            [searchTerm, searchTerm]
        );
        res.json(jobs);
    } catch (error) {
        console.error('Search error:', error);
        res.status(500).json({ error: 'Search failed' });
    }
});

// Create job
router.post('/create', authenticateToken, async (req, res) => {
    if (req.user.userType !== 'employer') {
        return res.status(403).json({ error: 'Only employers can post jobs' });
    }
    
    const { title, description, wage, wage_type, address_text } = req.body;
    
    if (!title || !wage) {
        return res.status(400).json({ error: 'Title and wage are required' });
    }
    
    try {
        const [result] = await db.execute(
            `INSERT INTO jobs 
             (employer_id, title, description, wage, wage_type, address_text, status)
             VALUES (?, ?, ?, ?, ?, ?, 'open')`,
            [req.user.userId, title, description || '', wage, wage_type || 'daily', address_text || '']
        );
        
        await db.execute(
            'UPDATE employers SET total_jobs_posted = total_jobs_posted + 1 WHERE user_id = ?',
            [req.user.userId]
        );
        
        res.json({ success: true, jobId: result.insertId, message: 'Job posted successfully' });
    } catch (error) {
        console.error('Create job error:', error);
        res.status(500).json({ error: error.message });
    }
});

// Get employer's jobs
router.get('/employer/my-jobs', authenticateToken, async (req, res) => {
    if (req.user.userType !== 'employer') {
        return res.status(403).json({ error: 'Access denied' });
    }
    
    try {
        const [jobs] = await db.execute(
            `SELECT *, (SELECT COUNT(*) FROM applications WHERE job_id = jobs.id) as application_count
             FROM jobs
             WHERE employer_id = ?
             ORDER BY created_at DESC`,
            [req.user.userId]
        );
        res.json(jobs);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Failed to fetch jobs' });
    }
});

// Get applications for employer
router.get('/employer/applications', authenticateToken, async (req, res) => {
    if (req.user.userType !== 'employer') {
        return res.status(403).json({ error: 'Access denied' });
    }
    
    try {
        const [applications] = await db.execute(
            `SELECT a.*, j.title as job_title, j.wage,
                    u.name as worker_name, u.phone as worker_phone, u.rating as worker_rating
             FROM applications a
             JOIN jobs j ON a.job_id = j.id
             JOIN users u ON a.worker_id = u.id
             WHERE j.employer_id = ? AND a.status = 'pending'
             ORDER BY a.applied_at DESC`,
            [req.user.userId]
        );
        res.json(applications);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Failed to fetch applications' });
    }
});

// Accept or reject application
router.put('/applications/:applicationId/:action', authenticateToken, async (req, res) => {
    const { applicationId, action } = req.params;
    
    if (action !== 'accept' && action !== 'reject') {
        return res.status(400).json({ error: 'Invalid action' });
    }
    
    try {
        const [apps] = await db.execute(
            `SELECT a.*, j.employer_id, j.title, j.wage
             FROM applications a
             JOIN jobs j ON a.job_id = j.id
             WHERE a.id = ?`,
            [applicationId]
        );
        
        if (apps.length === 0) {
            return res.status(404).json({ error: 'Application not found' });
        }
        
        if (apps[0].employer_id !== req.user.userId) {
            return res.status(403).json({ error: 'Not your job' });
        }
        
        const newStatus = action === 'accept' ? 'accepted' : 'rejected';
        
        await db.execute(
            'UPDATE applications SET status = ?, reviewed_at = NOW() WHERE id = ?',
            [newStatus, applicationId]
        );
        
        if (action === 'accept') {
            await db.execute(
                `INSERT INTO job_assignments 
                 (job_id, worker_id, employer_id, status, payment_amount)
                 VALUES (?, ?, ?, 'assigned', ?)`,
                [apps[0].job_id, apps[0].worker_id, req.user.userId, apps[0].wage]
            );
            
            await db.execute('UPDATE jobs SET status = "in_progress" WHERE id = ?', [apps[0].job_id]);
            await db.execute('UPDATE employers SET total_workers_hired = total_workers_hired + 1 WHERE user_id = ?', [req.user.userId]);
            
            res.json({ success: true, message: 'Application accepted! Worker hired.' });
        } else {
            res.json({ success: true, message: 'Application rejected' });
        }
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Failed to update application' });
    }
});

// Get worker's active jobs
router.get('/worker/active-jobs', authenticateToken, async (req, res) => {
    if (req.user.userType !== 'worker') {
        return res.status(403).json({ error: 'Access denied' });
    }
    
    try {
        const [jobs] = await db.execute(
            `SELECT ja.*, j.title, j.wage, j.address_text, u.name as employer_name
             FROM job_assignments ja
             JOIN jobs j ON ja.job_id = j.id
             JOIN users u ON ja.employer_id = u.id
             WHERE ja.worker_id = ? AND ja.status = 'assigned'
             ORDER BY ja.assigned_at DESC`,
            [req.user.userId]
        );
        res.json(jobs);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Failed to fetch active jobs' });
    }
});

// Get worker's completed jobs
router.get('/worker/completed-jobs', authenticateToken, async (req, res) => {
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

// Mark job as completed
router.put('/complete-job/:assignmentId', authenticateToken, async (req, res) => {
    if (req.user.userType !== 'worker') {
        return res.status(403).json({ error: 'Access denied' });
    }
    
    const { assignmentId } = req.params;
    
    try {
        await db.execute(
            `UPDATE job_assignments SET status = 'completed', completed_at = NOW() WHERE id = ?`,
            [assignmentId]
        );
        
        res.json({ success: true, message: 'Job completed!' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Failed to complete job' });
    }
});

// Get hired workers for employer
router.get('/employer/hired-workers', authenticateToken, async (req, res) => {
    if (req.user.userType !== 'employer') {
        return res.status(403).json({ error: 'Access denied' });
    }
    
    try {
        const [workers] = await db.execute(
            `SELECT DISTINCT u.id, u.name, u.phone, u.rating, ja.status, j.title as job_title
             FROM job_assignments ja
             JOIN users u ON ja.worker_id = u.id
             JOIN jobs j ON ja.job_id = j.id
             WHERE ja.employer_id = ?`,
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
    const { assignmentId, rating } = req.body;
    
    try {
        await db.execute(
            'UPDATE job_assignments SET employer_rating = ? WHERE id = ?',
            [rating, assignmentId]
        );
        res.json({ success: true, message: 'Rated!' });
    } catch (error) {
        res.status(500).json({ error: 'Failed to rate' });
    }
});

// Worker apply for job
router.post('/:jobId/apply', authenticateToken, async (req, res) => {
    if (req.user.userType !== 'worker') {
        return res.status(403).json({ error: 'Only workers can apply' });
    }
    
    const { jobId } = req.params;
    const { text_experience } = req.body;
    
    try {
        const [result] = await db.execute(
            `INSERT INTO applications (job_id, worker_id, application_type, text_experience, status)
             VALUES (?, ?, 'text', ?, 'pending')`,
            [jobId, req.user.userId, text_experience]
        );
        
        res.json({ success: true, applicationId: result.insertId });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Failed to apply' });
    }
});

// Get worker's applications
router.get('/worker/applications', authenticateToken, async (req, res) => {
    if (req.user.userType !== 'worker') {
        return res.status(403).json({ error: 'Access denied' });
    }
    
    try {
        const [apps] = await db.execute(
            `SELECT a.*, j.title, j.wage
             FROM applications a
             JOIN jobs j ON a.job_id = j.id
             WHERE a.worker_id = ?
             ORDER BY a.applied_at DESC`,
            [req.user.userId]
        );
        res.json(apps);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Failed to fetch applications' });
    }
});
// Get completed jobs for rating (FIXED)
router.get('/employer/completed-jobs-for-rating', authenticateToken, async (req, res) => {
    if (req.user.userType !== 'employer') {
        return res.status(403).json({ error: 'Access denied' });
    }
    
    try {
        const [jobs] = await db.execute(
            `SELECT ja.*, j.title as job_title, u.name as worker_name
             FROM job_assignments ja
             JOIN jobs j ON ja.job_id = j.id
             JOIN users u ON ja.worker_id = u.id
             WHERE ja.employer_id = ? AND ja.status = 'completed' AND ja.employer_rating IS NULL
             ORDER BY ja.completed_at DESC`,
            [req.user.userId]
        );
        res.json(jobs);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Failed to fetch completed jobs' });
    }
});
// Get completed jobs for rating (employer)
router.get('/employer/completed-jobs-for-rating', authenticateToken, async (req, res) => {
    if (req.user.userType !== 'employer') {
        return res.status(403).json({ error: 'Access denied' });
    }
    
    try {
        const [jobs] = await db.execute(
            `SELECT ja.*, j.title as job_title, u.name as worker_name
             FROM job_assignments ja
             JOIN jobs j ON ja.job_id = j.id
             JOIN users u ON ja.worker_id = u.id
             WHERE ja.employer_id = ? AND ja.status = 'completed' AND ja.employer_rating IS NULL
             ORDER BY ja.completed_at DESC`,
            [req.user.userId]
        );
        res.json(jobs);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Failed to fetch completed jobs' });
    }
});

// Rate worker
router.post('/rate-worker', authenticateToken, async (req, res) => {
    if (req.user.userType !== 'employer') {
        return res.status(403).json({ error: 'Access denied' });
    }
    
    const { assignmentId, rating } = req.body;
    
    if (!assignmentId || !rating || rating < 1 || rating > 5) {
        return res.status(400).json({ error: 'Valid rating (1-5) required' });
    }
    
    try {
        await db.execute(
            'UPDATE job_assignments SET employer_rating = ? WHERE id = ? AND employer_id = ?',
            [rating, assignmentId, req.user.userId]
        );
        
        const [assignment] = await db.execute(
            'SELECT worker_id FROM job_assignments WHERE id = ?',
            [assignmentId]
        );
        
        if (assignment.length > 0) {
            const [ratings] = await db.execute(
                `SELECT AVG(employer_rating) as avg_rating FROM job_assignments 
                 WHERE worker_id = ? AND employer_rating IS NOT NULL`,
                [assignment[0].worker_id]
            );
            
            if (ratings[0].avg_rating) {
                await db.execute(
                    'UPDATE users SET rating = ? WHERE id = ?',
                    [ratings[0].avg_rating, assignment[0].worker_id]
                );
            }
        }
        
        res.json({ success: true, message: 'Worker rated successfully' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Failed to rate worker' });
    }
});
// Accept application
router.put('/applications/:id/accept', authenticateToken, async (req, res) => {
    const { id } = req.params;
    try {
        await db.execute('UPDATE applications SET status = "accepted" WHERE id = ?', [id]);
        res.json({ success: true, message: 'Accepted' });
    } catch(e) { res.status(500).json({ error: e.message }); }
});

// Reject application
router.put('/applications/:id/reject', authenticateToken, async (req, res) => {
    const { id } = req.params;
    try {
        await db.execute('UPDATE applications SET status = "rejected" WHERE id = ?', [id]);
        res.json({ success: true, message: 'Rejected' });
    } catch(e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;