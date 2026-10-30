import { prisma } from "../src/database/prisma";
import { createUser, findAllUsers } from "../src/services/user.service";

jest.mock("../src/database/prisma", () => ({
  prisma: {
    $transaction: jest.fn(),
    users: {
      findFirst: jest.fn(),
      create: jest.fn(),
      findMany: jest.fn(),
      count: jest.fn()
    },
    roles: {
      findFirst: jest.fn(),
      findMany: jest.fn()
    },
    user_roles: {
      createMany: jest.fn(),
      deleteMany: jest.fn(),
      findMany: jest.fn()
    },
    audit_logs: {
      create: jest.fn()
    }
  }
}));

jest.mock("../src/utils/hash", () => ({
  hashPassword: jest.fn().mockResolvedValue("hashed-password")
}));

const mockedPrisma = prisma as typeof prisma & {
  $transaction: jest.Mock;
  users: {
    findFirst: jest.Mock;
    create: jest.Mock;
    findMany: jest.Mock;
    count: jest.Mock;
  };
  roles: {
    findFirst: jest.Mock;
    findMany: jest.Mock;
  };
  user_roles: {
    createMany: jest.Mock;
    deleteMany: jest.Mock;
    findMany: jest.Mock;
  };
  audit_logs: {
    create: jest.Mock;
  };
};

const tx = {
  users: {
    findFirst: jest.fn(),
    create: jest.fn()
  },
  roles: {
    findFirst: jest.fn(),
    findMany: jest.fn()
  },
  user_roles: {
    createMany: jest.fn(),
    deleteMany: jest.fn(),
    findMany: jest.fn()
  }
};

describe("user multi-role creation", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockedPrisma.$transaction.mockImplementation(async (arg) => Array.isArray(arg) ? Promise.all(arg) : arg(tx));

    tx.users.findFirst
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({
        id: 42n,
        uuid: "uuid-42",
        school_id: 7n,
        name: "Aline",
        email: "aline@example.com",
        phone: null,
        role: "teacher",
        status: "active",
        avatar_url: null,
        last_login_at: null,
        created_at: new Date(),
        updated_at: new Date(),
        deleted_at: null,
        user_roles: []
      });
    tx.users.create.mockResolvedValue({
      id: 42n,
      uuid: "uuid-42",
      school_id: 7n,
      name: "Aline",
      email: "aline@example.com",
      phone: null,
      role: "teacher",
      status: "active",
      avatar_url: null,
      last_login_at: null,
      created_at: new Date(),
      updated_at: new Date(),
      deleted_at: null,
      user_roles: []
    });

    tx.roles.findFirst.mockImplementation(({ where }) => Promise.resolve({
      id: where.slug === "staff" ? 11n : 12n,
      school_id: 7n,
      name: where.slug === "staff" ? "Staff" : "Patron",
      slug: where.slug,
      permissions: {},
      is_system: false,
      created_at: new Date(),
      updated_at: new Date(),
      deleted_at: null
    }));
    tx.roles.findMany.mockResolvedValue([
      { id: 11n, slug: "staff" },
      { id: 12n, slug: "patron" }
    ]);
    tx.user_roles.findMany.mockResolvedValue([]);
    mockedPrisma.audit_logs.create.mockResolvedValue({ id: 1n });
  });

  it("creates secondary role assignments alongside the primary role", async () => {
    await createUser(7, {
      name: "Aline",
      email: "aline@example.com",
      password: "StrongPass123",
      role: "teacher",
      roles: ["staff", "patron"]
    });

    expect(tx.user_roles.createMany).toHaveBeenCalledWith({
      data: expect.arrayContaining([
        { user_id: 42n, role_id: 11n, school_id: 7n },
        { user_id: 42n, role_id: 12n, school_id: 7n }
      ]),
      skipDuplicates: true
    });
  });

  it("defaults to newest users first and supports email search", async () => {
    mockedPrisma.users.findMany.mockResolvedValue([]);
    mockedPrisma.users.count.mockResolvedValue(0);

    await findAllUsers(7, { page: 1, limit: 10 }, { q: "jane@example.com" });

    expect(mockedPrisma.users.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({
        school_id: 7n,
        deleted_at: null,
        OR: [
          { name: { contains: "jane@example.com", mode: "insensitive" } },
          { email: { contains: "jane@example.com", mode: "insensitive" } },
          { phone: { contains: "jane@example.com", mode: "insensitive" } }
        ]
      }),
      orderBy: { created_at: "desc" },
      skip: 0,
      take: 10
    }));
  });
});
