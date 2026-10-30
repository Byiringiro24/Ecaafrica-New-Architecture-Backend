# API_doc - Education Care Africa Backend

## Base URL and Docs

- Base path: /api/v1
- Swagger UI: /api/docs

## Local Redis (Queues)

Run Redis locally for background jobs (notifications and SMS) when developing:

```bash
docker start ecare-redis
docker run -d --name ecare-redis -p 6379:6379 redis:7-alpine
```

Why: the backend uses Redis-backed queues (BullMQ) for notification and SMS workers. Without Redis, those workers cannot connect and job processing will fail.

## Authentication

- School endpoints use JWT access tokens issued by /auth/login.
- Platform endpoints use JWT access tokens issued by /auth/platform/login.
- Send tokens using the Authorization header: Bearer `<accessToken>`

## Response Envelope

Success response:

```json
{
  "success": true,
  "data": {},
  "meta": {
    "page": 1,
    "limit": 20,
    "total": 1
  }
}
```

Error response:

```json
{
  "success": false,
  "error": {
    "code": "bad_request",
    "message": "Validation failed",
    "details": ["field is required"]
  }
}
```

## Pagination and Filtering

Most list endpoints accept:

- page (default 1)
- limit (default 20, max 100)
- sort
- order (asc | desc)
- q (search)

Additional filters are listed per endpoint.

## File Uploads

- POST /api/v1/students/import uses multipart/form-data with field name file.
- POST /api/v1/students/:id/photo uses multipart/form-data with field name photo.
- POST /api/v1/fees/transactions/:id/receipt uses multipart/form-data with field name receipt.

## Enum Values (Reference)

- SchoolType: government, private, international, technical, seminary, other
- SchoolStatus: active, trial, grace, suspended, expired, cancelled
- BillingCycle: monthly, annual, term, weekly, daily
- SchoolSubscriptionStatus: active, trial, grace, expired, cancelled, pending
- InvoiceStatus: draft, issued, paid, overdue, void, refunded
- PlatformUserRole: platform_admin, support
- PlatformUserAccessScope: all, assigned
- PlatformUserStatus: active, inactive, locked
- AnnouncementType: info, warning, critical, maintenance, feature
- AnnouncementTargetScope: all, plan, province, specific
- AnnouncementStatus: draft, scheduled, sent
- SupportTicketCategory: technical, billing, feature_request, other
- SupportTicketPriority: low, medium, high, critical
- SupportTicketStatus: open, in_progress, resolved, closed
- SupportTicketSenderType: school_user, platform_user
- UserRole: school_admin, teacher, staff, parent, student
- UserStatus: active, inactive, locked, pending
- HolidayType: national, school, exam, other
- Gender: male, female, other
- StudentType: boarding, day
- StudentStatus: active, inactive, transferred, graduated, expelled
- EnrollmentStatus: active, transferred, dropped
- BiometricType: face, fingerprint, card_nfc, card_qr
- StaffContractType: permanent, contract, part_time
- EmploymentStatus: active, on_leave, inactive
- SalaryStatus: pending, paid, cancelled
- AttendanceSessionType: class, gate, boarding_morning, boarding_evening
- AttendanceStatus: present, absent, late, excused
- ScanMethod: manual, nfc, qr, face, fingerprint
- GateEventType: entry, exit
- OfflineRecordType: gate_log, attendance_record, boarding_roll
- OfflineSyncStatus: pending, processing, synced, failed
- DormGender: male, female
- BoardingSessionType: morning, evening
- BoardingRollStatus: present, absent, on_leave
- StudentLeaveType: weekend, emergency, medical, family, other
- StudentLeaveStatus: pending, approved, rejected, cancelled
- AbsenceAlertType: gate_exit_no_return, boarding_absent, consecutive_absent, leave_overdue, unauthorized_exit
- AlertSeverity: low, medium, high
- AlertStatus: active, resolved
- VisitorType: parent_guardian, organization
- VisitorPurpose: parent_visit, official_business, delivery, inspection, other
- VisitorAppointmentStatus: pending, confirmed, cancelled, completed
- FeeAssignmentStatus: unpaid, partial, paid, waived, overdue
- PaymentMethod: cash, mtn_momo, airtel_money, bank_transfer, cheque, other
- ExamType: cat, main_exam, mock, quiz, assignment
- ExamStatus: scheduled, ongoing, completed, cancelled
- NotificationRecipientType: parent, student, staff, admin, school
- NotificationChannel: sms, email, push, in_app
- NotificationLanguage: en, kin
- NotificationStatus: queued, sent, delivered, failed, retry
- AuditActorType: platform_user, school_user, system, api
- AuditSeverity: info, warning, critical
- SystemSettingType: string, integer, boolean, json
- DeviceType: tablet, kiosk, web
- DeviceMode: gate, boarding, classroom

## Endpoints

### Auth

#### POST /api/v1/auth/login

Auth: none

Request body:

```json
{
  "email": "admin@school.test",
  "password": "password123"
}
```

Response 200:

```json
{
  "success": true,
  "data": {
    "user": {
      "id": "1",
      "uuid": "user-uuid",
      "school_id": "10",
      "name": "School Admin",
      "email": "admin@school.test",
      "phone": "+250700000000",
      "role": "school_admin",
      "status": "active",
      "avatar_url": null,
      "roles": [
        {
          "id": "2",
          "name": "School Admin",
          "slug": "school_admin",
          "permissions": ["users:view"],
          "is_system": true
        }
      ]
    },
    "accessToken": "jwt-access",
    "refreshToken": "jwt-refresh"
  }
}
```

#### POST /api/v1/auth/platform/login

Auth: none

Request body:

```json
{
  "email": "admin@platform.test",
  "password": "password123"
}
```

Response 200:

```json
{
  "success": true,
  "data": {
    "user": {
      "id": "1",
      "uuid": "platform-uuid",
      "name": "Platform Admin",
      "email": "admin@platform.test",
      "role": "platform_admin",
      "status": "active",
      "access_scope": "all",
      "permissions": []
    },
    "accessToken": "jwt-access",
    "refreshToken": "jwt-refresh"
  }
}
```

#### POST /api/v1/auth/logout

Auth: School or Platform JWT

Request body (optional):

```json
{
  "sessionId": "123",
  "refreshToken": "jwt-refresh"
}
```

Response 200:

```json
{
  "success": true,
  "data": {"message": "Logged out"}
}
```

#### POST /api/v1/auth/refresh

Auth: none

Request body:

```json
{
  "refreshToken": "jwt-refresh"
}
```

Response 200: same shape as login.

#### POST /api/v1/auth/forgot-password

Auth: none

Request body:

```json
{
  "email": "admin@school.test"
}
```

Response 200:

```json
{
  "success": true,
  "data": {"message": "If the account exists, a reset link was sent."}
}
```

#### POST /api/v1/auth/reset-password

Auth: none

Request body:

```json
{
  "token": "reset-token",
  "newPassword": "NewPass123",
  "confirmPassword": "NewPass123"
}
```

