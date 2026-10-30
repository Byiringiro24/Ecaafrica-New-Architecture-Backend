# Updates on the Attendance and Tablet Assignment

## Overview

This document describes:
1. How the Super Admin assigns (and reassigns) tablets to schools
2. How attendance logs are pulled automatically from biometric devices
3. How parent/guardian SMS messages are sent automatically on each scan

---

## 1. Super Admin — Tablet Assignment to Schools

### Where to find it

**Super Admin Portal → Hardware Assignment** (`/super-admin/hardware`)

The page has three tabs:

| Tab | Purpose |
|-----|---------|
| Create Tablet | Register a new Windows tablet bridge for a school |
| Create Device | Register a new FK623 biometric device, linked to a tablet |
| Reassign Tablet | Move a tablet from one school to another |

---

### Tab 1 — Create Tablet

A **Tablet** is the Windows PC that acts as the bridge between the FK623 fingerprint hardware and this backend. It runs a local API server that the backend communicates with.

**Required fields:**

| Field | Description | Example |
|-------|-------------|---------|
| School | Which school this tablet belongs to | "Kigali Primary School" |
| Tablet Name | Human-readable label | "Main Gate Tablet" |
| Bridge IP Address | Local IP of the Windows PC on the school's network | `192.168.1.50` |
| API Port | Port the tablet bridge API listens on | `5000` |
| Location | Where the tablet is physically placed | "Main Entrance Gate" |
| Notes | Optional extra info | "FK623 on COM3, auto-start on boot" |

After creation, the tablet is immediately assigned to the selected school. The backend will begin health-checking it and automatically pulling logs once it comes online.

---

### Tab 2 — Create Device

A **Device** represents the physical FK623 biometric reader linked to a tablet bridge.

**Required fields:**

| Field | Description | Example |
|-------|-------------|---------|
| School | Must match the school of the linked tablet | "Kigali Primary School" |
| Device UID | Unique identifier for the device | `FK623-MAIN-GATE` |
| Device Name | Human-readable name | "Main Gate FK623" |
| Type | Hardware form factor | `tablet` / `kiosk` / `web` |
| Mode | Where the device is used | `gate` / `boarding` / `classroom` |
| Tablet Bridge | Which tablet this device connects through | "Main Gate Tablet" |
| FK623 Device IP | Network IP of the FK623 reader | `10.0.0.2` |
| FK623 Port | Port the FK623 reader listens on | `4370` |
| License Number | FK623 SDK license number | `0` (default / free tier) |
| Serial Number | Device serial from hardware label | `AB12CD34` |
| Product Code | FK623 product code | `206` |
| Product Name | Device model name | `FK623` |
| Firmware Version | Firmware version string | `6.70 Build:0000-01-01` |

---

### Tab 3 — Reassign Tablet

Use this tab to move a tablet from its current school to a different school — for example when a school upgrades, closes, or equipment is redistributed.

**Steps:**

1. In the **Select Tablet to Reassign** dropdown, choose the tablet you want to move. You will see:
   - Its current school
   - Its IP address and port
   - Its last known status (online/offline)

2. In the **Assign to School** dropdown, choose the target school.

3. A confirmation summary shows the before/after school names.

4. Click **Confirm Reassignment** — the tablet's `school_id` is updated immediately.

> **Note:** The associated devices linked to this tablet remain assigned to the original school. If you want those devices to follow the tablet, you must also update each device's `school_id` via the Create Device tab or the backend API.

---

## 2. Automatic Attendance Log Pull

### How it works

The backend runs a **background job** (`src/jobs/pull-logs.job.ts`) that starts automatically when the server boots. It:

1. Queries all active tablets in the `tablets` table (across all schools).
2. Performs a health-check ping on each tablet (`GET /api/health`).
3. For tablets that respond, calls `POST /api/device/pull-logs` on the tablet bridge.
4. Saves each returned scan log to two tables:
   - `gate_logs` — structured entry/exit events with a FK to the `students` table
   - `attendance_logs` — denormalized device-format logs used by the frontend

