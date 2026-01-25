// ===== Globals for stats =====
let advisorEnrollments = [];
let assignedStudents = [];

// ===== Auth =====
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

// ===== Helpers =====
function formatDate(dateStr) {
  if (!dateStr) return 'N/A';
  const date = new Date(dateStr);
  return date.toLocaleDateString('en-IN', {
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  });
}

// ----- Stats updater -----
function updateAdvisorStats() {
  const totalStudentsEl = document.getElementById('totalStudents');
  const pendingApprovalsEl = document.getElementById('pendingApprovals');
  const approvedApprovalsEl = document.getElementById('approvedApprovals');
  const totalEnrollmentsEl = document.getElementById('totalEnrollments');

  if (!totalStudentsEl || !pendingApprovalsEl || !approvedApprovalsEl || !totalEnrollmentsEl) {
    return;
  }

  // Total Students = assignedStudents.length
  totalStudentsEl.textContent = assignedStudents.length;

  // Pending Approvals = advisor_status === 'pending'
  const pending = advisorEnrollments.filter(e => e.advisor_status === 'pending');
  pendingApprovalsEl.textContent = pending.length;
  // Total Enrollments = all enrollments (any advisor_status)
  totalEnrollmentsEl.textContent = advisorEnrollments.length;

  // Approved Today = advisor_status === 'approved' and enrolled_date within last 24h
  const approved = advisorEnrollments.filter(e => e.advisor_status === 'approved');
  approvedApprovalsEl.textContent = approved.length;
}

// ===== Enrollment Approvals =====
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

    // cache for stats
    advisorEnrollments = Array.isArray(rows) ? rows : [];

    if (!advisorEnrollments.length) {
      tbody.innerHTML = '<tr><td colspan="8" class="text-center">No pending enrollments</td></tr>';
      updateAdvisorStats();
      return;
    }

    tbody.innerHTML = '';
    advisorEnrollments.forEach(e => {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>${e.student_name}</td>
        <td>${e.student_user_id}</td>
        <td>${e.course_code}</td>
        <td>${e.course_title}</td>
        <td><span class="badge badge-${e.instructor_status}">${e.instructor_status}</span></td>
        <td>${formatDate(e.enrolled_date)}</td>
        <td><span class="badge badge-${e.advisor_status}">${e.advisor_status}</span></td>
        <td>
          <button class="btn-small approve" onclick="updateAdvisorEnrollment(${e.id}, 'approved')">Approve</button>
          <button class="btn-small reject" onclick="updateAdvisorEnrollment(${e.id}, 'rejected')">Reject</button>
        </td>
      `;
      tbody.appendChild(tr);
    });

    updateAdvisorStats();
  } catch (e) {
    console.error('Load advisor enrollments error:', e);
    tbody.innerHTML = '<tr><td colspan="8" class="text-center">Failed to load</td></tr>';
    updateAdvisorStats();
  }
}

async function updateAdvisorEnrollment(id, status) {
  try {
    const res = await fetch(`/api/enrollments/advisor/approve/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status })
    });
    if (!res.ok) {
      const data = await res.json();
      alert(data.error || 'Update failed');
      return;
    }
    await loadAdvisorEnrollments(); // will refresh stats
  } catch (e) {
    alert('Server error');
  }
}

// ===== My Students =====
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

    // cache for stats
    assignedStudents = Array.isArray(rows) ? rows : [];

    if (!assignedStudents.length) {
      tbody.innerHTML = '<tr><td colspan="6" class="text-center">No assigned students</td></tr>';
      updateAdvisorStats();
      return;
    }

    tbody.innerHTML = '';
    assignedStudents.forEach(s => {
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

    updateAdvisorStats();
  } catch (e) {
    console.error('Load assigned students error:', e);
    tbody.innerHTML = '<tr><td colspan="6" class="text-center">Error loading students</td></tr>';
    updateAdvisorStats();
  }
}

// ===== Filters & Tabs =====
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
  } else if (tab === 'students') {
    loadAssignedStudents();
  }
}

// ===== Initial load =====
document.addEventListener('DOMContentLoaded', () => {
  loadAdvisorEnrollments();
  loadAssignedStudents();
});