Response 200:

```json
{
  "success": true,
  "data": {"message": "Password reset successful."}
}
```

#### GET /api/v1/auth/me

Auth: School or Platform JWT

Response 200: current user profile.

### Users

#### GET /api/v1/users

Auth: School JWT

Query: page, limit, sort, order, q, role, status, include_deleted

Response 200:

```json
{
  "success": true,
  "data": [
    {
      "id": "1",
      "name": "Jane Doe",
      "email": "jane@school.test",
      "phone": "+250700000001",
      "role": "teacher",
      "status": "active"
    }
  ],
  "meta": {"page": 1, "limit": 20, "total": 1}
}
```

#### POST /api/v1/users

Auth: School JWT

Request body:

```json
{
  "name": "Jane Doe",
  "email": "jane@school.test",
  "phone": "+250700000001",
  "role": "teacher",
  "status": "active",
  "avatar_url": null,
  "password": "StrongPass123"
}
```

Response 201:

```json
{
  "success": true,
  "data": {
    "id": "1",
    "name": "Jane Doe",
    "email": "jane@school.test",
    "phone": "+250700000001",
    "role": "teacher",
    "status": "active",
    "avatar_url": null
  }
}
```

#### GET /api/v1/users/:id

Auth: School JWT

Response 200: user object.

#### PATCH /api/v1/users/:id

Auth: School JWT

Request body (any of): name, email, phone, role, status, avatar_url, password

Response 200: updated user object.

#### DELETE /api/v1/users/:id

Auth: School JWT

Response 200: deleted user object.

#### POST /api/v1/users/:id/roles

Auth: School JWT

Request body:

```json
{"role_id": "2"}
```

Response 200: updated user object with roles.

#### DELETE /api/v1/users/:id/roles/:roleId

Auth: School JWT

Response 200: updated user object with roles.

### Roles

#### GET /api/v1/roles

Auth: School JWT

Query: page, limit, sort, order, q, include_deleted

Response 200: list of roles with meta.

#### POST /api/v1/roles

Auth: School JWT

Request body:

```json
{
  "name": "Teacher",
  "slug": "teacher",
  "permissions": ["students:view"],
  "is_system": false
}
```

Response 201: created role.

#### GET /api/v1/roles/:id

Auth: School JWT

Response 200: role object.

#### PATCH /api/v1/roles/:id

Auth: School JWT

Request body (any of): name, slug, permissions, is_system

Response 200: updated role.

#### DELETE /api/v1/roles/:id

Auth: School JWT

Response 200: deleted role.

### Academic Years

#### GET /api/v1/academic-years

Auth: School JWT

Query: page, limit, sort, order, q, include_deleted

Response 200: list of academic years with meta.

#### POST /api/v1/academic-years

Auth: School JWT

Request body:

```json
{
  "name": "2025/2026",
  "start_date": "2025-09-01",
  "end_date": "2026-07-31",
  "is_current": true
}
```

Response 201: created academic year.

#### GET /api/v1/academic-years/:id

Auth: School JWT

Response 200: academic year.

#### PATCH /api/v1/academic-years/:id

Auth: School JWT

Request body (any of): name, start_date, end_date, is_current

Response 200: updated academic year.

#### DELETE /api/v1/academic-years/:id

Auth: School JWT

Response 200: deleted academic year.

### Terms

#### GET /api/v1/terms

Auth: School JWT

Query: page, limit, sort, order, q, academic_year_id, include_deleted

Response 200: list of terms with meta.

#### POST /api/v1/terms

Auth: School JWT

Request body:

```json
{
  "academic_year_id": "1",
  "name": "Term 1",
  "start_date": "2025-09-01",
  "end_date": "2025-12-20",
  "is_current": true
}
```

Response 201: created term.

#### GET /api/v1/terms/:id

Auth: School JWT

Response 200: term object.

#### PATCH /api/v1/terms/:id

Auth: School JWT

Request body (any of): academic_year_id, name, start_date, end_date, is_current

Response 200: updated term.

#### DELETE /api/v1/terms/:id

Auth: School JWT

Response 200: deleted term.

### Classes

#### GET /api/v1/classes

Auth: School JWT

Query: page, limit, sort, order, q, academic_year_id, include_deleted

Response 200: list of classes with meta.

#### POST /api/v1/classes

Auth: School JWT

Request body:

```json
{
  "name": "S1",
  "level": 1,
  "description": "Senior One",
  "academic_year_id": "1"
}
```

Response 201: created class.

#### GET /api/v1/classes/:id

Auth: School JWT

Response 200: class object.

#### PATCH /api/v1/classes/:id

Auth: School JWT

Request body (any of): name, level, description, academic_year_id

Response 200: updated class.

#### DELETE /api/v1/classes/:id

Auth: School JWT

Response 200: deleted class.

### Sections

#### GET /api/v1/sections

Auth: School JWT

Query: page, limit, sort, order, q, class_id, include_deleted

Response 200: list of sections with meta.

#### POST /api/v1/sections

Auth: School JWT

Request body:

```json
{
  "class_id": "1",
  "name": "A",
  "full_name": "S1 A",
  "class_teacher_id": "10",
  "capacity": 40,
  "room": "Block A"
}
```

Response 201: created section.

#### GET /api/v1/sections/:id

Auth: School JWT

Response 200: section object.

#### PATCH /api/v1/sections/:id

Auth: School JWT

Request body (any of): class_id, name, full_name, class_teacher_id, capacity, room

Response 200: updated section.

#### DELETE /api/v1/sections/:id

Auth: School JWT

Response 200: deleted section.

### Subjects

#### GET /api/v1/subjects

Auth: School JWT

Query: page, limit, sort, order, q, include_deleted

Response 200: list of subjects with meta.

#### POST /api/v1/subjects

Auth: School JWT

Request body:

```json
{
  "name": "Mathematics",
  "code": "MATH",
  "description": "Core mathematics"
}
```

Response 201: created subject.

#### GET /api/v1/subjects/:id

Auth: School JWT

Response 200: subject object.

#### PATCH /api/v1/subjects/:id

Auth: School JWT

Request body (any of): name, code, description

Response 200: updated subject.

#### DELETE /api/v1/subjects/:id

Auth: School JWT

Response 200: deleted subject.

### Teacher Section Subjects

#### GET /api/v1/teacher-section-subjects

Auth: School JWT

Query: page, limit, sort, order, q, teacher_id, section_id, subject_id, term_id, include_deleted

Response 200: list of assignments with meta.

#### POST /api/v1/teacher-section-subjects

Auth: School JWT

Request body:

```json
{
  "teacher_id": "10",
  "section_id": "4",
  "subject_id": "3",
  "term_id": "2"
}
```

Response 201: created assignment.

#### GET /api/v1/teacher-section-subjects/:id

Auth: School JWT

Response 200: assignment object.

#### PATCH /api/v1/teacher-section-subjects/:id

Auth: School JWT

Request body (any of): teacher_id, section_id, subject_id, term_id

Response 200: updated assignment.

