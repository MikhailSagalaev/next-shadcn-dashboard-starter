/**
 * @file: mdx-components.tsx
 * @description: MDX компоненты для Nextra 4
 * @project: SaaS Bonus System - Documentation
 * @dependencies: nextra-theme-docs
 * @created: 2025-12-13
 * @author: AI Assistant + User
 */

import { useMDXComponents as getDocsMDXComponents } from 'nextra-theme-docs'

const docsComponents = getDocsMDXComponents()

export function useMDXComponents(components?: Record<string, React.ComponentType>) {
  return {
    ...docsComponents,
    ...components
  }
}