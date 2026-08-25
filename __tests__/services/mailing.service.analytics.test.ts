const mockDb = {
  mailing: { findFirst: jest.fn(), update: jest.fn() },
  mailingLink: { findMany: jest.fn() },
  mailingLinkClick: { findMany: jest.fn() }
};

jest.mock('@/lib/db', () => ({ db: mockDb }));
jest.mock('@/lib/logger');
jest.mock('@/lib/queues/mailing.queue', () => ({
  mailingQueue: null,
  getMailingWorker: jest.fn()
}));

import { MailingService } from '@/lib/services/mailing.service';

describe('MailingService.getMailingStats', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockDb.mailing.findFirst.mockResolvedValue({
      id: 'mailing-1',
      projectId: 'project-1',
      recipients: [
        {
          status: 'SENT',
          clickedAt: new Date('2026-08-25T10:00:00.000Z'),
          error: null
        },
        { status: 'SENT', clickedAt: null, error: null },
        {
          status: 'FAILED',
          clickedAt: null,
          error: 'bot was blocked by the user'
        }
      ]
    });
    mockDb.mailingLink.findMany.mockResolvedValue([]);
    mockDb.mailingLinkClick.findMany.mockResolvedValue([]);
  });

  it('ограничивает mailing проектом и возвращает только доказуемые метрики', async () => {
    const result = await MailingService.getMailingStats(
      'project-1',
      'mailing-1'
    );

    expect(mockDb.mailing.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'mailing-1', projectId: 'project-1' }
      })
    );
    expect(result).toMatchObject({
      total: 3,
      sent: 2,
      failed: 1,
      clicked: 1,
      clickThroughRate: 50,
      readTrackingAvailable: false
    });
    expect(result).not.toHaveProperty('opened');
    expect(result).not.toHaveProperty('openRate');
    expect(mockDb.mailing.update).not.toHaveBeenCalled();
  });
});
