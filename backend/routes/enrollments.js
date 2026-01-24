const express = require('express');
const router = express.Router();
const { pool } = require('../config/database');
const { authMiddleware, roleMiddleware } = require('../middleware/auth');

// Get enrollments for student
router.get('/student', roleMiddleware(['student']), async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT e.*, c.code as course_code, c.title as course_title,
              c.credits, c.session
       FROM enrollments e
       JOIN courses c ON e.course_id = c.id
       WHERE e.student_id = $1
       ORDER BY e.created_at DESC`,
      [req.session.user.id]
    );
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching student enrollments:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Enroll in a course
router.post('/enroll', roleMiddleware(['student']), async (req, res) => {
  try {
    const { course_id } = req.body;

    const result = await pool.query(
      `INSERT INTO enrollments (student_id, course_id)
       VALUES ($1, $2)
       RETURNING *`,
      [req.session.user.id, course_id]
    );

    res.json(result.rows[0]);
  } catch (error) {
    if (error.code === '23505') { // Unique violation
      return res.status(400).json({ error: 'Already enrolled in this course' });
    }
    console.error('Error enrolling in course:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Drop a course (student)
router.delete('/drop/:id', roleMiddleware(['student']), async (req, res) => {
  try {
    const enrollmentId = req.params.id;

    const result = await pool.query(
      `DELETE FROM enrollments
       WHERE id = $1 AND student_id = $2
       RETURNING *`,
      [enrollmentId, req.session.user.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Enrollment not found' });
    }

    res.json({ success: true });
  } catch (error) {
    console.error('Error dropping enrollment:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// GET /api/enrollments/instructor/pending?course_id=123
router.get('/instructor/pending', roleMiddleware(['instructor']), async (req, res) => {
  const instructorId = req.session.user.id;
  const { course_id } = req.query;

  let query = `
    SELECT e.*, 
           u.name as student_name, 
           u.user_id as student_user_id,
           c.code as course_code, 
           c.title as course_title
    FROM enrollments e
    JOIN users u ON e.student_id = u.id
    JOIN courses c ON e.course_id = c.id
    WHERE c.instructor_id = $1
  `;

  const params = [instructorId];
  let paramIndex = 2;

  if (course_id) {
    query += ` AND e.course_id = $${paramIndex}`;
    params.push(course_id);
    paramIndex++;
  }

  query += ' ORDER BY e.created_at DESC';

  try {
    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (error) {
    console.error('Instructor enrollments error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/enrollments/instructor/bulk-approve
router.post('/instructor/bulk-approve', roleMiddleware(['instructor']), async (req, res) => {
  const { ids, status } = req.body;

  if (!Array.isArray(ids) || !ids.length || !['approved', 'rejected'].includes(status)) {
    return res.status(400).json({ error: 'Invalid request' });
  }

  try {
    const result = await pool.query(
      `UPDATE enrollments 
       SET instructor_status = $1
       WHERE id = ANY($2)
       RETURNING *`,
      [status, ids]
    );

    res.json({ updated: result.rows.length });
  } catch (error) {
    console.error('Bulk approve error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});


// Instructor approval/rejection
router.put('/instructor/approve/:id', roleMiddleware(['instructor']), async (req, res) => {
  try {
    const { status, comment } = req.body;
    const enrollmentId = req.params.id;

    const result = await pool.query(
      `UPDATE enrollments 
       SET instructor_status = $1, instructor_comment = $2
       WHERE id = $3
       RETURNING *`,
      [status, comment || null, enrollmentId]
    );

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error updating enrollment:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Get enrollments for advisor approval (only instructor-approved + THEIR students)
router.get('/advisor/pending', roleMiddleware(['advisor']), async (req, res) => {
  const advisorId = req.session.user.user_id;
  const { status, search } = req.query;

  let query = `
    SELECT e.*, 
           u.name as student_name, 
           u.user_id as student_user_id, 
           u.department,
           c.code as course_code, 
           c.title as course_title
    FROM enrollments e
    JOIN users u ON e.student_id = u.id
    JOIN courses c ON e.course_id = c.id
    JOIN advisor_students aps ON aps.student_id = u.user_id
    WHERE aps.advisor_id = $1
      AND e.instructor_status = 'approved'
  `;

  const params = [advisorId];
  let paramIndex = 2;

  if (status && status !== 'all') {
    query += ` AND e.advisor_status = $${paramIndex}`;
    params.push(status);
    paramIndex++;
  }

  if (search) {
    const likeParam = `%${search.toLowerCase()}%`;
    query += `
      AND (LOWER(u.name) LIKE $${paramIndex} OR LOWER(u.user_id) LIKE $${paramIndex})
    `;
    params.push(likeParam);
    paramIndex++;
  }

  query += ' ORDER BY e.created_at DESC';

  try {
    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (error) {
    console.error('Advisor enrollments error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Advisor approval/rejection
router.put('/advisor/approve/:id', roleMiddleware(['advisor']), async (req, res) => {
  try {
    const { status, comment } = req.body;
    const enrollmentId = req.params.id;

    const result = await pool.query(
      `UPDATE enrollments 
       SET advisor_status = $1, advisor_comment = $2
       WHERE id = $3
       RETURNING *`,
      [status, comment || null, enrollmentId]
    );

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error updating enrollment:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// GET /api/enrollments/advisor/students → students assigned to this advisor
router.get('/advisor/students', roleMiddleware(['advisor']), async (req, res) => {
  const advisorId = req.session.user.user_id;
  const { search } = req.query;

  let query = `
    SELECT
      s.user_id AS student_user_id,
      s.name AS student_name,
      s.email
    FROM advisor_students a
    JOIN users s ON a.student_id = s.user_id
    WHERE a.advisor_id = $1
  `;

  const params = [advisorId];
  let paramIndex = 2;

  if (search) {
    const likeParam = `%${search.toLowerCase()}%`;
    query += `
      AND (LOWER(s.name) LIKE $${paramIndex} OR LOWER(s.user_id) LIKE $${paramIndex})
    `;
    params.push(likeParam);
    paramIndex++;
  }

  query += ' ORDER BY s.name';

  try {
    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (e) {
    console.error('Advisor students error:', e);
    res.status(500).json({ error: 'Failed to load assigned students' });
  }
});

module.exports = router;
