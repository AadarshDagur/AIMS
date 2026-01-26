// ========= Globals =========
let allStudentEnrollments = [];
let availableCoursesCount = 0;

// ========= Auth =========
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

// ========= Tabs =========
function showTab(tab) {
  const tabs = ['courses', 'enrollments'];
  tabs.forEach(t => {
    document.getElementById(t + 'Tab').classList.toggle('active', t === tab);
    document
      .querySelector(`.tab-button[onclick="showTab('${t}')"]`)
      .classList.toggle('active', t === tab);
  });
}

// ========= Helpers =========
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

function formatDate(dateStr) {
  if (!dateStr) return 'N/A';
  const date = new Date(dateStr);
  return date.toLocaleDateString('en-IN', {
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  });
}

// ========= Stats =========
function updateStudentStats() {
  const totalEnrollmentsEl = document.getElementById('totalEnrollments');
  const approvedEnrollmentsEl = document.getElementById('approvedEnrollments');
  const pendingEnrollmentsEl = document.getElementById('pendingEnrollments');
  const availableCoursesEl = document.getElementById('availableCourses');

  if (!totalEnrollmentsEl || !approvedEnrollmentsEl || !pendingEnrollmentsEl || !availableCoursesEl) {
    return;
  }

  // Total enrollments
  totalEnrollmentsEl.textContent = allStudentEnrollments.length;

  const withFinal = allStudentEnrollments.map(e => {
    const finalStatus =
      e.instructor_status === 'approved' && e.advisor_status === 'approved'
        ? 'approved'
        : e.instructor_status === 'rejected' || e.advisor_status === 'rejected'
        ? 'rejected'
        : 'pending';
    return { ...e, finalStatus };
  });

  const approved = withFinal.filter(e => e.finalStatus === 'approved');
  const pending = withFinal.filter(e => e.finalStatus === 'pending');

  approvedEnrollmentsEl.textContent = approved.length;
  pendingEnrollmentsEl.textContent = pending.length;

  // Available courses (from last fetch)
  availableCoursesEl.textContent = availableCoursesCount;
}

// ========= Courses (Available) =========
async function renderCourses() {
  const tbody = document.getElementById('coursesTable');
  tbody.innerHTML = '<tr><td colspan="7" class="text-center">Loading...</td></tr>';
  try {
    const courses = await fetchCourses();

    availableCoursesCount = Array.isArray(courses) ? courses.length : 0;
    updateStudentStats();

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

// ========= Enrollments (My Enrollments) =========
// status filter helper
function passesStatusFilter(enrollment) {
  const select = document.getElementById('statusFilter');
  if (!select) return true;
  const filter = select.value; // 'all' | 'pending' | 'approved' | 'rejected'

  const finalStatus =
    enrollment.instructor_status === 'approved' && enrollment.advisor_status === 'approved'
      ? 'approved'
      : enrollment.instructor_status === 'rejected' || enrollment.advisor_status === 'rejected'
      ? 'rejected'
      : 'pending';

  if (filter === 'all') return true;
  return finalStatus === filter;
}

// drop course
async function dropEnrollment(enrollmentId) {
  if (!confirm('Are you sure you want to drop this course?')) return;
  try {
    const res = await fetch(`/api/enrollments/drop/${enrollmentId}`, {
      method: 'DELETE'
    });
    const data = await res.json();
    if (!res.ok) {
      alert(data.error || 'Failed to drop course');
      return;
    }
    alert('Course dropped successfully');
    loadEnrollments();
  } catch (e) {
    alert('Server error');
  }
}

async function loadEnrollments() {
  const tbody = document.getElementById('enrollmentsTable');
  tbody.innerHTML = '<tr><td colspan="7" class="text-center">Loading...</td></tr>';
  try {
    const res = await fetch('/api/enrollments/student');
    const rows = await res.json();

    allStudentEnrollments = Array.isArray(rows) ? rows : [];
    updateStudentStats();

    if (!rows.length) {
      tbody.innerHTML = '<tr><td colspan="7" class="text-center">No enrollments yet</td></tr>';
      return;
    }

    tbody.innerHTML = '';
    rows
      .filter(passesStatusFilter)
      .forEach(e => {
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

        const canDrop = finalStatus !== 'rejected';

        const tr = document.createElement('tr');
        tr.innerHTML = `
          <td>${e.course_code}</td>
          <td>${e.course_title}</td>
          <td>${formatDate(e.enrolled_date)}</td>
          <td><span class="badge badge-${e.instructor_status}">${e.instructor_status}</span></td>
          <td><span class="badge badge-${e.advisor_status}">${e.advisor_status}</span></td>
          <td><span class="badge ${badgeClass}">${finalStatus}</span></td>
          <td>
            ${
              canDrop
                ? `<button class="btn-small reject" onclick="dropEnrollment(${e.id})">Drop</button>`
                : '-'
            }
          </td>
        `;
        tbody.appendChild(tr);
      });
  } catch (e) {
    tbody.innerHTML = '<tr><td colspan="7" class="text-center">Failed to load enrollments</td></tr>';
  }
}

// ========= Filters =========
function searchCourses() {
  renderCourses();
}

function applyEnrollmentFilter() {
  loadEnrollments();
}

// ========= Initial load =========
document.addEventListener('DOMContentLoaded', () => {
  loadDepartments();
  renderCourses();
  loadEnrollments();
});
