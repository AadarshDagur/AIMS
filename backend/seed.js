const bcrypt = require('bcryptjs');
const { pool, initDatabase } = require('./config/database');

async function seed() {
  await initDatabase();

  const passwordStudent = await bcrypt.hash('student123', 10);
  const passwordInstructor = await bcrypt.hash('instructor123', 10);
  const passwordAdvisor = await bcrypt.hash('advisor123', 10);

  await pool.query('TRUNCATE enrollments RESTART IDENTITY CASCADE');
  await pool.query('TRUNCATE courses RESTART IDENTITY CASCADE');
  await pool.query('TRUNCATE users RESTART IDENTITY CASCADE');

  const usersResult = await pool.query(
    `INSERT INTO users (email, password, name, role, user_id, department)
     VALUES
       ('student@iit.ac.in', $1, 'Demo Student', 'student', 'BT22CS001', 'CSE'),
       ('instructor@iit.ac.in', $2, 'Demo Instructor', 'instructor', 'EMP123', 'CSE'),
       ('advisor@iit.ac.in', $3, 'Demo Advisor', 'advisor', 'EMP987', 'CSE')
     RETURNING *`,
    [passwordStudent, passwordInstructor, passwordAdvisor]
  );

  const instructor = usersResult.rows.find(u => u.role === 'instructor');

  await pool.query(
    `INSERT INTO courses (code, title, department, instructor_id, credits, session)
     VALUES
       ('CS301', 'Algorithms', 'CSE', $1, 4, '2025-26 Sem II'),
       ('CS305', 'Database Systems', 'CSE', $1, 4, '2025-26 Sem II'),
       ('CS340', 'Networks', 'CSE', $1, 3, '2025-26 Sem II')`,
    [instructor.id]
  );

  console.log('Seed completed');
  process.exit(0);
}

seed().catch(err => {
  console.error(err);
  process.exit(1);
});
