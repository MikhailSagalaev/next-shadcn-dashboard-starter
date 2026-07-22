/**
 * @jest-environment jsdom
 */

// @ts-nocheck

const fs = require('fs');
const path = require('path');

const widgetSource = fs.readFileSync(
  path.join(process.cwd(), 'public', 'tilda-bonus-widget.js'),
  'utf8'
);

describe('Tilda bonus widget authorization boundary', () => {
  let widget;

  beforeEach(() => {
    document.body.innerHTML = `
      <form>
        <input name="email" type="email">
        <input name="phone" type="tel">
      </form>
      <div class="t-inputpromocode__wrapper"></div>
    `;
    localStorage.clear();
    delete window.tilda_members_profile;
    delete window.TildaBonusWidget;
    jest.spyOn(console, 'log').mockImplementation(() => {});
    jest.spyOn(console, 'warn').mockImplementation(() => {});

    window.eval(widgetSource);
    widget = window.TildaBonusWidget;
    widget.config.projectId = 'loyalty-project';
    widget.state.operationMode = 'WITHOUT_BOT';
    widget.state.userEmail = null;
    widget.state.userPhone = null;
    widget.state.appliedBonuses = 0;
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  test('does not authorize from checkout fields or tilda_user storage', () => {
    document.querySelector('[name="email"]').value = 'guest@example.com';
    document.querySelector('[name="phone"]').value = '+79990000000';
    localStorage.setItem('tilda_user_email', 'guest@example.com');
    localStorage.setItem('tilda_user_phone', '+79990000000');

    expect(widget.getUserContact()).toBeNull();
    expect(widget.getUserState()).toBe('not_registered');
    expect(widget.canSpendBonuses()).toBe(false);
  });

  test('does not react to typing in checkout fields', () => {
    widget.observeUserSession();
    const email = document.querySelector('[name="email"]');
    email.value = 'guest@example.com';
    email.dispatchEvent(new Event('input', { bubbles: true }));

    expect(localStorage.getItem('tilda_user_email')).toBeNull();
    expect(widget.state.userEmail).toBeNull();
  });

  test('authorizes from the Tilda Members profile in localStorage', () => {
    localStorage.setItem(
      'tilda_members_profile123456',
      JSON.stringify({ login: 'member@example.com', phone: '+79991112233' })
    );

    expect(widget.getUserContact()).toEqual({
      email: 'member@example.com',
      phone: '+79991112233'
    });
    expect(widget.getUserState()).toBe('fully_activated');
    expect(widget.canSpendBonuses()).toBe(true);
  });

  test('keeps the registration prompt for a guest even with stored contacts', () => {
    localStorage.setItem('tilda_user_email', 'guest@example.com');
    widget.removeWidget = jest.fn();
    widget.showRegistrationPrompt = jest.fn();
    widget.ensureWidgetMounted = jest.fn();
    widget.loadUserBalance = jest.fn();

    widget.updateWidgetState();

    expect(widget.removeWidget).toHaveBeenCalledTimes(1);
    expect(widget.showRegistrationPrompt).toHaveBeenCalledTimes(1);
    expect(widget.ensureWidgetMounted).not.toHaveBeenCalled();
    expect(widget.loadUserBalance).not.toHaveBeenCalled();
    expect(localStorage.getItem('tilda_user_email')).toBeNull();
  });
});
