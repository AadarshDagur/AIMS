const bcrypt = require('bcryptjs');
const { pool, initDatabase } = require('./config/database');

async function seed() {
  console.log('🌱 Starting AIMS large seed...');
  
  try {
    await initDatabase();

    // 🔄 FIXED: Truncate in correct order with CASCADE
    await pool.query('TRUNCATE enrollments, advisor_students, courses, users RESTART IDENTITY CASCADE');

    // 🔐 Hash passwords
    const passwordStudent = await bcrypt.hash('student123', 10);
    const passwordInstructor = await bcrypt.hash('instructor123', 10);
    const passwordAdvisor = await bcrypt.hash('advisor123', 10);

    // 👥 1. CORE DEMO USERS (create FIRST)
    const coreResult = await pool.query(`
      INSERT INTO users (email, password, name, role, user_id, department)
      VALUES 
        ('student@iit.ac.in', $1, 'Demo Student', 'student', 'BT22CS001', 'CSE'),
        ('instructor@iit.ac.in', $2, 'Prof. Rajesh Kumar', 'instructor', 'EMP001', 'CSE'),
        ('advisor@iit.ac.in', $3, 'Prof. Anjali Sharma', 'advisor', 'EMP002', 'CSE')
      RETURNING *
    `, [passwordStudent, passwordInstructor, passwordAdvisor]);

    const demoStudentId = coreResult.rows.find(u => u.role === 'student').id;
    const demoInstructorId = coreResult.rows.find(u => u.role === 'instructor').id;
    const demoAdvisorId = coreResult.rows.find(u => u.role === 'advisor').id;

    // 🎓 2. 50 MORE STUDENTS
    for (let i = 1; i <= 50; i++) {
      await pool.query(`
        INSERT INTO users (email, password, name, role, user_id, department)
        VALUES ($1, $2, $3, 'student', $4, $5)
      `, [
        `student${i}@iit.ac.in`,
        passwordStudent,
        `Student ${i}`,
        `BT22CS00${i.toString().padStart(2, '0')}`,
        ['CSE', 'ECE', 'ME', 'Civil', 'Chemical'][(i-1) % 5]
      ]);
    }

    // 👨‍🏫 3. 8 INSTRUCTORS
    const instructorData = [
      ['instructor1@iit.ac.in', 'Prof. Amit Singh', 'EMP011', 'CSE'],
      ['instructor2@iit.ac.in', 'Prof. Priya Gupta', 'EMP012', 'ECE'],
      ['instructor3@iit.ac.in', 'Prof. Vikram Rao', 'EMP013', 'ME'],
      ['instructor4@iit.ac.in', 'Prof. Neha Patel', 'EMP014', 'Civil'],
      ['instructor5@iit.ac.in', 'Prof. Sanjay Joshi', 'EMP015', 'Chemical'],
      ['instructor6@iit.ac.in', 'Prof. Ritu Verma', 'EMP016', 'CSE'],
      ['instructor7@iit.ac.in', 'Prof. Karan Mehra', 'EMP017', 'ECE'],
      ['instructor8@iit.ac.in', 'Prof. Meera Nair', 'EMP018', 'ME']
    ];
    const instructorIds = [];
    for (const [email, name, userId, dept] of instructorData) {
      const result = await pool.query(`
        INSERT INTO users (email, password, name, role, user_id, department)
        VALUES ($1, $2, $3, 'instructor', $4, $5) RETURNING id
      `, [email, passwordInstructor, name, userId, dept]);
      instructorIds.push(result.rows[0].id);
    }

    // 🧑‍🏫 4. 3 ADVISORS
    const advisorData = [
      ['advisor1@iit.ac.in', 'Prof. Rahul Desai', 'EMP021', 'CSE'],
      ['advisor2@iit.ac.in', 'Prof. Kavya Reddy', 'EMP022', 'ECE'],
      ['advisor3@iit.ac.in', 'Prof. Sonia Verma', 'EMP023', 'ME']
    ];
    const advisorIds = [demoAdvisorId]; // Include demo advisor
    for (const [email, name, userId, dept] of advisorData) {
      const result = await pool.query(`
        INSERT INTO users (email, password, name, role, user_id, department)
        VALUES ($1, $2, $3, 'advisor', $4, $5) RETURNING id
      `, [email, passwordAdvisor, name, userId, dept]);
      advisorIds.push(result.rows[0].id);
    }

    // 📚 5. Get all students for assignments
    const studentsResult = await pool.query('SELECT id FROM users WHERE role = $1 ORDER BY id', ['student']);
    const students = studentsResult.rows;

    // 👥 6. ASSIGN STUDENTS TO ADVISORS (15 each)
    for (let i = 0; i < advisorIds.length; i++) {
      const start = i * 15;
      for (let j = 0; j < 15 && start + j < students.length; j++) {
        await pool.query(`
          INSERT INTO advisor_students (student_id, advisor_id) 
          VALUES ($1, $2)
        `, [students[start + j].id, advisorIds[i]]);
      }
    }

    // 📖 7. 25 COURSES (AFTER instructors exist!)
    const courseData = [
      ['CS101', 'Intro to Programming', 'CSE', 3],
      ['CS201', 'Data Structures', 'CSE', 4],
      ['CS301', 'Algorithms', 'CSE', 4],
      ['CS305', 'Database Systems', 'CSE', 4],
      ['CS340', 'Computer Networks', 'CSE', 3],
      ['CS350', 'Operating Systems', 'CSE', 4],
      ['EE201', 'Circuits I', 'ECE', 4],
      ['EE301', 'Digital Systems', 'ECE', 3],
      ['EE320', 'Signals & Systems', 'ECE', 4],
      ['ME101', 'Engineering Mechanics', 'ME', 3],
      ['ME301', 'Machine Design', 'ME', 4],
      ['ME305', 'Heat Transfer', 'ME', 4],
      ['CE201', 'Structural Analysis', 'Civil', 4],
      ['CE301', 'Geotechnical Engg', 'Civil', 3],
      ['CH101', 'Chemical Engg Principles', 'Chemical', 3],
      ['CH301', 'Process Control', 'Chemical', 4],
      ['MA101', 'Linear Algebra', 'Mathematics', 3],
      ['MA201', 'Calculus III', 'Mathematics', 4],
      ['PH101', 'Physics I', 'Physics', 4],
      ['HS101', 'Technical Communication', 'Humanities', 2],
      ['CS401', 'Machine Learning', 'CSE', 4],
      ['EE401', 'Embedded Systems', 'ECE', 4],
      ['ME401', 'Robotics', 'ME', 3],
      ['CE401', 'Water Resources', 'Civil', 3],
      ['CH401', 'Biochemical Engg', 'Chemical', 4]
    ];
    const courseIds = [];
    for (let i = 0; i < courseData.length; i++) {
      const instructorId = instructorIds[i % instructorIds.length];
      const result = await pool.query(`
        INSERT INTO courses (code, title, department, instructor_id, credits, session)
        VALUES ($1, $2, $3, $4, $5, '2025-26 Sem II') RETURNING id
      `, [...courseData[i], instructorId]);
      courseIds.push(result.rows[0].id);
    }

    // 📋 8. 400 ENROLLMENTS (mixed statuses)
    const statuses = ['pending', 'approved', 'rejected'];
    for (let i = 0; i < 400; i++) {
      const studentId = students[i % students.length].id;
      const courseId = courseIds[i % courseIds.length];
      const instructorStatus = statuses[Math.floor(Math.random() * 3)];
      const advisorStatus = ['rejected', 'pending'].includes(instructorStatus) ? instructorStatus : statuses[Math.floor(Math.random() * 2)];

      await pool.query(`
        INSERT INTO enrollments (student_id, course_id, instructor_status, advisor_status)
        VALUES ($1, $2, $3, $4)
      `, [studentId, courseId, instructorStatus, advisorStatus]);
    }

    // 📈 Final stats
    const stats = await pool.query(`
      SELECT 
        (SELECT COUNT(*) FROM users WHERE role='student') students,
        (SELECT COUNT(*) FROM users WHERE role='instructor') instructors,
        (SELECT COUNT(*) FROM users WHERE role='advisor') advisors,
        (SELECT COUNT(*) FROM courses) courses,
        (SELECT COUNT(*) FROM enrollments) enrollments,
        (SELECT COUNT(*) FROM advisor_students) assignments
    `);

    const s = stats.rows[0];
    console.log('\n🎉 SEED SUCCESS!');
    console.log(`📊 ${s.students} students | ${s.instructors} instructors | ${s.advisors} advisors`);
    console.log(`📚 ${s.courses} courses | ${s.enrollments} enrollments | ${s.assignments} assignments`);
    console.log('\n🔑 LOGIN:');
    console.log('Student: student@iit.ac.in / student123');
    console.log('Instructor: instructor1@iit.ac.in / instructor123');
    console.log('Advisor: advisor1@iit.ac.in / advisor123');

  } catch (error) {
    console.error('❌ SEED FAILED:', error.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

seed();
