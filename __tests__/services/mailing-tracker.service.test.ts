const tx = {
  mailingRecipient: {
    updateMany: jest.fn(),
    update: jest.fn()
  },
  mailingLinkClick: { create: jest.fn() },
  mailingHistory: { create: jest.fn() },
  mailing: { update: jest.fn() }
};

const mockDb = {
  mailingLink: {
    findUnique: jest.fn(),
    findMany: jest.fn(),
    create: jest.fn()
  },
  mailingRecipient: { findFirst: jest.fn() },
  $transaction: jest.fn(async (callback: (client: typeof tx) => unknown) =>
    callback(tx)
  )
};

jest.mock('@/lib/db', () => ({ db: mockDb }));
jest.mock('@/lib/logger');

import { MailingTrackerService } from '@/lib/services/mailing-tracker.service';

describe('MailingTrackerService.recordClick', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockDb.mailingLink.findUnique.mockResolvedValue({
      id: 'link-1',
      mailingId: 'mailing-1',
      originalUrl: 'https://example.com/offer',
      mailing: {
        id: 'mailing-1',
        projectId: 'project-1',
        name: 'MAX offer',
        type: 'MAX'
      }
    });
    mockDb.mailingRecipient.findFirst.mockResolvedValue({
      id: 'recipient-1',
      mailingId: 'mailing-1',
      userId: 'user-1'
    });
    tx.mailingRecipient.updateMany.mockResolvedValue({ count: 1 });
    tx.mailingRecipient.update.mockResolvedValue({});
    tx.mailingLinkClick.create.mockResolvedValue({});
    tx.mailingHistory.create.mockResolvedValue({});
    tx.mailing.update.mockResolvedValue({});
  });

  it('считает уникального кликнувшего один раз и не выдаёт клик за прочтение', async () => {
    const result = await MailingTrackerService.recordClick({
      shortCode: 'abc123',
      recipientId: 'recipient-1',
      userAgent: 'browser',
      ipAddress: '127.0.0.1'
    });

    expect(mockDb.mailingRecipient.findFirst).toHaveBeenCalledWith({
      where: { id: 'recipient-1', mailingId: 'mailing-1' }
    });
    expect(tx.mailingRecipient.update).toHaveBeenCalledWith({
      where: { id: 'recipient-1' },
      data: { clickCount: { increment: 1 } }
    });
    expect(tx.mailing.update).toHaveBeenCalledWith({
      where: { id: 'mailing-1' },
      data: { clickedCount: { increment: 1 } }
    });
    expect(JSON.stringify(tx.mailingRecipient.update.mock.calls)).not.toContain(
      'opened'
    );
    expect(result.destinationUrl).toContain('utm_source=max');
    expect(result.destinationUrl).toContain('utm_user=user-1');
  });

  it('не увеличивает unique clicked при повторном клике', async () => {
    tx.mailingRecipient.updateMany.mockResolvedValue({ count: 0 });

    await MailingTrackerService.recordClick({
      shortCode: 'abc123',
      recipientId: 'recipient-1'
    });

    expect(tx.mailingLinkClick.create).toHaveBeenCalledTimes(1);
    expect(tx.mailingRecipient.update).toHaveBeenCalledTimes(1);
    expect(tx.mailing.update).not.toHaveBeenCalled();
  });

  it('не привязывает клик к recipient из другой рассылки', async () => {
    mockDb.mailingRecipient.findFirst.mockResolvedValue(null);

    const result = await MailingTrackerService.recordClick({
      shortCode: 'abc123',
      recipientId: 'foreign-recipient'
    });

    expect(mockDb.$transaction).not.toHaveBeenCalled();
    expect(result.recipientId).toBeUndefined();
    expect(result.destinationUrl).not.toContain('utm_user=');
  });
});