#### DELETE /api/v1/teacher-section-subjects/:id

Auth: School JWT

Response 200: deleted assignment.

### Timetable Periods

#### GET /api/v1/timetable-periods

Auth: School JWT

Query: page, limit, sort, order, q, include_deleted

Response 200: list of periods with meta.

#### POST /api/v1/timetable-periods

Auth: School JWT

Request body:

```json
{
  "name": "Period 1",
  "start_time": "08:00",
  "end_time": "08:45",
  "is_break": false,
  "sort_order": 1
}
```

Response 201: created period.

#### GET /api/v1/timetable-periods/:id

Auth: School JWT

Response 200: period object.

#### PATCH /api/v1/timetable-periods/:id

Auth: School JWT

Request body (any of): name, start_time, end_time, is_break, sort_order

Response 200: updated period.

#### DELETE /api/v1/timetable-periods/:id

Auth: School JWT

Response 200: deleted period.

### Timetable Slots

#### GET /api/v1/timetable-slots

Auth: School JWT

Query: page, limit, sort, order, q, section_id, teacher_id, subject_id, term_id, include_deleted

Response 200: list of slots with meta.

#### POST /api/v1/timetable-slots

Auth: School JWT

Request body:

```json
{
  "section_id": "4",
  "subject_id": "3",
  "teacher_id": "10",
  "period_id": "1",
  "day_of_week": 1,
  "room": "Lab 1",
  "term_id": "2"
}
```

Response 201: created slot.

#### GET /api/v1/timetable-slots/:id

Auth: School JWT

Response 200: slot object.

#### PATCH /api/v1/timetable-slots/:id

Auth: School JWT

Request body (any of): section_id, subject_id, teacher_id, period_id, day_of_week, room, term_id

Response 200: updated slot.

#### DELETE /api/v1/timetable-slots/:id

Auth: School JWT

Response 200: deleted slot.

### Holidays

#### GET /api/v1/holidays

Auth: School JWT

Query: page, limit, sort, order, q, include_deleted

Response 200: list of holidays with meta.

#### POST /api/v1/holidays

Auth: School JWT

Request body:

```json
{
  "name": "National Day",
  "start_date": "2025-07-01",
  "end_date": "2025-07-01",
  "type": "national"
}
```

Response 201: created holiday.

#### GET /api/v1/holidays/:id

Auth: School JWT

Response 200: holiday object.

#### PATCH /api/v1/holidays/:id

Auth: School JWT

Request body (any of): name, start_date, end_date, type

Response 200: updated holiday.

#### DELETE /api/v1/holidays/:id

Auth: School JWT

Response 200: deleted holiday.

### Students

#### GET /api/v1/students

Auth: School JWT

Query: page, limit, sort, order, q, status, student_type, include_deleted

Response 200: list of students with meta.

#### POST /api/v1/students

Auth: School JWT

Request body:

```json
{
  "user_id": "20",
  "student_id_number": "S-0001",
  "first_name": "Alice",
  "last_name": "Uwimana",
  "other_names": "Grace",
  "combination": "PCM",
  "date_of_birth": "2010-05-12",
  "gender": "female",
  "national_id": "1199...",
  "nationality": "Rwanda",
  "religion": "None",
  "blood_group": "O+",
  "photo_url": "https://cdn.example.com/students/1.jpg",
  "address": "Kigali",
  "previous_school": "ABC Primary",
  "admission_date": "2024-09-01",
  "enrollment_year": 2024,
  "student_type": "boarding",
  "status": "active"
}
```

Response 201: created student.

#### POST /api/v1/students/import

Auth: School JWT

Request: multipart/form-data with file (CSV).

Response 200: import summary.

#### GET /api/v1/students/:id

Auth: School JWT

Response 200: student object.

#### PATCH /api/v1/students/:id

Auth: School JWT

Request body: any student fields.

Response 200: updated student.

#### DELETE /api/v1/students/:id

Auth: School JWT

Response 200: deleted student.

#### POST /api/v1/students/:id/enrollments

Auth: School JWT

Request body:

```json
{
  "section_id": "4",
  "academic_year_id": "1",
  "term_id": "2",
  "enrolled_at": "2025-09-01",
  "left_at": null,
  "status": "active"
}
```

Response 201: created enrollment.

#### GET /api/v1/students/:id/enrollments

Auth: School JWT

Query: page, limit, sort, order, status, academic_year_id, include_deleted

Response 200: enrollment list with meta.

#### POST /api/v1/students/:id/parents

Auth: School JWT

Request body:

```json
{
  "parent_id": "5",
  "is_primary": true
}
```

Response 200: linked parent.

#### DELETE /api/v1/students/:id/parents/:parentId

Auth: School JWT

Response 200: unlink result.

#### POST /api/v1/students/:id/photo

Auth: School JWT

Request: multipart/form-data with photo.

Response 200: updated student with photo_url.

### Parents

#### GET /api/v1/parents

Auth: School JWT

Query: page, limit, sort, order, q

Response 200: list of parents with meta.

#### POST /api/v1/parents

Auth: School JWT

Request body:

```json
{
  "user_id": "30",
  "first_name": "John",
  "last_name": "Doe",
  "phone": "+250700000002",
  "phone_alt": null,
  "email": "john@home.test",
  "national_id": "1199...",
  "relationship": "Father",
  "address": "Kigali",
  "occupation": "Engineer"
}
```

Response 201: created parent.

#### GET /api/v1/parents/:id

Auth: School JWT

Response 200: parent object.

#### PATCH /api/v1/parents/:id

Auth: School JWT

Request body: any parent fields.

Response 200: updated parent.

#### DELETE /api/v1/parents/:id

Auth: School JWT

Response 200: deleted parent.

### Biometrics

#### GET /api/v1/biometric-enrollments

Auth: School JWT

Query: page, limit, sort, order, student_id, type, is_active

Response 200: list of enrollments with meta.

#### POST /api/v1/biometric-enrollments

Auth: School JWT

Request body:

```json
{
  "student_id": "1",
  "type": "fingerprint",
  "template_hash": "hash",
  "card_uid": null,
  "enrolled_by": "10",
  "is_active": true
}
```

Note: template_hash is required for face/fingerprint; card_uid for card types.

Response 201: created enrollment.

#### GET /api/v1/biometric-enrollments/:id

Auth: School JWT

Response 200: enrollment object.

#### PATCH /api/v1/biometric-enrollments/:id

Auth: School JWT

Request body: any biometric fields.

Response 200: updated enrollment.

#### DELETE /api/v1/biometric-enrollments/:id

Auth: School JWT

Response 200: deleted enrollment.

### Attendance Sessions

#### GET /api/v1/attendance/sessions

Auth: School JWT

Query: page, limit, sort, order, section_id, session_type, date

Response 200: list of sessions with meta.

#### POST /api/v1/attendance/sessions

Auth: School JWT

Request body:

```json
{
  "section_id": "4",
  "subject_id": "3",
  "teacher_id": "10",
  "period_id": "1",
  "session_date": "2025-09-10",
  "session_type": "class",
  "started_at": "2025-09-10T08:00:00Z",
  "notes": "Morning attendance"
}
```

