/**
 * @file: run-eslint.mjs
 * @description: Cross-platform ESLint runner with flat config enabled
 * @project: SaaS Bonus System
 * @dependencies: eslint
 * @created: 2026-01-16
 * @author: AI Assistant + User
 */

import { spawn } from 'node:child_process';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const rootDir = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const eslintBin = resolve(rootDir, 'node_modules', 'eslint', 'bin', 'eslint.js');
const args = process.argv.slice(2);

const child = spawn(process.execPath, [eslintBin, ...args], {
  cwd: rootDir,
  stdio: 'inherit',
  env: {
    ...process.env,
    ESLINT_USE_FLAT_CONFIG: 'true'
  }
});

child.on('exit', (code) => {
  process.exit(code ?? 1);
});
