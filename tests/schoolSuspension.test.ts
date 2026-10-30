import { AppError } from "../src/middleware/errorHandler";
import { loginSchoolUser } from "../src/services/auth.service";
import { updateSchoolStatus } from "../src/services/platform/school.service";
import { prisma } from "../src/database/prisma";
import { comparePassword } from "../src/utils/hash";
import { sendSchoolSuspensionEmail } from "../src/utils/mailer";

jest.mock("../src/database/prisma", () => ({
  prisma: {
    users: {
      findFirst: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn()
    },
    schools: {
      findFirst: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn()
    },
    sessions: {
      create: jest.fn(),
      updateMany: jest.fn(),
      findFirst: jest.fn()
    },
    platform_users: {
      findFirst: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn()
    },
    school_subscriptions: {
      findFirst: jest.fn(),
      findMany: jest.fn(),
      count: jest.fn()
    },
    invoices: {
      findMany: jest.fn(),
      count: jest.fn()
    },
    $transaction: jest.fn()
  }
}));

jest.mock("../src/utils/hash", () => ({
  comparePassword: jest.fn(),
  hashPassword: jest.fn()
}));

jest.mock("../src/utils/jwt", () => ({
  signAccessToken: jest.fn(),
  signRefreshToken: jest.fn(),
  verifyRefreshToken: jest.fn(),
  verifyAccessToken: jest.fn()
}));

jest.mock("../src/utils/mailer", () => ({
  buildResetUrl: jest.fn(),
  sendPasswordResetEmail: jest.fn(),
  sendTeacherOnboardingEmail: jest.fn(),
  sendSchoolWelcomeEmail: jest.fn(),
  sendSchoolSuspensionEmail: jest.fn().mockResolvedValue(undefined)
}));

jest.mock("../src/services/audit.service", () => ({
  logAction: jest.fn()
}));

const mockedUserFindFirst = prisma.users.findFirst as jest.Mock;
const mockedSchoolFindFirst = prisma.schools.findFirst as jest.Mock;
const mockedSchoolUpdate = prisma.schools.update as jest.Mock;
const mockedSessionUpdateMany = prisma.sessions.updateMany as jest.Mock;
const mockedComparePassword = comparePassword as jest.MockedFunction<typeof comparePassword>;
const mockedSendSchoolSuspensionEmail = sendSchoolSuspensionEmail as jest.MockedFunction<typeof sendSchoolSuspensionEmail>;

describe("school suspension behavior", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("blocks school login when the school is suspended", async () => {
    mockedUserFindFirst.mockResolvedValue({
      id: BigInt(1),
      uuid: "user-1",
      school_id: BigInt(20),
      name: "Admin User",
      email: "admin@school.test",
      phone: null,
      role: "school_admin",
      status: "active",
      avatar_url: null,
      password_hash: "hashed-password",
      school: { status: "suspended" },
      user_roles: []
    } as any);

    mockedComparePassword.mockResolvedValue(true);

    await expect(loginSchoolUser("admin@school.test", "Password@123")).rejects.toMatchObject({
      message: "School suspended. Check your email and contact the system administrator.",
      statusCode: 403
    });

    expect(mockedComparePassword).not.toHaveBeenCalled();
  });

  it("notifies school contacts when suspension is applied", async () => {
    mockedSchoolFindFirst.mockResolvedValue({
      id: BigInt(20),
      name: "ESTG",
      status: "active",
      school_email: "school@example.com",
      principal_email: "principal@example.com"
    } as any);

    mockedSchoolUpdate.mockResolvedValue({
      id: BigInt(20),
      uuid: "school-uuid",
      name: "ESTG",
      school_type: "government",
      province: "Western",
      district: "Kampala City",
      country: "Uganda",
      sector: null,
      logo_url: null,
      website: null,
      principal_name: "Principal",
      principal_phone: null,
      principal_email: "principal@example.com",
      school_phone: null,
      school_email: "school@example.com",
      subscription_plan_id: null,
      status: "suspended",
      trial_ends_at: null,
      grace_ends_at: null,
      timezone: "Africa/Kigali",
      currency: "RWF",
      has_boarding: false,
      has_biometrics: false,
      has_gate: false,
      has_visitor_mgmt: false,
      has_exam_system: false,
      has_salary_mgmt: false,
      has_parent_app: false,
      has_bulk_sms: false,
      settings: null,
      created_at: new Date(),
      updated_at: new Date(),
      deleted_at: null,
      _count: { students: 0, users: 0 },
      subscription_plan: null
    } as any);

    mockedSessionUpdateMany.mockResolvedValue({ count: 3 });

    await updateSchoolStatus("20", "suspended");

    expect(mockedSessionUpdateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ school_id: BigInt(20), revoked_at: null }),
        data: expect.objectContaining({ revoked_at: expect.any(Date) })
      })
    );
    expect(mockedSendSchoolSuspensionEmail).toHaveBeenCalledTimes(2);
    expect(mockedSendSchoolSuspensionEmail).toHaveBeenCalledWith("school@example.com", "ESTG");
    expect(mockedSendSchoolSuspensionEmail).toHaveBeenCalledWith("principal@example.com", "ESTG");
  });
});