Response 201: created session.

#### GET /api/v1/attendance/sessions/:id

Auth: School JWT

Response 200: session object.

#### PATCH /api/v1/attendance/sessions/:id

Auth: School JWT

Request body: any session fields.

Response 200: updated session.

#### PATCH /api/v1/attendance/sessions/:id/close

Auth: School JWT

Response 200: closed session.

#### DELETE /api/v1/attendance/sessions/:id

Auth: School JWT

Response 200: deleted session.

### Attendance Records

#### GET /api/v1/attendance/records

Auth: School JWT

Query: page, limit, sort, order, session_id, student_id, status, date

Response 200: list of records with meta.

#### POST /api/v1/attendance/records

Auth: School JWT

Request body:

```json
{
  "session_id": "100",
  "student_id": "1",
  "status": "present",
  "scan_method": "manual",
  "notes": "On time"
}
```

Response 201: created record.

#### POST /api/v1/attendance/records/bulk

Auth: School JWT

Request body:

```json
{
  "session_id": "100",
  "scan_method": "qr",
  "records": [
    {"student_id": "1", "status": "present"},
    {"student_id": "2", "status": "absent", "notes": "Sick"}
  ]
}
```

Response 200: bulk insert summary.

#### GET /api/v1/attendance/records/summary

Auth: School JWT

Query: start_date, end_date

Response 200: summary object.

#### DELETE /api/v1/attendance/records/:id

Auth: School JWT

Response 200: deleted record.

### Gate Logs

#### GET /api/v1/gate/logs

Auth: School JWT

Query: page, limit, sort, order, student_id, event_type, scan_method, device_id, is_flagged, date

Response 200: list of logs with meta.

#### POST /api/v1/gate/logs

Auth: School JWT

Request body:

```json
{
  "student_id": "1",
  "event_type": "entry",
  "scan_method": "nfc",
  "device_id": "dev-1",
  "is_flagged": false,
  "flag_reason": null
}
```

Response 201: created log.

#### GET /api/v1/gate/logs/active-on-campus

Auth: School JWT

Response 200: list of active students.

#### GET /api/v1/gate/logs/:id

Auth: School JWT

Response 200: gate log object.

#### PATCH /api/v1/gate/logs/:id

Auth: School JWT

Request body: any gate log fields.

Response 200: updated gate log.

#### DELETE /api/v1/gate/logs/:id

Auth: School JWT

Response 200: deleted gate log.

### Boarding - Dormitories

#### GET /api/v1/boarding/dormitories

Auth: School JWT

Query: page, limit, sort, order, q, gender

Response 200: list of dormitories with meta.

#### POST /api/v1/boarding/dormitories

Auth: School JWT

Request body:

```json
{
  "name": "Dorm A",
  "gender": "male",
  "capacity": 200,
  "supervisor_id": "10",
  "description": "Main dorm"
}
```

Response 201: created dormitory.

#### GET /api/v1/boarding/dormitories/:id

Auth: School JWT

Response 200: dormitory object.

#### PATCH /api/v1/boarding/dormitories/:id

Auth: School JWT

Request body: any dormitory fields.

Response 200: updated dormitory.

#### DELETE /api/v1/boarding/dormitories/:id

Auth: School JWT

Response 200: deleted dormitory.

### Boarding - Rooms

#### GET /api/v1/boarding/rooms

Auth: School JWT

Query: page, limit, sort, order, q, dormitory_id

Response 200: list of rooms with meta.

#### POST /api/v1/boarding/rooms

Auth: School JWT

Request body:

```json
{
  "dormitory_id": "1",
  "room_number": "A-101",
  "capacity": 8
}
```

Response 201: created room.

#### GET /api/v1/boarding/rooms/:id

Auth: School JWT

Response 200: room object.

#### PATCH /api/v1/boarding/rooms/:id

Auth: School JWT

Request body: any room fields.

Response 200: updated room.

#### DELETE /api/v1/boarding/rooms/:id

Auth: School JWT

Response 200: deleted room.

### Boarding - Assignments

#### GET /api/v1/boarding/assignments

Auth: School JWT

Query: page, limit, sort, order, student_id, dormitory_id, room_id, academic_year_id, is_active

Response 200: list of assignments with meta.

#### POST /api/v1/boarding/assignments

Auth: School JWT

Request body:

```json
{
  "student_id": "1",
  "dormitory_id": "1",
  "room_id": "10",
  "bed_number": "B2",
  "academic_year_id": "1",
  "assigned_at": "2025-09-01",
  "left_at": null
}
```

Response 201: created assignment.

#### GET /api/v1/boarding/assignments/:id

Auth: School JWT

Response 200: assignment object.

#### PATCH /api/v1/boarding/assignments/:id

Auth: School JWT

Request body: any assignment fields.

Response 200: updated assignment.

#### DELETE /api/v1/boarding/assignments/:id

Auth: School JWT

Response 200: deleted assignment.

### Boarding - Roll Calls

#### GET /api/v1/boarding/roll-calls

Auth: School JWT

Query: page, limit, sort, order, dormitory_id, roll_date, session_type

Response 200: list of roll calls with meta.

#### POST /api/v1/boarding/roll-calls

Auth: School JWT

Request body:

```json
{
  "dormitory_id": "1",
  "roll_date": "2025-09-10",
  "session_type": "morning",
  "conducted_by": "10",
  "notes": "Daily roll call"
}
```

Response 201: created roll call.

#### GET /api/v1/boarding/roll-calls/:id

Auth: School JWT

Response 200: roll call object.

#### PATCH /api/v1/boarding/roll-calls/:id

Auth: School JWT

Request body: any roll call fields.

Response 200: updated roll call.

#### DELETE /api/v1/boarding/roll-calls/:id

Auth: School JWT

Response 200: deleted roll call.

#### POST /api/v1/boarding/roll-calls/:id/records

Auth: School JWT

Request body:

```json
{
  "student_id": "1",
  "status": "present",
  "notes": "On time"
}
```

Response 201: created roll call record.

#### POST /api/v1/boarding/roll-calls/:id/records/bulk

Auth: School JWT

Request body:

```json
{
  "records": [
    {"student_id": "1", "status": "present"},
    {"student_id": "2", "status": "absent"}
  ]
}
```

Response 200: bulk summary.

#### GET /api/v1/boarding/roll-calls/:id/summary

Auth: School JWT

Response 200: roll call summary.

### Boarding - Student Leaves

#### GET /api/v1/boarding/student-leaves

Auth: School JWT

Query: page, limit, sort, order, student_id, status, from_date, to_date, is_unauthorized

Response 200: list of leaves with meta.

#### POST /api/v1/boarding/student-leaves

Auth: School JWT

Request body:

```json
{
  "student_id": "1",
  "parent_id": "5",
  "leave_type": "weekend",
  "start_date": "2025-09-14",
  "end_date": "2025-09-15",
  "reason": "Family visit"
}
```

