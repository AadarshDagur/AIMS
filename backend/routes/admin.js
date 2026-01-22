const express = require('express');
const router = express.Router();
const { pool } = require('../config/database');
const bcrypt = require('bcryptjs');

router.use((req, res, next) => {
  if (req.session.user?.role !== 'admin') return res.status(403).json({ error: 'Admin only' });
  next();
});

router.get('/stats', async (req, res) => {
  const result = await pool.query(`
    SELECT COALESCE((SELECT COUNT(*) FROM users),0) total_users,
           COALESCE((SELECT COUNT(*) FROM courses),0) total_courses,
           COALESCE((SELECT COUNT(*) FROM enrollments),0) total_enrollments,
           COALESCE((SELECT COUNT(*) FROM enrollments WHERE status='pending'),0) pending_enrollments
  `);
  res.json(result.rows[0]);
});

router.get('/users', async (req, res) => {
  const result = await pool.query('SELECT id,email,name,role,user_id,COALESCE(department,\'N/A\') department FROM users ORDER BY id DESC LIMIT 20');
  res.json(result.rows);
});

router.get('/courses', async (req, res) => {
  const result = await pool.query(`
    SELECT c.*,COALESCE(u.name,'-') instructor_name,
           COALESCE((SELECT COUNT(*) FROM enrollments e WHERE e.course_id=c.id),0) enrolled_count
    FROM courses c LEFT JOIN users u ON c.instructor_id=u.id ORDER BY c.code
  `);
  res.json(result.rows);
});

router.post('/create-user', async (req, res) => {
  const { email, name, role, user_id, department, password = '123456' } = req.body;
  const hashed = await bcrypt.hash(password, 10);
  try {
    await pool.query('INSERT INTO users(email,password,name,role,user_id,department)VALUES($1,$2,$3,$4,$5,$6)', 
      [email, hashed, name, role, user_id, department]);
    res.json({ success: true });
  } catch (err) {
    res.json({ success: false, error: err.message });
  }
});

module.exports = router;
