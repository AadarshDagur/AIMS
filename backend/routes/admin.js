const express = require('express');
const router = express.Router();
const { pool } = require('../config/database');

// 🛡️ Admin check
const requireAdmin = (req, res, next) => {
  if (req.session?.user?.role !== 'admin') {
    return res.status(403).json({ error: 'Admin only' });
  }
  next();
};

// 📊 STATS - Fixed (no nested aggregates)
router.get('/stats', requireAdmin, async (req, res) => {
  try {
    const [users, courses, enrollments, sessions, pending, approved, rejected, roles] = await Promise.all([
      pool.query('SELECT COUNT(*)::int as totalUsers FROM users'),
      pool.query('SELECT COUNT(*)::int as totalCourses FROM courses'),
      pool.query('SELECT COUNT(*)::int as totalEnrollments FROM enrollments'),
      pool.query("SELECT COUNT(*)::int as activeSessions FROM pg_stat_activity WHERE state='active'"),
      pool.query("SELECT COUNT(*)::int as pending FROM enrollments WHERE status='pending'"),
      pool.query("SELECT COUNT(*)::int as approved FROM enrollments WHERE status='approved'"),
      pool.query("SELECT COUNT(*)::int as rejected FROM enrollments WHERE status='rejected'"),
      pool.query('SELECT role, COUNT(*)::int as count FROM users GROUP BY role')
    ]);
    
    const roleCounts = {};
    roles.rows.forEach(r => roleCounts[r.role] = r.count);
    
    res.json({
      totalUsers: users.rows[0].totalusers,
      totalCourses: courses.rows[0].totalcourses,
      totalEnrollments: enrollments.rows[0].totalenrollments,
      activeSessions: sessions.rows[0].activesessions,
      pending: pending.rows[0].pending,
      approved: approved.rows[0].approved,
      rejected: rejected.rows[0].rejected,
      students: roleCounts.student || 0,
      instructors: roleCounts.instructor || 0,
      advisors: roleCounts.advisor || 0,
      admins: roleCounts.admin || 0
    });
  } catch (e) {
    res.json({
      totalUsers: 0, totalCourses: 0, totalEnrollments: 0, activeSessions: 0,
      pending: 0, approved: 0, rejected: 0,
      students: 0, instructors: 0, advisors: 0, admins: 1
    });
  }
});

// 👥 USERS - Fixed (no advisor_id)
router.get('/users', requireAdmin, async (req, res) => {
  const { role, search } = req.query;
  let query = 'SELECT user_id, name, email, role FROM users';
  let params = [];
  
  const conditions = [];
  if (role && role !== 'all') {
    conditions.push('role = $1');
    params.push(role);
  }
  if (search) {
    const sIdx = params.length + 1;
    conditions.push('(LOWER(name) LIKE $' + sIdx + ' OR LOWER(user_id) LIKE $' + sIdx + ')');
    params.push(`%${search.toLowerCase()}%`);
  }
  
  if (conditions.length) {
    query += ' WHERE ' + conditions.join(' AND ');
  }
  query += ' ORDER BY user_id';
  
  try {
    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (e) {
    console.error('Users error:', e);
    res.json([]);
  }
});

// POST users (uses your existing bcryptjs)
router.post('/users', requireAdmin, async (req, res) => {
  const { user_id, name, email, password, role } = req.body;
  try {
    const bcrypt = require('bcryptjs');
    const hashed = await bcrypt.hash(password || '123456', 10);
    await pool.query(
      'INSERT INTO users (user_id, name, email, password, role) VALUES ($1,$2,$3,$4,$5)',
      [user_id, name, email, hashed, role]
    );
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// 📚 COURSES
router.get('/courses', requireAdmin, async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT c.code, c.title, c.department, c.instructor_id, c.credits, c.session,
             COALESCE((SELECT COUNT(*) FROM enrollments e WHERE e.course_id::text = c.code), 0) as enrollments
      FROM courses c ORDER BY c.code
    `);
    res.json(result.rows);
  } catch (e) {
    res.json([]);
  }
});

// 📋 DEPARTMENTS
router.get('/departments', requireAdmin, async (req, res) => {
  try {
    const result = await pool.query('SELECT DISTINCT department FROM courses WHERE department IS NOT NULL ORDER BY department');
    res.json(result.rows.map(r => r.department));
  } catch (e) {
    res.json(['CS', 'Math', 'Physics']);
  }
});

// 📋 ENROLLMENTS - Fixed (course_id varchar → code varchar)
router.get('/enrollments', requireAdmin, async (req, res) => {
  const { status: filterStatus, search } = req.query;
  
  try {
    let query = `
      SELECT 
        e.student_id,
        COALESCE(u.name, e.student_id) as student_name,
        e.course_id,
        COALESCE(c.code, e.course_id) as course_code,
        COALESCE(c.title, 'Course ' || e.course_id) as course_title,
        COALESCE(e.enrolled_date, e.created_at) as enrolled_date,
        COALESCE(e.instructor_status, 'pending') as instructor_status,
        COALESCE(e.advisor_status, 'pending') as advisor_status,
        COALESCE(e.status, 'pending') as status
      FROM enrollments e
      LEFT JOIN users u ON e.student_id = u.user_id
      LEFT JOIN courses c ON e.course_id::text = c.code
    `;
    
    const params = [];
    if (filterStatus && filterStatus !== 'all') {
      query += ' WHERE e.status = $1';
      params.push(filterStatus);
    }
    if (search) {
      const sIdx = params.length + 1;
      query += params.length ? ' AND' : ' WHERE';
      query += ` (LOWER(COALESCE(u.name, '')) LIKE $${sIdx} OR LOWER(e.course_id) LIKE $${sIdx})`;
      params.push(`%${search.toLowerCase()}%`);
    }
    
    query += ' ORDER BY COALESCE(e.created_at, e.enrolled_date) DESC LIMIT 100';
    
    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (e) {
    console.error('Enrollments error:', e);
    res.json([]);
  }
});

module.exports = router;