**Pull interval:** every **5 minutes** by default.
Configure via environment variable: `PULL_LOGS_INTERVAL_MS=300000`

### Duplicate prevention

Two layers prevent the same scan from being stored twice:

| Layer | Mechanism |
|-------|-----------|
| `attendance_logs` | Unique index on `(log_id, device_id)` — same log from same device is ignored |
| `gate_logs` | Query checks for existing row with same `(school_id, student_id, device_id, scanned_at)` before inserting |

### Manual sync trigger

Users can also trigger an immediate pull from the **Gate Management** page by clicking the **Sync Now** button. This calls `POST /api/v1/tablets/pull-all-logs` which:

- Health-checks all active tablets
- Pulls logs from all that are reachable
- Returns a summary: how many logs were saved, how many were duplicates

---

## 3. Automatic SMS / Notification on Attendance

### What happens automatically

Every time a student scan is saved to `gate_logs`, the backend immediately fires an attendance notification **without any user interaction**:

```
gate_logs saved  →  sendAttendanceNotification()
                 →  look up student's parent
                 →  send SMS: "Your child [Name] entered/exited school at [time]"
```

This happens in two code paths:

| Code Path | Trigger |
|-----------|---------|
| `tablet.service.ts → pullDeviceLogs()` | Every time the auto-pull job or Sync Now pulls a scan |
| `gate/log.service.ts → logEvent()` | Every time a manual gate event is created via the API |

### Message content

Messages use the **Notification Template** system (`notification_templates` table). The template keys are:

- `school_entry` — sent when `event_type = entry`
- `school_exit` — sent when `event_type = exit`

The SMS is sent via the school's configured SMS provider (SMS Uganda or other configured gateway).

### No user action required

Once a device is online and registered to a school:
- Logs are pulled automatically every 5 minutes
- Each new scan creates a `gate_logs` record
- Each `gate_logs` record triggers an SMS to the student's parent
- The entire pipeline runs server-side with no interaction needed from the school user

---

## 4. Frontend — Gate Management Page (`/gate`)

The gate page has five tabs:

| Tab | What it shows |
|-----|---------------|
| **Overview** | Summary stats, recent scans, device health cards |
| **Live Monitor** | Today's scans, deduplicated per student (one row per student = their latest scan), auto-refreshes every 30 seconds |
| **Students** | List of students currently on campus (those with a check-in but no matching check-out) |
| **Devices** | All tablets with online/offline status and last ping time |
| **Reports** | Entry time distribution chart, scan method breakdown, CSV export |

### Date filter

Select any date using the date picker at the top. All tabs (except Live Monitor, which is always today) will filter to that date.

### Live Monitor — deduplication

The Live Monitor tab shows **one row per student** — their most recent scan of the day. This gives a clean view of who is currently checked in/out without showing all individual re-scans. Total scan count is still shown in the stat cards.

---

## 5. Backend API Endpoints Reference

| Method | Path | Purpose |
|--------|------|---------|
| `POST` | `/api/v1/tablets/pull-all-logs` | Immediate pull from all active tablets (used by Sync Now) |
| `POST` | `/api/v1/tablets/:id/device/pull-logs` | Pull logs from a specific tablet |
| `GET` | `/api/v1/attendance/records/device-logs` | List attendance logs with filters (page, limit, date, deviceId, status, method, search) |
| `GET` | `/api/v1/attendance/records/device-logs/today` | Today's logs only |
| `GET` | `/api/v1/attendance/records/device-logs/stats` | Aggregate stats (counts by method, direction, unique students) |
| `GET` | `/api/v1/gate/logs/active-on-campus` | Students whose latest gate event is "entry" |
| `PATCH` | `/api/v1/platform/hardware/tablets/:id` | Update tablet (includes school_id for reassignment) |
