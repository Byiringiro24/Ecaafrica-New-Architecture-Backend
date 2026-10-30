# eCare System — Testers' Guide to Every Dashboard

> **Purpose:** so a tester knows, page by page, **which forms to fill**, **which actions to try**, and **which tables/columns to verify**.
> Source: `frontend/src/routes/*.tsx` (2026 codebase). Routes are shown as app paths.
> Note: pages marked _mock_ use hardcoded frontend data (no backend calls) — always say so in test reports.

---

## 0. Quick Reference — Roles & Their Dashboards

| Role | Landing URL | Dashboards |
|---|---|---|
| School Admin | `/dashboard` | Dashboard, Attendance, Students, Classes, Subject Assignments, Exams & Results, Visitors, Fees, Boarding, Leaves, Tablets & Devices, Staff, Parents, Notifications, Parent Broadcasts, Settings |
| Finance Officer | `/finance` | Finance Dashboard, Fee Structure, Invoices, Payments, Payroll, Expenses, Inventory, Reports, Audit |
| Teacher | `/teacher/dashboard` | My Classes, Attendance, Record Marks, Schedule, Progress, Messages, Notifications, Profile |
| Staff (front desk) | `/staff/dashboard` | Dashboard, Visitors, Gate, Boarding Roll Call, Leave Requests, Absence Alerts, My Attendance, Student Lookup, Profile |
| Gate Keeper | `/gate-keeper/dashboard` | Dashboard, Gate Attendance (Device/Make/History), Visitors, Boarding Leave Verification, Device Status |
| Director of Discipline | `/dod/dashboard` | Dashboard, Boarding Attendance, Leave Requests, Dormitory, Dormitory Analytics, Reports |
| Super Admin | `/super-admin` | Platform Overview, Schools, Hardware, Manage SMS, SMS Usage, Demo Requests, (mock: Analytics, Subscriptions, Billing, Revenue, Announcements, Support) |

---

# 1. SCHOOL ADMIN DASHBOARDS

## 1.1 Dashboard — `/dashboard`
- **Forms:** None. **Actions:** None (read-only).
- **Charts:** "This Week's Attendance" (bar, Mon–Fri), "Attendance by Class Today" (pie).
- **Lists:** Recent Check-ins (last 6), Absence Alerts (absent students today).
- **Stats:** Total Students, Present Today, Absent Today, Late Arrivals (each with % of total).

## 1.2 Attendance — `/attendance`
Two tabs: **Manual Attendance** `/attendance/manual`, **Device Attendance** `/attendance/device-attendance`.

