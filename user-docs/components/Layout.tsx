/**
 * @file: Layout.tsx
 * @description: Основной layout компонент для документации
 * @project: SaaS Bonus System
 * @dependencies: next, react
 * @created: 2025-01-13
 * @author: AI Assistant + User
 */

import React from 'react'
import Head from 'next/head'
import Link from 'next/link'

interface LayoutProps {
  children: React.ReactNode
  title?: string
}

const Layout: React.FC<LayoutProps> = ({ children, title = 'Gupil Documentation' }) => {
  return (
    <>
      <Head>
        <title>{title}</title>
        <meta name="description" content="Документация по SaaS платформе бонусных программ Gupil" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link rel="icon" href="/favicon.ico" />
      </Head>

      <div className="min-h-screen bg-gray-50">
        {/* Header */}
        <header className="bg-white shadow-sm border-b border-gray-200">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex justify-between items-center h-16">
              <div className="flex items-center">
                <Link href="/" className="flex items-center space-x-2">
                  <span className="text-xl font-bold text-gray-900">Gupil Docs</span>
                </Link>
              </div>
              
              <nav className="hidden md:flex space-x-8">
                <Link href="/getting-started" className="text-gray-600 hover:text-gray-900">
                  Быстрый старт
                </Link>
                <Link href="/api-reference" className="text-gray-600 hover:text-gray-900">
                  API
                </Link>
                <Link href="/telegram-bots" className="text-gray-600 hover:text-gray-900">
                  Telegram боты
                </Link>
                <Link href="/faq" className="text-gray-600 hover:text-gray-900">
                  FAQ
                </Link>
              </nav>
            </div>
          </div>
        </header>

        {/* Main Content */}
        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="flex">
            {/* Sidebar */}
            <aside className="hidden lg:block w-64 flex-shrink-0 mr-8">
              <nav className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
                <div className="space-y-2">
                  <div>
                    <h3 className="text-sm font-semibold text-gray-900 mb-2">Начало работы</h3>
                    <ul className="space-y-1 text-sm">
                      <li><Link href="/getting-started" className="text-gray-600 hover:text-blue-600">Быстрый старт</Link></li>
                      <li><Link href="/getting-started/create-project" className="text-gray-600 hover:text-blue-600">Создание проекта</Link></li>
                    </ul>
                  </div>
                  
                  <div>
                    <h3 className="text-sm font-semibold text-gray-900 mb-2 mt-4">Основные функции</h3>
                    <ul className="space-y-1 text-sm">
                      <li><Link href="/bonus-system" className="text-gray-600 hover:text-blue-600">Бонусная система</Link></li>
                      <li><Link href="/telegram-bots" className="text-gray-600 hover:text-blue-600">Telegram боты</Link></li>
                      <li><Link href="/webhook-integration" className="text-gray-600 hover:text-blue-600">Webhook интеграция</Link></li>
                      <li><Link href="/workflow-constructor" className="text-gray-600 hover:text-blue-600">Конструктор сценариев</Link></li>
                    </ul>
                  </div>
                  
                  <div>
                    <h3 className="text-sm font-semibold text-gray-900 mb-2 mt-4">Справочник</h3>
                    <ul className="space-y-1 text-sm">
                      <li><Link href="/api-reference" className="text-gray-600 hover:text-blue-600">API документация</Link></li>
                      <li><Link href="/faq" className="text-gray-600 hover:text-blue-600">FAQ</Link></li>
                    </ul>
                  </div>
                </div>
              </nav>
            </aside>

            {/* Content */}
            <div className="flex-1 bg-white rounded-lg shadow-sm border border-gray-200 p-8">
              {children}
            </div>
          </div>
        </main>

        {/* Footer */}
        <footer className="bg-white border-t border-gray-200 mt-16">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
            <div className="text-center text-gray-600">
              <p>&copy; 2025 Gupil Documentation. Все права защищены.</p>
            </div>
          </div>
        </footer>
      </div>
    </>
  )
}

export default Layout