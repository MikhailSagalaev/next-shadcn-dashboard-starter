import { NextRequest } from 'next/server';

import { GET } from '@/app/api/projects/[id]/users/balance/route';
import { FirstPurchaseDiscountService } from '@/lib/services/first-purchase-discount.service';
import { ProjectService } from '@/lib/services/project.service';
import { UserService } from '@/lib/services/user.service';

jest.mock('@/lib/services/user.service');
jest.mock('@/lib/services/project.service');
jest.mock('@/lib/services/first-purchase-discount.service');
jest.mock('@/lib/logger');
jest.mock('@/lib/db', () => ({
  db: {
    webhookLog: {
      create: jest.fn().mockResolvedValue({})
    }
  }
}));
jest.mock('@/lib/services/bonus-level.service', () => ({
  BonusLevelService: {
    calculateUserLevel: jest.fn().mockResolvedValue({
      name: 'Базовый',
      bonusPercent: 5,
      paymentPercent: 50,
      minAmount: 0,
      maxAmount: null
    })
  }
}));

const projectId = 'project-1';

describe('balance route organization discount', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (ProjectService.getProjectById as jest.Mock).mockResolvedValue({
      id: projectId,
      domain: 'shop.example',
      operationMode: 'WITHOUT_BOT'
    });
    (UserService.getUserBalance as jest.Mock).mockResolvedValue({
      currentBalance: 0,
      totalEarned: 0,
      totalSpent: 0,
      expiringSoon: 0
    });
  });

  it('returns the server-calculated organization discount', async () => {
    (UserService.findUserByContact as jest.Mock).mockResolvedValue({
      id: 'user-1',
      email: 'buyer@example.com',
      phone: null,
      totalPurchases: 0,
      telegramId: null
    });
    (
      FirstPurchaseDiscountService.getEligibility as jest.Mock
    ).mockResolvedValue({
      available: true,
      discountPercent: 10,
      source: 'ORGANIZATION'
    });

    const request = new NextRequest(
      `https://shop.example/api/projects/${projectId}/users/balance?email=buyer@example.com`,
      { headers: { origin: 'https://shop.example' } }
    );
    const response = await GET(request, {
      params: Promise.resolve({ id: projectId })
    });

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual(
      expect.objectContaining({
        firstPurchaseDiscount: {
          available: true,
          discountPercent: 10,
          source: 'ORGANIZATION'
        }
      })
    );
  });

  it('keeps utm_org when the widget auto-registers a customer', async () => {
    (UserService.findUserByContact as jest.Mock).mockResolvedValue(null);
    (UserService.createUser as jest.Mock).mockResolvedValue({
      id: 'user-2',
      email: 'new@example.com',
      phone: null,
      totalPurchases: 0,
      telegramId: null
    });
    (
      FirstPurchaseDiscountService.getEligibility as jest.Mock
    ).mockResolvedValue({
      available: true,
      discountPercent: 10,
      source: 'ORGANIZATION'
    });

    const request = new NextRequest(
      `https://shop.example/api/projects/${projectId}/users/balance?email=new@example.com&utm_source=trainer-1&utm_org=fitness-network`,
      { headers: { origin: 'https://shop.example' } }
    );
    const response = await GET(request, {
      params: Promise.resolve({ id: projectId })
    });

    expect(response.status).toBe(200);
    expect(UserService.createUser).toHaveBeenCalledWith(
      expect.objectContaining({
        projectId,
        email: 'new@example.com',
        utmSource: 'trainer-1',
        utmOrg: 'fitness-network'
      })
    );
  });
});
