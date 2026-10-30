/**
 * The rules used by biometric devices are configured in Attendance Sessions.
 *
 * Older installations also have a JSON `devices.attendance_config` field.  The
 * JSON shape is still supported as a fallback, but all device ingestion paths
 * should resolve their status through this module so they cannot disagree.
 */

export type DeviceAttendanceStatus = "present" | "absent" | "late" | "grace" | "not_scheduled";

export type DeviceAttendanceWindow = {
  label?: string | null;
  start_time?: string;
  end_time?: string;
  start?: string;
  end?: string;
  grace_minutes?: number | string | null;
  graceMinutes?: number | string | null;
};

export type DeviceAttendanceSession = {
  id?: string;
  name: string;
  send_sms?: boolean;
  auto_approve?: boolean;
  notification_template_id?: string;
  is_active?: boolean;
  windows: DeviceAttendanceWindow[];
};

export type DeviceAttendanceResolution = {
  session: DeviceAttendanceSession | null;
  sessionName: string | null;
  status: DeviceAttendanceStatus;
  statusLabel: string | null;
  scheduled: boolean;
};

/** Convert the pre-session JSON shape into the common session shape. */
export const normalizeLegacyAttendanceConfig = (value: unknown): DeviceAttendanceSession[] => {
  const rawValue =
    typeof value === "object" && value !== null && Array.isArray((value as any).sessions)
      ? (value as any).sessions
      : value;

  if (!Array.isArray(rawValue)) return [];

  return rawValue
    .filter((entry): entry is Record<string, unknown> => typeof entry === "object" && entry !== null)
    .map((entry) => ({
      id: typeof entry.session_id === "string" || typeof entry.session_id === "number" || typeof entry.session_id === "bigint"
        ? String(entry.session_id)
        : typeof entry.id === "string" || typeof entry.id === "number" || typeof entry.id === "bigint"
          ? String(entry.id)
          : undefined,
      name: typeof entry.name === "string" && entry.name.trim() ? entry.name.trim() : "Session",
      windows: (Array.isArray(entry.rules) ? entry.rules : [])
        .filter((rule): rule is Record<string, unknown> => typeof rule === "object" && rule !== null)
        .map((rule) => ({
          label: typeof rule.label === "string" ? rule.label : undefined,
          start: typeof rule.start === "string" ? rule.start : "00:00",
          end: typeof rule.end === "string" ? rule.end : "23:59"
        }))
    }))
    .filter((session) => session.windows.length > 0);
};

const parseTimeToMinutes = (value?: string) => {
  const [hours, minutes] = String(value ?? "00:00").split(":").map(Number);
  return (Number.isFinite(hours) ? hours : 0) * 60 + (Number.isFinite(minutes) ? minutes : 0);
};

const parseGraceMinutes = (value?: number | string | null) => {
  if (value === undefined || value === null || value === "") return 0;
  const numeric = typeof value === "number" ? value : Number(value);
  return Number.isFinite(numeric) ? Math.max(0, numeric) : 0;
};

const isWithinRange = (minutes: number, start: number, end: number) =>
  start <= end ? minutes >= start && minutes <= end : minutes >= start || minutes <= end;

const isWeekend = (date: Date) => date.getDay() === 0 || date.getDay() === 6;

const windowStart = (window: DeviceAttendanceWindow) => window.start_time ?? window.start;
const windowEnd = (window: DeviceAttendanceWindow) => window.end_time ?? window.end;
const windowGrace = (window: DeviceAttendanceWindow) =>
  parseGraceMinutes(window.grace_minutes ?? window.graceMinutes ?? 0);

const statusFromLabel = (label?: string | null): DeviceAttendanceStatus =>
  label && /late/i.test(label) ? "late" : "present";

