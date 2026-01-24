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
  const tabs = ['myCourses', 'approvals'];
  tabs.forEach(t => {
    document.getElementById(t + 'Tab').classList.toggle('active', t === tab);
    document
      .querySelector(`.tab-button[onclick="showTab('${t}')"]`)
      .classList.toggle('active', t === tab);
  });
}

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

    const myCourses = courses.filter(c => c.instructor_id === userId);

    if (!myCourses.length) {
      container.innerHTML = '<p class="text-center">No courses yet</p>';
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
        <button class="btn-small" onclick="showCourseEnrollments(${c.id}, '${c.code}', '${c.title}')">
          View Enrollments
        </button>
      `;
      container.appendChild(card);
    });
  } catch (e) {
    console.error('Load my courses error:', e);
    container.innerHTML = '<p class="text-center">Failed to load courses</p>';
  }
}


function formatDate(dateStr) {
  if (!dateStr) return 'N/A';
  const date = new Date(dateStr);
  return date.toLocaleDateString('en-IN', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
}

async function loadInstructorEnrollments() {
  const tbody = document.getElementById('instructorEnrollmentsTable');
  tbody.innerHTML = '<tr><td colspan="7" class="text-center">Loading...</td></tr>';
  try {
    const res = await fetch('/api/enrollments/instructor/pending');
    const rows = await res.json();
    if (!rows.length) {
      tbody.innerHTML = '<tr><td colspan="7" class="text-center">No requests</td></tr>';
      return;
    }
    tbody.innerHTML = '';
    rows.forEach(e => {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>${e.student_name}</td>
        <td>${e.student_user_id}</td>
        <td>${e.course_code} - ${e.course_title}</td>
        <td>${formatDate(e.enrolled_date)}</td>
        <td><span class="badge badge-${e.instructor_status}">${e.instructor_status}</span></td>
        <td>
          <button class="btn-small approve" onclick="updateEnrollment(${e.id}, 'approved')">Approve</button>
          <button class="btn-small reject" onclick="updateEnrollment(${e.id}, 'rejected')">Reject</button>
        </td>
      `;
      tbody.appendChild(tr);
    });
  } catch (e) {
    tbody.innerHTML = '<tr><td colspan="7" class="text-center">Failed to load</td></tr>';
  }
}

async function updateEnrollment(id, status) {
  const input = document.querySelector(`input[data-comment-for="${id}"]`);
  const comment = input ? input.value.trim() : '';
  try {
    const res = await fetch(`/api/enrollments/instructor/approve/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status, comment })
    });
    if (!res.ok) {
      const data = await res.json();
      alert(data.error || 'Update failed');
      return;
    }
    loadInstructorEnrollments();
  } catch (e) {
    alert('Server error');
  }
}

async function showCourseEnrollments(courseId, courseCode, courseTitle) {
  const modal = document.getElementById('courseEnrollmentsModal');
  if (!modal) {
    console.error('Element #courseEnrollmentsModal not found');
    return;
  }

  modal.style.display = 'block';
  modal.querySelector('.modal-title').textContent = `${courseCode} – ${courseTitle}`;

  const tbody = modal.querySelector('#courseEnrollmentsTable');
  tbody.innerHTML = '<tr><td colspan="7" class="text-center">Loading...</td></tr>';

  try {
    const res = await fetch(`/api/enrollments/instructor/pending?course_id=${courseId}`);
    if (!res.ok) {
      throw new Error(`HTTP ${res.status}: ${res.statusText}`);
    }
    const rows = await res.json();

    if (!rows.length) {
      tbody.innerHTML = '<tr><td colspan="7" class="text-center">No enrollments</td></tr>';
      return;
    }

    tbody.innerHTML = '';
    rows.forEach(e => {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>${e.student_name}</td>
        <td>${e.student_user_id}</td>
        <td>${e.course_code} - ${e.course_title}</td>
        <td>${formatDate(e.enrolled_date)}</td>
        <td><span class="badge badge-${e.instructor_status}">${e.instructor_status}</span></td>
        <td>
          <label>
            <input type="checkbox" name="enrollment" value="${e.id}">
          </label>
        </td>
      `;
      tbody.appendChild(tr);
    });
  } catch (e) {
    console.error('Load course enrollments error:', e);
    tbody.innerHTML = '<tr><td colspan="7" class="text-center">Failed to load</td></tr>';
  }
}

function closeModal() {
  const modal = document.getElementById('courseEnrollmentsModal');
  if (modal) modal.style.display = 'none';
}

async function bulkApprove() {
  const checked = document.querySelectorAll('input[name="enrollment"]:checked');
  const ids = Array.from(checked).map(input => Number(input.value));
  if (!ids.length) return;

  try {
    const res = await fetch('/api/enrollments/instructor/bulk-approve', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ids, status: 'approved' })
    });

    if (!res.ok) {
      const data = await res.json();
      alert(data.error || 'Bulk approve failed');
      return;
    }

    loadInstructorEnrollments();
    checked.forEach(input => input.closest('tr').remove());
  } catch (e) {
    alert('Server error');
  }
}

async function bulkReject() {
  const checked = document.querySelectorAll('input[name="enrollment"]:checked');
  const ids = Array.from(checked).map(input => Number(input.value));
  if (!ids.length) return;

  try {
    const res = await fetch('/api/enrollments/instructor/bulk-approve', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ids, status: 'rejected' })
    });

    if (!res.ok) {
      const data = await res.json();
      alert(data.error || 'Bulk reject failed');
      return;
    }

    loadInstructorEnrollments();
    checked.forEach(input => input.closest('tr').remove());
  } catch (e) {
    alert('Server error');
  }
}

document.addEventListener('DOMContentLoaded', () => {
  loadMyCourses();
  loadInstructorEnrollments();

  document.getElementById('createCourseForm').addEventListener('submit', async e => {
    e.preventDefault();
    const messageEl = document.getElementById('createCourseMessage');
    messageEl.textContent = 'Saving...';

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
        messageEl.textContent = data.error || 'Failed to create course';
        return;
      }
      messageEl.textContent = 'Course created successfully';
      e.target.reset();
      loadMyCourses();
    } catch (err) {
      messageEl.textContent = 'Server error';
    }
  });
});
