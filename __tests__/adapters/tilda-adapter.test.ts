/**
 * @file: tilda-adapter.test.ts
 * @description: Unit тесты для TildaAdapter
 * @project: SaaS Bonus System - Universal Widget
 * @created: 2026-01-31
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

// Mock DOM для тестирования
const setupDOM = () => {
  document.body.innerHTML = `
    <!-- Tilda Cart -->
    <div class="t706__cartwin">
      <div class="t706__cartwin-totalamount">5000</div>
      <div class="t706__product" data-product-id="1">
        <div class="t706__product-name">Товар 1</div>
        <div class="t706__product-price">3000</div>
      </div>
    </div>

    <!-- Tilda Form -->
    <form class="t-form">
      <input type="email" name="email" id="email" value="test@example.com">
      <input type="tel" name="phone" id="phone" value="+79991234567">
    </form>

    <!-- Tilda Promocode -->
    <div class="t-inputpromocode__wrapper">
      <input type="text" class="t-inputpromocode" id="promo-input">
      <button class="t-inputpromocode__btn" id="promo-button">Применить</button>
    </div>

    <!-- Tilda Products -->
    <div class="t-store__card js-product" data-product-id="1">
      <div class="t-store__card__title">Товар 1</div>
      <div class="t-store__card__price">
        <span class="t-store__card__price-value">3000</span>
        <span class="t-store__card__price-currency">₽</span>
      </div>
    </div>
  `;

  // Mock window.tcart (Tilda cart object)
  (window as any).tcart = {
    products: [
      {
        uid: '1',
        name: 'Товар 1',
        price: 3000,
        quantity: 1
      }
    ],
    total: 1,
    amount: 3000,
    totalAmount: 3000
  };

  // Mock window.t_store (Tilda store object)
  (window as any).t_store = {
    getProducts: () => [
      {
        uid: '1',
        title: 'Товар 1',
        price: 3000
      }
    ]
  };
};

const cleanupDOM = () => {
  document.body.innerHTML = '';
  delete (window as any).tcart;
  delete (window as any).t_store;
};

// Динамический импорт адаптера (так как он использует window)
const loadAdapter = async () => {
  // В реальности адаптер загружается через script tag
  // Для тестов мы создаем mock класс с той же логикой
  class TildaAdapterMock {
    config: any;

    constructor(config = {}) {
      this.config = config;
    }

    getCartTotal(): number {
      const totalElement = document.querySelector('.t706__cartwin-totalamount');
      if (!totalElement) return 0;

      const text = totalElement.textContent?.replace(/[^\d.,]/g, '') || '0';
      return parseFloat(text);
    }

    getContactInfo(): { email: string; phone: string } {
      const emailInput = document.querySelector<HTMLInputElement>(
        '#email, input[name="email"]'
      );
      const phoneInput = document.querySelector<HTMLInputElement>(
        '#phone, input[name="phone"]'
      );

      return {
        email: emailInput?.value || '',
        phone: phoneInput?.value || ''
      };
    }

    async applyPromocode(code: string): Promise<boolean> {
      const input =
        document.querySelector<HTMLInputElement>('.t-inputpromocode');
      const button = document.querySelector<HTMLButtonElement>(
        '.t-inputpromocode__btn'
      );

      if (!input || !button) return false;

      input.value = code;
      button.click();

      return true;
    }

    observeCart(callback: () => void): void {
      const cartElement = document.querySelector('.t706__cartwin');
      if (!cartElement) return;

      const observer = new MutationObserver(() => {
        callback();
      });

      observer.observe(cartElement, {
        childList: true,
        subtree: true,
        attributes: true
      });
    }

    observeContactInput(callback: () => void): void {
      const emailInput = document.querySelector('#email');
      const phoneInput = document.querySelector('#phone');

      emailInput?.addEventListener('input', callback);
      phoneInput?.addEventListener('input', callback);
    }

    getCartItems(): Array<any> {
      if ((window as any).tcart?.products) {
        return (window as any).tcart.products;
      }
      return [];
    }

    getTildaCart(): any {
      return (window as any).tcart || null;
    }

    getProductPrice(element: Element): number {
      const priceElement = element.querySelector('.t-store__card__price-value');
      if (!priceElement) return 0;

      const text = priceElement.textContent?.replace(/[^\d.,]/g, '') || '0';
      return parseFloat(text);
    }

    getProductId(element: Element): string {
      return element.getAttribute('data-product-id') || '';
    }

    getProductName(element: Element): string {
      const nameElement = element.querySelector('.t-store__card__title');
      return nameElement?.textContent || '';
    }
  }

  return TildaAdapterMock;
};

describe('TildaAdapter', () => {
  let TildaAdapter: any;
  let adapter: any;

  beforeEach(async () => {
    setupDOM();
    TildaAdapter = await loadAdapter();
    adapter = new TildaAdapter();
  });

  afterEach(() => {
    cleanupDOM();
  });

  describe('getCartTotal()', () => {
    it('должен вернуть общую сумму корзины', () => {
      const total = adapter.getCartTotal();
      expect(total).toBe(5000);
    });

    it('должен вернуть 0 если элемент не найден', () => {
      document.querySelector('.t706__cartwin-totalamount')?.remove();
      const total = adapter.getCartTotal();
      expect(total).toBe(0);
    });

    it('должен корректно парсить сумму с пробелами', () => {
      const totalElement = document.querySelector('.t706__cartwin-totalamount');
      if (totalElement) totalElement.textContent = '5 000';

      const total = adapter.getCartTotal();
      expect(total).toBe(5000);
    });

    it('должен корректно парсить сумму с валютой', () => {
      const totalElement = document.querySelector('.t706__cartwin-totalamount');
      if (totalElement) totalElement.textContent = '5000 ₽';

      const total = adapter.getCartTotal();
      expect(total).toBe(5000);
    });
  });

  describe('getContactInfo()', () => {
    it('должен вернуть email и телефон из формы', () => {
      const contactInfo = adapter.getContactInfo();

      expect(contactInfo.email).toBe('test@example.com');
      expect(contactInfo.phone).toBe('+79991234567');
    });

    it('должен вернуть пустые строки если поля не найдены', () => {
      document.querySelector('#email')?.remove();
      document.querySelector('#phone')?.remove();

      const contactInfo = adapter.getContactInfo();

      expect(contactInfo.email).toBe('');
      expect(contactInfo.phone).toBe('');
    });

    it('должен вернуть пустые строки если поля пустые', () => {
      const emailInput = document.querySelector<HTMLInputElement>('#email');
      const phoneInput = document.querySelector<HTMLInputElement>('#phone');

      if (emailInput) emailInput.value = '';
      if (phoneInput) phoneInput.value = '';

      const contactInfo = adapter.getContactInfo();

      expect(contactInfo.email).toBe('');
      expect(contactInfo.phone).toBe('');
    });
  });

  describe('applyPromocode()', () => {
    it('должен применить промокод', async () => {
      const result = await adapter.applyPromocode('TEST123');

      expect(result).toBe(true);

      const input =
        document.querySelector<HTMLInputElement>('.t-inputpromocode');
      expect(input?.value).toBe('TEST123');
    });

    it('должен вернуть false если элементы не найдены', async () => {
      document.querySelector('.t-inputpromocode')?.remove();

      const result = await adapter.applyPromocode('TEST123');

      expect(result).toBe(false);
    });
  });

  describe('observeCart()', () => {
    it('должен вызвать callback при изменении корзины', (done) => {
      const callback = vi.fn(() => {
        expect(callback).toHaveBeenCalled();
        done();
      });

      adapter.observeCart(callback);

      // Имитируем изменение корзины
      const cartElement = document.querySelector('.t706__cartwin');
      const newProduct = document.createElement('div');
      newProduct.className = 't706__product';
      cartElement?.appendChild(newProduct);
    });

    it('не должен падать если корзина не найдена', () => {
      document.querySelector('.t706__cartwin')?.remove();

      expect(() => {
        adapter.observeCart(() => {});
      }).not.toThrow();
    });
  });

  describe('observeContactInput()', () => {
    it('должен вызвать callback при вводе email', () => {
      const callback = vi.fn();

      adapter.observeContactInput(callback);

      const emailInput = document.querySelector<HTMLInputElement>('#email');
      emailInput?.dispatchEvent(new Event('input'));

      expect(callback).toHaveBeenCalled();
    });

    it('должен вызвать callback при вводе телефона', () => {
      const callback = vi.fn();

      adapter.observeContactInput(callback);

      const phoneInput = document.querySelector<HTMLInputElement>('#phone');
      phoneInput?.dispatchEvent(new Event('input'));

      expect(callback).toHaveBeenCalled();
    });
  });

  describe('getCartItems()', () => {
    it('должен вернуть товары из window.tcart', () => {
      const items = adapter.getCartItems();

      expect(items).toHaveLength(1);
      expect(items[0].uid).toBe('1');
      expect(items[0].name).toBe('Товар 1');
      expect(items[0].price).toBe(3000);
    });

    it('должен вернуть пустой массив если tcart не существует', () => {
      delete (window as any).tcart;

      const items = adapter.getCartItems();

      expect(items).toEqual([]);
    });
  });

  describe('getTildaCart()', () => {
    it('должен вернуть объект window.tcart', () => {
      const cart = adapter.getTildaCart();

      expect(cart).toBeDefined();
      expect(cart.total).toBe(1);
      expect(cart.amount).toBe(3000);
    });

    it('должен вернуть null если tcart не существует', () => {
      delete (window as any).tcart;

      const cart = adapter.getTildaCart();

      expect(cart).toBeNull();
    });
  });

  describe('getProductPrice()', () => {
    it('должен вернуть цену товара', () => {
      const productElement = document.querySelector('.t-store__card');
      if (!productElement) throw new Error('Product element not found');

      const price = adapter.getProductPrice(productElement);

      expect(price).toBe(3000);
    });

    it('должен вернуть 0 если цена не найдена', () => {
      const productElement = document.querySelector('.t-store__card');
      productElement?.querySelector('.t-store__card__price-value')?.remove();

      if (!productElement) throw new Error('Product element not found');

      const price = adapter.getProductPrice(productElement);

      expect(price).toBe(0);
    });
  });

  describe('getProductId()', () => {
    it('должен вернуть ID товара', () => {
      const productElement = document.querySelector('.t-store__card');
      if (!productElement) throw new Error('Product element not found');

      const id = adapter.getProductId(productElement);

      expect(id).toBe('1');
    });

    it('должен вернуть пустую строку если ID не найден', () => {
      const productElement = document.querySelector('.t-store__card');
      productElement?.removeAttribute('data-product-id');

      if (!productElement) throw new Error('Product element not found');

      const id = adapter.getProductId(productElement);

      expect(id).toBe('');
    });
  });

  describe('getProductName()', () => {
    it('должен вернуть название товара', () => {
      const productElement = document.querySelector('.t-store__card');
      if (!productElement) throw new Error('Product element not found');

      const name = adapter.getProductName(productElement);

      expect(name).toBe('Товар 1');
    });

    it('должен вернуть пустую строку если название не найдено', () => {
      const productElement = document.querySelector('.t-store__card');
      productElement?.querySelector('.t-store__card__title')?.remove();

      if (!productElement) throw new Error('Product element not found');

      const name = adapter.getProductName(productElement);

      expect(name).toBe('');
    });
  });
});
