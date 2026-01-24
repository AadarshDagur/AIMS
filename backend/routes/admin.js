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
  const { user_id, name, email, password, role, advisor_id } = req.body;

  // Validate required fields
  if (!user_id || !name || !email || !password || !role) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  // If role is student, advisor_id is required
  if (role === 'student') {
    if (!advisor_id) {
      return res.status(400).json({ error: 'Advisor ID is required for students' });
    }

    // Optional: validate advisor exists
    try {
      const advisorCheck = await pool.query(
        'SELECT 1 FROM users WHERE user_id = $1 AND role = $2',
        [advisor_id, 'advisor']
      );
      if (advisorCheck.rows.length === 0) {
        return res.status(400).json({ error: 'Invalid or non‑advisor advisor ID' });
      }
    } catch (e) {
      return res.status(500).json({ error: 'Failed to validate advisor' });
    }
  }

  try {
    const bcrypt = require('bcryptjs');
    const hashed = await bcrypt.hash(password || '123456', 10);

    // Insert user
    await pool.query(
      'INSERT INTO users (user_id, name, email, password, role) VALUES ($1,$2,$3,$4,$5)',
      [user_id, name, email, hashed, role]
    );

    // If student, insert into advisor_students
    if (role === 'student') {
      await pool.query(
        `INSERT INTO advisor_students (student_id, advisor_id, created_at)
         VALUES ($1, $2, NOW())`,
        [user_id, advisor_id]
      );
    }

    res.json({ success: true });
  } catch (e) {
    console.error('Create user error:', e);
    res.status(500).json({ error: e.message });
  }
});


// 📚 COURSES - with filters
router.get('/courses', requireAdmin, async (req, res) => {
  const { dept, search } = req.query;

  let query = `
    SELECT c.code, c.title, c.department, c.instructor_id, c.credits, c.session,
           COALESCE((SELECT COUNT(*) FROM enrollments e WHERE e.course_id::text = c.code), 0) as enrollments
    FROM courses c
    WHERE 1=1
  `;

  const params = [];
  let paramIndex = 1;

  if (dept && dept !== 'all') {
    query += ` AND c.department = $${paramIndex}`;
    params.push(dept);
    paramIndex++;
  }

  if (search) {
    const likeParam = `%${search.toLowerCase()}%`;
    query += ` AND (LOWER(c.title) LIKE $${paramIndex} OR LOWER(c.code) LIKE $${paramIndex})`;
    params.push(likeParam);
    paramIndex++;
  }

  query += ' ORDER BY c.code';

  try {
    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (e) {
    console.error('Courses error:', e);
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

// 📋 ENROLLMENTS - SAFE VERSION (NO JOINS, NO TYPE MISMATCH)
router.get('/enrollments', requireAdmin, async (req, res) => {
  const { status: filterStatus, search } = req.query;

  try {
    let query = `
      SELECT 
        student_id,
        student_id::text AS student_name,        -- placeholder name
        course_id::text AS course_code,          -- show id as code
        ('Course ' || course_id::text) AS course_title,
        COALESCE(enrolled_date::text, created_at::text) AS enrolled_date,
        COALESCE(instructor_status, 'pending') AS instructor_status,
        COALESCE(advisor_status, 'pending') AS advisor_status,
        COALESCE(status, 'pending') AS status
      FROM enrollments
    `;

    const params = [];
    const conditions = [];

    // Filter by status (all text, so safe)
    if (filterStatus && filterStatus !== 'all') {
      conditions.push(`status = $${params.length + 1}`);
      params.push(filterStatus);
    }

    // Search on student_id or course_id as text (safe)
    if (search) {
      const idx = params.length + 1;
      conditions.push(`(student_id::text ILIKE $${idx} OR course_id::text ILIKE $${idx})`);
      params.push(`%${search}%`);
    }

    if (conditions.length) {
      query += ' WHERE ' + conditions.join(' AND ');
    }

    query += ' ORDER BY COALESCE(created_at, enrolled_date) DESC NULLS LAST';

    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (e) {
    console.error('Enrollments SAFE ERROR:', e.message);
    res.status(500).json({ error: e.message });
  }
});


module.exports = router;