### Manual Attendance
- **Tabs:** "Today's Records" | "Make Attendance".
- **Filters (Today's Records):** date picker; Class select; Status select (All/Present/Absent/Late/Excused); Residency select (All Students/Day/Boarding); Search "Search by name…".
- **Filters (Make Attendance):** Class, Date, Search "Search student…".
- **Actions:** `Export Excel` (`attendance-<date>.xlsx`), `Load Students`, `Mark All Present`, per-student status pill (cycles Present → Absent → Late → Excused → Mark), `Save Attendance`, `Submit Attendance` (sidebar), pagination.
- **Tables:** Records: `# | Student | Card ID | Class | Time | Status`; Make: `# | Student | Card ID | Status`.
- **Stats:** Total/Present/Absent/Late counts; sidebar session summary + "X of Y marked".
- **Rules:** future dates blocked; must select class; all students must be marked before save.

### Device Attendance
- **Filters:** Search, Date, Status, Method (Fingerprint / Face Recognition / RFID).
- **Actions:** `Export Records` (**stub** — "Export feature coming soon").
- **Table:** `# | Student | Class | Status | Time | Scan In`.
- **Stats:** Total Records, Unique Students, Check-ins, Check-outs.

## 1.3 Students — `/students`
- **Stats:** Total Students, Male, Female, Boarding, Day Schooler.
- **Filters:** Search "Search by name or ID…", Class, Residency (All/Day/Boarding), grid ↔ table toggle.
- **Action:** `Register New Student` (opens modal).
- **Register Student modal:**
  - Step 1 – Basic: Student ID Number *, Date of Birth *, Gender, Residency (Day scholar/Boarding).
  - Step 2 – Academic: Class (section) *, Combination, Year of Enrollment, Blood Group, Religion (opt), Previous School (opt).
  - Step 3 – Parent: Parent Name *, Relationship, National ID, Email, Address.
  - Buttons: Cancel / Back / Next / Register Student.
- **Table:** `Name | Student ID | Class | Residency | Device (sync status) | Parent | Phone | View`.
- **Grid cards:** avatar, class badge, "Pushed to device" badge, parent phone, `View Profile`.
- **Profile drawer:** Edit, Add/Change Photo, details (Student Details, Parent/Guardian blocks); `Send SMS`.
- **Edit modal:** same fields editable (Student ID disabled) → `Save Changes`.
- Rule: "Student ID already exists" validation.

## 1.4 Classes — `/classes`
- **Actions:** `Add Class`, `Add Level` (modal: Level Name), per class `View Details`, `Edit`, `Import Students` (CSV), `Delete` (confirm).
- **Add/Edit Class modal:** Level, Section, Academic Year (select, incl. "Not set"), Teacher (select, "Unassigned"), Room (optional), Capacity.
- **CSV Import modal:** Upload File, Section mapping (read-only), Academic year, `Download Template`; detection summary: Rows, Ready to Import, Issues found; `Import`.
- **Detail drawer tabs:** Students (search "Search by name or ID…"), Attendance Trend, Gate Reports.
- Per-class card: `students/capacity` count + "Today's attendance" %.

## 1.5 Subject Assignments — `/subject-assignments`
- **Forms:** Teacher select; New Subject inline form (Name *, Code e.g. "MATH"); assignment row Selects: Class + Subject.
- **Actions:** `New Subject`, `Create`, `Cancel`, `Save assignments`, "+" add row, per-row delete; row duplicates highlighted red.
- **Table:** `Class | Subject | (delete)`; "Currently saved" chips list.

## 1.6 Exams & Results — `/exams`
Sub-tabs: **Overview / Review Submissions / All Exams / Published Results / Report Cards / Analytics**.

### Overview (`/exams`)
- **Stats:** Total Exams, Awaiting Review, Published, Results Recorded, Can Pass %.
- **Charts:** Exam Status (pie), Exams by Type (bar), Class Average Scores (bar).
- **Actions:** Review banner → review page; "View all" Recent Submissions; Recently Published list.

### All Exams / schedule (`/exams/schedule`)
- **Filters:** class, subject, status (Scheduled/In Progress/Submitted/Published/Cancelled).
- **Table:** `Test | Class | Subject | Teacher | Date | Type | Max Marks | Count | Status | Actions (View)`.
- **Results modal:** Stat boxes: Pending, Class Average, Highest, Lowest; table `Student | Marks | Grade | Status | Remarks`; actions `Publish to Parents`, Close.

### Review Results (`/exams/review`)
- **Grouped table per class:** `Test | Subject | Teacher | Date | Type | Marked | Status ("Awaiting Review") | Actions (Review / Publish)`.
- **Actions:** `Review` opens results modal; `Publish` confirm dialog.
- **Stats:** Pending review count + "Filtered results".

### Published Results (`/exams/published`)
- **Actions:** `View Results`, `Unpublish` (confirm: parents lose access).
- **Card stats:** Pass Rate, Avg, students. **Summary:** Published Exams, Avg Pass $, Avg.

### Report Cards (`/exams/report-cards`)
- **Forms:** Class, Term ("Current term"), Student ("All students in class").
- **Actions:** `Generate`, `Print`.
- **Table:** `Subject | % | Grade | Comments`; empty warning if no published results.

### Analytics (`/exams/analytics`)
- **Charts only:** Pass Rate by Class, by Subject, Score & Pass Rate Trend, Grade Distribution (A–F). Filters: class, subject.

## 1.7 Visitors — `/visitors`
- **Stats:** Today's Visitors, Currently On Campus, Pending Check-out, This Week.
- **Register Visitor modal (3 steps):**
1. Step 1: Full Name *, National ID/Passport *, Phone * (9-digit validation), Visitor Type (Parent / Organization), Student search (parents), Organization / Relationship (org).
2. Step 2: Purpose (options), Host (staff) *, Date, Time, Expected Duration (30min/1hr/2hrs/Half day/Full day), Notes.
3. Step 3: Review (no inputs). Buttons: Cancel / Back / Next / `Confirm & Check-in`.
- **Actions:** Check-out (Notes field), Scheduled tab: `Check in`, `Cancel`; History tab: search input (+ inert date input).
- **Tables:**
  - Active: `Visitor | Host | Purpose | Check-in | Status | Actions`.
  - Scheduled: `Visitor | Host | Date / Time | Purpose | Status | Actions`.
  - History: `Visitor | Host | Date | Check-in | Check-out | Duration | Purpose`.
  - Logs: `Event (Entry/Exit) | Visitor | Gate Officer | Notes`.
- **Note:** gate-keeper `/gate-keeper/visitors` reuses this same screens.

## 1.8 Fees — `/fees`
- **Default view:** "Subscription" tab only (`subscriptionOnly` hides the fee module tabs).
- **Visible:** usage meters (Students / SMS Sent this month / Staff accounts, "X% used"); `Manage Billing`; invoice history; plans area.
- **Invoice history table:** `Invoice | Period | Issue Date | Due Date | Amount | Status`.
- **Invoice modal:** description lines + Subtotal + VAT 18% + Total; actions `Download PDF`, `Print`.
- **Actions:** `Upgrade Plan`, `Downgrade`, `Manage Billing`.
- **Hidden tabs (when fee module enabled — test if visible):**
  - Student Fees table: `Student | Class | Total | Paid | Balance | Last Payment | Status | Actions` → `Record Payment` modal (Amount, Method, Reference, Collected By); `Export CSV`.
  - Transactions: `Receipt # | Date | Student | Class | Amount | Method | Collected By | Status`.
  - Fee Structure: `Fee Item | S1..S6 | Yearly | Mandatory` + `Add Fee Item`.
  - Reminders: target select (All Unpaid/Overdue 30+/Specific class) + message; `Send to N parents`.

## 1.9 Finance (Finance Officer) — `/finance`
See Section 6 for the full Finance module breakdown (same pages).

## 1.10 Boarding (Admin) — `/boarding`
- **`/boarding` index:** Dorm filter + search; table `Student | No. | Class | Dormitory`; stats: Total / Boarders, Assigned, Unassigned, Dormitories.
- **`/boarding/devices`:** device command center. Tabs: Overview / Live Monitor / Students / Devices / Reports.
  - Forms: "Add Student to Device" (First/Last name, Student Number, Section, Student Type), Manual scan event (Student, Session, Method, timestamp), DB log filters (start/end date + time, method).
  - Actions: `Refresh`, `Sync Now`, `Push now` (list to device), `Add one`, `Check Health`.
  - Tables: Students list (checkbox, Student, Class, Student, Device User, Sync status, Action), Users on Device (`User ID | Name | Privilege | Methods | Status`), Live feed (`Student | Direction | Method | Class | Status | Time`), DB logs (`Student | Class | Method | Direction | Session | Status | Time`).
  - Stats: Students, Today Logs, Devices Online, Stored Logs.
- **`/boarding/device-students`:** assign/remove students on a biometric device.
  - Filters: Device, Class, All/Boarding/Day, "Show assigned only", search.
  - Actions: checkbox selection, `Push Selected`, `Push Class`, `Push All`, per-row Add/Remove.
  - Table: `Student | Class | Boarding status | Assign (Add/Remove)`; stats: Assigned, Boarding, Day, Unassigned.
- **`/boarding/device-sessions`:** create attendance windows per device.
  - Form: **Session** modal: Session name, toggle Auto-approve attendance, toggle Parent SMS + template select, Add morning/evening window (Status label, Start time, End time).
  - Actions: `New Session`, `Add Morning/Evening Session`, Edit, Delete.
  - Sessions shown as cards: Session name, status, window chips, status.

## 1.11 Gate (Admin) — `/gate`
- **Tabs:** Overview | Live Monitor | Students | Devices | Reports.
- **Stats per tab:** Overview: On Campus Now, Entries, Exits, Flagged; Live: On Campus/Exited/Unique/Total scans; Students: On-Campus/Scanned/Flagged; Devices: Total/Online/Offline/In maintenance; Reports: Total scans, Unique, Fingerprint, Face + summary list.
- **Live Monitor table:** `Student | Class | Direction | Method | Device | Time | Status`.
- **Students table:** `Student | Admission No. | Last Scan | Status`.
- **Actions:** `Refresh`, `Sync Now`, direction filter, search; Reports `Export CSV` (**stub** toast).

## 1.12 Leaves — `/leaves`
- **Tabs:** Pending | Approved | Rejected | All History.
- **Stats:** Pending Requests, Approved Today, Currently Out (`#`), Returned Today.
- **New Leave Request (3 steps):** 1) Search Student (results list, max 5, selectable); 2) Type *, Departure date *, Return date *, Destination, Contact Person, Reason *; 3) review. Buttons: Cancel/Back/Next/Submit.
- **Approve modal:** Authorized By (Warden/Deputy/Head), approve checkbox + SMS preview; Send approval SMS.
- **Reject modal:** Rejection reason *.
- **Tables:** `# | Student | Class | Leaving type | Departure | Return | Reason | Status | Actions (Approve / Reject)`.
- Cards "Students Currently on Leave": name, class, type, dates, contact phone.

