# DOS feature audit: missing or incomplete features

This file lists requirements from `Backend/dos.txt` that are absent or only partially implemented after reviewing the backend, Prisma schema, API routes/services and frontend routes/components.

## Priority 1: required DOS capabilities not complete

| Required feature | Gap found | What must be added |
|---|---|---|
| Academic DOS dashboard | Current dashboard has limited counts and attendance submission coverage only. | Accurate aggregates for students, teachers, classes, subjects, today's classes, attendance percentage, syllabus completion, pending marks, upcoming exams, risk students, teacher absence, classes without teachers, free periods, conflicts, substitutions, missing lesson plans and syllabus delays. |
| Academic calendar management | Academic-year, term and holiday APIs exist, but no DOS calendar screen or academic activity model exists. | DOS calendar UI, academic activities, assessment/exam periods, validation, filtering and role-aware permissions. |
| Curriculum management | No curriculum, unit, topic, learning-objective or scheme-of-work model/API/UI was found. | Curriculum by academic year, class, subject and term, with units, topics, objectives, targets, versions and audit history. |
| Syllabus and progress monitoring | No syllabus-progress model/API/UI was found. | Expected versus actual progress, completed/pending topics, topic coverage, delay calculation and delayed-subject alerts. |
| Teacher lesson planning | No lesson-plan model/API/review workflow was found. | Teacher submission, DOS review, lesson coverage, missing plans, review status and compliance reports. |
| Academic performance | Exam analytics exists, but no complete student, subject, class and teacher academic-performance service exists. | Averages, pass/fail, grade distribution, trends, weak/strong subjects, rankings where permitted and teacher academic indicators. |
| Academic risk | No configurable risk rules, persisted risk records or DOS risk list was found. | Rules for low average, failed subjects, repeated low assessments, poor attendance, declining performance and missing assignments; store evidence and alert history. |
| Academic interventions | No intervention model, API, page or lifecycle was found. | Student, reason, action, teacher, start/review dates, outcome, status, notes, follow-up and audit trail. |
| DOS/DOD referrals | No academic referral model/API/UI was found. | DOS-to-DOD and DOD-to-DOS referrals with student, source/destination role, reason, priority, date, notes, attachments, status, follow-up and closure. Preserve original record ownership. |
| DOS parent academic chat | Existing notification/SMS and generic messages are not a student-linked conversation feature. | Parent/DOS conversations, text and attachments, search/filter, unread/read state, resolution/reopen, escalation, DOD referral and parent-app integration. |
| Academic parent meetings | No academic parent-meeting model, API or DOS page was found. | Student, parent, teacher, reason, date/time, academic issue, notes, follow-up and optional DOD referral. |
| Academic staff/department meetings | No department, subject, examination or curriculum meeting workflow was found. | Meeting scheduling, participants, agenda, minutes, actions and follow-up, or integration with a general meetings module. |
| Complete DOS reports | DOS reports link only to attendance, exams, classes/subjects and staff allocation. | Student, class, subject, teacher, attendance, curriculum, syllabus, examination, marks, results, workload, substitutions, lesson-plan and academic-risk reports with filters/export. |

## Priority 2: existing features that do not satisfy the full specification

### Timetable and teaching operations

- DOS timetable is a read-only placeholder and redirects to `/timetable`.
- Timetable conflict detection covers teacher availability only; class, room and all overlapping assignment conflicts are not fully handled.
- `room` is a free-text timetable field; there is no first-class room/resource model, capacity or availability management.
- No timetable publication/version/approval workflow or authorized override exists.
- No teacher workload calculation for weekly periods, free periods, overload or underutilization exists.
- No teacher substitution model, confirmation flow, notifications or immutable substitution history exists.

### Academic attendance and escalation

- DOS attendance monitors session submission, not student-level subject/period attendance analytics.
- Attendance percentage, history, absence trends, late-arrival handling and exception workflows are not complete in the DOS portal.
- Repeated academic absence does not create a dedicated academic attendance concern lifecycle.
- There is no DOS review → intervention → DOD referral workflow while retaining academic attendance ownership.
- Academic and boarding attendance are separated in the data model, but the DOS UI and permissions must explicitly expose academic attendance only.

### Examinations, assessments, marks and results

- Exam records do not have first-class exam rooms or invigilator assignments.
- There is no examination-period workspace scheduling subjects/classes with room and invigilator conflict detection.
- Exam attendance is not implemented as a DOS examination feature.
- The broader assessment layer is missing: assessment periods, non-exam assessments, assignments and completion tracking.
- Marks entry and publication exist, but there is no DOS-specific verification/approval queue, missing-mark dashboard or result approval workflow.
- Result/report-card write permissions are primarily School Admin controlled; the policy must explicitly decide whether DOS can review, approve and/or publish.
- Result history and detailed before/after approval audit should be strengthened for DOS actions.

### Alerts and academic supervision

- Generic notifications and absence alerts exist, but DOS-specific alert types and lifecycle states are missing for low performance, repeated absence, syllabus delay, missing marks, teacher absence, timetable conflict, missing lesson plans, poor subject performance and academic risk.
- Teacher academic performance reporting is not implemented separately from HR performance management.
- Academic counselling, remedial classes, extra lessons, study plans and performance-monitoring follow-ups are not modeled.

## Permission and boundary gaps

- No explicit permission keys exist for curriculum, syllabus, lesson plans, academic performance, academic risk, interventions, referrals, academic meetings or DOS parent chat.
- The DOS role currently receives broad generic permissions. This does not prove each required action is available and may grant more write access than intended.
- DOS must be denied ownership of discipline actions, boarding management, boarding leave approval, gate exit authorization, dormitory assignment, dining, finance, payroll and HR employment decisions. Negative authorization tests are needed.
- Exam, exam-result and report-card routes should consistently include the intended DOS policy, whether supervisory read/review or full approval/publishing.
- `Backend/src/constants/permissions.ts` contains duplicate `DIRECTOR_OF_DISCIPLINE` entries and should be corrected before it is used as the authority for DOD/DOS separation.

## Data models/API surface still needed

Add school-scoped, validated and audited persistence for:

- curriculum, curriculum units, topics, learning objectives and syllabus progress;
- lesson plans and lesson coverage/review records;
- non-exam academic assessments and assessment results;
- academic-risk rules, student risk records and risk evidence;
- academic interventions and follow-ups;
- DOS/DOD referrals and attachments;
- student-linked academic parent conversations, messages, attachments and read state;
- academic parent meetings and academic staff/department meetings;
- rooms/resources, exam invigilators, exam attendance and schedule conflicts;
- timetable substitutions and timetable publication/version history;
- DOS-specific academic alerts and escalation history.

## Recommended implementation order

1. Fix duplicate role permissions and establish one backend DOS/DOD policy.
2. Build curriculum, syllabus progress and lesson-plan foundations.
3. Add performance analytics, configurable academic risk and interventions.
4. Add referrals, academic parent meetings and parent chat integration.
5. Complete timetable conflicts, rooms, workload and substitutions.
6. Complete exam rooms, invigilators, exam attendance and DOS result supervision.
7. Replace DOS placeholder pages with operational screens and full reports.
8. Add backend/frontend tests for DOS access and denial of DOD, boarding, finance and HR operations.