const findMatchingWindow = (session: DeviceAttendanceSession, minutes: number) => {
  const match = session.windows.find((window) => {
    const start = windowStart(window);
    const end = windowEnd(window);
    if (!start || !end) return false;
    const startMinutes = parseTimeToMinutes(start);
    const endMinutes = parseTimeToMinutes(end);
    const graceMinutes = windowGrace(window);
    const inWindow = isWithinRange(minutes, startMinutes, endMinutes);
    const inGrace = graceMinutes > 0 && minutes > endMinutes && minutes <= endMinutes + graceMinutes;
    return inWindow || inGrace;
  });

  if (!match) return null;

  const startMinutes = parseTimeToMinutes(windowStart(match) ?? "00:00");
  const endMinutes = parseTimeToMinutes(windowEnd(match) ?? "23:59");
  const graceMinutes = windowGrace(match);
  const inWindow = isWithinRange(minutes, startMinutes, endMinutes);
  const inGrace = graceMinutes > 0 && minutes > endMinutes && minutes <= endMinutes + graceMinutes;

  return {
    window: match,
    inWindow,
    inGrace,
    graceMinutes,
    status: statusFromLabel(match?.label)
  };
};

/**
 * Resolve one scan against the active Attendance Session and its windows.
 *
 * An explicitly active session owns all scans for that device. Its windows
 * classify the scan as present/late when they match; a scan outside those
 * windows remains present because the session is active. If no session is
 * active, windows are matched by time and the first configured session is used
 * as a safe fallback, matching the existing Attendance Sessions behaviour.
 * Weekends are deliberately retained as device events but are never attendance.
 */
export const resolveDeviceAttendance = (
  sessions: DeviceAttendanceSession[],
  scannedAt: Date,
  requestedSessionName?: string
): DeviceAttendanceResolution => {
  if (isWeekend(scannedAt)) {
    const session = requestedSessionName
      ? sessions.find((candidate) => candidate.name === requestedSessionName) ?? sessions.find((candidate) => candidate.is_active) ?? null
      : sessions.find((candidate) => candidate.is_active) ?? sessions[0] ?? null;
    return {
      session,
      sessionName: session?.name ?? null,
      status: "not_scheduled",
      statusLabel: "Not scheduled",
      scheduled: false
    };
  }

  const requested = requestedSessionName
    ? sessions.find((session) => session.name === requestedSessionName)
    : undefined;
  const minutes = scannedAt.getHours() * 60 + scannedAt.getMinutes();
  const timedMatch = sessions
    .map((candidate) => ({ session: candidate, match: findMatchingWindow(candidate, minutes) }))
    .find((match) => Boolean(match.match));

  const session = requested ?? timedMatch?.session ?? sessions.find((candidate) => candidate.is_active) ?? sessions[0] ?? null;

  if (session) {
    const matchingWindow = findMatchingWindow(session, minutes);
    if (matchingWindow) {
      const endMinutes = parseTimeToMinutes(windowEnd(matchingWindow.window) ?? "23:59");
      const graceMinutes = matchingWindow.graceMinutes;
      const afterEnd = minutes > endMinutes;
      const inGrace = matchingWindow.inGrace;
      const labelSaysLate = /late/i.test(matchingWindow.window.label ?? "");

      return {
        session,
        sessionName: session.name,
        status: labelSaysLate ? "late" : inGrace ? "grace" : afterEnd && graceMinutes === 0 ? "late" : "present",
        statusLabel: matchingWindow.window.label ?? null,
        scheduled: true
      };
    }

    if (requested) {
      return {
        session: requested,
        sessionName: requested.name,
        status: "present",
        statusLabel: null,
        scheduled: true
      };
    }
  }

  if (timedMatch) {
    const { match, session } = timedMatch;
    const endMinutes = parseTimeToMinutes(windowEnd(match?.window ?? {}) ?? "23:59");
    const graceMinutes = match?.graceMinutes ?? 0;
    const afterEnd = minutes > endMinutes;
    const inGrace = match?.inGrace ?? false;
    const labelSaysLate = /late/i.test(match?.window.label ?? "");

    return {
      session,
      sessionName: session.name,
      status: labelSaysLate ? "late" : inGrace ? "grace" : afterEnd && graceMinutes === 0 ? "late" : "present",
      statusLabel: match?.window.label ?? null,
      scheduled: true
    };
  }

  const fallback = sessions[0] ?? null;
  return {
    session: fallback,
    sessionName: fallback?.name ?? null,
    status: fallback ? "present" : "absent",
    statusLabel: null,
    scheduled: Boolean(fallback)
  };
};

export const isAttendanceScheduled = (status: DeviceAttendanceStatus) => status !== "not_scheduled";
