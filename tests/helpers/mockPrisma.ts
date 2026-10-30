import jest from 'jest-mock';

export const mockPrisma = (overrides: Record<string, any> = {}) => {
  const defaultClient = {
    $connect: jest.fn().mockResolvedValue(undefined),
    $disconnect: jest.fn().mockResolvedValue(undefined),
    $transaction: jest.fn().mockImplementation(async (args: any) => {
      // If array passed, resolve with an array of empty results matching length
      if (Array.isArray(args)) return args.map(() => []);
      return [];
    }),
    dormitories: {
      findMany: jest.fn().mockResolvedValue([]),
      findUnique: jest.fn().mockResolvedValue(null),
      count: jest.fn().mockResolvedValue(0),
    },
    dormitory_supervisor_assignments: {
      findMany: jest.fn().mockResolvedValue([]),
    },
    staff_profiles: {
      findUnique: jest.fn().mockResolvedValue(null),
    },
  } as any;

  const client = Object.assign(defaultClient, overrides);

  jest.doMock('@prisma/client', () => ({
    PrismaClient: function PrismaClient() {
      return client;
    },
  }));

  return client;
};
