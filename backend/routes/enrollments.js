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

// Get enrollments for instructor approval
router.get('/instructor/pending', roleMiddleware(['instructor']), async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT e.*, 
              u.name as student_name, u.user_id as student_user_id,
              c.code as course_code, c.title as course_title
       FROM enrollments e
       JOIN users u ON e.student_id = u.id
       JOIN courses c ON e.course_id = c.id
       WHERE c.instructor_id = $1
       ORDER BY e.created_at DESC`,
      [req.session.user.id]
    );
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching instructor enrollments:', error);
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

// Get enrollments for advisor approval (only instructor-approved)
router.get('/advisor/pending', roleMiddleware(['advisor']), async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT e.*, 
              u.name as student_name, u.user_id as student_user_id, u.department,
              c.code as course_code, c.title as course_title
       FROM enrollments e
       JOIN users u ON e.student_id = u.id
       JOIN courses c ON e.course_id = c.id
       WHERE e.instructor_status = 'approved'
       ORDER BY e.created_at DESC`
    );
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching advisor enrollments:', error);
    res.status(500).json({ error: 'Server error' });
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

module.exports = router;