// =========================
// Globals
// =========================
let myCourses = [];
let allEnrollments = [];

// =========================
// Auth
// =========================
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

// =========================
function showTab(tab) {
  const tabs = ['myCourses', 'approvals'];
  tabs.forEach(t => {
    document.getElementById(t + 'Tab').classList.toggle('active', t === tab);
    document
      .querySelector(`.tab-button[onclick="showTab('${t}')"]`)
      .classList.toggle('active', t === tab);
  });
}

// =========================
// Helpers
// =========================
function formatDate(dateStr) {
  if (!dateStr) return 'N/A';
  const date = new Date(dateStr);
  return date.toLocaleDateString('en-IN', {
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  });
}

// ---- Dashboard stats ----
function updateDashboardStats(courses, enrollments) {
  const totalCoursesEl = document.getElementById('totalCourses');
  const pendingRequestsEl = document.getElementById('pendingRequests');
  const totalEnrollmentsEl = document.getElementById('totalEnrollments');
  const activeStudentsEl = document.getElementById('activeStudents');

  if (!totalCoursesEl || !pendingRequestsEl || !totalEnrollmentsEl || !activeStudentsEl) {
    return;
  }

  // Total Courses = courses taught by this instructor
  totalCoursesEl.textContent = courses.length;

  // Pending Requests = enrollments where instructor_status === 'pending'
  const pending = enrollments.filter(e => e.instructor_status === 'pending');
  pendingRequestsEl.textContent = pending.length;

  // Total Requets = all requests for these courses
  totalEnrollmentsEl.textContent = enrollments.length;

  // Active Students = distinct student_id where instructor_status === 'approved'
  const activeStudentIds = new Set(
    enrollments
      .filter(e => e.instructor_status === 'approved')
      .map(e => e.student_id)
  );
  activeStudentsEl.textContent = activeStudentIds.size;
}

// =========================
// My Courses
// =========================
async function loadMyCourses() {
  const container = document.getElementById('instructorCoursesContainer');
  if (!container) {
    console.error('Element #instructorCoursesContainer not found');
    return;
  }

  container.innerHTML = '<div class="loading">Loading courses...</div>';

  try {
    const coursesRes = await fetch('/api/courses');
    if (!coursesRes.ok) {
      throw new Error(`HTTP ${coursesRes.status}: ${coursesRes.statusText}`);
    }
    const courses = await coursesRes.json();

    const userId = window.currentUser?.id;
    if (!userId) {
      throw new Error('currentUser.id not available');
    }

    // Save globally
    myCourses = courses.filter(c => c.instructor_id === userId);

    if (!myCourses.length) {
      container.innerHTML = '<p class="text-center">No courses yet</p>';
      // Update stats with no courses
      updateDashboardStats(myCourses, allEnrollments);
      return;
    }

    container.innerHTML = '';
    myCourses.forEach(c => {
      const card = document.createElement('div');
      card.className = 'course-card';
      card.dataset.courseId = c.id;
      card.dataset.courseCode = c.code;
      card.innerHTML = `
        <h3>${c.code} – ${c.title}</h3>
        <p><strong>Department:</strong> ${c.department}</p>
        <p><strong>Credits:</strong> ${c.credits}</p>
        <p><strong>Session:</strong> ${c.session}</p>
        <button class="btn-small" onclick="showCourseEnrollments(${c.id}, '${c.code}', '${c.title.replace(/'/g, "\\'")}')">
          View Enrollments
        </button>
      `;
      container.appendChild(card);
    });

    // Update stats after courses load
    updateDashboardStats(myCourses, allEnrollments);
  } catch (e) {
    console.error('Load my courses error:', e);
    container.innerHTML = '<p class="text-center">Failed to load courses</p>';
  }
}

// =========================
// Enrollment Requests (main table)
// =========================

// loadInstructorEnrollments with global allEnrollments + client filter
async function loadInstructorEnrollments() {
  const tbody = document.getElementById('instructorEnrollmentsTable');
  tbody.innerHTML = '<tr><td colspan="7" class="text-center">Loading...</td></tr>';
  try {
    // Backend should return all statuses for this instructor
    const res = await fetch('/api/enrollments/instructor/pending?status=all');
    const rows = await res.json();

    allEnrollments = Array.isArray(rows) ? rows : [];

    renderEnrollmentsTable(allEnrollments);

    // Update stats after enrollments load
    updateDashboardStats(myCourses, allEnrollments);
  } catch (e) {
    console.error('loadInstructorEnrollments error:', e);
    tbody.innerHTML = '<tr><td colspan="7" class="text-center">Failed to load</td></tr>';
  }
}

function applyApprovalFilter() {
  const filter = document.getElementById('approvalStatusFilter').value;
  let filtered;

  if (filter === 'all') {
    filtered = allEnrollments;
  } else {
    filtered = allEnrollments.filter(e => e.instructor_status === filter);
  }

  renderEnrollmentsTable(filtered);
}

