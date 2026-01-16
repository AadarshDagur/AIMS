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
  const tbody = document.getElementById('instructorCoursesTable');
  tbody.innerHTML = '<tr><td colspan="5" class="text-center">Loading...</td></tr>';
  try {
    // Filter by nothing, but backend will use session.user.id through instructor_id when creating.
    const res = await fetch('/api/courses');
    const courses = await res.json();
    // Filter client-side to this instructor
    const userRes = await fetch('/api/auth/current-user');
    const user = await userRes.json();
    const my = courses.filter(c => c.instructor_id === user.id);

    if (!my.length) {
      tbody.innerHTML = '<tr><td colspan="5" class="text-center">No courses yet</td></tr>';
      return;
    }
    tbody.innerHTML = '';
    my.forEach(c => {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>${c.code}</td>
        <td>${c.title}</td>
        <td>${c.department}</td>
        <td>${c.credits}</td>
        <td>${c.session}</td>
      `;
      tbody.appendChild(tr);
    });
  } catch (e) {
    tbody.innerHTML = '<tr><td colspan="5" class="text-center">Failed to load</td></tr>';
  }
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
        <td>${e.enrolled_date}</td>
        <td><span class="badge badge-${e.instructor_status}">${e.instructor_status}</span></td>
        <td>
          <input type="text" placeholder="Comment" data-comment-for="${e.id}" />
        </td>
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
