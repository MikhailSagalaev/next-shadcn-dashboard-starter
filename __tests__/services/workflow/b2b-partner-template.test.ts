import template from '@/lib/workflow-templates/b2b-partner-cabinet.json';

describe('B2B partner workflow template', () => {
  const nodes = template.nodes as Array<{
    id: string;
    type: string;
    data?: any;
  }>;
  const connections = template.connections as Array<{
    source: string;
    target: string;
  }>;

  it('uses one adaptive home instead of system-role menu branches', () => {
    const ids = new Set(nodes.map((node) => node.id));
    expect(ids.has('action-partner-home')).toBe(true);
    for (const obsolete of [
      'cond-is-director',
      'cond-is-manager',
      'cond-is-trainer',
      'menu-director',
      'menu-manager',
      'menu-trainer',
      'menu-client'
    ]) {
      expect(ids.has(obsolete)).toBe(false);
    }
    expect(
      connections.some(
        (connection) =>
          connection.source === 'msg-remove-keyboard' &&
          connection.target === 'action-partner-home'
      )
    ).toBe(true);
  });

  it('supports purchases and organization-aware team navigation', () => {
    const ids = new Set(nodes.map((node) => node.id));
    expect(ids.has('menu-purchases-trigger')).toBe(true);
    expect(ids.has('show-purchases-list')).toBe(true);

    const team = nodes.find((node) => node.id === 'action-team');
    const teamTab = nodes.find((node) => node.id === 'action-team-tab');
    expect(team?.data?.config?.['action.partner_team']?.organizationId).toBe(
      '{{telegram.callback.params[1]}}'
    );
    expect(teamTab?.data?.config?.['action.partner_team']?.organizationId).toBe(
      '{{telegram.callback.params[2]}}'
    );
  });

  it('checks referral and help visibility at runtime', () => {
    const referrals = nodes.find((node) => node.id === 'show-referrals-stats');
    const help = nodes.find((node) => node.id === 'show-help-info');

    expect(referrals?.type).toBe('action.menu_command');
    expect(referrals?.data?.config?.['action.menu_command']?.command).toBe(
      'menu_referrals'
    );
    expect(help?.type).toBe('action.menu_command');
    expect(help?.data?.config?.['action.menu_command']?.command).toBe(
      'menu_help'
    );
  });
});
