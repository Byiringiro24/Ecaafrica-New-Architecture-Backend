import { prisma } from "../src/database/prisma";
import { listDosWorkItems } from "../src/services/dos-work-item.service";

jest.mock("../src/database/prisma", () => ({
  prisma: {
    $transaction: jest.fn(),
    dos_work_items: {
      findMany: jest.fn(),
      count: jest.fn()
    }
  }
}));

const mockedPrisma = prisma as typeof prisma & {
  $transaction: jest.Mock;
  dos_work_items: {
    findMany: jest.Mock;
    count: jest.Mock;
  };
};

beforeEach(() => {
  jest.clearAllMocks();
  mockedPrisma.$transaction.mockImplementation((operations: Promise<unknown>[]) =>
    Promise.all(operations)
  );
});

describe("DOS work item listing", () => {
  it("normalizes string pagination before calling Prisma", async () => {
    mockedPrisma.dos_work_items.findMany.mockResolvedValue([]);
    mockedPrisma.dos_work_items.count.mockResolvedValue(0);

    await listDosWorkItems(42, { page: "2", limit: "50", type: "calendar" });

    expect(mockedPrisma.dos_work_items.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          school_id: 42n,
          type: "calendar"
        }),
        skip: 50,
        take: 50
      })
    );
  });
});