function renderEnrollmentsTable(rows) {
  const tbody = document.getElementById('instructorEnrollmentsTable');
  if (!rows || !rows.length) {
    tbody.innerHTML = '<tr><td colspan="7" class="text-center">No requests</td></tr>';
    return;
  }

  tbody.innerHTML = '';
  rows.forEach(e => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${e.student_name}</td>
      <td>${e.student_user_id}</td>
      <td>${e.course_code}</td>
      <td>${e.course_title}</td>
      <td>${formatDate(e.enrolled_date)}</td>
      <td><span class="badge badge-${e.instructor_status}">${e.instructor_status}</span></td>
      <td>
        <button class="btn-small approve" onclick="updateEnrollment(${e.id}, 'approved')">Approve</button>
        <button class="btn-small reject" onclick="updateEnrollment(${e.id}, 'rejected')">Reject</button>
      </td>
    `;
    tbody.appendChild(tr);
  });
}

async function updateEnrollment(id, status) {
  try {
    const res = await fetch(`/api/enrollments/instructor/approve/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status })
    });
    if (!res.ok) {
      const data = await res.json();
      alert(data.error || 'Update failed');
      return;
    }
    await loadInstructorEnrollments();
  } catch (e) {
    console.error('updateEnrollment error:', e);
    alert('Server error');
  }
}

// =========================
// Course-specific modal
// =========================
async function showCourseEnrollments(courseId, courseCode, courseTitle) {
  const modal = document.getElementById('courseEnrollmentsModal');
  if (!modal) {
    console.error('Element #courseEnrollmentsModal not found');
    return;
  }

  modal.style.display = 'flex';

  const titleEl = document.getElementById('modalCourseTitle');
  if (titleEl) {
    titleEl.textContent = `${courseCode} – ${courseTitle}`;
  }

  const tbody = modal.querySelector('#courseEnrollmentsTable tbody') ||
                modal.querySelector('#courseEnrollmentsTable');
  if (!tbody) {
    console.error('#courseEnrollmentsTable body not found');
    return;
  }

  tbody.innerHTML = '<tr><td colspan="6" class="text-center">Loading...</td></tr>';

  try {
    const res = await fetch(`/api/enrollments/instructor/pending?course_id=${courseId}&status=all`);
    if (!res.ok) {
      throw new Error(`HTTP ${res.status}: ${res.statusText}`);
    }
    const rows = await res.json();

    if (!rows.length) {
      tbody.innerHTML = '<tr><td colspan="6" class="text-center">No enrollments</td></tr>';
      return;
    }

    tbody.innerHTML = '';
    rows.forEach(e => {
      const tr = document.createElement('tr');
      tr.dataset.id = e.id;
      tr.innerHTML = `
        <td>${e.student_name}</td>
        <td>${e.student_user_id}</td>
        <td>${e.course_code} - ${e.course_title}</td>
        <td>${formatDate(e.enrolled_date)}</td>
        <td><span class="badge badge-${e.instructor_status}">${e.instructor_status}</span></td>
        <td>
          <label>
            <input type="checkbox" class="enrollment-checkbox" value="${e.id}">
          </label>
        </td>
      `;
      tbody.appendChild(tr);
    });

    const selectAll = document.getElementById('selectAll');
    if (selectAll) {
      selectAll.checked = false;
      selectAll.onchange = () => toggleSelectAll();
    }
  } catch (e) {
    console.error('Load course enrollments error:', e);
    tbody.innerHTML = '<tr><td colspan="6" class="text-center">Failed to load</td></tr>';
  }
}

function closeModal() {
  const modal = document.getElementById('courseEnrollmentsModal');
  if (modal) modal.style.display = 'none';
}

function toggleSelectAll() {
  const selectAll = document.getElementById('selectAll');
  const checkboxes = document.querySelectorAll('.enrollment-checkbox');
  const checked = !!selectAll && selectAll.checked;
  checkboxes.forEach(cb => cb.checked = checked);
}

async function bulkUpdate(status) {
  const checkboxes = document.querySelectorAll('.enrollment-checkbox:checked');
  const ids = Array.from(checkboxes).map(cb => Number(cb.value));
  if (!ids.length) return;

  try {
    const res = await fetch('/api/enrollments/instructor/bulk-approve', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ids, status })
    });

    if (!res.ok) {
      const data = await res.json();
      alert(data.error || 'Bulk update failed');
      return;
    }

    const result = await res.json();
    console.log('Updated:', result.updated);

    checkboxes.forEach(cb => {
      const row = cb.closest('tr');
      const badge = row.querySelector('.badge');
      badge.textContent = status;
      badge.className = `badge badge-${status}`;
      cb.disabled = true;
    });

    await loadInstructorEnrollments();
  } catch (e) {
    console.error('bulkUpdate error:', e);
    alert('Server error');
  }
}

// =========================
// Create course form
// =========================
document.addEventListener('DOMContentLoaded', () => {
  loadMyCourses();
  loadInstructorEnrollments();

  const form = document.getElementById('createCourseForm');
  if (!form) return;

  form.addEventListener('submit', async e => {
    e.preventDefault();
    const messageEl = document.getElementById('createCourseMessage');
    if (messageEl) messageEl.textContent = 'Saving...';

    const body = {
      code: document.getElementById('courseCode').value.trim(),
      title: document.getElementById('courseTitle').value.trim(),
      department: document.getElementById('courseDept').value.trim(),
      credits: Number(document.getElementById('courseCredits').value),
      session: document.getElementById('courseSession').value.trim()
    };

    try {
      const res = await fetch('/api/courses', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });
      const data = await res.json();
      if (!res.ok) {
        if (messageEl) messageEl.textContent = data.error || 'Failed to create course';
        return;
      }
      if (messageEl) messageEl.textContent = 'Course created successfully';
      form.reset();
      await loadMyCourses();
    } catch (err) {
      console.error('Create course error:', err);
      if (messageEl) messageEl.textContent = 'Server error';
    }
  });
});
