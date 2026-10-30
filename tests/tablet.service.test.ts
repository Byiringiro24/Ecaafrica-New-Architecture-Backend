import axios from 'axios';
import { withTabletOfflineRetry, TabletService } from '../src/services/tablet.service';
import { prisma } from '../src/database/prisma';
import { findDeviceById, markStudentsAbsent } from '../src/services/device.service';
import { TabletStatus } from '../src/types/tablet.types';

jest.mock('axios', () => ({
  __esModule: true,
  default: { get: jest.fn() },
}));

// Mock the prisma client
jest.mock('../src/database/prisma', () => ({
  prisma: {
    tablets: {
      findMany: jest.fn(),
      count: jest.fn(),
    },
    devices: {
      findMany: jest.fn(),
      count: jest.fn(),
      findFirst: jest.fn(),
    },
    sections: {
      findMany: jest.fn(),
    },
    students: {
      findMany: jest.fn(),
    },
    gate_logs: {
      findMany: jest.fn(),
      create: jest.fn(),
    },
  },
}));

describe('withTabletOfflineRetry', () => {
  it('retries offline tablet calls until the device responds', async () => {
    let attempts = 0;

    const result = await withTabletOfflineRetry(
      async () => {
        attempts += 1;
        if (attempts < 3) {
          throw new Error('Tablet error: device not connected');
        }
        return 'ok';
      },
      { timeoutMs: 5000, retryIntervalMs: 0 }
    );

    expect(result).toBe('ok');
    expect(attempts).toBe(3);
  });
});

describe('device online status', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (axios.get as jest.Mock).mockReset();
  });

  it('marks a device offline only when the bridge is unreachable and the heartbeat is stale', async () => {
    (prisma.devices.findFirst as jest.Mock).mockResolvedValue({
      id: BigInt(1),
      school_id: BigInt(1),
      device_uid: 'dev-1',
      name: 'Device 1',
      type: 'tablet',
      location: 'Gate',
      mode: 'gate',
      is_active: true,
      last_seen_at: new Date(Date.now() - 10 * 60 * 1000),
      last_sync_at: null,
      tablet_port: 5000,
      is_connected: false,
      tablet: { url: 'http://10.0.0.10:5000' },
      pin_hash: null,
      api_url: null,
      tablet_ip: null,
      last_status_message: null,
      last_sync_status: null,
      last_sync_error: null,
      connection_error: null,
      device_serial: null,
      device_logs_count: 0,
      device_users_count: 0,
      firmware_version: null,
      license_number: null,
      product_code: null,
      product_name: null,
      tablet_id: null,
      location_scope: 'gate',
      dormitory_id: null,
      location_label: null,
      assigned_by: null,
      assigned_at: null,
      created_at: new Date(),
      updated_at: new Date(),
    });
    (axios.get as jest.Mock).mockRejectedValue(new Error('No response received'));

    const result = await findDeviceById(BigInt(1), '1');

    expect(result.status).toBe('offline');
    expect(result.is_online).toBe(false);
    expect(result.is_connected).toBe(false);
  });

  it('keeps a device online when the bridge is reachable even if the last heartbeat is stale', async () => {
    (prisma.devices.findFirst as jest.Mock).mockResolvedValue({
      id: BigInt(1),
      school_id: BigInt(1),
      device_uid: 'dev-1',
      name: 'Device 1',
      type: 'tablet',
      location: 'Gate',
      mode: 'gate',
      is_active: true,
      last_seen_at: new Date(Date.now() - 10 * 60 * 1000),
      last_sync_at: null,
      tablet_port: 5000,
      is_connected: false,
      tablet: { url: 'http://10.0.0.10:5000' },
      pin_hash: null,
      api_url: null,
      tablet_ip: null,
      last_status_message: null,
      last_sync_status: null,
      last_sync_error: null,
      connection_error: null,
      device_serial: null,
      device_logs_count: 0,
      device_users_count: 0,
      firmware_version: null,
      license_number: null,
      product_code: null,
      product_name: null,
      tablet_id: null,
      location_scope: 'gate',
      dormitory_id: null,
      location_label: null,
      assigned_by: null,
      assigned_at: null,
      created_at: new Date(),
      updated_at: new Date(),
    });
    (axios.get as jest.Mock).mockResolvedValue({ status: 200 });

    const result = await findDeviceById(BigInt(1), '1');

    expect(result.status).toBe('online');
    expect(result.is_online).toBe(true);
    expect(result.is_connected).toBe(true);
  });
});

