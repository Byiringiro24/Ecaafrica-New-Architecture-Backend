# DOS feature audit: features already available

## Scope

This audit compares `Backend/dos.txt` with the implementation in both `Backend/` and `Ecareafrica_frontend/`. **Implemented** means there is evidence in backend and frontend. **Backend only** means an API/data foundation exists but the DOS experience is missing. **Partial** means the feature exists but does not yet meet the complete DOS requirement.

The specification is named `dos.txt` in this repository. The requested output files are `features_dos.md` and `miss_feature_dos.md`.

## DOS portal currently available

| DOS feature | Current implementation | Status |
|---|---|---|
| DOS authentication and route protection | `Ecareafrica_frontend/src/routes/dos.tsx` and `src/lib/schoolAuth` protect the DOS route family. | Implemented |
| DOS dashboard | `dos.dashboard.tsx` loads classes, students, exams and today's attendance sessions and displays class count, active-student display, attendance submission coverage and pending exams. | Partial |
| Classes and sections | Backend class/section models, validators, controllers, services and routes exist. `dos.classes.tsx` displays classes and sections. | Implemented for viewing |
| Subjects | Backend subject CRUD exists. The DOS Classes & Subjects page lists subject, code and active status. | Implemented for viewing |
| Academic year and terms | Academic-year and term models/routes/services exist. | Backend only |
| Holidays / academic calendar data | Holiday CRUD and `HolidayType.exam` exist. | Backend only |
| Teacher-section-subject assignment | `teacher_section_subjects` and its API exist; the school-admin assignment screen exists. | Implemented in school admin; DOS UI incomplete |
| Teacher/staff visibility | `dos.staff.tsx` loads staff and filters academic roles. | Implemented for viewing |
| Timetable periods and breaks | `timetable_periods` supports named periods, start/end times, break flag and order. | Implemented |
| Timetable slots | `timetable_slots` supports section, subject, teacher, period, day, room text and term. CRUD API and school-admin UI exist. | Partial |
| Basic teacher timetable conflict check | Timetable service rejects a teacher assigned to another class in the same period/day. | Partial |
| Academic/class attendance sessions | Attendance session and record models/APIs exist, including class sessions and submission state. | Implemented |
| DOS attendance monitoring | `dos.attendance.tsx` filters class sessions by date, searches sections and shows submitted/pending sessions. | Partial |
| Separate academic and boarding attendance | Academic attendance uses `attendance_sessions`/`attendance_records`; boarding uses separate boarding sessions/records and migrations. | Implemented at data level |
| Attendance history and reports | Attendance records, logs, history/date-range services, manual/device pages and reports exist. | Partial against DOS analytics |
| Exam configuration | Exam types, grading roles, exam configuration and modification-request APIs/pages exist. | Implemented in school admin |
| Exams and scheduling foundation | `exams` supports section, subject, teacher, term, date, start time, duration, marks and status. | Partial |
| Basic exam conflict check | Exam service checks overlapping exams for the same section/date. | Partial |
| Exam marks/results | `exam_results`, validators, controllers, services and frontend exam pages exist. | Implemented |
| Result publication | Results can be published/unpublished with publication metadata. | Implemented; DOS authorization incomplete |
| Report cards | Report-card model/service/routes and frontend pages exist. | Implemented in school admin |
| Exam analytics | School-admin exam analytics and exam/result data provide basic analysis. | Partial |
| Notifications and attendance alerts | Notification models/services/routes, templates, SMS and absence-alert infrastructure exist. | Partial; not DOS-specific |
| Generic audit logs | `audit_logs`, audit service/controller/routes and frontend audit page exist. | Implemented as infrastructure |
| Parent records | Parent/guardian models, student-parent links, API and parent page exist. | Implemented for records |
| Parent notifications / SMS | Parent notifications, SMS templates and attendance notification flow exist. | Implemented for notifications; not academic chat |
| Student academic context | Students, enrollments, sections, parents, subjects, exams, results and report cards are modeled. | Implemented foundation |

## Existing school-admin dashboard modules relevant to DOS

The school-admin dashboard already provides:

- students and parent/guardian records;
- classes, sections, levels and class teachers;
- subjects and teacher academic assignments;
- academic years, terms and holidays;
- timetable periods, breaks and slots;
- class/manual/device attendance, attendance history and notifications;
- exams, exam types, grading roles, exam review, result entry, publishing, report cards and analytics;
- staff profiles, staff attendance and leave information;
- general reports, notifications and audit logs;
- boarding, dormitories, boarding attendance, boarding leave, gate operations, visitors, dining and devices;
- finance, fees, payroll, inventory and expenses.

The final groups are school-admin/DOD operational scope, not DOS ownership. `dos.txt` says DOS must not control discipline, boarding, gate exit, dormitory, dining, finance, payroll or HR employment decisions.

## Current DOS navigation

The DOS route family contains `/dos/dashboard`, `/dos/classes`, `/dos/attendance`, `/dos/exams`, `/dos/reports`, `/dos/staff` and `/dos/timetable`.

The timetable page is currently a hand-off to the school-admin timetable module. The reports page links only to the small set of existing DOS screens; it is not yet a complete DOS reporting workspace.

## Important observations

- The dashboard student request uses `limit=1`, so “Active Students” is not a reliable total count.
- The dashboard does not calculate syllabus completion, pending marks, academic-risk students, teacher absence, free periods, timetable conflicts or today's class schedule.
- DOS permission entries exist in `Backend/src/constants/permissions.ts`, but reuse broad generic permissions such as `classes.manage`, `students.manage`, `attendance.manage`, `exams.manage` and `notifications.manage`.
- Academic endpoints are school-scoped, but the DOS role is not consistently included in all exam/result/report-card write guards.
- Generic `messages` and notification records do not implement the student-linked DOS parent conversation required by section 49 of `dos.txt`.