Response 201: created leave.

#### GET /api/v1/boarding/student-leaves/:id

Auth: School JWT

Response 200: leave object.

#### PATCH /api/v1/boarding/student-leaves/:id

Auth: School JWT

Request body: any leave fields.

Response 200: updated leave.

#### DELETE /api/v1/boarding/student-leaves/:id

Auth: School JWT

Response 200: deleted leave.

#### PATCH /api/v1/boarding/student-leaves/:id/approve

Auth: School JWT

Response 200: approved leave.

#### PATCH /api/v1/boarding/student-leaves/:id/reject

Auth: School JWT

Request body:

```json
{"rejection_reason": "Not allowed"}
```

Response 200: rejected leave.

### Boarding - Absence Alerts

#### GET /api/v1/boarding/absence-alerts

Auth: School JWT

Query: page, limit, sort, order, student_id, status, alert_type, severity

Response 200: list of alerts with meta.

#### POST /api/v1/boarding/absence-alerts

Auth: School JWT

Request body:

```json
{
  "student_id": "1",
  "alert_type": "boarding_absent",
  "severity": "high",
  "description": "Absent from roll call"
}
```

Response 201: created alert.

#### GET /api/v1/boarding/absence-alerts/:id

Auth: School JWT

Response 200: alert object.

#### PATCH /api/v1/boarding/absence-alerts/:id

Auth: School JWT

Request body: any alert fields.

Response 200: updated alert.

#### DELETE /api/v1/boarding/absence-alerts/:id

Auth: School JWT

Response 200: deleted alert.

#### PATCH /api/v1/boarding/absence-alerts/:id/resolve

Auth: School JWT

Request body:

```json
{"resolution_note": "Parent contacted"}
```

Response 200: resolved alert.

### Offline Sync

#### POST /api/v1/offline-sync

Auth: School JWT

Request body:

```json
{
  "device_id": "dev-1",
  "records": [
    {
      "local_id": "local-001",
      "record_type": "gate_log",
      "payload": {"event_type": "entry"}
    }
  ]
}
```

Response 200: queued job.

#### GET /api/v1/offline-sync/status

Auth: School JWT

Query: device_id

Response 200: sync status.

### Fees

#### GET /api/v1/fees/summary

Auth: School JWT

Query: term_id, academic_year_id

Response 200: summary object.

#### GET /api/v1/fees/students/:id/balance

Auth: School JWT

Response 200: balance object.

#### GET /api/v1/fees/structures

Auth: School JWT

Query: page, limit, sort, order, q, academic_year_id, term_id, class_id

Response 200: list of fee structures with meta.

#### POST /api/v1/fees/structures

Auth: School JWT

Request body:

```json
{
  "academic_year_id": "1",
  "term_id": "2",
  "class_id": "3",
  "name": "Tuition",
  "amount": 250000,
  "currency": "RWF",
  "is_mandatory": true,
  "due_date": "2025-10-01"
}
```

Response 201: created structure.

#### POST /api/v1/fees/structures/:id/clone

Auth: School JWT

Request body:

```json
{"term_id": "3", "academic_year_id": "1"}
```

Response 200: cloned structure.

#### GET /api/v1/fees/structures/:id

Auth: School JWT

Response 200: fee structure.

#### PATCH /api/v1/fees/structures/:id

Auth: School JWT

Request body: any structure fields.

Response 200: updated structure.

#### DELETE /api/v1/fees/structures/:id

Auth: School JWT

Response 200: deleted structure.

#### POST /api/v1/fees/assignments/bulk

Auth: School JWT

Request body:

```json
{
  "fee_structure_id": "1",
  "section_id": "4",
  "academic_year_id": "1",
  "term_id": "2",
  "due_date": "2025-10-01"
}
```

Response 200: bulk assignment summary.

#### GET /api/v1/fees/assignments

Auth: School JWT

Query: page, limit, sort, order, student_id, fee_structure_id, status

Response 200: list of assignments with meta.

#### POST /api/v1/fees/assignments

Auth: School JWT

Request body:

```json
{
  "student_id": "1",
  "fee_structure_id": "1",
  "amount_due": 250000,
  "due_date": "2025-10-01",
  "waiver_reason": null
}
```

Response 201: created assignment.

#### GET /api/v1/fees/assignments/:id

Auth: School JWT

Response 200: assignment object.

#### PATCH /api/v1/fees/assignments/:id

Auth: School JWT

Request body (any of): amount_due, due_date, status, waiver_reason

Response 200: updated assignment.

#### DELETE /api/v1/fees/assignments/:id

Auth: School JWT

Response 200: deleted assignment.

#### GET /api/v1/fees/transactions

Auth: School JWT

Query: page, limit, sort, order, student_id, fee_assignment_id, from_date, to_date

Response 200: list of transactions with meta.

#### POST /api/v1/fees/transactions

Auth: School JWT

Request body:

```json
{
  "student_id": "1",
  "fee_assignment_id": "10",
  "amount": 100000,
  "payment_method": "cash",
  "payment_ref": "RCPT-001",
  "paid_at": "2025-09-15",
  "notes": "Partial payment",
  "currency": "RWF"
}
```

Response 201: created transaction.

#### GET /api/v1/fees/transactions/:id

Auth: School JWT

Response 200: transaction object.

#### PATCH /api/v1/fees/transactions/:id

Auth: School JWT

Request body (any of): payment_ref, notes

Response 200: updated transaction.

#### DELETE /api/v1/fees/transactions/:id

Auth: School JWT

Response 200: deleted transaction.

#### POST /api/v1/fees/transactions/:id/receipt

Auth: School JWT

Request: multipart/form-data with receipt.

Response 200: updated transaction with receipt URL.

### Exams

#### GET /api/v1/exams

Auth: School JWT

Query: page, limit, sort, order, q, section_id, subject_id, term_id, status, type

Response 200: list of exams with meta.

#### POST /api/v1/exams

Auth: School JWT

Request body:

```json
{
  "section_id": "4",
  "subject_id": "3",
  "teacher_id": "10",
  "term_id": "2",
  "name": "Math CAT 1",
  "type": "cat",
  "exam_date": "2025-10-10",
  "start_time": "10:00",
  "duration_min": 60,
  "max_marks": 100,
  "pass_mark": 50,
  "status": "scheduled"
}
```

Response 201: created exam.

#### GET /api/v1/exams/:id

Auth: School JWT

Response 200: exam object.

#### PATCH /api/v1/exams/:id

Auth: School JWT

Request body: any exam fields.

Response 200: updated exam.

#### DELETE /api/v1/exams/:id

Auth: School JWT

Response 200: deleted exam.

### Exam Results

#### POST /api/v1/exam-results/bulk

Auth: School JWT

Request body:

```json
{
  "exam_id": "5",
  "results": [
    {"student_id": "1", "score": 80, "grade": "A"},
    {"student_id": "2", "is_absent": true}
  ]
}
```

Response 200: bulk summary.

#### GET /api/v1/exam-results/summary/:examId

