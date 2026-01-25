# AIMS – Academic Information Management System

AIMS is a full-stack web application for managing academic information in a university setting. It provides role-based dashboards and workflows for students, instructors, advisors, and admins, covering course management, enrollments, and approvals.

## Features

### Core roles

- **Student**
  - Browse and filter available courses.
  - Submit enrollment requests for selected courses.
  - Track enrollment status through instructor and advisor approvals.
  - Drop courses that are approved or rejected.

- **Instructor**
  - Create, update, and manage offered courses.
  - View all enrollment requests for their courses.
  - Approve or reject enrollment requests.
  - Perform bulk approval/rejection actions using a modal interface.

- **Advisor**
  - View students assigned to the advisor.
  - Review enrollment requests requiring advisor approval.
  - Approve or reject enrollments with optional comments.
  - Advisor approval is enabled only after instructor approval.

- **Admin**
  - Manage users (students, instructors, advisors, admins).
  - Assign advisors to students.
  - Monitor system-wide metrics.
  - View active sessions and overall user counts.

### Enrollment workflow

- Student submits an enrollment request for a course.
- Instructor reviews and approves or rejects the request.
- Advisor reviews and approves or rejects the request (only after instructor approval).
- Final enrollment status is derived from instructor and advisor decisions.
- Every role sees a clear status badge (pending / approved / rejected).

### UI/UX

- Modern dashboard layout for each role.
- Stats cards with real data.
- Filterable tables (by status, department, course code, student).
- Modal for course-specific enrollments.

### Authentication & Security

- Secure two-factor authentication.
- Email-based login using OTP.
- Sessions handled server-side, with access control based on role.

## Tech Stack

- Backend: Node.js, Express
- Frontend: EJS templates, vanilla JavaScript, CSS
- Database: PostgreSQL
- Auth & Mail: Session-based auth, OTP via email (Nodemailer)
- Other: REST-style JSON APIs for dashboard data

## Getting Started

### Prerequisites

- Node.js (LTS recommended)
- PostgreSQL
- SMTP account for OTP emails

### Setup

1. Clone repository  
   - git clone https://github.com/AadarshDagur/AIMS.git  
   - cd AIMS

2. Install dependencies  
   - npm install

3. Configure environment variables (.env)  
   - PORT=3000  
   - DATABASE_URL=postgresql://username:password@localhost:5432/aims  
   - SESSION_SECRET=your_secret_key  
   - EMAIL_USER=your_email  
   - EMAIL_PASS=your_email_password

4. Create PostgreSQL database named "aims"

5. Seed database  
   - npm run seed

6. Start server  
   - node start

Server runs at http://localhost:3000

## Authors

- Adarsh Chaudhary
- Deepanshu
- Lavudya Sai Mani Chaitanya
- Atul Kharat

**B.Tech, Computer Science & Engineering**  
**Indian Institute of Technology, Ropar**
