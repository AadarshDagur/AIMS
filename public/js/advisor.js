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

async function loadAdvisorEnrollments() {
  const tbody = document.getElementById('advisorEnrollmentsTable');
  tbody.innerHTML = '<tr><td colspan="8" class="text-center">Loading...</td></tr>';
  try {
    const res = await fetch('/api/enrollments/advisor/pending');
    const rows = await res.json();
    if (!rows.length) {
      tbody.innerHTML = '<tr><td colspan="8" class="text-center">No pending enrollments</td></tr>';
      return;
    }
    tbody.innerHTML = '';
    rows.forEach(e => {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>${e.student_name}</td>
        <td>${e.student_user_id}</td>
        <td>${e.department}</td>
        <td>${e.course_code} - ${e.course_title}</td>
        <td><span class="badge badge-${e.instructor_status}">${e.instructor_status}</span></td>
        <td><span class="badge badge-${e.advisor_status}">${e.advisor_status}</span></td>
        <td>
          <input type="text" placeholder="Comment" data-comment-for="${e.id}" />
        </td>
        <td>
          <button class="btn-small approve" onclick="updateAdvisorEnrollment(${e.id}, 'approved')">Approve</button>
          <button class="btn-small reject" onclick="updateAdvisorEnrollment(${e.id}, 'rejected')">Reject</button>
        </td>
      `;
      tbody.appendChild(tr);
    });
  } catch (e) {
    tbody.innerHTML = '<tr><td colspan="8" class="text-center">Failed to load</td></tr>';
  }
}

async function updateAdvisorEnrollment(id, status) {
  const input = document.querySelector(`input[data-comment-for="${id}"]`);
  const comment = input ? input.value.trim() : '';
  try {
    const res = await fetch(`/api/enrollments/advisor/approve/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status, comment })
    });
    if (!res.ok) {
      const data = await res.json();
      alert(data.error || 'Update failed');
      return;
    }
    loadAdvisorEnrollments();
  } catch (e) {
    alert('Server error');
  }
}

document.addEventListener('DOMContentLoaded', () => {
  loadAdvisorEnrollments();
});
