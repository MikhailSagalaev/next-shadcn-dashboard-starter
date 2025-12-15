/**
 * @file: next.config.mjs
 * @description: Конфигурация Nextra 4 для документации
 * @project: SaaS Bonus System - Documentation
 * @dependencies: nextra
 * @created: 2025-12-13
 * @author: AI Assistant + User
 */

import nextra from 'nextra'

const withNextra = nextra({})

export default withNextra({
  reactStrictMode: true,
  outputFileTracingRoot: process.cwd()
})
