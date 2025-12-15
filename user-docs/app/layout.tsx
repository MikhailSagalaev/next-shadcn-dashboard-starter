/**
 * @file: layout.tsx
 * @description: Root layout для Nextra 4 документации
 * @project: SaaS Bonus System - Documentation
 * @dependencies: nextra-theme-docs
 * @created: 2025-12-13
 * @author: AI Assistant + User
 */

import { Footer, Layout, Navbar } from 'nextra-theme-docs'
import { Banner, Head } from 'nextra/components'
import { getPageMap } from 'nextra/page-map'
import 'nextra-theme-docs/style.css'

export const metadata = {
  title: {
    default: 'Gupil Documentation',
    template: '%s - Gupil Docs'
  },
  description: 'Документация по SaaS платформе бонусных программ Gupil'
}

const navbar = (
  <Navbar
    logo={<span style={{ fontWeight: 700 }}>Gupil Docs</span>}
  />
)

const footer = <Footer>© {new Date().getFullYear()} Gupil Documentation</Footer>

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ru" dir="ltr" suppressHydrationWarning>
      <Head />
      <body>
        <Layout
          navbar={navbar}
          footer={footer}
          pageMap={await getPageMap()}
        >
          {children}
        </Layout>
      </body>
    </html>
  )
}
