/**
 * @file: eslint.config.js
 * @description: ESLint flat config for the Next.js app
 * @project: SaaS Bonus System
 * @dependencies: eslint-config-next
 * @created: 2026-01-16
 * @author: AI Assistant + User
 */

const next = require('eslint-config-next');

module.exports = [
  ...next,
  {
    rules: {
      '@typescript-eslint/no-unused-vars': 'warn',
      '@typescript-eslint/no-var-requires': 'off',
      'import/no-unresolved': 'off',
      'import/named': 'off',
      'no-console': 'warn',
      'react-hooks/exhaustive-deps': 'warn',
      'react-hooks/refs': 'warn',
      'react-hooks/set-state-in-effect': 'warn',
      'react-hooks/preserve-manual-memoization': 'warn',
      'react-hooks/purity': 'warn',
      'react-hooks/immutability': 'warn',
      'react-hooks/use-memo': 'warn',
      'react/no-unescaped-entities': 'off'
    }
  }
];