describe('markStudentsAbsent offline protection', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('does not auto-create absent records when the device is offline and no logs were fetched', async () => {
    (prisma.devices.findFirst as jest.Mock).mockResolvedValue({
      id: BigInt(1),
      school_id: BigInt(1),
      device_uid: 'dev-1',
      name: 'Device 1',
      type: 'tablet',
      location: 'Gate',
      mode: 'gate',
      is_active: true,
      last_seen_at: new Date(Date.now() - 10 * 60 * 1000),
      last_sync_at: null,
      tablet_port: 5000,
      is_connected: false,
      attendance_config: {
        sessions: [
          {
            session_id: 'session-1',
            name: 'Morning',
            rules: [
              { label: 'Morning', start: '08:00', end: '10:00' }
            ]
          }
        ]
      },
      tablet: { url: 'http://10.0.0.10:5000', status: 'offline' },
      api_url: null,
      tablet_ip: '10.0.0.10',
      created_at: new Date(),
      updated_at: new Date(),
      pin_hash: null,
      last_status_message: null,
      last_sync_status: null,
      last_sync_error: null,
      connection_error: null,
      device_serial: null,
      device_logs_count: 0,
      device_users_count: 0,
      firmware_version: null,
      license_number: null,
      product_code: null,
      product_name: null,
      tablet_id: null,
      location_scope: 'gate',
      dormitory_id: null,
      location_label: null,
      assigned_by: null,
      assigned_at: null,
    });

    (prisma.students.findMany as jest.Mock).mockResolvedValue([
      { id: BigInt(10), first_name: 'Alice', last_name: 'Smith', student_id_number: 'ST-001' }
    ]);
    (prisma.gate_logs.findMany as jest.Mock).mockResolvedValue([]);

    const result = await markStudentsAbsent(BigInt(1), '1', 'session-1', { date: '2026-10-26' });

    expect(result.absent_count).toBe(0);
    expect(result.status).toBe('no_data_fetched');
    expect(prisma.gate_logs.create).not.toHaveBeenCalled();
  });
});

