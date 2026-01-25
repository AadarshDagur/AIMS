const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool(
  process.env.DATABASE_URL
    ? {
        connectionString: process.env.DATABASE_URL,
        ssl: {
          rejectUnauthorized: false
        }
      }
    : {
        host: process.env.DB_HOST,
        port: process.env.DB_PORT,
        user: process.env.DB_USER,
        password: process.env.DB_PASSWORD,
        database: process.env.DB_NAME
      }
);


// Database initialization
const initDatabase = async () => {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        email VARCHAR(255) UNIQUE NOT NULL,
        password VARCHAR(255) NOT NULL,
        name VARCHAR(255) NOT NULL,
        role VARCHAR(50) NOT NULL CHECK (role IN ('student', 'instructor', 'advisor', 'admin')),
        user_id VARCHAR(50) UNIQUE NOT NULL,
        department VARCHAR(255),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS login_otps (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        otp VARCHAR(255) NOT NULL,  -- bcrypt hash needs 60+ chars
        expires_at TIMESTAMP NOT NULL,
        used BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMP DEFAULT NOW()
      );
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS courses (
        id SERIAL PRIMARY KEY,
        code VARCHAR(50) UNIQUE NOT NULL,
        title VARCHAR(255) NOT NULL,
        department VARCHAR(255) NOT NULL,
        instructor_id INTEGER REFERENCES users(id),
        credits INTEGER NOT NULL,
        session VARCHAR(100) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS enrollments (
        id SERIAL PRIMARY KEY,
        student_id INTEGER REFERENCES users(id),
        course_id INTEGER REFERENCES courses(id),
        instructor_status VARCHAR(50) DEFAULT 'pending' CHECK (instructor_status IN ('pending', 'approved', 'rejected')),
        advisor_status VARCHAR(50) DEFAULT 'pending' CHECK (advisor_status IN ('pending', 'approved', 'rejected')),
        enrolled_date DATE DEFAULT CURRENT_DATE,
        instructor_comment TEXT,
        advisor_comment TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(student_id, course_id)
      );
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS advisor_students (
        id SERIAL PRIMARY KEY,
        student_id VARCHAR(50) REFERENCES users(user_id) ON DELETE CASCADE,
        advisor_id VARCHAR(50) REFERENCES users(user_id) ON DELETE CASCADE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(student_id, advisor_id)
      );

    `);

    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_advisor_students_advisor ON advisor_students(advisor_id);
    `);


    console.log('Database tables created successfully');
  } catch (error) {
    console.error('Error initializing database:', error);
    throw error;
  }
};

module.exports = { pool, initDatabase };