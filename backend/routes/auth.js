const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const db = require('../config/database');
const { authenticateToken } = require('../middleware/auth');

// Generate OTP (debug mode - no real SMS)
function generateOTP() {
    return Math.floor(1000 + Math.random() * 9000).toString();
}

// Request OTP
router.post('/request-otp', async (req, res) => {
    const { phone } = req.body;

    if (!phone || phone.length < 10) {
        return res.status(400).json({ error: 'Phone number required' });
    }

    try {
        const otp = generateOTP();
        const expiresAt = new Date(Date.now() + 5 * 60000);

        await db.execute(
            'INSERT INTO otp_codes (phone, code, expires_at) VALUES (?, ?, ?)',
            [phone, otp, expiresAt]
        );

        console.log(`📱 OTP for ${phone}: ${otp}`);

        res.json({ 
            success: true, 
            message: 'OTP sent successfully',
            debug_otp: otp
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Failed to send OTP' });
    }
});

// Verify OTP
router.post('/verify-otp', async (req, res) => {
    const { phone, otp, userType, name } = req.body;

    if (!phone || !otp) {
        return res.status(400).json({ error: 'Phone and OTP required' });
    }

    try {
        const [rows] = await db.execute(
            'SELECT * FROM otp_codes WHERE phone = ? AND code = ? AND used = FALSE AND expires_at > NOW()',
            [phone, otp]
        );

        if (rows.length === 0) {
            return res.status(401).json({ error: 'Invalid or expired OTP' });
        }

        await db.execute('UPDATE otp_codes SET used = TRUE WHERE id = ?', [rows[0].id]);

        let [users] = await db.execute('SELECT * FROM users WHERE phone = ?', [phone]);

        let user;
        let isNewUser = false;

        if (users.length === 0) {
            isNewUser = true;
            const [result] = await db.execute(
                'INSERT INTO users (phone, name, user_type, verified) VALUES (?, ?, ?, TRUE)',
                [phone, name || (userType === 'worker' ? 'Worker' : 'Employer'), userType]
            );
            
            user = { id: result.insertId, phone, user_type: userType, name: name || null };
            
            if (userType === 'worker') {
                await db.execute(
                    'INSERT INTO workers (user_id, skills, experience_years) VALUES (?, ?, ?)',
                    [user.id, '', 0]
                );
            } else {
                await db.execute(
                    'INSERT INTO employers (user_id, company_name) VALUES (?, ?)',
                    [user.id, name || 'New Business']
                );
            }
        } else {
            user = users[0];
        }

        const token = jwt.sign(
            { userId: user.id, phone: user.phone, userType: user.user_type },
            process.env.JWT_SECRET,
            { expiresIn: '7d' }
        );

        res.json({
            success: true,
            token,
            isNewUser,
            user: {
                id: user.id,
                phone: user.phone,
                name: user.name,
                userType: user.user_type
            }
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Verification failed' });
    }
});

// Get user profile
router.get('/profile', authenticateToken, async (req, res) => {
    try {
        const [users] = await db.execute(
            'SELECT id, phone, name, user_type, rating, verified, created_at FROM users WHERE id = ?',
            [req.user.userId]
        );

        if (users.length === 0) {
            return res.status(404).json({ error: 'User not found' });
        }

        let profile = users[0];
        
        if (profile.user_type === 'worker') {
            const [workers] = await db.execute(
                'SELECT * FROM workers WHERE user_id = ?',
                [profile.id]
            );
            if (workers.length > 0) {
                profile.worker_details = workers[0];
            }
        } else {
            const [employers] = await db.execute(
                'SELECT * FROM employers WHERE user_id = ?',
                [profile.id]
            );
            if (employers.length > 0) {
                profile.employer_details = employers[0];
            }
        }

        res.json(profile);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Failed to fetch profile' });
    }
});

module.exports = router;