/**
 * @file: homepage-page.tsx
 * @description: Главный компонент светлого лэндинга GUPIL (Server Component)
 * @project: SaaS Bonus System
 * @dependencies: React, все компоненты homepage
 * @created: 2026-01-06
 * @updated: 2026-01-21 - Оптимизация: Server Component + вынос side effects
 * @author: AI Assistant + User
 */

import { HomepageStyleManager } from './homepage-style-manager';
import { HomepageNavbar } from './homepage-navbar';
import { HomepageHero } from './homepage-hero';
import { HomepageMarquee } from './homepage-marquee';
import { HomepageFeatures } from './homepage-features';
import { HomepageSteps } from './homepage-steps';
import { HomepagePricing } from './homepage-pricing';
import { HomepageHelpSection } from './homepage-help-section';
import { HomepageFooter } from './homepage-footer';

/**
 * Главная страница homepage - теперь Server Component
 * Side effects вынесены в HomepageStyleManager
 */
export function HomepagePage() {
  return (
    <>
      <HomepageStyleManager />
      <div className='min-h-screen w-full bg-white text-black antialiased'>
        <HomepageNavbar />
        <main>
          <HomepageHero />
          <HomepageMarquee />
          <div id='features'>
            <HomepageFeatures />
          </div>
          <div id='steps'>
            <HomepageSteps />
          </div>
          <div id='pricing'>
            <HomepagePricing />
          </div>
          <HomepageHelpSection />
        </main>
        <HomepageFooter />
      </div>
    </>
  );
}
