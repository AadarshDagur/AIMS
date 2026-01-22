// AIMS Admin - Full functionality
async function logout() {
  try {
    await fetch('/api/auth/logout', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    });
    window.location.href = '/login';
  } catch (e) {
    alert('Logout failed: ' + e.message);
    window.location.href = '/login'; // Force redirect anyway
  }
}

async function createUser() {
  const form = document.getElementById('userForm');
  const formData = Object.fromEntries(new FormData(form));
  formData.password = document.getElementById('userPassword').value.trim() || '123456';
  
  if (!formData.email || !formData.name || !formData.role || !formData.user_id) {
    return alert('Fill required fields');
  }
  
  const btn = form.querySelector('button');
  btn.disabled = true;
  btn.textContent = 'Creating...';
  
  try {
    const res = await fetch('/api/admin/create-user', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(formData)
    });
    const result = await res.json();
    
    if (result.success) {
      alert(`✅ ${formData.role.toUpperCase()} created!\n${formData.email}\nPass: ${formData.password}`);
      form.reset();
      document.getElementById('userPassword').value = '';
      loadUsers();
    } else {
      alert('❌ ' + result.error);
    }
  } catch (e) {
    alert('Network error');
  } finally {
    btn.disabled = false;
    btn.textContent = 'Create User';
  }
}

async function loadUsers() {
  const tbody = document.getElementById('usersTableBody');
  if (!tbody) return;
  tbody.innerHTML = '<tr><td colspan="5" class="text-center">Loading...</td></tr>';
  
  try {
    const res = await fetch('/api/admin/users');
    const users = await res.json();
    tbody.innerHTML = users.map(u => `
      <tr>
        <td>${u.email}</td>
        <td>${u.name}</td>
        <td><span class="badge badge-${u.role}">${u.role}</span></td>
        <td>${u.user_id}</td>
        <td>${u.department}</td>
      </tr>
    `).join('');
  } catch (e) {
    tbody.innerHTML = '<tr><td colspan="5" class="text-center">Load failed</td></tr>';
  }
}

async function loadCoursesOverview() {
  const tbody = document.getElementById('coursesTableBody');
  if (!tbody) return;
  tbody.innerHTML = '<tr><td colspan="6" class="text-center">Loading...</td></tr>';
  
  try {
    const res = await fetch('/api/admin/courses');
    const courses = await res.json();
    tbody.innerHTML = courses.map(c => `
      <tr>
        <td><strong>${c.code}</strong></td>
        <td>${c.title}</td>
        <td>${c.department}</td>
        <td>${c.instructor_name || '-'}</td>
        <td>${c.credits}</td>
        <td>${c.session} (${c.enrolled_count})</td>
      </tr>
    `).join('');
  } catch (e) {
    tbody.innerHTML = '<tr><td colspan="6" class="text-center">Load failed</td></tr>';
  }
}

async function loadStats() {
  try {
    const res = await fetch('/api/admin/stats');
    const stats = await res.json();
    document.getElementById('totalUsers').textContent = stats.total_users;
    document.getElementById('totalCourses').textContent = stats.total_courses;
    document.getElementById('totalEnrollments').textContent = stats.total_enrollments;
    document.getElementById('pendingEnrollments').textContent = stats.pending_enrollments;
  } catch (e) {
    console.error('Stats error:', e);
  }
}

document.addEventListener('DOMContentLoaded', () => {
  loadStats();
  loadUsers();
  loadCoursesOverview();
  
  document.getElementById('userForm')?.addEventListener('submit', e => {
    e.preventDefault();
    createUser();
  });
  
  // Logout button
  document.querySelectorAll('.btn-logout, [onclick*="logout()"]').forEach(btn => {
    btn.addEventListener('click', e => {
      e.preventDefault();
      if (confirm('Logout?')) logout();
    });
  });
});