## 1.13 Staff Management — `/staff`
- **Stats:** Total, Teaching, Non-teaching, Active.
- **Register Staff modal (2 steps):** Full Name*, Gender, Phone (+country), Email, Join date, Address, Role (Teacher hold etc.) + Department; Step 2 review (Staff ID, Name..) with Next/Register.
- **Edit Profile modal:** Full Name, Role, Department, Phone, Email, Timetable Access (Full/Limited/Read only), + if Teacher: "Assigned teacher sections" checkboxes + "Teaching assignments" (Class + Subject) rows and `+ Add assignment`, `Create subject`.
- **Actions:** Activate/Deactivate (confirm), View Profile, Edit, Grid/Table toggle, Department filter, Status filter, Add.
- **Tabs:** All Staff | Departments (Add dept input → `Add Department`, per card "View Staff").

## 1.14 Parents — `/parents`
- **Stats:** Total Parents, SMS Sent Today, Failed SMS (with `Retry All` button link).
- **Filters:** search (parent/phone/student), District select, SMS select.
- **Table:** `Parent | Phone | District | Children (badges) | Last SMS | Total SMS | Actions (Edit)`.
- **Edit modal:** First Name, Last Name, Phone, Email, National ID, District → Save Changes.
- **SMS Compose modal** (from row/edit): To field, template select, message, "sent as SMS" char count, Send.
- **History drawer:** SMS log list with status ignore.

