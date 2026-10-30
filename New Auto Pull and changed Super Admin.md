# New Auto Pull and Changed Super Admin

**Project:** Education Care Africa (Ecareafrica)
**Date:** July 2026
**Covers:** All changes made in this development session across backend and frontend

---

## Table of Contents

1. [Git Branches](#1-git-branches)
2. [Daily Git Workflow — Commands to Use Every Time](#2-daily-git-workflow)
3. [Server Deployment Commands](#3-server-deployment-commands)
4. [Safe Server Testing — Zero Risk Approach](#4-safe-server-testing)
5. [Changes: Auto Pull Logs](#5-changes-auto-pull-logs)
6. [Changes: Super Admin Hardware & Assignment](#6-changes-super-admin-hardware--assignment)
7. [Changes: Gate Management Page](#7-changes-gate-management-page)
8. [Changes: Real-Time Socket (Live Monitor)](#8-changes-real-time-socket-live-monitor)
9. [Changes: Attendance Logs API](#9-changes-attendance-logs-api)
10. [Changes: Frontend Cleanup](#10-changes-frontend-cleanup)
11. [Full File Change List](#11-full-file-change-list)
12. [Architecture Overview](#12-architecture-overview)

---

## 1. Git Branches

### Frontend — `Ecareafrica_frontend`
| Branch | Purpose |
|--------|---------|
| `main` | Stable production code — always keep this safe |
| `feature/live-attendance-auto-pull` | All new changes from this session |

### Backend — `Ecareafrica_backend`
| Branch | Purpose |
|--------|---------|
| `main` | Stable production code — always keep this safe |
| `feature/live-attendance-auto-pull` | All new changes from this session |

### GitHub PR links
- Backend: `https://github.com/MbarushimanaFabrice/Ecareafrica_backend/pull/new/feature/live-attendance-auto-pull`
- Frontend: `https://github.com/MbarushimanaFabrice/Ecareafrica_frontend/pull/new/feature/live-attendance-auto-pull`

---

## 2. Daily Git Workflow

Use these commands every time you work on the project.

### Starting work (your local machine — Windows)

```bash
# Backend
cd D:\Ecare_AfricaA\Ecareafrica_backend
git checkout feature/live-attendance-auto-pull
git pull origin feature/live-attendance-auto-pull

# Frontend
cd D:\Ecare_AfricaA\Ecareafrica_frontend
git checkout feature/live-attendance-auto-pull
git pull origin feature/live-attendance-auto-pull
```

### After making changes — commit and push

```bash
# Backend
cd D:\Ecare_AfricaA\Ecareafrica_backend
git add .
git commit -m "feat: describe what you changed"
git push origin feature/live-attendance-auto-pull

# Frontend
cd D:\Ecare_AfricaA\Ecareafrica_frontend
git add .
git commit -m "feat: describe what you changed"
git push origin feature/live-attendance-auto-pull
```

### Merge feature branch into main (when tested and ready)

```bash
# Backend
git checkout main
git merge feature/live-attendance-auto-pull
git push origin main

# Frontend
git checkout main
git merge feature/live-attendance-auto-pull
git push origin main
```

### Create a new feature branch for future work

```bash
# Backend
git checkout main
git pull origin main
git checkout -b feature/your-new-feature-name
git push -u origin feature/your-new-feature-name

# Frontend
git checkout main
git pull origin main
git checkout -b feature/your-new-feature-name
git push -u origin feature/your-new-feature-name
```

### Switch back to main quickly (backup/safety)

```bash
git checkout main
```

---

## 3. Server Deployment Commands

Server: `root@13.140.133.61`
Backend path: `/var/www/ecareafrica/Ecareafrica_backend`
PM2 app name: `ecare-backend`

### Full deploy (existing folder — replaces current code)

```bash
# SSH into server first
ssh root@13.140.133.61

# Go to backend
cd /var/www/ecareafrica/Ecareafrica_backend

# Pull latest from your feature branch
git fetch origin
git checkout feature/live-attendance-auto-pull
git pull origin feature/live-attendance-auto-pull

# Install any new packages
npm install

# Generate Prisma client
npm run prisma:generate

# Run database migrations
npx prisma migrate deploy --schema src/models/schema.prisma

# Build TypeScript to JavaScript
npm run build

# Restart the running PM2 process
pm2 restart ecare-backend

# Watch logs to confirm it started correctly
pm2 logs ecare-backend --lines 50
```

### Expected log output after successful start

```
[pull-logs] Auto-pull job started { intervalMs: 10000 }
API listening on port 5000
Socket.IO initialized
```

### Rollback — go back to main instantly

```bash
cd /var/www/ecareafrica/Ecareafrica_backend
git checkout main
npm run build
pm2 restart ecare-backend
```

### Nginx — add WebSocket support for Socket.IO

Open your nginx config:
```bash
sudo nano /etc/nginx/sites-enabled/ecareafrica
```

Add this block inside your server block (for the backend):
```nginx
location /socket.io/ {
    proxy_pass http://localhost:5000;
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection "upgrade";
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_read_timeout 86400;
}
```

Then reload nginx:
```bash
sudo nginx -t
sudo systemctl reload nginx
```

### Frontend deploy (after building locally or on server)

```bash
cd /var/www/ecareafrica/Ecareafrica_frontend    # or wherever frontend lives

git fetch origin
git checkout feature/live-attendance-auto-pull
git pull origin feature/live-attendance-auto-pull

# Install (socket.io-client was added — required)
npm install

# Build
npm run build

# Copy built files to web root (adjust path as needed)
cp -r dist/* /var/www/html/ecareafrica/
```

### Useful PM2 commands

```bash
pm2 list                          # see all running apps
pm2 restart ecare-backend         # restart backend
pm2 stop ecare-backend            # stop backend
pm2 start ecare-backend           # start backend
pm2 logs ecare-backend --lines 50 # last 50 log lines
pm2 logs ecare-backend            # live log stream (Ctrl+C to exit)
pm2 save                          # save current process list (survives reboot)
pm2 startup                       # generate startup command for system boot
```

### Check everything is working

```bash
# Backend health
curl http://localhost:5000/api/health

# Check pull-logs job is running
pm2 logs ecare-backend --lines 30 | grep pull-logs

# Check port is listening
ss -tlnp | grep 5000

# Check database
sudo -u postgres psql -c "\l" | grep ecareafrica

# Check Redis
redis-cli ping
# Should reply: PONG
```

---

## 4. Safe Server Testing — Zero Risk Approach

This runs your new code on a **different port** without touching the current live app.

```bash
ssh root@13.140.133.61

cd /var/www/ecareafrica

# Clone fresh copy into a new folder
git clone https://github.com/MbarushimanaFabrice/Ecareafrica_backend.git Ecareafrica_backend_new

cd Ecareafrica_backend_new

# Switch to feature branch
git checkout feature/live-attendance-auto-pull

# Install
npm install

# Generate Prisma
npm run prisma:generate

# Run migrations (safe — only adds new tables/columns)
npx prisma migrate deploy --schema src/models/schema.prisma

# Build
npm run build

# Copy .env from existing backend and change the port
cp ../Ecareafrica_backend/.env .env
sed -i 's/PORT=5000/PORT=5001/' .env

# Start as a SEPARATE pm2 app
pm2 start dist/server.js --name ecare-backend-new

# Watch logs
pm2 logs ecare-backend-new --lines 30
```

**Result:**

| PM2 App | Folder | Port | Status |
|---------|--------|------|--------|
| `ecare-backend` | `Ecareafrica_backend` | 5000 | Original — untouched |
| `ecare-backend-new` | `Ecareafrica_backend_new` | 5001 | New code — safe to test |

When you are happy with the new code:
```bash
# Stop old, rename new to take over
pm2 stop ecare-backend
pm2 delete ecare-backend
pm2 restart ecare-backend-new --name ecare-backend
pm2 save
```

If something breaks:
```bash
pm2 stop ecare-backend-new
# Old ecare-backend on port 5000 is still running untouched
```

---

## 5. Changes: Auto Pull Logs

### Problem before
Logs were only pulled manually — the user had to click a button. There was no automatic flow.

### What was built

**File:** `src/jobs/pull-logs.job.ts` *(new file)*

A background job that starts automatically when the server boots. It:

1. Runs every **10 seconds** (configurable via `PULL_LOGS_INTERVAL_MS` env var)
2. Queries all active tablets from the database
3. Health-checks each tablet (pings the Windows bridge over WireGuard VPN)
4. For tablets that respond — calls `POST /api/device/pull-logs` on the bridge
5. Saves each new scan to `gate_logs` and `attendance_logs` tables
6. Skips tablets already being pulled (in-flight guard)
7. Prevents duplicate logs (unique index on `log_id + device_id`)

**To tune the interval**, add to `.env`:
```bash
PULL_LOGS_INTERVAL_MS=10000    # 10 seconds (default — near instant)
PULL_LOGS_INTERVAL_MS=30000    # 30 seconds (if server is under load)
PULL_LOGS_INTERVAL_MS=60000    # 1 minute
```

**File:** `src/server.ts` *(modified)*

Added one line to start the job on boot:
```typescript
import { startPullLogsJob } from "./jobs/pull-logs.job";
startPullLogsJob();
```

### Socket event after every scan

**File:** `src/services/tablet.service.ts` *(modified)*

After every log is saved to the database, the backend now emits a `gate_event` Socket.IO event to the school's room. This fires **instantly** — the frontend receives it with zero polling delay.

```
Biometric scan
    → Windows tablet bridge
        → Backend pulls every 10 seconds
            → Log saved to database
                → gate_event emitted via Socket.IO
                    → Frontend Live Monitor updates instantly
                        → SMS sent to parent automatically
```

### Manual Sync Now button

**File:** `src/controllers/tablet.controller.ts` *(modified)*
**Route:** `POST /api/v1/tablets/pull-all-logs`

When the user clicks "Sync Now" on the gate page, this endpoint:
- Health-checks all active tablets
- Pulls logs from all reachable ones immediately
- Returns a summary: `{ totalSaved, tablets[], summary }`

---

## 6. Changes: Super Admin Hardware & Assignment

### Problem before
The Hardware page was confusing — it mixed creation and assignment, showed IP addresses to users who didn't need them, and had no clean flow for the super admin to create a school, then tablet, then device, then assign.

### What was built

**File:** `src/routes/super-admin.hardware.tsx` *(completely rewritten)*

The page now has **4 clear tabs** in order:

#### Tab 1 — Schools
- Shows all registered schools (read-only reference)
- Schools are created in the main Schools section
- Tells admin which schools exist before assigning hardware

#### Tab 2 — Tablets
- Super admin registers a new Windows tablet bridge
- Selects which school it belongs to
- Enters: Tablet Name, Location, Notes
- IP address and port are present (admin needs them) but clearly labeled as internal/VPN fields
- Lists all tablets across all schools — shows name, school, location, online/offline status
- No IP shown in the list — only name and school

#### Tab 3 — Devices
- Super admin registers a new FK623 biometric device
- Selects which school it belongs to
- Enters: Device Name, Device UID, Mode (gate/boarding/classroom), Location
- Device network settings (IP, port, license) grouped in a separate section labeled "internal — not shown to school users"
- Lists all devices — shows name, school, mode, linked tablet name, connected/offline status
- No raw IP addresses in the list view

#### Tab 4 — Assign
- Reassign a tablet from one school to another
- Select the tablet → see current school highlighted
- Select target school → see confirmation summary
- Click Confirm — tablet moves to new school instantly
- All tablets shown in a list with their current school for reference

### What changed on the backend

**File:** `src/controllers/platform/hardware.controller.ts` *(modified)*

Fixed `updateTablet` to properly handle `school_id` reassignment:
- Previously it would fail silently when trying to move a tablet between schools
- Now it separates standard field updates from school reassignment
- Does a direct Prisma update for the `school_id` change

---

## 7. Changes: Gate Management Page

**File:** `src/routes/gate.tsx` *(completely rewritten)*

### Problem before
The gate page used **hardcoded mock data** — no real API calls. Nothing was connected to the database.

### What was built

The page now has **5 tabs**, all reading from real data:

#### Overview tab
- Live campus status card showing students currently on campus
- Today's entries, exits, and flagged events
- Recent scans list (latest 8)
- Device health summary cards (online/offline per tablet)

#### Live Monitor tab
- Shows **today's scans in real time**
- Uses Socket.IO — updates the moment a student scans (zero delay, no polling)
- **Deduplication**: shows one row per student — their latest scan only (no repeated rows)
- Search by name or ID
- Filter by direction (In / Out)
- Live indicator (green pulsing dot)

#### Students tab
- Lists all students currently on campus
- "On campus" means their last gate event was an entry with no matching exit
- Shows student name, admission number, last scan time, status
- Search filter

#### Devices tab
- All registered tablets with online/offline status
- Last ping time
- Location
- No IP addresses shown — just name, location, status

#### Reports tab
- Entry time distribution chart (hourly, for selected date)
- Scan method breakdown (Fingerprint, Face, Card counts)
- Summary statistics
- CSV export button

### Date filter
A date picker at the top of the page filters all tabs (except Live Monitor which is always today).

### Sync Now button
Triggers immediate pull from all devices. Shows result: "X new logs pulled".

---

## 8. Changes: Real-Time Socket (Live Monitor)

### Problem before
No socket integration existed in the frontend. Live Monitor used polling every 30 seconds.

### What was built

**File:** `src/hooks/useGateSocket.ts` *(new file)*

A React hook that:
1. Connects to the backend Socket.IO server
2. Authenticates using the school JWT token
3. Joins the school's private room (`school:{id}`)
4. Listens for `gate_event` events
5. Auto-reconnects if connection drops
6. Cleans up on component unmount

Usage in any component:
```typescript
useGateSocket({
  enabled: true,
  onEvent: (event) => {
    // event = { studentId, studentName, direction, method, status, timestamp, deviceId, ... }
    // update your state here
  }
});
```

**Package added:** `socket.io-client` v4.8.3

The flow:
```
Student scans finger on FK623
  → (≤10 seconds) backend pulls from tablet bridge
      → gate_logs saved to DB
          → attendance_logs saved to DB
              → gate_event emitted via Socket.IO
                  → useGateSocket receives it
                      → Live Monitor row appears instantly
                          → SMS sent to parent
```

---

## 9. Changes: Attendance Logs API

### Problem before
The frontend device-logs page was reading from `attendance_records` (the manual attendance table). Device-generated scans live in `attendance_logs` — a completely separate table. The data shown was wrong.

### What was built

**File:** `src/services/attendance/attendance-logs.service.ts` *(new file)*

Reads from the `attendance_logs` table with full filtering:
- Date range (`startDate`, `endDate`)
- Device ID
- Student ID
- Scan method (fingerprint, face, card)
- Status (present, late, absent)
- Sync state (synced, queued, failed)
- Free text search (student name, class, device)

**File:** `src/controllers/attendance/record.controller.ts` *(modified)*

Three new controller functions added:
- `listDeviceAttendanceLogs` — paginated list with all filters
- `listTodayDeviceAttendanceLogs` — today's logs only
- `getDeviceAttendanceLogStats` — aggregate counts (unique students, method breakdown, check-in/out counts)

**File:** `src/routes/attendance/record.routes.ts` *(modified)*

Three new routes registered:
```
GET  /api/v1/attendance/records/device-logs           — paginated list
GET  /api/v1/attendance/records/device-logs/today     — today only
GET  /api/v1/attendance/records/device-logs/stats     — stats
```

**File:** `src/lib/device-logs-api.ts` *(updated)*

Frontend API calls now point to the correct endpoints and include `pullAllLogs()`.

---

## 10. Changes: Frontend Cleanup

### Deleted files
| File | Reason |
|------|--------|
| `src/routes/boarding.device-logs.tsx` | Replaced by the gate.tsx page |
| `src/components/device-logs/DeviceHealthPanel.tsx` | Only used by deleted page |
| `src/components/device-logs/StatsCards.tsx` | Only used by deleted page |
| `src/components/device-logs/SyncAlertsPanel.tsx` | Only used by deleted page |

### Fixed files

**`src/pages/school-admin/DeviceManagement.tsx`**
- `handleConnect` was using a hardcoded IP from env variable. Fixed to use the tablet's own stored IP/port from the database
- `handlePullLogs` now calls the backend endpoint directly instead of using the old tabletApi wrapper

**`src/lib/liveAttendanceSync.ts`**
- Simplified — now delegates to `POST /tablets/pull-all-logs` instead of looping through tablets individually from the frontend

---

## 11. Full File Change List

### Backend — `Ecareafrica_backend`

| File | Status | What changed |
|------|--------|-------------|
| `src/jobs/pull-logs.job.ts` | **NEW** | Auto-pull scheduler, runs every 10 seconds |
| `src/services/attendance/attendance-logs.service.ts` | **NEW** | Service to read from attendance_logs table |
| `src/server.ts` | Modified | Added `startPullLogsJob()` call on boot |
| `src/services/tablet.service.ts` | Modified | Added socket emit after each saved scan, added `emitGateEvent` import |
| `src/controllers/tablet.controller.ts` | Modified | Added `pullAllTabletLogs` function, added prisma import |
| `src/routes/tablet.routes.ts` | Modified | Registered `POST /pull-all-logs` route |
| `src/controllers/attendance/record.controller.ts` | Modified | Added 3 new device-logs controller functions |
| `src/routes/attendance/record.routes.ts` | Modified | Registered 3 new device-logs routes |
| `src/controllers/platform/hardware.controller.ts` | Modified | Fixed tablet school_id reassignment |
| `Updates on the Attendance and tablet assign.md` | **NEW** | Previous documentation file |

### Frontend — `Ecareafrica_frontend`

| File | Status | What changed |
|------|--------|-------------|
| `src/hooks/useGateSocket.ts` | **NEW** | Socket.IO hook for real-time gate events |
| `src/routes/gate.tsx` | Rewritten | 5 tabs with real data, socket Live Monitor |
| `src/routes/super-admin.hardware.tsx` | Rewritten | 4-tab Create→Assign flow, IPs hidden from users |
| `src/lib/device-logs-api.ts` | Modified | Points to correct attendance_logs endpoints |
| `src/lib/liveAttendanceSync.ts` | Modified | Simplified to use server-side pull |
| `src/pages/school-admin/DeviceManagement.tsx` | Modified | Fixed hardcoded IP bug, fixed pull logs call |
| `src/routes/boarding.device-logs.tsx` | **DELETED** | Replaced by gate.tsx |
| `src/components/device-logs/DeviceHealthPanel.tsx` | **DELETED** | Orphaned |
| `src/components/device-logs/StatsCards.tsx` | **DELETED** | Orphaned |
| `src/components/device-logs/SyncAlertsPanel.tsx` | **DELETED** | Orphaned |
| `package.json` | Modified | Added `socket.io-client` v4.8.3 |

---

## 12. Architecture Overview

### How attendance flows end-to-end

```
Student puts finger on FK623 reader
        │
        ▼
FK623 biometric device (on school LAN)
        │  USB/LAN
        ▼
Windows tablet bridge (WireGuard VPN IP e.g. 10.0.0.x)
        │  Runs local API on port 5000
        ▼
Backend server (Azure — 13.140.133.61)
  ├── pull-logs.job.ts polls every 10 seconds
  ├── Calls POST /api/device/pull-logs on tablet bridge
  ├── Saves to gate_logs table
  ├── Saves to attendance_logs table
  ├── Emits gate_event via Socket.IO → frontend updates instantly
  └── Sends SMS to parent automatically
        │
        ▼
Frontend (browser)
  ├── useGateSocket receives gate_event
  ├── Live Monitor updates with new row instantly
  └── Reports/Overview refresh on next page load
```

### Who sees what

| User | What they see | IP addresses visible? |
|------|--------------|----------------------|
| School user (gate page) | Student names, scan times, direction, status | No |
| School admin (devices page) | Device name, location, mode, connected/offline | No |
| Super admin (hardware page) | Everything above + internal IP fields for setup | Yes (labeled as internal) |

### Environment variable reference

```bash
# Pull interval (default 10 seconds)
PULL_LOGS_INTERVAL_MS=10000

# All other vars stay the same as before
DATABASE_URL=...
PORT=5000
CORS_ORIGIN=https://ecareafrica.net
REDIS_URL=redis://localhost:6379
```

---

*Document written July 2026. Branch: `feature/live-attendance-auto-pull`*
