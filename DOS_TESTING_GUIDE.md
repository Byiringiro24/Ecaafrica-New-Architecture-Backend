# DOS dashboard testing guide

This guide tests the DOS features added from `dos.txt` and `miss_feature_dos.md`.

## 1. Prepare the environment

1. Start PostgreSQL and configure the backend `.env` database URL.
2. From `Backend/`, generate Prisma Client:

   ```bash
   npx prisma generate --schema src/models/schema.prisma
   ```

3. Apply the DOS migration in a development database:

   ```bash
   npx prisma migrate deploy --schema src/models/schema.prisma
   ```

4. Start the backend and frontend.
5. Use a school user with role `director_of_studies`. The login should redirect to `/dos/dashboard`.

## 2. Dashboard checks

- Confirm the DOS dashboard opens without redirecting to School Admin.
- Confirm the academic sidebar contains classes, assignments, timetable, attendance, exams, reports, calendar, curriculum, syllabus, lesson plans, performance, risk, interventions, referrals, meetings, parent chat, alerts, rooms, substitutions and assessments.
- Confirm the dashboard loads attendance/exam data and DOS work-item summary cards.
- Create an Academic Risk and an Intervention record, return to the dashboard, and confirm the open counts change.
- Confirm School Admin still opens `/dashboard` with its original sidebar and does not see the DOS workflow links.

## 3. Test every DOS workflow

Each workflow screen uses the same create/edit/filter/status lifecycle. For each route below:

1. Open the route.
2. Select **New record**.
3. Enter a title, optional student ID, priority and valid JSON details.
4. Save and confirm the record appears in the table.
5. Search for it, edit it, change its status to `in_progress`, then `resolved`.
6. Delete the test record and confirm it disappears.

| Feature | Route | Suggested test title/details |
|---|---|---|
| Academic calendar | `/dos/calendar` | Term 2 assessment week; include dates and activity type |
| Curriculum | `/dos/curriculum` | S4 Mathematics algebra unit; include objectives and target |
| Syllabus progress | `/dos/syllabus` | S4 Mathematics 65% actual / 80% expected |
| Lesson plans | `/dos/lesson-plans` | Week 4 Mathematics lesson plan; include teacher and coverage |
| Academic performance | `/dos/performance` | S5 class performance review; include average and weak subject |
| Academic risk | `/dos/risk` | Student low average risk; include evidence and threshold |
| Intervention | `/dos/interventions` | Remedial Mathematics plan; include responsible teacher and review date |
| DOS/DOD referral | `/dos/referrals` | Repeated class absence referral; include source/destination and priority |
| Academic meeting | `/dos/meetings` | Parent academic meeting; include date, parent and follow-up |
| Parent academic chat | `/dos/chat` | Jane Doe attendance conversation; include messages and resolution state |
| Academic alert | `/dos/alerts` | Missing marks alert; include affected exam and escalation |
| Room | `/dos/rooms` | Science Room 1; include capacity and availability |
| Substitution | `/dos/substitutions` | Teacher absence substitution; include affected class and substitute |
| Assessment | `/dos/assessments` | CAT 1 Mathematics; include assessment period and completion state |

## 4. API checks

Use the DOS bearer token and the school ID attached to the token.

```text
GET    /api/v1/dos/work-items?type=risk
GET    /api/v1/dos/work-items/summary
POST   /api/v1/dos/work-items
PATCH  /api/v1/dos/work-items/:id
DELETE /api/v1/dos/work-items/:id
```

Example POST body:

```json
{
  "type": "intervention",
  "title": "Remedial Mathematics plan",
  "student_id": "12",
  "priority": "high",
  "payload": {
    "reason": "Low assessment average",
    "action": "Two remedial lessons per week",
    "responsible_teacher": "Teacher ID 4",
    "review_date": "2026-10-15",
    "outcome": ""
  }
}
```

Verify that responses are school-scoped and that each create/update/delete action creates an `audit_logs` entry with resource type `dos_work_item`.

## 5. Permission and isolation checks

- DOS can read academic classes, subjects, staff, timetable, attendance, exams and results.
- DOS can manage DOS work items and academic-year/exam/result/report-card workflows.
- DOS cannot create, update, delete users or assign roles.
- DOS cannot access boarding, dormitory, leave approval, gate, dining, finance, payroll or discipline-management screens/APIs.
- A DOS token from School A cannot read or modify School B work items.
- School Admin behavior remains unchanged: existing School Admin routes, sidebar and pages must continue to work.

## 6. Regression checks

Run:

```bash
cd Ecareafrica_frontend
npm run build

cd ../Backend
npm test -- --runInBand
```

The backend build must also be run after Prisma Client generation. Any remaining errors in unrelated boarding/visitor services should be tracked separately from the DOS feature test results.