## 1.15 Notifications — `/notifications`
- **Filters:** from/to dates, Status dropdown (queued/sent/delivered/failed/retry), search.
- **Table:** `# | Time | Student | Parent | Phone | Trigger | Message | Status | Action (View)`.
- **Stats:** SMS Used, Delivered Delivery Rate, Failed.
- **Detail modal:** full SMS body read-only.

## 1.16 Parent Broadcasts — `/parent-broadcasts`
- **Form:** Audience type (All parents / By class / By section), Class select, Section select, `Title *` (max 255), `Body *` (max 2000).
- **Actions:** `Preview Audience`, `Send Broadcast` (confirm dialog Cancel/Confirm); summary shows recipients count.

## 1.17 Settings — `/settings`
- **Tabs:** School | Reset Password.
- **School details** (read-only inputs): School name, Address, District, Province, School email. Upload logo action.
- **Academic year table:** `Name | Start | End | Status | Actions (Set current / Edit)`; `Add Academic Year` (name, start, end, `Set as current`).
- **Reset Password tab:** read-only email + `Send reset link`.

---

# 2. TEACHER DASHBOARDS — `/teacher/…`

## 2.1 Dashboard — `/teacher/dashboard`
- **Stats:** My Classes, Students I Teach, Subjects, Present Today (mock 92%).
- **Quick actions:** Mark attendance → `/teacher/attendance`, Record Marks → `/teacher/exams`, Communicate with parents, My Timetable. Class cards: `View Class`.

## 2.2 My Classes — `/teacher/classes`
- **Drawer tabs:** Students (`Name | Reg | Attendance` mock), Attendance, Exam Results (mock table `Exam | Avg | High | Low | Pass %`).
- **Actions:** `View Students`; class cards count. Mock data.

## 2.3 Attendance — `/teacher/attendance`
- **Tabs:** Live / History / Make Attendance.
- **All include:** Class, Date (max today), search by name.
- **Live table:** `# | Class | Student | Card ID | Class | Time | Status`; counts total/present/absent/late.
- **History:** "Load History" (needs class), `Export Excel`.
- **Make:** status pill cycles statuses; `Mark All Present`, `Save`, `Submit`; sidebar session summary.
- **Export content:** sheet "Attendance History" with columns `# | Student | Card ID | Class | Time | Status`.

## 2.4 Exams — "Record Marks" — `/teacher/exams`
- **Tabs:** Upcoming Exams | Enter Results | Published Results | Student Performance.
- **Create Exam modal:** Test Name *, * selected class, Subject (filtered by class), Exam Date, Type select (CAT, Main, Mock, Quiz), Max Marks, Pass Mark.
- **Enter Results:** pick exam (`name — Class`), `Filter by subject`, `Load Students`; per-student Marks (1..max), Absent checkbox, Comment; `Save Draft`, `Submit for Review`.
- **Per-student table:** `Student | Marks | Grade | Status | Comments`.
- **Published:** cards Pass Rate/Students; "View results" modal.
- **Performance:** exam selector → `Student | Marks | Grade | Status` table + Stats (Total, Results, Class) + distribution bar.

## 2.5 Schedule — `/teacher/schedule`
- **Toggle:** Grid ↔ List, `Print`.
- **Grid:** Period column + Mon–Fri; cells `Section · Subject · Room`.
- Shows "N lessons scheduled per week".

