import { resolveDeviceAttendance } from "../src/services/attendance/device-attendance-rules.service";

const sessions = [
  {
    id: "morning",
    name: "Morning",
    is_active: true,
    windows: [
      { label: "On time", start_time: "06:00", end_time: "08:00" },
      { label: "Late", start_time: "08:01", end_time: "09:00" }
    ]
  }
];

describe("device attendance session rules", () => {
  it("uses the active session window for a present scan", () => {
    expect(resolveDeviceAttendance(sessions, new Date("2026-10-05T07:15:00"))).toMatchObject({
      sessionName: "Morning",
      status: "present",
      statusLabel: "On time",
      scheduled: true
    });
  });

  it("uses the active session window for a late scan when the grace period is exhausted", () => {
    expect(resolveDeviceAttendance(sessions, new Date("2026-10-05T08:15:00"))).toMatchObject({
      sessionName: "Morning",
      status: "late",
      statusLabel: "Late"
    });
  });

  it("classifies a scan during the configured grace window as grace", () => {
    const graceSession = [{
      id: "morning",
      name: "Morning",
      is_active: true,
      windows: [
        { label: "On time", start_time: "06:00", end_time: "08:00", grace_minutes: 15 }
      ]
    }];

    expect(resolveDeviceAttendance(graceSession, new Date("2026-10-05T08:12:00"))).toMatchObject({
      sessionName: "Morning",
      status: "grace",
      statusLabel: "On time",
      scheduled: true
    });
  });

  it("prefers the time-matching session over a stale active session", () => {
    const autoSessions = [
      {
        id: "morning",
        name: "Morning",
        is_active: true,
        windows: [
          { label: "On time", start_time: "06:00", end_time: "08:00" }
        ]
      },
      {
        id: "afternoon",
        name: "Afternoon",
        is_active: false,
        windows: [
          { label: "Afternoon present", start_time: "12:00", end_time: "14:00" }
        ]
      }
    ];

    expect(resolveDeviceAttendance(autoSessions, new Date("2026-10-05T12:30:00"))).toMatchObject({
      sessionName: "Afternoon",
      status: "present",
      statusLabel: "Afternoon present",
      scheduled: true
    });
  });

  it("does not count weekend scans as attendance", () => {
    expect(resolveDeviceAttendance(sessions, new Date("2026-10-03T07:15:00"))).toMatchObject({
      sessionName: "Morning",
      status: "not_scheduled",
      statusLabel: "Not scheduled",
      scheduled: false
    });
  });

  it("does not silently mark an unconfigured weekday scan present", () => {
    expect(resolveDeviceAttendance([], new Date("2026-10-05T07:15:00"))).toMatchObject({
      status: "absent",
      scheduled: false
    });
  });
});

