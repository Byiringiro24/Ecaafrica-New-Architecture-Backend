import { sendAttendanceNotification } from '../src/services/attendance/notification.service';
import { prisma } from '../src/database/prisma';
import { sendSMS } from '../src/services/notification/sender.service';

jest.mock('../src/database/prisma', () => ({
  prisma: {
    schools: { findFirst: jest.fn() },
    students: { findFirst: jest.fn() },
    student_parent_links: { findFirst: jest.fn() },
    notification_templates: { findFirst: jest.fn(), create: jest.fn() }
  }
}));

jest.mock('../src/services/notification/sender.service', () => ({
  sendSMS: jest.fn()
}));

describe('sendAttendanceNotification', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('sends a parent SMS for Ugandan schools when attendance is recorded', async () => {
    (prisma.schools.findFirst as jest.Mock).mockResolvedValue({
      id: BigInt(1),
      country: 'Uganda',
      has_bulk_sms: true
    });
    (prisma.students.findFirst as jest.Mock).mockResolvedValue({
      first_name: 'Amina',
      last_name: 'Kato'
    });
    (prisma.student_parent_links.findFirst as jest.Mock).mockResolvedValue({
      parent: {
        id: BigInt(2),
        first_name: 'Jane',
        last_name: 'Kato',
        phone: '+256773666640'
      }
    });
    (prisma.notification_templates.findFirst as jest.Mock).mockResolvedValue(null);
    (prisma.notification_templates.create as jest.Mock).mockResolvedValue({
      id: BigInt(99),
      body_en: 'Education Care\nAttendance: Your child, ${student_name}, has safely arrived at school and checked in at ${time}. Thank you.'
    });
    (sendSMS as jest.Mock).mockResolvedValue({ id: 'log-1' });

    const result = await sendAttendanceNotification({
      schoolId: '1',
      studentId: '10',
      kind: 'school_entry',
      occurredAt: new Date('2026-07-05T08:15:00Z')
    });

    expect(sendSMS).toHaveBeenCalledWith(
      '+256773666640',
      expect.stringContaining('Attendance: Your child, Amina Kato'),
      undefined,
      '1',
      expect.objectContaining({ recipientType: 'parent', triggerType: 'school_entry', templateId: BigInt(99) })
    );
    expect(sendSMS).toHaveBeenCalledWith(
      '+256773666640',
      expect.stringMatching(/Date: \d{2}\/\d{2}\/\d{4}/),
      undefined,
      '1',
      expect.objectContaining({ recipientType: 'parent', triggerType: 'school_entry', templateId: BigInt(99) })
    );
    expect(sendSMS).toHaveBeenCalledWith(
      '+256773666640',
      expect.stringMatching(/Time: \d{2}:\d{2}/),
      undefined,
      '1',
      expect.objectContaining({ recipientType: 'parent', triggerType: 'school_entry', templateId: BigInt(99) })
    );
    expect(result).toEqual({ id: 'log-1' });
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('does not send an SMS for non-Ugandan schools', async () => {
    (prisma.schools.findFirst as jest.Mock).mockResolvedValue({
      id: BigInt(1),
      country: 'Kenya',
      has_bulk_sms: true
    });

    const result = await sendAttendanceNotification({
      schoolId: '1',
      studentId: '10',
      kind: 'school_entry',
      occurredAt: new Date('2026-07-05T08:15:00Z')
    });

    expect(sendSMS).not.toHaveBeenCalled();
    expect(result).toBeNull();
  });
});