## 2.6 Progress — `/teacher/progress` (mock)
- **Filters:** Class, Term, Subject.
- **Table:** `# | Student | Attendance % | Avg Marks | Trend | Last Exam | Status (badge)`.
- Actions: `View At-Risk`, `Message Parent`, `Flag for Counseling` (no handling).

## 2.7 Messages — `/teacher/messages` (mock)
- **Compose modal:** To (search), Subject (opt), Message textarea (limit 160).
- **Thread view:** template selector, SMS checkbox, response textarea.

## 2.8 Notifications — `/teacher/notifications` (mock)
- Filters All / Attendance / Academic / System / Message; `Mark all as read`.

## 2.9 Profile — `/teacher/profile`
- **Personal info** (read-only): Full Name, DOB, Gender, Address, Email, Phone.
- **Work info** (read-only): Employee ID, Department, Employment contract, Start date, Work.

---

# 3. STAFF DASHBOARDS — `/staff/…` (front-desk staff; mostly mock data)

## 3.1 Dashboard — `/staff/dashboard`
- **Stats:** On Campus Now, Pending Leave, Visitors Today, Absent Boarders + Live Guest status (Entries / Exits / Returns).
- **Actions:** `Emergency Lockdown` (2-step dialog), Today's Tasks checkboxes, links to leaves.

## 3.2 Visitors — `/staff/visitors` (same UI as 1.7 Visitors)
- Quick Check-in: Visitor Name, Phone, Purpose select, Host autocomplete, Notes, National ID (opt) → `Quick Check-In`; host Notification checkbox; `Print badge`.

## 3.3 Gate Control — `/staff/gate` (mock)
- **Panels:** Entry & Exit with Manual ID input + `Scan Student ID` /` Scan for Exit`) buttons; entries & exits toast backend logs.
- **Tabs:** Today's Log / Pending Exits / Unauthorized Alerts.
- **Actions:** `Mark Returned`, `Alert Parent`, `Resolve`, `All Students Present` (mock), `Emergency Lockdown`, `Print Today's Log`; close modal "Confirm Re-entry".
- **Today's log table:** `Time | Type | Class | Type | Method / Notes`.

## 3.4 Boarding Leave — `/staff/leaves`
- **Tabs:** Boarding requests | Approved | Rejected | All.
- **Actions:** `Review`, `Approve`, `Reject` (with required reason), `Mark Returned`, `Send Reminder SMS`.
- **Table:** student, class, type, dates, parent, reason, status, actions.
- **Stats:** Pending Approval, Approved Today, Rejected Today, Globals On Leave.

## 3.5 My Attendance — `/staff/my-attendance`
- **Tabs:** My Attendance / Mark Students / Reports.
- **My Attendance:** Leave application modal (Leave type, Start, End, Reason); Daily log table `Date | Day | Check-in | Check-out | Hours | Status | Notes`, `Export CSV`.
- **Mark Students:** Class + Date, per-student P/A/L buttons; `Mark All Present`, `Clear`, `Save`, `Submit`.
- **Reports:** Trend ggplot + CSV, Summaries (Monthly/Term), `Send to Admin`.

