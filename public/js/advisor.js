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

async function loadAdvisorEnrollments(filters = {}) {
  const tbody = document.getElementById('advisorEnrollmentsTable');
  if (!tbody) {
    console.error('Element #advisorEnrollmentsTable not found');
    return;
  }

  tbody.innerHTML = '<tr><td colspan="8" class="text-center">Loading...</td></tr>';

  try {
    const params = new URLSearchParams(filters);
    const res = await fetch(`/api/enrollments/advisor/pending?${params}`);
    if (!res.ok) {
      throw new Error(`HTTP ${res.status}: ${res.statusText}`);
    }
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
        <td><span class="badge badge-${e.advisor_status}">${e.advisor_status}</span></td>
        <td>
          <button class="btn-small approve" onclick="updateAdvisorEnrollment(${e.id}, 'approved')">Approve</button>
          <button class="btn-small reject" onclick="updateAdvisorEnrollment(${e.id}, 'rejected')">Reject</button>
        </td>
      `;
      tbody.appendChild(tr);
    });
  } catch (e) {
    console.error('Load advisor enrollments error:', e);
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

async function loadAssignedStudents(filters = {}) {
  const tbody = document.getElementById('studentsTable');
  if (!tbody) {
    console.error('Element #studentsTable not found');
    return;
  }

  tbody.innerHTML = '<tr><td colspan="6" class="text-center">Loading...</td></tr>';

  try {
    const params = new URLSearchParams(filters);
    const res = await fetch(`/api/enrollments/advisor/students?${params}`);
    if (!res.ok) {
      throw new Error(`HTTP ${res.status}: ${res.statusText}`);
    }
    const rows = await res.json();

    if (!rows.length) {
      tbody.innerHTML = '<tr><td colspan="6" class="text-center">No assigned students</td></tr>';
      return;
    }

    tbody.innerHTML = '';
    rows.forEach(s => {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>${s.student_user_id}</td>
        <td>${s.student_name}</td>
        <td>${s.email}</td>
        <td>0</td>
        <td>0</td>
      `;
      tbody.appendChild(tr);
    });
  } catch (e) {
    console.error('Load assigned students error:', e);
    tbody.innerHTML = '<tr><td colspan="6" class="text-center">Error loading students</td></tr>';
  }
}

function searchStudents() {
  const search = document.getElementById('searchStudent').value;
  loadAssignedStudents({ search });
}

function applyApprovalFilter() {
  const status = document.getElementById('approvalStatusFilter').value;
  const search = document.getElementById('searchApprovalStudent').value;
  loadAdvisorEnrollments({ status, search });
}

function showTab(tab) {
  document.querySelectorAll('.tab-content').forEach(t => t.classList.remove('active'));
  document.querySelectorAll('.tab-button').forEach(b => b.classList.remove('active'));
  document.getElementById(tab + 'Tab').classList.add('active');
  event.target.closest('.tab-button').classList.add('active');

  if (tab === 'approvals') {
    loadAdvisorEnrollments();
  }
}

document.addEventListener('DOMContentLoaded', () => {
  loadAdvisorEnrollments();
  loadAssignedStudents();
});