Auth: School JWT

Response 200: summary object.

#### GET /api/v1/exam-results/by-student/:studentId

Auth: School JWT

Response 200: results list.

#### GET /api/v1/exam-results/by-exam/:examId

Auth: School JWT

Response 200: results list.

#### GET /api/v1/exam-results

Auth: School JWT

Query: page, limit, sort, order, exam_id, student_id

Response 200: list of results with meta.

#### POST /api/v1/exam-results

Auth: School JWT

Request body:

```json
{
  "exam_id": "5",
  "student_id": "1",
  "score": 80,
  "grade": "A",
  "remarks": "Great",
  "is_absent": false
}
```

Response 201: created exam result.

#### GET /api/v1/exam-results/:id

Auth: School JWT

Response 200: exam result object.

#### PATCH /api/v1/exam-results/:id

Auth: School JWT

Request body (any of): score, grade, remarks, is_absent

Response 200: updated exam result.

#### DELETE /api/v1/exam-results/:id

Auth: School JWT

Response 200: deleted exam result.

### Visitors

#### GET /api/v1/visitors

Auth: School JWT

Query: page, limit, sort, order, q, visitor_type

Response 200: list of visitors with meta.

#### POST /api/v1/visitors

Auth: School JWT

Request body:

```json
{
  "full_name": "John Visitor",
  "phone": "+250700000010",
  "email": "visitor@test.com",
  "national_id": "1199...",
  "organization": "ACME",
  "visitor_type": "organization"
}
```

Response 201: created visitor.

#### GET /api/v1/visitors/:id

Auth: School JWT

Response 200: visitor object.

#### PATCH /api/v1/visitors/:id

Auth: School JWT

Request body: any visitor fields.

Response 200: updated visitor.

#### DELETE /api/v1/visitors/:id

Auth: School JWT

Response 200: deleted visitor.

### Visitor Appointments

#### GET /api/v1/visitor-appointments

Auth: School JWT

Query: page, limit, sort, order, q, visitor_id, student_id, host_id, status, from_date, to_date

Response 200: list of appointments with meta.

#### POST /api/v1/visitor-appointments

Auth: School JWT

Request body:

```json
{
  "visitor_id": "1",
  "student_id": "1",
  "host_id": "10",
  "purpose": "parent_visit",
  "appointment_at": "2025-09-18T09:00:00Z",
  "expected_duration_min": 30,
  "notes": "Discuss progress"
}
```

Response 201: created appointment.

#### GET /api/v1/visitor-appointments/:id

Auth: School JWT

Response 200: appointment object.

#### PATCH /api/v1/visitor-appointments/:id

Auth: School JWT

Request body: any appointment fields.

Response 200: updated appointment.

#### DELETE /api/v1/visitor-appointments/:id

Auth: School JWT

Response 200: deleted appointment.

#### PATCH /api/v1/visitor-appointments/:id/confirm

Auth: School JWT

Response 200: confirmed appointment.

#### PATCH /api/v1/visitor-appointments/:id/cancel

Auth: School JWT

Response 200: cancelled appointment.

#### PATCH /api/v1/visitor-appointments/:id/complete

Auth: School JWT

Response 200: completed appointment.

### Visitor Visits

#### GET /api/v1/visitor-visits

Auth: School JWT

Query: page, limit, sort, order, visitor_id, student_id, appointment_id, active_only, from_date, to_date

Response 200: list of visits with meta.

#### POST /api/v1/visitor-visits

Auth: School JWT

Request body:

```json
{
  "visitor_id": "1",
  "appointment_id": "1",
  "student_id": "1",
  "host_id": "10",
  "purpose": "parent_visit",
  "checked_in_at": "2025-09-18T09:05:00Z",
  "expected_out_at": "2025-09-18T09:35:00Z",
  "notes": "On time",
  "badge_printed": true,
  "sms_sent_host": true
}
```

Response 201: created visit.

#### GET /api/v1/visitor-visits/:id

Auth: School JWT

Response 200: visit object.

#### PATCH /api/v1/visitor-visits/:id

Auth: School JWT

Request body: any visit fields.

Response 200: updated visit.

#### DELETE /api/v1/visitor-visits/:id

Auth: School JWT

Response 200: deleted visit.

#### PATCH /api/v1/visitor-visits/:id/check-out

Auth: School JWT

Response 200: checked out visit.

### Devices

#### GET /api/v1/devices

Auth: School JWT

Query: page, limit, sort, order, q, mode, type, is_active

Response 200: list of devices with meta.

#### POST /api/v1/devices

Auth: School JWT

Request body:

```json
{
  "device_uid": "DEV-001",
  "name": "Gate Tablet",
  "type": "tablet",
  "location": "Main Gate",
  "mode": "gate",
  "pin": "1234",
  "firmware_version": "1.0.0"
}
```

Response 201: created device.

#### GET /api/v1/devices/:id

Auth: School JWT

Response 200: device object.

#### PATCH /api/v1/devices/:id

Auth: School JWT

Request body: any device fields.

Response 200: updated device.

#### PATCH /api/v1/devices/:id/deactivate

Auth: School JWT

Response 200: deactivated device.

#### DELETE /api/v1/devices/:id

Auth: School JWT

Response 200: deleted device.

### Staff Profiles

#### GET /api/v1/staff/profiles

Auth: School JWT

Query: page, limit, sort, order, q, department, employment_status, contract_type

Response 200: list of profiles with meta.

#### POST /api/v1/staff/profiles

Auth: School JWT

Request body:

```json
{
  "user_id": "10",
  "staff_id_number": "STF-001",
  "gender": "male",
  "department": "Science",
  "contract_type": "permanent",
  "join_date": "2020-01-01",
  "employment_status": "active",
  "subjects": ["Math", "Physics"]
}
```

Response 201: created staff profile.

#### GET /api/v1/staff/profiles/:id

Auth: School JWT

Response 200: profile object.

#### PATCH /api/v1/staff/profiles/:id

Auth: School JWT

Request body: any profile fields.

Response 200: updated profile.

#### DELETE /api/v1/staff/profiles/:id

Auth: School JWT

Response 200: deleted profile.

### Staff Leave Balances

#### GET /api/v1/staff/leave-balances

Auth: School JWT

Query: page, limit, sort, order, staff_id, academic_year_id

Response 200: list of leave balances with meta.

#### POST /api/v1/staff/leave-balances

Auth: School JWT

Request body:

```json
{
  "staff_id": "10",
  "academic_year_id": "1",
  "annual_days": 30,
  "sick_days": 10,
  "emergency_days": 5
}
```

Response 201: created leave balance.

#### GET /api/v1/staff/leave-balances/:id

Auth: School JWT

Response 200: leave balance object.

#### PATCH /api/v1/staff/leave-balances/:id

Auth: School JWT

Request body: any leave balance fields.

Response 200: updated leave balance.

#### PATCH /api/v1/staff/leave-balances/:id/deduct

Auth: School JWT

Request body:

```json
{"leave_type": "annual", "days": 2}
```