## 3.6 Student Lookup — `/staff/students` (mock per-student directory)
- **Cards:** Direct Search (`Search by name, student ID, class or parent's phone`), filters chips (All, S1–S6, Boarders/Day), Add student modal (Student ID, Card #, Full name, Gender, class, parent Name/Phone), Edit/Delete with confirm, Send SMS in slide-over, "On Campus" badges.

## 3.7 Absence Alerts — `/staff/alerts`
- **Cards:** detailed alert (Student, Type, Severity, Status, Notes), `Notify Parent`, `Resolve`, `Export Excel`.
- **Rules panel:** collapsible list of rules.

## 3.8 Profile — `/staff/profile`
- **Personal info form (save):** First, Last, DOB, Gender, National ID, Address, Contact Number → `Save Changes`.
- **Password change:** Current/ New / Confirm → `Update Password`.

---

# 4. GATE KEEPER DASHBOARDS — `/gate-keeper/…`

## 4.1 Dashboard — `/gate-keeper/dashboard`
- **Stats:** Entries Today, Exits Today, Visitors On Campus, Approved on Leave; Warning banner for flagged events; **Device summary** (Online/Offline counts).
- **Quick actions →** Gate Attendance, Visitors, Boarding-Leave, Device Status.

## 4.2 Gate Attendance — `/gate-keeper/attendance` (sub-tab layout)
Tabs: **Device Attendance / Make Attendance / Attendance History**.

### Device Attendance (`…/device-attendance`)
- **Filters:** Search, Date, Event type (Entries/Exits), (device method, status).
- **Table:** `Student (avatar+ID) | Class | Event (Entry badge) | Time | Method | Device | Status (Flagged or Normal)`.
- **Stats:** Total Logs, Entries, Exits, Flagged. Navigation previous.
- **Note:** `Export Logs` is stub — toast only.

### Make Attendance (`…/make-attendance`)
- **Filters:** Class, Section, Search.
- **Table:** `# | Student | Card ID | Class | Status` per-row **cyclable pill** Present → Absent → Late → Excused → Mark.
- **Actions:** `Submit Attendance` (closes open sessions), pagination.
- **Stats panel:** Present/Absent/Late/Excused, "X of Y marked", "Z submitted", open sessions.

### Attendance History (`…/history`)
- **Filters:** class, status, search; date (must not be future).
- **Table:** Same as make + `Time | Submitted (Submitted/Draft)`.
- **Actions:** pagination only (read-only).

## 4.3 Visitors — `/gate-keeper/visitors` → same module as 1.7.
## 4.4 Boarding Leave Verification — `/gate-keeper/boarding-leave` (read-only)
- **Filters:** search, View (Currently Out / All Approved).
- **Table:** Student / Reason, Class, Fee Type, Departure / Return, Contact, Status (Approved/Out/ Returned). No actions.

## 4.5 Device Status — `/gate-keeper/device-status` (read-only)
- **Cards:** Active Devices, Offline, Location breakdown.
- **Table:** `Name | UID | Location | Mode | Status | Last Seen`.

---

# 5. BOARDING OFFICER DASHBOARDS — `/dod/…`

## 5.1 Dashboard — `/dod/dashboard`
- **Stats:** Total Boarders, Present in Dorm, On Approved Leave, Absent; alert if pending; Today Summary Present/Absent.
- **Quick actions →** Attendance / leaves / dormitory / reports.

## 5.2 Boarding Attendance — `/dod/attendance`
- **Tabs:** Record Attendance / Attendance History.
- **Record:** Class-Logging (Class, Section, search), per-student cycled status (Present→Absent→Late→Excused→Mark), `Submit Attendance`; sidebar summary (Marked/Present/…).
- **Tables:** `Student | Class | ID | Status | Action (Mark)`; History: `Student | Class | ID | Time | Status | Submitted?`.
- Sync info line: "Live device sync: N tablets, N records, N duplicates".

## 5.3 Leave Requests — `/dod/leaves`
- **Tabs:** Pending / Approved / All History.
- **Stats:** Pending, Approved Today, Currently Out, Returned Today.
- **New Leave modal (3 steps):** Search student, Type (Weekend/Medical/Emergency/Family/Other), Departure, Return, Reason; then review.
- **Actions:** `Assign Rights` link per pending row; Approve/ Reject agents, optional Rejection reason.
- **Table:** `# | Student | Class Members | H-5 Leave Type | Departure | Return | Reason | Status | Actions`.
- Side cards "Students currently on leave" (with OVERDUE pill).

## 5.4 Dormitory — `/dod/dormitory`
- **Create dorm form:** Name, Gender (Male/Female), Capacity, Description → `Create`.
- **Assign student form/fields:** Class, Student (enabled after class), Dormitory (shift filter), Room (optional), Bed number (optional), Academic year, Assigned date.
- **Actions:** `Assign to dormitory`, `Transfer` (dialog with new dorm), `Unassign` (confirm).
- **Table:** `Student | Class | Dormitory | Room / Bed | Status | Actions`.
- **Stats/filters:** class, dormitory, status, search; overview cards per dorm (name, gender, capacity, count assignment).

## 5.5 Dormitory Analytics — `/dod/dormitory-analytics`
- **Stats:** Total Boarders, Assigned, Not yet Assigned, Bed % (value) .
- **Charts:** Occupancy vs capacity (bar), Today status (donut Present/Leave/Absent), Class distribution per dorm (stacked), Gender (grouped bars).

## 5.6 Reports — `/dod/reports`
- **Tabs:** Boarding Students | Boarding Attendance.
- **Students tab form:** Class select, Room filter, search; table `Student | ID | Class | Dormitory | Gender`; stats (Total/Filtered/Dormitories); `Export Excel` (`.xlsx`).
- **Attendance tab form:** Period (Daily/Weekly/Monthly/Custom), From/To (when Custom), Class, Student; table `Date | Student | Class | Status`; stats Record/ Present/ Absent/ Late/ Excused; export.

---

# 6. FINANCE OFFICER — `/finance`

## 6.1 Finance Dashboard — `/finance`
- **Stats:** Outstanding, Overdue, Payroll (Net), Inventory Value, Expenses Paid, Pending, Supplier Payable (Net Balance), Net Cash Position.
- **Charts:** Line 30-day collections, Collected vs Exp (6 mo), Payment Methods (pie), Expenses by Category.
- **Quick links:** Fee Structure, Invoices, Payments, Payroll, Expenses, Inventory, Reports.

## 6.2 Fee Structure — `/finance/fee-structure`
- **Create modal:** Category Name (e.g. "Examination Fee"), Amount per class (input), Due Date, Apply To Classes (checkbox list), Mandatory checkbox → `Cancel / Create for N classes`.
- **Table:** Fee Category | Amount per Class (columns) | Total | Mandatory | Action (`Remove`).
- **Stats:** Fee Category, Structures, Mandatory, Classes Covered; search bar.

## 6.3 Invoices — `/finance/invoices`
- **Generate Invoice modal:** Student * (typeahead search), Fee Items (checkbox list w/ class + mandatory), Due Date, preview Total, Document optional → Generate.
- **Table:** `Invoice | Student | Issue | Due | Total | Paid | Balance | Status | Doc | Action (View / Print) / Pay`.
- **Filters/actions:** search, status filter (Pending/Draft/…), `Print`, `Pay` (partial amounts, applies modal), `+ Generate`.
- **Stats:** Invoices, Total Billed, Total Paid, Outstanding balance.

## 6.4 Payments — `/finance/payments`
- **Tabs:** Student Balances / Transaction Logs.
- **Record Payment modal:** Amount (RWF), Payment Method select, Ref, Collected By, proof upload → Post Payment.
- **Balances table:** `Student | Fee | Total | Paid | Balance | Due | Status | Action (Record Payment)`. Status filter + search.
- **Transactions:** `Date | Receipt | Student | Amount | Method | Reference | Collected By`, summary bar, `Export CSV`.
- **Receipt modal:** printable (Receipt #, student, method, amount, remaining balance, print).

## 6.5 Payroll — `/finance/payroll`
- **Form:** `Generate Current Month`; **Add Payslip**: Employee select, Gross salary, Allowances, Overtime (0), Bonus (0), Deductions (Loan recovery, Other), Net preview → Add.
- **Workflow actions:** `Submit`, `Approve`, `Mark Paid` (method + date).
- **Tables:** **Run table:** Period (month) | Employees | Gross | Deductions | Net | Status | Action; **Payslips table:** Employee | Role | Basic | Allowances | Deductions | Net | Status.
- **Stats:** Employees, Gross Payroll, Total Deductions, Net Payable.

## 6.6 Expenses — `/finance/expenses`
- **Record modal:** Category (select or + new), Price (RWF), Operating Payee, Date, Description, Attach document → Submit.
- **Table:** `ID | Date | Category | Vendor | Amount | Doc | Status | Action (View / Approve / Reject (reason) / Mark Paid)`.
- Filters: category, status; Export CSV.

## 6.7 Inventory — `/finance/inventory`
- **Tabs:** Stock & Valuations | Suppliers.
- **New purchase request modal:** Item Name, Category (or new), Supplier (autocomplete), Quantity, Buy, Reorder, Total preview → status flow (Order → Receive / Cancel).
- **Tables:** Stock (`Item | Category | Supplier | Qty | Value | Invoice | Status | Action`), Suppliers (`Supplier | Category / Supplier | Phone | Number | Balance`).
- **Stats:** Stock Value, Items, Low Stock, Supplier Payable.

## 6.8 Audit — `/finance/audit` (read-only)
- **Search & module filter; table:** `Time | Action | Module | Entity | Performed By | Role`; side lists Security Policies / Actions by Module.

## 6.9 Reports — `/finance/reports`
- Sections: Collection, Expenses, Payroll summary, Students defaulters, Inventory; each with `CSV` export + `print`.
- **Tables:** **Payment defaulters:** `Student | Class | Balance`; Inventory `Item | Qty | Value`.

---

# 7. SUPER ADMIN — `/super-admin`

## 7.1 Platform Overview — `/super-admin`
- **Stats:** Schools, Active devices, Students, SMS this month + **MRR trend chart (12 mo)**.
- **Table Active by Schools:** `School | Location | Plan | Students | Status | SMS | Storage | View` (row actions + Contact **inert**).
- **Pagination** with page size control.

## 7.2 Schools — `/super-admin/schools`
- **Table:** `School | Location | Type | Plan | Students | Staff | Status | (View)`.
- **Create School modal:** Name *, Type (list), Country *, Province / District, Status, Admin email, Phone, plan, Timezone (default Africa/Kigali), Currency (RWF), **8 module checkboxes** (Boarding, Biometrics, Gate..., Vistors, Exam, Salary, Parent App, Bulk SMS).
- **School detail (`/super-admin/schools/:id`):**
  - Overview tab: Usage metrics (Students / Staff / Classes / SMS), features.
  - **Modules tab:** toggles + `Save changes` (Core locked).
  - **Billing:** invoice controls (Create, Override, Discount) — mostly toast-stubs.
  - Users: `Name | Role | Email | Last login | Status | Actions (Reset Password, Deactivate)`; users tab on-click "Deactivate" inert.
  - **Audit log:** action list.
  - Actions: Edit, Suspend/Activate, Reset School Password.

## 7.3 Hardware / Tablets & Devices — `/super-admin/hardware`
- **Tabs:** School | Tablets | Devices | Assignment.
- **Register Tablet:** School, Name, VPN IP, Port (default 5000), Location, Notes; ping / edit / delete.
- **Register Device:** Name, School, Mode, Location, model, IP/port, serial, license; link Device to Tablet.
- **Assign tab tools:** assign tablet→school, device→tablet, device→school; **Assignments Overview table:** `Device | Mode | School | Type | Linked Tablet | Auto-Pull | Status`.

## 7.4 Manage SMS — `/super-admin/manage-sms`
- **Index cards:** 4 triggers (School Entry / Exit, Class Entry / Absent), template counts.
- **Editor page (each type):** Template name, text area (English & optional template), Kinyarwanda, Active toggle, Preview via API button; Save / Delete.

## 7.5 SMS Usage — `/super-admin/sms-usage`
- **Filters:** From / To dates, school search.
- **Stats:** SMS totals, Delivered, Failed, Pending, Spend.
- **Table:** `School | Country | Sent / delivered | Failed | Pending | Spend`.

## 7.6 Demo Requests — `/super-admin/demo-requests`
- **Table:** `School | Contact | Date | Status | Actions`; per-row status buttons (Pending/Contacted/Scheduled/Completed), Delete.
- Filters: search, status.

## 7.7 Mock-only Super Admin pages (test for display only, no real changes)
- **Analytics** `/super-admin/analytics` — usage/attendance/SMS/performance, all mock.
- **Subscriptions** `/super-admin/subscriptions` — table `School | Plan | Cycle | MRR | Next renewal | Status | Auto-renew | Actions` mock.
- **Billing** `/super-admin/billing` — invoice table + Create Invoice modal (school, dates, line items, VAT), mostly mock.
- **Revenue** `/super-admin/revenue` — period chips, stat cards, charts mock.
- **Announcements** `/super-admin/announcements` — Announcement modal (Title, Type, Target, Schedule, Message) mock.
- **Support Tickets** `/super-admin/support` — Ticket table + modal (Subject, Category, Priority, etc.) mock.

---

# 8. THINGS TO VERIFY ON EVERY PAGE

1. **Empty states** — each table shows a message when no data.
2. **Filtration** — filters work and combine (class + status + search).
3. **Pagination** — Previous/Next, page counter, reset on filter.
4. **Validation** — required fields (`*`); date rules (future dates usually blocked).
5. **Small states** — buttons show spinner/disabled while submitting (double-click protection).
6. **Toasts** — success/error confirmations shown for each action.
7. **Exports** — CSV/Excel/PDF content matches the filtered table; note columns/format.
8. **Role access** — page is only reachable by correct role; redirects.
9. **Dark/print views** — for printable modals (report cards, receipts, badges).

---

# 9. KNOWN STUBS & MOCK PAGES (test accordingly)

| Page | Status |
|---|---|
| Gate device attendance, `Export Logs` | stub (toast only) |
| Staff gate, `Resolve` (unauthorized) | no handler |
| Teacher progress: `View At-Risk`, `Message Parent`, `Flag` | no handler |
| Teacher messages `sent` filter | defined but not implemented |
| Visitors History date field | inertial |
| reports.tsx | imports mock constants **missing** — page may not render; `Export PDF` toast only; KPI values hardcoded |
| boarding.devices "Sessions" / "Settings" tabs | dead code (not reachable) |
| Super Admin Overview: `Contact` | inert button |
| School detail users: `Deactivate` | no handler |
| Super Admin analytics/subscriptions/billing/revenue/announcements/support | 100% mock data |
| teacher.dashboard "Present Today" 92% | hardcoded |
| staff pages (dashboard, gate, leaves, alerts, students, visitors) | mock data |
| `/super-admin/system` | redirects to `/super-admin` |

---

*Compiled from source: `frontend/src/routes/*` — review if UI changes.*