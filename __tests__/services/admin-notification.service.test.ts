/**
 * @file: admin-notification.service.test.ts
 * @description: План 009 (core) — сервис in-app уведомлений админа: create,
 *   throttle по dedupeKey, notifyProjectOwner, tenant-guard в markRead,
 *   unreadCount. БД мокается (@/lib/db), живой БД на сборке нет.
 * @project: SaaS Bonus System
 */

import { AdminNotificationService } from '@/lib/services/admin-notification.service';
import { db } from '@/lib/db';

jest.mock('@/lib/db');
jest.mock('@/lib/logger');

const mockDb = db as jest.Mocked<typeof db>;

const adminAccountId = 'admin-1';
const projectId = 'project-1';

function notifRow(over: Partial<any> = {}) {
  return {
    id: 'notif-1',
    adminAccountId,
    projectId,
    type: 'system',
    severity: 'info',
    title: 'Заголовок',
    message: 'Текст',
    link: null,
    metadata: null,
    dedupeKey: null,
    readAt: null,
    createdAt: new Date(),
    ...over
  };
}

beforeEach(() => {
  jest.clearAllMocks();
  (mockDb as any).adminNotification = {
    findFirst: jest.fn().mockResolvedValue(null),
    findMany: jest.fn().mockResolvedValue([]),
    create: jest.fn().mockResolvedValue(notifRow()),
    count: jest.fn().mockResolvedValue(0),
    updateMany: jest.fn().mockResolvedValue({ count: 0 })
  };
  (mockDb as any).project = {
    findUnique: jest.fn().mockResolvedValue({ ownerId: adminAccountId })
  };
});

describe('AdminNotificationService.create', () => {
  it('вставляет запись с переданными полями', async () => {
    const created = notifRow({ id: 'notif-new', type: 'new_user' });
    (mockDb as any).adminNotification.create.mockResolvedValueOnce(created);

    const result = await AdminNotificationService.create({
      adminAccountId,
      projectId,
      type: 'new_user' as any,
      severity: 'success' as any,
      title: 'Новый пользователь',
      message: 'Зарегистрировался клиент'
    });

    expect((mockDb as any).adminNotification.findFirst).not.toHaveBeenCalled();
    expect((mockDb as any).adminNotification.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          adminAccountId,
          projectId,
          type: 'new_user',
          severity: 'success',
          title: 'Новый пользователь',
          message: 'Зарегистрировался клиент'
        })
      })
    );
    expect(result).toBe(created);
  });

  it('с dedupeKey ПРОПУСКАЕТ вставку при свежей непрочитанной записи', async () => {
    const existing = notifRow({ id: 'notif-existing', dedupeKey: 'dk-1' });
    (mockDb as any).adminNotification.findFirst.mockResolvedValueOnce(existing);

    const result = await AdminNotificationService.create({
      adminAccountId,
      type: 'integration_error' as any,
      title: 'Ошибка интеграции',
      message: 'Повтор',
      dedupeKey: 'dk-1'
    });

    expect((mockDb as any).adminNotification.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          adminAccountId,
          dedupeKey: 'dk-1',
          readAt: null
        })
      })
    );
    expect((mockDb as any).adminNotification.create).not.toHaveBeenCalled();
    expect(result).toBe(existing);
  });
});

describe('AdminNotificationService.notifyProjectOwner', () => {
  it('резолвит владельца и создаёт с adminAccountId=ownerId', async () => {
    const created = notifRow({ id: 'notif-owner' });
    (mockDb as any).adminNotification.create.mockResolvedValueOnce(created);

    const result = await AdminNotificationService.notifyProjectOwner(
      projectId,
      {
        type: 'large_purchase' as any,
        title: 'Крупная покупка',
        message: 'Покупка на большую сумму'
      }
    );

    expect((mockDb as any).project.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: projectId },
        select: { ownerId: true }
      })
    );
    expect((mockDb as any).adminNotification.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          adminAccountId,
          projectId
        })
      })
    );
    expect(result).toBe(created);
  });

  it('возвращает null когда у проекта нет владельца', async () => {
    (mockDb as any).project.findUnique.mockResolvedValueOnce({ ownerId: null });

    const result = await AdminNotificationService.notifyProjectOwner(
      projectId,
      {
        type: 'system' as any,
        title: 'X',
        message: 'Y'
      }
    );

    expect(result).toBeNull();
    expect((mockDb as any).adminNotification.create).not.toHaveBeenCalled();
  });
});

describe('AdminNotificationService.markRead', () => {
  it('обновляет только строки этого админа (tenant guard)', async () => {
    (mockDb as any).adminNotification.updateMany.mockResolvedValueOnce({
      count: 2
    });

    const count = await AdminNotificationService.markRead(adminAccountId, [
      'a',
      'b'
    ]);

    expect((mockDb as any).adminNotification.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          id: { in: ['a', 'b'] },
          adminAccountId,
          readAt: null
        }),
        data: expect.objectContaining({ readAt: expect.any(Date) })
      })
    );
    expect(count).toBe(2);
  });
});

describe('AdminNotificationService.unreadCount', () => {
  it('возвращает число непрочитанных', async () => {
    (mockDb as any).adminNotification.count.mockResolvedValueOnce(7);

    const count = await AdminNotificationService.unreadCount(adminAccountId);

    expect((mockDb as any).adminNotification.count).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { adminAccountId, readAt: null }
      })
    );
    expect(count).toBe(7);
  });
});