Response 200: updated leave balance.

#### DELETE /api/v1/staff/leave-balances/:id

Auth: School JWT

Response 200: deleted leave balance.

### Salary Records

#### GET /api/v1/salary-records

Auth: School JWT

Query: page, limit, sort, order, staff_id, month, year, status

Response 200: list of salary records with meta.

#### POST /api/v1/salary-records

Auth: School JWT

Request body:

```json
{
  "staff_id": "10",
  "month": 9,
  "year": 2025,
  "basic_salary": 500000,
  "allowances": 50000,
  "deductions": 10000,
  "net_salary": 540000,
  "notes": "September salary"
}
```

Response 201: created salary record.

#### GET /api/v1/salary-records/:id

Auth: School JWT

Response 200: salary record object.

#### PATCH /api/v1/salary-records/:id

Auth: School JWT

Request body: any salary fields.

Response 200: updated salary record.

#### DELETE /api/v1/salary-records/:id

Auth: School JWT

Response 200: deleted salary record.

#### PATCH /api/v1/salary-records/:id/mark-paid

Auth: School JWT

Request body:

```json
{"payment_method": "bank_transfer", "paid_at": "2025-09-30"}
```

Response 200: marked paid.

### Notifications

#### POST /api/v1/notifications/send

Auth: School JWT

Request body:

```json
{
  "channel": "sms",
  "recipient_phone": "+250700000010",
  "message": "Hello",
  "template_id": null,
  "variables": {"name": "Alice"},
  "type": "general"
}
```

Response 200: send result.

#### POST /api/v1/notifications/send-bulk

Auth: School JWT

Request body:

```json
{
  "template_id": "tmpl-1",
  "variables": {"term": "Term 1"},
  "recipients": [
    {"recipient_type": "parent", "recipient_id": "5"},
    {"recipient_type": "student", "recipient_id": "1"}
  ]
}
```

Response 200: bulk send result.

#### GET /api/v1/notifications/logs

Auth: School JWT

Query: page, limit, status, channel, recipient_type, from, to

Response 200: list of logs with meta.

### Notification Templates

#### GET /api/v1/notifications/templates

Auth: School JWT

Query: page, limit, sort, order, q, is_active, trigger_type

Response 200: list of templates with meta.

#### POST /api/v1/notifications/templates

Auth: School JWT

Request body:

```json
{
  "name": "Fee Reminder",
  "slug": "fee_reminder",
  "trigger_type": "fees",
  "body_en": "Dear {{name}}, fees due.",
  "body_kin": null,
  "variables": {"name": "string"},
  "is_active": true
}
```

Response 201: created template.

#### POST /api/v1/notifications/templates/:id/render

Auth: School JWT

Request body:

```json
{"variables": {"name": "Alice"}, "language": "en"}
```

Response 200: rendered message.

#### GET /api/v1/notifications/templates/:id

Auth: School JWT

Response 200: template object.

#### PATCH /api/v1/notifications/templates/:id

Auth: School JWT

Request body: any template fields.

Response 200: updated template.

#### DELETE /api/v1/notifications/templates/:id

Auth: School JWT

Response 200: deleted template.

### Audit Logs

#### GET /api/v1/audit-logs

Auth: School JWT

Query: page, limit, sort, order, actor_id, actor_type, action, resource_type, severity, from, to

Response 200: list of logs with meta.

### Feature Flags (Platform)

Auth: Platform JWT (platform_admin)

#### GET /api/v1/feature-flags

Query: page, limit

Response 200: list of feature flags with meta.

#### POST /api/v1/feature-flags

Request body:

```json
{
  "key_name": "new_feature",
  "label": "New Feature",
  "description": "Optional",
  "is_enabled": true,
  "is_beta": false
}
```

Response 201: created feature flag.

#### GET /api/v1/feature-flags/key/:key

Response 200: feature flag.

#### GET /api/v1/feature-flags/:id

Response 200: feature flag.

#### PATCH /api/v1/feature-flags/:id

Request body (any of): label, description, is_enabled, is_beta

Response 200: updated feature flag.

#### DELETE /api/v1/feature-flags/:id

Response 200: deleted feature flag.

### System Settings

#### GET /api/v1/system-settings

Auth: School JWT

Query: page, limit, q

Response 200: list of settings with meta.

#### POST /api/v1/system-settings

Auth: School JWT

Request body:

```json
{
  "key_name": "late_threshold_min",
  "value": 10,
  "type": "integer"
}
```

Response 201: created setting.

#### GET /api/v1/system-settings/key/:key

Auth: School JWT

Response 200: setting object.

#### PATCH /api/v1/system-settings/key/:key

Auth: School JWT

Request body: value, type

Response 200: updated setting.

#### GET /api/v1/system-settings/:id

Auth: School JWT

Response 200: setting object.

#### PATCH /api/v1/system-settings/:id

Auth: School JWT

Request body: value, type

Response 200: updated setting.

#### DELETE /api/v1/system-settings/:id

Auth: School JWT

Response 200: deleted setting.

### Platform Revenue

#### GET /api/v1/platform/revenue

Auth: Platform JWT (platform_admin)

Query: from, to

Response 200: revenue summary.

### Platform Schools

Auth: Platform JWT (platform_admin)

#### GET /api/v1/platform/schools

Query: page, limit, sort, order, q, status, province, district, school_type, subscription_plan_id,
has_boarding, has_biometrics, has_gate, has_visitor_mgmt, has_exam_system, has_salary_mgmt,
has_parent_app, has_bulk_sms, include_deleted

Response 200: list of schools with meta.

#### POST /api/v1/platform/schools

Request body:

```json
{
  "name": "My School",
  "school_type": "private",
  "province": "Kigali",
  "district": "Gasabo",
  "sector": "Kacyiru",
  "logo_url": null,
  "website": null,
  "principal_name": "Head",
  "principal_phone": "+250700000011",
  "principal_email": "head@school.test",
  "school_phone": "+250700000012",
  "school_email": "info@school.test",
  "subscription_plan_id": "1",
  "status": "active",
  "trial_ends_at": null,
  "grace_ends_at": null,
  "timezone": "Africa/Kigali",
  "currency": "RWF",
  "has_boarding": true,
  "has_biometrics": true,
  "has_gate": true,
  "has_visitor_mgmt": true,
  "has_exam_system": true,
  "has_salary_mgmt": true,
  "has_parent_app": true,
  "has_bulk_sms": true,
  "settings": {}
}
```

Response 201: created school.

#### GET /api/v1/platform/schools/:id

Response 200: school object.

#### PATCH /api/v1/platform/schools/:id

Request body: any school fields.

Response 200: updated school.

#### DELETE /api/v1/platform/schools/:id

Response 200: deleted school.

### Platform Plans

Auth: Platform JWT (platform_admin)

#### GET /api/v1/platform/plans

Query: page, limit, sort, order, q, is_active, include_deleted

Response 200: list of plans with meta.

#### POST /api/v1/platform/plans

Request body:

