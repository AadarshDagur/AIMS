const express = require('express');
const session = require('express-session');
const pgSession = require('connect-pg-simple')(session);
const bodyParser = require('body-parser');
const path = require('path');
require('dotenv').config();

const { pool, initDatabase } = require('./config/database');
const { authMiddleware, roleMiddleware } = require('./middleware/auth');
const authRoutes = require('./routes/auth');
const courseRoutes = require('./routes/courses');
const enrollmentRoutes = require('./routes/enrollments');
const adminRoutes = require('./routes/admin');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, '../public')));

// Session configuration
app.use(session({
  store: new pgSession({
    pool: pool,
    tableName: 'session'
  }),
  secret: process.env.SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  cookie: { 
    maxAge: 24 * 60 * 60 * 1000, // 24 hours
    secure: process.env.NODE_ENV === 'production'
  }
}));

// View engine setup
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, '../views'));

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/courses', courseRoutes);
app.use('/api/enrollments', enrollmentRoutes);
app.use('/api/admin', adminRoutes);

// Page routes
app.get('/', (req, res) => {
  if (req.session.user) {
    return res.redirect(`/${req.session.user.role}`);
  }
  res.redirect('/login');
});

app.get('/login', (req, res) => {
  if (req.session.user) {
    return res.redirect(`/${req.session.user.role}`);
  }
  res.render('login');
});


app.get('/student', roleMiddleware(['student']), (req, res) => {
  res.render('student', { user: req.session.user });
});

app.get('/instructor', roleMiddleware(['instructor']), (req, res) => {
  res.render('instructor', { user: req.session.user });
});

app.get('/advisor', roleMiddleware(['advisor']), (req, res) => {
  res.render('advisor', { user: req.session.user });
});

app.get('/admin', roleMiddleware(['admin']), (req, res) => {
  res.render('admin', { user: req.session.user });
});

app.get('/api/admin/stats', async (req, res) => {
  const { pool } = require('./config/database');
  try {
    const result = await pool.query(`
      SELECT 
        COALESCE((SELECT COUNT(*) FROM users), 0) total_users,
        COALESCE((SELECT COUNT(*) FROM courses), 0) total_courses,
        COALESCE((SELECT COUNT(*) FROM enrollments), 0) total_enrollments,
        COALESCE((SELECT COUNT(*) FROM enrollments WHERE status='pending'), 0) pending_enrollments
    `);
    res.json(result.rows[0]);
  } catch (err) {
    console.error('Stats error:', err);
    res.status(500).json({ error: 'Stats unavailable' });
  }
});

app.get('/api/admin/users', async (req, res) => {
  const { pool } = require('./config/database');
  try {
    const result = await pool.query(`
      SELECT id, email, name, role, user_id, 
             COALESCE(department, 'N/A') as department 
      FROM users ORDER BY id DESC LIMIT 20
    `);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: 'Users unavailable' });
  }
});

app.get('/api/admin/courses', async (req, res) => {
  const { pool } = require('./config/database');
  try {
    const result = await pool.query(`
      SELECT c.*, COALESCE(u.name, '-') instructor_name,
             COALESCE(e_count.count, 0) enrolled_count
      FROM courses c 
      LEFT JOIN users u ON c.instructor_id = u.id
      LEFT JOIN (
        SELECT course_id, COUNT(*) count 
        FROM enrollments 
        GROUP BY course_id
      ) e_count ON c.id = e_count.course_id
      ORDER BY c.code
    `);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: 'Courses unavailable' });
  }
});

app.post('/api/admin/create-user', async (req, res) => {
  const { pool } = require('./config/database');
  const bcrypt = require('bcryptjs');
  const { email, name, role, user_id, department, password = '123456' } = req.body;
  
  try {
    const hashed = await bcrypt.hash(password, 10);
    await pool.query(
      `INSERT INTO users (email, password, name, role, user_id, department) 
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT (email) DO NOTHING`,
      [email, hashed, name, role, user_id, department]
    );
    res.json({ success: true, message: 'User created' });
  } catch (err) {
    console.error('Create user error:', err);
    res.status(500).json({ error: err.message });
  }
});


// Initialize database and start server
initDatabase()
  .then(() => {
    app.listen(PORT, () => {
      console.log(`Server running on http://localhost:${PORT}`);
    });
  })
  .catch(err => {
    console.error('Failed to initialize database:', err);
    process.exit(1);
  });