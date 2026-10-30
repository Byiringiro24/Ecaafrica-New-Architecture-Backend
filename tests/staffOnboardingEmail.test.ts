jest.mock("../src/utils/mailer", () => ({
  sendTeacherOnboardingEmail: jest.fn().mockResolvedValue(undefined)
}));

import { createUser } from "../src/services/user.service";
import { prisma } from "../src/database/prisma";
import { sendTeacherOnboardingEmail } from "../src/utils/mailer";
import { STAFF_ROLES, SchoolRole } from "../src/constants/roles";

jest.mock("../src/database/prisma", () => ({
  prisma: {
    users: { findFirst: jest.fn(), create: jest.fn() },
    $transaction: jest.fn()
  }
}));

jest.mock("../src/utils/hash", () => ({
  hashPassword: jest.fn().mockResolvedValue("hashed")
}));


jest.mock("../src/services/audit.service", () => ({
  logAction: jest.fn()
}));

const mailerMock = sendTeacherOnboardingEmail as jest.Mock;
const txMock = prisma.$transaction as unknown as jest.Mock;

const buildTx = (role: string, email: string | null) => ({
  users: {
    findFirst: jest.fn().mockResolvedValue(null),
    create: jest.fn().mockResolvedValue({
      id: 10n,
      uuid: "user-uuid",
      school_id: 1n,
      name: "Jane Doe",
      email,
      phone: null,
      role,
      status: "active",
      avatar_url: null,
      created_at: new Date(),
      updated_at: new Date(),
      user_roles: []
    })
  }
});

const runCreate = async (role: string, email: string | null = "jane@example.com") => {
  const tx = buildTx(role, email);
  txMock.mockImplementation(async (cb: (t: unknown) => unknown) => cb(tx));

  return createUser(1n, {
    name: "Jane Doe",
    email,
    password: "Staff@12345",
    role,
    status: "active"
  });
};

describe("staff account creation sends onboarding instructions", () => {
  beforeEach(() => {
    mailerMock.mockClear();
    mailerMock.mockResolvedValue(undefined);
  });

  for (const role of STAFF_ROLES) {
    it(`emails a newly created "${role}"`, async () => {
      await runCreate(role);

      expect(mailerMock).toHaveBeenCalledTimes(1);
      expect(mailerMock).toHaveBeenCalledWith("jane@example.com", "Jane Doe");
    });
  }

  it("covers the finance officer role explicitly", async () => {
    await runCreate(SchoolRole.FINANCE_OFFICER);

    expect(mailerMock).toHaveBeenCalledWith("jane@example.com", "Jane Doe");
  });

  for (const role of [SchoolRole.PARENT, SchoolRole.STUDENT]) {
    it(`does not email a "${role}"`, async () => {
      await runCreate(role);

      expect(mailerMock).not.toHaveBeenCalled();
    });
  }

  it("skips the email when no address was provided", async () => {
    await runCreate(SchoolRole.FINANCE_OFFICER, null);

    expect(mailerMock).not.toHaveBeenCalled();
  });

  it("still returns the created user when the email fails", async () => {
    const mailerModule = require("../src/utils/mailer");
    mailerModule.sendTeacherOnboardingEmail = jest.fn().mockRejectedValue("SMTP is not configured");

    const result = await runCreate(SchoolRole.FINANCE_OFFICER);

    expect(result.email).toBe("jane@example.com");
    expect(mailerModule.sendTeacherOnboardingEmail).toHaveBeenCalledTimes(1);
  });
});