```json
{
  "name": "Basic",
  "price_monthly": 10000,
  "price_annual": 100000,
  "student_limit": 500,
  "staff_limit": 50,
  "sms_bundle": 1000,
  "features": ["fees", "attendance"],
  "is_active": true,
  "sort_order": 1
}
```

Response 201: created plan.

#### GET /api/v1/platform/plans/:id

Response 200: plan object.

#### PATCH /api/v1/platform/plans/:id

Request body: any plan fields.

Response 200: updated plan.

#### DELETE /api/v1/platform/plans/:id

Response 200: deleted plan.

### Platform Subscriptions

Auth: Platform JWT (platform_admin)

#### GET /api/v1/platform/subscriptions

Query: page, limit, sort, order, q, status, school_id, plan_id

Response 200: list of subscriptions with meta.

#### POST /api/v1/platform/subscriptions

Request body:

```json
{
  "school_id": "1",
  "plan_id": "1",
  "billing_cycle": "monthly",
  "amount": 10000,
  "currency": "RWF",
  "status": "active",
  "starts_at": "2025-09-01",
  "ends_at": "2025-10-01",
  "trial_ends_at": null,
  "grace_ends_at": null,
  "auto_renew": true,
  "cancelled_at": null,
  "cancellation_reason": null,
  "notes": null,
  "created_by": "1"
}
```

Response 201: created subscription.

#### GET /api/v1/platform/subscriptions/:id

Response 200: subscription object.

#### PATCH /api/v1/platform/subscriptions/:id

Request body: any subscription fields.

Response 200: updated subscription.

#### DELETE /api/v1/platform/subscriptions/:id

Response 200: deleted subscription.

### Platform Invoices

Auth: Platform JWT (platform_admin)

#### GET /api/v1/platform/invoices

Query: page, limit, sort, order, q, status, school_id, subscription_id

Response 200: list of invoices with meta.

#### POST /api/v1/platform/invoices

Request body:

```json
{
  "invoice_number": "INV-0001",
  "school_id": "1",
  "subscription_id": "1",
  "period_start": "2025-09-01",
  "period_end": "2025-09-30",
  "issue_date": "2025-09-01",
  "due_date": "2025-09-15",
  "subtotal": 10000,
  "tax_rate": 0,
  "tax_amount": 0,
  "discount_amount": 0,
  "total": 10000,
  "currency": "RWF",
  "status": "issued",
  "paid_at": null,
  "payment_method": null,
  "payment_ref": null,
  "notes": null,
  "pdf_url": null,
  "created_by": "1",
  "line_items": [
    {"description": "Subscription", "quantity": 1, "unit_price": 10000, "total": 10000}
  ]
}
```

Response 201: created invoice.

#### GET /api/v1/platform/invoices/:id

Response 200: invoice object.

#### PATCH /api/v1/platform/invoices/:id

Request body: any invoice fields.

Response 200: updated invoice.

#### DELETE /api/v1/platform/invoices/:id

Response 200: deleted invoice.

### Platform Users

Auth: Platform JWT (platform_admin)

#### GET /api/v1/platform/users

Query: page, limit, sort, order, q, role, status, include_deleted

Response 200: list of platform users with meta.

#### POST /api/v1/platform/users

Request body:

```json
{
  "name": "Support User",
  "email": "support@platform.test",
  "password": "StrongPass123",
  "role": "support",
  "access_scope": "all",
  "permissions": [],
  "status": "active"
}
```

Response 201: created platform user.

#### GET /api/v1/platform/users/:id

Response 200: platform user object.

#### PATCH /api/v1/platform/users/:id

Request body: any platform user fields.

Response 200: updated platform user.

#### DELETE /api/v1/platform/users/:id

Response 200: deleted platform user.

### Platform Announcements

Auth: Platform JWT (platform_admin)

#### GET /api/v1/platform/announcements

Query: page, limit, sort, order, q, status, type, target_scope

Response 200: list of announcements with meta.

#### POST /api/v1/platform/announcements

Request body:

```json
{
  "title": "Maintenance",
  "body": "Scheduled maintenance",
  "type": "maintenance",
  "target_scope": "all",
  "target_values": null,
  "status": "scheduled",
  "scheduled_at": "2025-09-20T20:00:00Z",
  "sent_at": null,
  "send_inapp": true,
  "send_email": true
}
```

Response 201: created announcement.

#### GET /api/v1/platform/announcements/:id

Response 200: announcement object.

#### PATCH /api/v1/platform/announcements/:id

Request body: any announcement fields.

Response 200: updated announcement.

#### DELETE /api/v1/platform/announcements/:id

Response 200: deleted announcement.

#### POST /api/v1/platform/announcements/:id/read

Request body:

```json
{"school_id": "1", "user_id": "10"}
```

Response 200: read marker.

### Platform Support Tickets

Auth: Platform JWT (platform_admin)

#### GET /api/v1/platform/support-tickets

Query: page, limit, sort, order, q, status, priority, category, school_id, assigned_to

Response 200: list of tickets with meta.

#### POST /api/v1/platform/support-tickets

Request body:

```json
{
  "school_id": "1",
  "opened_by": "10",
  "assigned_to": "2",
  "subject": "Login issue",
  "category": "technical",
  "priority": "high",
  "status": "open",
  "resolved_at": null
}
```

Response 201: created ticket.

#### GET /api/v1/platform/support-tickets/:id

Response 200: ticket object.

#### PATCH /api/v1/platform/support-tickets/:id

Request body: any ticket fields.

Response 200: updated ticket.

#### DELETE /api/v1/platform/support-tickets/:id

Response 200: deleted ticket.

#### GET /api/v1/platform/support-tickets/:id/messages

Response 200: list of messages.

#### POST /api/v1/platform/support-tickets/:id/messages

Request body:

```json
{
  "sender_type": "platform_user",
  "sender_id": "2",
  "body": "We are investigating.",
  "is_internal": false
}
```

Response 201: created message.

#### GET /api/v1/platform/support-tickets/:id/messages/:messageId

Response 200: message object.

#### PATCH /api/v1/platform/support-tickets/:id/messages/:messageId

Request body: any message fields.

Response 200: updated message.

#### DELETE /api/v1/platform/support-tickets/:id/messages/:messageId

Response 200: deleted message.

### Platform SMS Providers

Auth: Platform JWT (platform_admin)

#### GET /api/v1/platform/sms-providers

Query: page, limit

Response 200: list of providers with meta.

#### POST /api/v1/platform/sms-providers

Request body:

```json
{
  "name": "Provider A",
  "slug": "provider_a",
  "api_key_masked": "***",
  "sender_id": "ECARE",
  "is_default": true,
  "is_active": true,
  "priority": 1,
  "config": {}
}
```

Response 201: created provider.

#### GET /api/v1/platform/sms-providers/:id

Response 200: provider object.

#### PATCH /api/v1/platform/sms-providers/:id

Request body: any provider fields.

Response 200: updated provider.

#### DELETE /api/v1/platform/sms-providers/:id

Response 200: deleted provider.
