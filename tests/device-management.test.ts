import {
  buildDevicePushTarget,
  isDeviceSyncInProgress,
  resolveAttendanceStatusForTime,
  resolveDeviceApiUrl
} from "../src/services/device.service";
import {
  buildDeviceStudentImageSyncPlan,
  normalizeDeviceStudentStatus
} from "../src/services/device-assignment.service";
import { resolveNextDeviceUserId } from "../src/services/student.service";
import { buildDeviceUserId } from "../src/services/tablet.service";

describe("buildDevicePushTarget", () => {
  it("keeps selected student ids for direct push", () => {
    const target = buildDevicePushTarget({
      mode: "selected",
      student_ids: ["10", "11"]
    });

    expect(target).toEqual({
      mode: "selected",
      student_ids: ["10", "11"],
      section_id: undefined,
      class_id: undefined,
      student_type: undefined
    });
  });

  it("uses class-based targeting when section id is provided", () => {
    const target = buildDevicePushTarget({
      mode: "class",
      section_id: "7"
    });

    expect(target).toEqual({
      mode: "class",
      student_ids: [],
      section_id: "7",
      class_id: undefined,
      student_type: undefined
    });
  });
});

describe("resolveNextDeviceUserId", () => {
  it("ignores legacy 8-digit values derived from student numbers and keeps the next sequential device user ID valid", () => {
    expect(resolveNextDeviceUserId(["1028", "1029", "20260959"])).toBe("1030");
    expect(resolveNextDeviceUserId(["20260959", "20260960", "20260961"])).toBe("1000");
  });
});

describe("buildDeviceUserId", () => {
  it("keeps the stored device user id and ignores the student number mapping", () => {
    expect(buildDeviceUserId({
      id: 9n,
      student_id_number: "STU-2026-001",
      device_user_id: "2048"
    })).toBe("2048");
  });

  it("falls back to a plain generated id instead of the student id number", () => {
    expect(buildDeviceUserId({
      id: 9n,
      student_id_number: "STU-2026-001",
      device_user_id: null
    })).toBe("9");
  });
});

describe("isDeviceSyncInProgress", () => {
  it("treats active bulk push states as in progress until completion", () => {
    expect(isDeviceSyncInProgress("syncing")).toBe(true);
    expect(isDeviceSyncInProgress("partial")).toBe(true);
    expect(isDeviceSyncInProgress("pending")).toBe(true);
    expect(isDeviceSyncInProgress("synced")).toBe(false);
    expect(isDeviceSyncInProgress(null)).toBe(false);
  });
});

describe("resolveDeviceApiUrl", () => {
  it("prefers the current linked tablet bridge URL over stale device.api_url records", () => {
    expect(resolveDeviceApiUrl({
      api_url: "http://10.0.0.12:5000/",
      tablet: { url: "http://192.168.1.20:5000" }
    } as any)).toBe("http://192.168.1.20:5000");
  });

  it("falls back to the saved device api_url when no linked tablet bridge exists", () => {
    expect(resolveDeviceApiUrl({
      api_url: "https://bridge.example.com/api",
      tablet: null
    } as any)).toBe("https://bridge.example.com/api");
  });
});

describe("normalizeDeviceStudentStatus", () => {
  it("maps sync state and device-user assignment to the DOD filter values", () => {
    expect(normalizeDeviceStudentStatus({ device_sync_status: "synced", device_user_id: "101" })).toBe("pushed");
    expect(normalizeDeviceStudentStatus({ device_sync_status: "failed", device_user_id: "101" })).toBe("failed");
    expect(normalizeDeviceStudentStatus({ device_sync_status: "pending", device_user_id: "101" })).toBe("pending");
    expect(normalizeDeviceStudentStatus({ device_sync_status: null, device_user_id: null })).toBe("pending");
    expect(normalizeDeviceStudentStatus({ device_sync_status: "synced", device_user_id: null })).toBe("pending");
  });
});

describe("buildDeviceStudentImageSyncPlan", () => {
  it("keeps unchanged students, removes old ones, adds new ones, and flags changed photo metadata", () => {
    const previous = [
      { id: "1", device_user_id: "A101", full_name: "Alice A", class_name: "S1A", student_type: "boarding", photo_url: "/img/a-old.jpg" },
      { id: "2", device_user_id: "A102", full_name: "Bob B", class_name: "S1A", student_type: "boarding", photo_url: "/img/b.jpg" },
      { id: "3", device_user_id: "A103", full_name: "Carol C", class_name: "S1B", student_type: "day", photo_url: "/img/c.jpg" },
    ];

    const next = [
      { id: "2", device_user_id: "A102", full_name: "Bob B", class_name: "S1A", student_type: "boarding", photo_url: "/img/b-new.jpg" },
      { id: "4", device_user_id: "A104", full_name: "Dora D", class_name: "S1A", student_type: "day", photo_url: "/img/d.jpg" },
    ];

    const plan = buildDeviceStudentImageSyncPlan(previous, next);

    expect(plan.keep).toEqual(["2"]);
    expect(plan.remove).toEqual(["1", "3"]);
    expect(plan.add).toEqual(["4"]);
    expect(plan.changed).toEqual(["2"]);
    expect(plan.total).toBe(4);
  });
});

describe("resolveAttendanceStatusForTime", () => {
  it("marks attendance as present when the scan falls inside a configured window", () => {
    const status = resolveAttendanceStatusForTime("2026-06-24T07:30:00", [
      { label: "Morning", start: "07:00", end: "08:00" }
    ]);

    expect(status).toBe("present");
  });

  it("marks attendance as late when a rule label says late", () => {
    const status = resolveAttendanceStatusForTime("2026-06-24T08:20:00", [
      { label: "Late", start: "07:00", end: "08:00" }
    ]);

    expect(status).toBe("late");
  });

  it("keeps scans in the grace window as grace when the grace period is enabled", () => {
    const status = resolveAttendanceStatusForTime("2026-06-24T08:12:00", [
      { label: "Morning", start: "07:00", end: "08:00", grace_minutes: 15 }
    ]);

    expect(status).toBe("grace");
  });

  it("marks attendance as late once the grace window is over", () => {
    const status = resolveAttendanceStatusForTime("2026-06-24T08:22:00", [
      { label: "Morning", start: "07:00", end: "08:00", grace_minutes: 15 }
    ]);

    expect(status).toBe("late");
  });

  it("marks attendance as late immediately after the end time when grace is disabled", () => {
    const status = resolveAttendanceStatusForTime("2026-06-24T08:05:00", [
      { label: "Morning", start: "07:00", end: "08:00", grace_minutes: 0 }
    ]);

    expect(status).toBe("late");
  });

  it("marks attendance as late when the scan falls after the configured window and grace is disabled", () => {
    const status = resolveAttendanceStatusForTime("2026-06-24T09:00:00", [
      { label: "Morning", start: "07:00", end: "08:00" }
    ]);

    expect(status).toBe("late");
  });
});
