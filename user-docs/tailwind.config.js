/**
 * @file: tailwind.config.js
 * @description: Конфигурация Tailwind CSS для документации
 * @project: SaaS Bonus System
 * @dependencies: tailwindcss
 * @created: 2025-01-13
 * @author: AI Assistant + User
 */

/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './app/**/*.{js,ts,jsx,tsx,mdx}',
    './content/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './node_modules/nextra-theme-docs/**/*.{js,jsx}'
  ],
  theme: {
    extend: {}
  },
  plugins: []
}