describe('TabletService - findAllTablets', () => {
  let tabletService: TabletService;
  const mockSchoolId = BigInt(1);

  beforeEach(() => {
    tabletService = new TabletService();
    jest.clearAllMocks();
  });

  describe('Basic functionality', () => {
    it('should return all tablets without pagination', async () => {
      const mockTablets = [
        {
          id: BigInt(1),
          name: 'Tablet 1',
          location: 'Building A',
          status: 'online' as TabletStatus,
          last_health_check: new Date('2024-01-01T10:00:00Z'),
        },
        {
          id: BigInt(2),
          name: 'Tablet 2',
          location: 'Building B',
          status: 'offline' as TabletStatus,
          last_health_check: new Date('2024-01-01T09:00:00Z'),
        },
      ];

      (prisma.tablets.findMany as jest.Mock).mockResolvedValue(mockTablets);

      const result = await tabletService.findAllTablets(mockSchoolId);

      expect(result.data).toEqual(mockTablets);
      expect(result).not.toHaveProperty('pagination');
      expect(prisma.tablets.findMany).toHaveBeenCalledWith({
        where: {
          school_id: mockSchoolId,
          deleted_at: null,
        },
        select: {
          id: true,
          name: true,
          location: true,
          status: true,
          last_health_check: true,
        },
        orderBy: { created_at: 'desc' },
      });
    });

    it('should return paginated tablets when pagination is provided', async () => {
      const mockTablets = [
        {
          id: BigInt(1),
          name: 'Tablet 1',
          location: 'Building A',
          status: 'online' as TabletStatus,
          last_health_check: new Date('2024-01-01T10:00:00Z'),
        },
      ];

      (prisma.tablets.findMany as jest.Mock).mockResolvedValue(mockTablets);
      (prisma.tablets.count as jest.Mock).mockResolvedValue(15);

      const result = await tabletService.findAllTablets(
        mockSchoolId,
        {},
        { page: 1, limit: 10 }
      );

      expect(result.data).toEqual(mockTablets);
      expect(result).toHaveProperty('pagination');
      expect((result as any).pagination).toEqual({
        page: 1,
        limit: 10,
        total: 15,
        totalPages: 2,
      });
    });
  });

  describe('Status filtering', () => {
    it('should filter tablets by online status', async () => {
      const mockTablets = [
        {
          id: BigInt(1),
          name: 'Online Tablet',
          location: 'Building A',
          status: 'online' as TabletStatus,
          last_health_check: new Date(),
        },
      ];

      (prisma.tablets.findMany as jest.Mock).mockResolvedValue(mockTablets);

      await tabletService.findAllTablets(mockSchoolId, {
        status: TabletStatus.ONLINE,
      });

      expect(prisma.tablets.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            status: 'online',
          }),
        })
      );
    });

    it('should filter tablets by offline status', async () => {
      (prisma.tablets.findMany as jest.Mock).mockResolvedValue([]);

      await tabletService.findAllTablets(mockSchoolId, {
        status: TabletStatus.OFFLINE,
      });

      expect(prisma.tablets.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            status: 'offline',
          }),
        })
      );
    });

    it('should filter tablets by maintenance status', async () => {
      (prisma.tablets.findMany as jest.Mock).mockResolvedValue([]);

      await tabletService.findAllTablets(mockSchoolId, {
        status: TabletStatus.MAINTENANCE,
      });

      expect(prisma.tablets.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            status: 'maintenance',
          }),
        })
      );
    });
  });

  describe('is_active filtering', () => {
    it('should filter tablets by is_active = true', async () => {
      (prisma.tablets.findMany as jest.Mock).mockResolvedValue([]);

      await tabletService.findAllTablets(mockSchoolId, {
        is_active: true,
      });

      expect(prisma.tablets.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            is_active: true,
          }),
        })
      );
    });

    it('should filter tablets by is_active = false', async () => {
      (prisma.tablets.findMany as jest.Mock).mockResolvedValue([]);

      await tabletService.findAllTablets(mockSchoolId, {
        is_active: false,
      });

      expect(prisma.tablets.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            is_active: false,
          }),
        })
      );
    });
  });

  describe('Combined filters', () => {
    it('should apply both status and is_active filters', async () => {
      (prisma.tablets.findMany as jest.Mock).mockResolvedValue([]);

      await tabletService.findAllTablets(mockSchoolId, {
        status: TabletStatus.ONLINE,
        is_active: true,
      });

      expect(prisma.tablets.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            status: 'online',
            is_active: true,
          }),
        })
      );
    });

    it('should apply filters with pagination', async () => {
      (prisma.tablets.findMany as jest.Mock).mockResolvedValue([]);
      (prisma.tablets.count as jest.Mock).mockResolvedValue(0);

      await tabletService.findAllTablets(
        mockSchoolId,
        {
          status: TabletStatus.ONLINE,
          is_active: true,
        },
        { page: 2, limit: 5 }
      );

      expect(prisma.tablets.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            status: 'online',
            is_active: true,
          }),
          skip: 5, // (page 2 - 1) * limit 5
          take: 5,
        })
      );
    });
  });

  describe('Pagination calculations', () => {
    it('should calculate correct pagination for page 1', async () => {
      (prisma.tablets.findMany as jest.Mock).mockResolvedValue([]);
      (prisma.tablets.count as jest.Mock).mockResolvedValue(25);

      const result = await tabletService.findAllTablets(
        mockSchoolId,
        {},
        { page: 1, limit: 10 }
      );

      expect((result as any).pagination).toEqual({
        page: 1,
        limit: 10,
        total: 25,
        totalPages: 3,
      });
    });

    it('should calculate correct skip value for page 3', async () => {
      (prisma.tablets.findMany as jest.Mock).mockResolvedValue([]);
      (prisma.tablets.count as jest.Mock).mockResolvedValue(50);

      await tabletService.findAllTablets(
        mockSchoolId,
        {},
        { page: 3, limit: 10 }
      );

      expect(prisma.tablets.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          skip: 20, // (page 3 - 1) * limit 10
          take: 10,
        })
      );
    });

    it('should handle totalPages calculation with remainder', async () => {
      (prisma.tablets.findMany as jest.Mock).mockResolvedValue([]);
      (prisma.tablets.count as jest.Mock).mockResolvedValue(23);

      const result = await tabletService.findAllTablets(
        mockSchoolId,
        {},
        { page: 1, limit: 10 }
      );

      expect((result as any).pagination.totalPages).toBe(3); // Math.ceil(23 / 10)
    });
  });

  describe('Field selection', () => {
    it('should only return specified fields', async () => {
      const mockTablet = {
        id: BigInt(1),
        name: 'Tablet 1',
        location: 'Building A',
        status: 'online' as TabletStatus,
        last_health_check: new Date(),
      };

      (prisma.tablets.findMany as jest.Mock).mockResolvedValue([mockTablet]);

      const result = await tabletService.findAllTablets(mockSchoolId);

      // Verify that the select clause only includes required fields
      expect(prisma.tablets.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          select: {
            id: true,
            name: true,
            location: true,
            status: true,
            last_health_check: true,
          },
        })
      );

      // Verify returned data has only these fields
      expect(result.data[0]).toHaveProperty('id');
      expect(result.data[0]).toHaveProperty('name');
      expect(result.data[0]).toHaveProperty('location');
      expect(result.data[0]).toHaveProperty('status');
      expect(result.data[0]).toHaveProperty('last_health_check');
    });
  });

  describe('Edge cases', () => {
    it('should handle empty results', async () => {
      (prisma.tablets.findMany as jest.Mock).mockResolvedValue([]);

      const result = await tabletService.findAllTablets(mockSchoolId);

      expect(result.data).toEqual([]);
      expect(Array.isArray(result.data)).toBe(true);
    });

    it('should handle empty results with pagination', async () => {
      (prisma.tablets.findMany as jest.Mock).mockResolvedValue([]);
      (prisma.tablets.count as jest.Mock).mockResolvedValue(0);

      const result = await tabletService.findAllTablets(
        mockSchoolId,
        {},
        { page: 1, limit: 10 }
      );

      expect(result.data).toEqual([]);
      expect((result as any).pagination).toEqual({
        page: 1,
        limit: 10,
        total: 0,
        totalPages: 0,
      });
    });

    it('should always exclude soft-deleted tablets', async () => {
      (prisma.tablets.findMany as jest.Mock).mockResolvedValue([]);

      await tabletService.findAllTablets(mockSchoolId);

      expect(prisma.tablets.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            deleted_at: null,
          }),
        })
      );
    });
  });
});
