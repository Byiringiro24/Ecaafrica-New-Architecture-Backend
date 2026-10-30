import { prisma } from "../src/database/prisma";
import { listSessionsBySchoolAndDate } from "../src/services/attendance/session.service";
import {
  findAllAttendanceRecords,
  getAttendanceSummary
} from "../src/services/attendance/record.service";

jest.mock("../src/database/prisma", () => ({
  prisma: {
    attendance_sessions: { findMany: jest.fn(), count: jest.fn() },
    attendance_records: { findMany: jest.fn(), count: jest.fn() },
    $transaction: jest.fn()
  }
}));

jest.mock("../src/services/attendance/notification.service", () => ({
  sendAttendanceNotification: jest.fn()
}));

const mockedPrisma = prisma as typeof prisma & {
  attendance_sessions: { findMany: jest.Mock; count: jest.Mock };
  attendance_records: { findMany: jest.Mock; count: jest.Mock };
  $transaction: jest.Mock;
};

beforeEach(() => {
  jest.clearAllMocks();
  mockedPrisma.$transaction.mockImplementation((operations: Promise<unknown>[]) =>
    Promise.all(operations)
  );
});

describe("manual attendance history date filtering", () => {
  it("loads sessions for the complete selected day", async () => {
    mockedPrisma.attendance_sessions.findMany.mockResolvedValue([]);
    mockedPrisma.attendance_sessions.count.mockResolvedValue(0);

    await listSessionsBySchoolAndDate(1, { page: 1, limit: 200 }, {
      section_id: "7",
      date: "2026-08-23"
    });

    expect(mockedPrisma.attendance_sessions.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          session_date: {
            gte: new Date("2026-08-23T00:00:00.000Z"),
            lt: new Date("2026-08-24T00:00:00.000Z")
          }
        })
      })
    );
  });

  it("filters records by attendance date rather than insertion date", async () => {
    mockedPrisma.attendance_records.findMany.mockResolvedValue([]);
    mockedPrisma.attendance_records.count.mockResolvedValue(0);

    await findAllAttendanceRecords(1, { page: 1, limit: 200 }, {
      date: "2026-08-23"
    });

    expect(mockedPrisma.attendance_records.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          session: {
            session_date: {
              gte: new Date("2026-08-23T00:00:00.000Z"),
              lt: new Date("2026-08-24T00:00:00.000Z")
            }
          }
        })
      })
    );
  });

  it("includes manual records when the report starts and ends on the same day", async () => {
    mockedPrisma.attendance_sessions.findMany.mockResolvedValue([]);
    mockedPrisma.attendance_records.findMany.mockResolvedValue([
      { session_id: 1n, status: "present" }
    ]);

    await expect(
      getAttendanceSummary(1, {
        startDate: "2026-08-23",
        endDate: "2026-08-23"
      })
    ).resolves.toMatchObject({ total: 1, present: 1, absent: 0, late: 0, excused: 0 });

    expect(mockedPrisma.attendance_records.findMany).toHaveBeenCalledWith({
      where: {
        school_id: 1n,
        scan_method: "manual",
        session: {
          session_date: {
            gte: new Date("2026-08-23T00:00:00.000Z"),
            lt: new Date("2026-08-24T00:00:00.000Z")
          }
        }
      },
      select: {
        session_id: true,
        status: true
      }
    });
  });

  it("supports filtering class sessions by class_id", async () => {
    mockedPrisma.attendance_sessions.findMany.mockResolvedValue([]);
    mockedPrisma.attendance_sessions.count.mockResolvedValue(0);

    await listSessionsBySchoolAndDate(1, { page: 1, limit: 200 }, {
      class_id: "17",
      date: "2026-08-23"
    });

    expect(mockedPrisma.attendance_sessions.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          section: { class_id: 17n },
          session_date: {
            gte: new Date("2026-08-23T00:00:00.000Z"),
            lt: new Date("2026-08-24T00:00:00.000Z")
          }
        })
      })
    );
  });

  it("keeps sessions for different teachers and subjects separate", async () => {
    mockedPrisma.attendance_sessions.findMany.mockResolvedValue([
      {
        id: 21n,
        school_id: 1n,
        section_id: 7n,
        subject_id: 9n,
        teacher_id: 11n,
        period_id: 3n,
        session_date: new Date("2026-08-23T00:00:00.000Z"),
        subject: { id: 9n, name: "Mathematics", code: "MATH" },
        teacher: { id: 11n, name: "Teacher One" },
        period: { id: 3n, name: "Period 1" },
        section: {
          id: 7n,
          name: "A",
          full_name: "Senior 1A",
          class: { name: "Senior 1" }
        }
      },
      {
        id: 22n,
        school_id: 1n,
        section_id: 7n,
        subject_id: 10n,
        teacher_id: 12n,
        period_id: 3n,
        session_date: new Date("2026-08-23T00:00:00.000Z"),
        subject: { id: 10n, name: "Science", code: "SCI" },
        teacher: { id: 12n, name: "Teacher Two" },
        period: { id: 3n, name: "Period 1" },
        section: {
          id: 7n,
          name: "A",
          full_name: "Senior 1A",
          class: { name: "Senior 1" }
        }
      }
    ]);
    mockedPrisma.attendance_sessions.count.mockResolvedValue(2);

    const result = await listSessionsBySchoolAndDate(1, { page: 1, limit: 200 }, {
      section_id: "7",
      date: "2026-08-23"
    });

    expect(mockedPrisma.attendance_sessions.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          section_id: 7n,
          session_date: {
            gte: new Date("2026-08-23T00:00:00.000Z"),
            lt: new Date("2026-08-24T00:00:00.000Z")
          }
        }),
        include: expect.objectContaining({ subject: expect.any(Object) })
      })
    );
    expect(result.data).toHaveLength(2);
    expect(result.data).toEqual(expect.arrayContaining([
      expect.objectContaining({
        id: "21",
        subject: expect.objectContaining({ name: "Mathematics", code: "MATH" }),
        teacher: expect.objectContaining({ name: "Teacher One" })
      }),
      expect.objectContaining({
        id: "22",
        subject: expect.objectContaining({ name: "Science", code: "SCI" }),
        teacher: expect.objectContaining({ name: "Teacher Two" })
      })
    ]));

    await listSessionsBySchoolAndDate(1, { page: 1, limit: 200 }, {
      section_id: "7",
      subject_id: "9",
      teacher_id: "11",
      period_id: "3",
      date: "2026-08-23"
    });
    expect(mockedPrisma.attendance_sessions.findMany).toHaveBeenLastCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          subject_id: 9n,
          teacher_id: 11n,
          period_id: 3n
        })
      })
    );
    expect(result.data[0]).toMatchObject({
      section: { full_name: "Senior 1A" },
      subject: { name: "Mathematics", code: "MATH" },
      teacher: { name: "Teacher One" },
      period: { name: "Period 1" }
    });
  });

  it("supports filtering records for late and grace-period entries by student type and class", async () => {
    mockedPrisma.attendance_records.findMany.mockResolvedValue([]);
    mockedPrisma.attendance_records.count.mockResolvedValue(0);

    await findAllAttendanceRecords(1, { page: 1, limit: 200 }, {
      class_id: "17",
      student_type: "boarding",
      status: "late",
      late: true,
      grace: true
    });

    expect(mockedPrisma.attendance_records.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          status: "late",
          student: { student_type: "boarding" },
          session: { section: { class_id: 17n } }
        })
      })
    );
  });
});
