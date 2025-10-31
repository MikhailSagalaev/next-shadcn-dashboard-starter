// Test variable replacement fix
const testString = 'Test: {user.balanceFormatted} and {user.expiringBonusesFormatted} and {user.referralCount}';
console.log('Original:', testString);

// Simulate the fix - convert undefined/null to empty string
const variables = {
  'user.balanceFormatted': '1000 бонусов',
  'user.expiringBonusesFormatted': undefined,
  'user.referralCount': null,
  'user.progressPercent': 75
};

let result = testString;
for (const [key, value] of Object.entries(variables)) {
  const placeholder = `{${key}}`;
  const stringValue = value === undefined || value === null ? '' : String(value);
  result = result.replace(new RegExp(placeholder.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'), stringValue);
  console.log(`Replacing {${key}}: '${stringValue}'`);
}

console.log('Result:', result);
