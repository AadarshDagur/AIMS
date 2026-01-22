const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const { pool } = require('../config/database');
const nodemailer = require('nodemailer'); // npm install nodemailer

// FIXED: createTransport (not createTransporter)
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER, // your@gmail.com
    pass: process.env.EMAIL_PASS  // your 16-char app password
  }
});

// POST /login - Password → Send OTP
router.post('/login', async (req, res) => {
  try {
    const { email, password, role } = req.body;

    const userQuery = `SELECT * FROM users WHERE email = $1 AND role = $2`;
    const userResult = await pool.query(userQuery, [email, role]);

    if (userResult.rows.length === 0) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const user = userResult.rows[0];
    const isValidPassword = await bcrypt.compare(password, user.password);
    if (!isValidPassword) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Generate OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const otpHash = await bcrypt.hash(otp, 10);
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

    await pool.query('DELETE FROM login_otps WHERE user_id = $1', [user.id]);
    await pool.query(
      'INSERT INTO login_otps (user_id, otp, expires_at) VALUES ($1, $2, $3)',
      [user.id, otpHash, expiresAt]
    );

    // Send email
    await transporter.sendMail({
      from: process.env.EMAIL_USER,
      to: email,
      subject: 'AIMS Login OTP',
      text: `Your OTP: ${otp} (expires in 10 min)`
    });

    req.session.pendingLogin = { userId: user.id, role: user.role };
    await req.session.save();

    res.json({ message: 'OTP sent' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /verify-otp
router.post('/verify-otp', async (req, res) => {
  try {
    const { otp } = req.body;

    if (!req.session.pendingLogin) {
      return res.status(401).json({ error: 'Session expired' });
    }

    const { userId } = req.session.pendingLogin;
    const otpResult = await pool.query(
      'SELECT * FROM login_otps WHERE user_id = $1 AND used = false AND expires_at > NOW()',
      [userId]
    );

    if (otpResult.rows.length === 0) {
      return res.status(401).json({ error: 'Invalid/expired OTP' });
    }

    const dbOtp = otpResult.rows[0];
    const isValidOtp = await bcrypt.compare(otp, dbOtp.otp);
    if (!isValidOtp) {
      return res.status(401).json({ error: 'Wrong OTP' });
    }

    await pool.query('UPDATE login_otps SET used = true WHERE id = $1', [dbOtp.id]);
    const userResult = await pool.query('SELECT * FROM users WHERE id = $1', [userId]);

    req.session.user = userResult.rows[0];
    req.session.role = req.session.pendingLogin.role;
    delete req.session.pendingLogin;
    await req.session.save();

    const rolePath = req.session.role === 'student' ? 'student' : req.session.role;
    res.json({ message: 'Success', redirect: `/${rolePath}` });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /logout
router.post('/logout', (req, res) => {
  req.session.destroy((err) => {
    if (err) return res.status(500).json({ error: 'Logout failed' });
    res.json({ message: 'Logged out' });
  });
});

module.exports = router;
