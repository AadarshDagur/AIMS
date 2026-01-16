async function logout() {
  try {
    await fetch('/api/auth/logout', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    });
    window.location.href = '/login';
  } catch (e) {
    alert('Logout failed');
  }
}

function showTab(tab) {
  const tabs = ['courses', 'enrollments'];
  tabs.forEach(t => {
    document.getElementById(t + 'Tab').classList.toggle('active', t === tab);
    document
      .querySelector(`.tab-button[onclick="showTab('${t}')"]`)
      .classList.toggle('active', t === tab);
  });
}

async function loadDepartments() {
  const res = await fetch('/api/courses/departments');
  const departments = await res.json();
  const select = document.getElementById('filterDept');
  departments.forEach(d => {
    const opt = document.createElement('option');
    opt.value = d;
    opt.textContent = d;
    select.appendChild(opt);
  });
}

async function fetchCourses() {
  const params = new URLSearchParams();
  const dept = document.getElementById('filterDept').value;
  const code = document.getElementById('filterCode').value.trim();
  const title = document.getElementById('filterTitle').value.trim();

  if (dept) params.append('department', dept);
  if (code) params.append('code', code);
  if (title) params.append('title', title);

  const res = await fetch('/api/courses?' + params.toString());
  return res.json();
}

async function renderCourses() {
  const tbody = document.getElementById('coursesTable');
  tbody.innerHTML = '<tr><td colspan="7" class="text-center">Loading...</td></tr>';
  try {
    const courses = await fetchCourses();
    if (!courses.length) {
      tbody.innerHTML = '<tr><td colspan="7" class="text-center">No courses found</td></tr>';
      return;
    }
    tbody.innerHTML = '';
    courses.forEach(c => {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>${c.code}</td>
        <td>${c.title}</td>
        <td>${c.department}</td>
        <td>${c.instructor_name || '-'}</td>
        <td>${c.credits}</td>
        <td>${c.session}</td>
        <td><button class="btn-small" onclick="enroll(${c.id})">Enroll</button></td>
      `;
      tbody.appendChild(tr);
    });
  } catch (e) {
    tbody.innerHTML = '<tr><td colspan="7" class="text-center">Failed to load courses</td></tr>';
  }
}

async function enroll(courseId) {
  if (!confirm('Request enrollment for this course?')) return;
  try {
    const res = await fetch('/api/enrollments/enroll', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ course_id: courseId })
    });
    const data = await res.json();
    if (!res.ok) {
      alert(data.error || 'Failed to enroll');
      return;
    }
    alert('Enrollment request submitted');
    loadEnrollments();
  } catch (e) {
    alert('Server error');
  }
}

async function loadEnrollments() {
  const tbody = document.getElementById('enrollmentsTable');
  tbody.innerHTML = '<tr><td colspan="6" class="text-center">Loading...</td></tr>';
  try {
    const res = await fetch('/api/enrollments/student');
    const rows = await res.json();
    if (!rows.length) {
      tbody.innerHTML = '<tr><td colspan="6" class="text-center">No enrollments yet</td></tr>';
      return;
    }
    tbody.innerHTML = '';
    rows.forEach(e => {
      const finalStatus =
        e.instructor_status === 'approved' && e.advisor_status === 'approved'
          ? 'approved'
          : e.instructor_status === 'rejected' || e.advisor_status === 'rejected'
          ? 'rejected'
          : 'pending';

      const badgeClass =
        finalStatus === 'approved'
          ? 'badge-approved'
          : finalStatus === 'rejected'
          ? 'badge-rejected'
          : 'badge-pending';

      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>${e.course_code}</td>
        <td>${e.course_title}</td>
        <td>${e.enrolled_date}</td>
        <td><span class="badge badge-${e.instructor_status}">${e.instructor_status}</span></td>
        <td><span class="badge badge-${e.advisor_status}">${e.advisor_status}</span></td>
        <td><span class="badge ${badgeClass}">${finalStatus}</span></td>
      `;
      tbody.appendChild(tr);
    });
  } catch (e) {
    tbody.innerHTML = '<tr><td colspan="6" class="text-center">Failed to load enrollments</td></tr>';
  }
}

function searchCourses() {
  renderCourses();
}

document.addEventListener('DOMContentLoaded', () => {
  loadDepartments();
  renderCourses();
  loadEnrollments();
});
