document.addEventListener('DOMContentLoaded', async () => {
  await Promise.all([loadStats(), loadUsers(), loadDepartments(), loadCourses(), loadEnrollments(), loadReports()]);
  setupEventListeners();
  showTab('users');
});

async function setupEventListeners() {
  document.getElementById('addUserForm')?.addEventListener('submit', createUser);
  document.getElementById('filterRole')?.addEventListener('change', () => searchUsers());
  document.getElementById('searchUser')?.addEventListener('input', debounce(searchUsers, 300));
  document.getElementById('filterDept')?.addEventListener('change', () => searchCourses());
  document.getElementById('searchCourse')?.addEventListener('input', debounce(searchCourses, 300));
  document.getElementById('enrollmentStatusFilter')?.addEventListener('change', () => searchEnrollments());
  document.getElementById('searchEnrollment')?.addEventListener('input', debounce(searchEnrollments, 300));
  
  document.querySelectorAll('.btn-logout').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      if (confirm('Logout?')) logout();
    });
  });
  
  setInterval(loadStats, 30000);
}

async function loadStats() {
  try {
    const res = await fetch('/api/admin/stats');
    const stats = await res.json();
    document.getElementById('totalUsers').textContent = stats.totalUsers || 0;
    document.getElementById('totalCourses').textContent = stats.totalCourses || 0;
    document.getElementById('totalEnrollments').textContent = stats.totalEnrollments || 0;
    document.getElementById('activeSessions').textContent = stats.activeSessions || 0;
    document.getElementById('reportPending').textContent = stats.pending || 0;
    document.getElementById('reportApproved').textContent = stats.approved || 0;
    document.getElementById('reportRejected').textContent = stats.rejected || 0;
    document.getElementById('reportStudents').textContent = stats.students || 0;
    document.getElementById('reportInstructors').textContent = stats.instructors || 0;
    document.getElementById('reportAdvisors').textContent = stats.advisors || 0;
    document.getElementById('reportAdmins').textContent = stats.admins || 0;
  } catch (e) { console.error('Stats failed'); }
}

async function loadUsers(filters = {}) {
  try {
    const params = new URLSearchParams(filters);
    const res = await fetch(`/api/admin/users?${params}`);
    const users = await res.json();
    document.getElementById('usersTable').innerHTML = users.map(u => `
<<<<<<< HEAD
      <tr><td>${u.user_id}</td><td>${u.name}</td><td>${u.email}</td><td><span class="badge-${u.role}">${u.role}</span></td><td>-</td><td>-</td></tr>
=======
      <tr><td>${u.user_id}</td><td>${u.name}</td><td>${u.email}</td><td><span class="badge-${u.role}">${u.role}</span></td></tr>
>>>>>>> eaa7e87 (Added smooth filtering across each dashboards)
    `).join('') || '<tr><td colspan="6" class="text-center">No users</td></tr>';
  } catch (e) { console.error('Users failed'); }
}

async function createUser(e) {
  e.preventDefault();
  const formData = Object.fromEntries(new FormData(e.target));
<<<<<<< HEAD
  try {
    const res = await fetch('/api/admin/users', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(formData)
    });
    if (res.ok) {
      document.getElementById('addUserMessage').textContent = '✅ Created!';
      e.target.reset();
      loadUsers(); loadStats();
    }
  } catch (e) { console.error('Create failed'); }
}

=======
  const role = formData.role;
  const advisorId = formData.advisor_id;

  if (role === 'student' && !advisorId) {
    alert('Advisor ID is required for students');
    return;
  }

  try {
    const res = await fetch('/api/admin/users', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(formData)
    });

    if (res.ok) {
      document.getElementById('addUserMessage').textContent = '✅ Created!';
      e.target.reset();
      loadUsers();
      loadStats();
    } else {
      const data = await res.json();
      alert('Error: ' + data.error);
    }
  } catch (e) {
    console.error('Create failed', e);
    alert('Network error');
  }
}


>>>>>>> eaa7e87 (Added smooth filtering across each dashboards)
function searchUsers() {
  const role = document.getElementById('filterRole').value;
  const search = document.getElementById('searchUser').value;
  loadUsers({ role, search });
}

async function loadCourses(filters = {}) {
  try {
    const params = new URLSearchParams(filters);
    const res = await fetch(`/api/admin/courses?${params}`);
    const courses = await res.json();
    document.getElementById('coursesTable').innerHTML = courses.map(c => `
<<<<<<< HEAD
      <tr><td>${c.code}</td><td>${c.title}</td><td>${c.department||'-'}</td><td>${c.instructor_id||'-'}</td><td>${c.credits}</td><td>${c.session||'-'}</td><td>${c.enrollments}</td><td>-</td></tr>
=======
      <tr><td>${c.code}</td><td>${c.title}</td><td>${c.department||'-'}</td><td>${c.instructor_id||'-'}</td><td>${c.credits}</td><td>${c.session||'-'}</td><td>${c.enrollments}</td></tr>
>>>>>>> eaa7e87 (Added smooth filtering across each dashboards)
    `).join('') || '<tr><td colspan="8">No courses</td></tr>';
  } catch (e) { console.error('Courses failed'); }
}

async function loadDepartments() {
  try {
    const res = await fetch('/api/admin/departments');
    const depts = await res.json();
    document.getElementById('filterDept').innerHTML = '<option value="">All</option>' + depts.map(d => `<option>${d}</option>`).join('');
  } catch (e) {}
}

function searchCourses() {
  const dept = document.getElementById('filterDept').value;
  const search = document.getElementById('searchCourse').value;
  loadCourses({ dept, search });
}

async function loadEnrollments(filters = {}) {
  try {
    const params = new URLSearchParams(filters);
    const res = await fetch(`/api/admin/enrollments?${params}`);
    const data = await res.json();
    document.getElementById('enrollmentsTable').innerHTML = data.map(e => `
      <tr><td>${e.student_id}</td><td>${e.student_name}</td><td>${e.course_code}</td><td>${e.course_title}</td><td>${e.enrolled_date}</td><td>${e.instructor_status}</td><td>${e.advisor_status}</td><td><span class="badge-${e.status}">${e.status}</span></td></tr>
    `).join('') || '<tr><td colspan="8">No enrollments</td></tr>';
  } catch (e) { console.error('Enrollments failed'); }
}

function searchEnrollments() {
  const status = document.getElementById('enrollmentStatusFilter').value;
  const search = document.getElementById('searchEnrollment').value;
  loadEnrollments({ status, search });
}

async function loadReports() { await loadStats(); }

function showTab(tab) {
  document.querySelectorAll('.tab-content').forEach(t => t.classList.remove('active'));
  document.querySelectorAll('.tab-button').forEach(b => b.classList.remove('active'));
  document.getElementById(tab + 'Tab').classList.add('active');
  event.target.closest('.tab-button').classList.add('active');
}

async function logout() {
  await fetch('/api/auth/logout', { method: 'POST' });
  window.location.href = '/login';
}

function debounce(fn, ms) {
  let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); };
}
