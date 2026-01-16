const express = require('express');
const router = express.Router();
const { pool } = require('../config/database');
const { authMiddleware, roleMiddleware } = require('../middleware/auth');

// Get all courses
router.get('/', authMiddleware, async (req, res) => {
  try {
    const { department, code, title } = req.query;
    
    let query = `
      SELECT c.*, u.name as instructor_name 
      FROM courses c
      LEFT JOIN users u ON c.instructor_id = u.id
      WHERE 1=1
    `;
    const params = [];
    let paramCount = 1;

    if (department) {
      query += ` AND c.department = $${paramCount}`;
      params.push(department);
      paramCount++;
    }

    if (code) {
      query += ` AND c.code ILIKE $${paramCount}`;
      params.push(`%${code}%`);
      paramCount++;
    }

    if (title) {
      query += ` AND c.title ILIKE $${paramCount}`;
      params.push(`%${title}%`);
      paramCount++;
    }

    query += ' ORDER BY c.code';

    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching courses:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Get all departments
router.get('/departments', authMiddleware, async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT DISTINCT department FROM courses ORDER BY department'
    );
    res.json(result.rows.map(row => row.department));
  } catch (error) {
    console.error('Error fetching departments:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Add new course (instructor only)
router.post('/', roleMiddleware(['instructor']), async (req, res) => {
  try {
    const { code, title, department, credits, session } = req.body;
    
    const result = await pool.query(
      `INSERT INTO courses (code, title, department, instructor_id, credits, session)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [code, title, department, req.session.user.id, credits, session]
    );

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error creating course:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;