/**
 * @file: landing-page.tsx
 * @description: Главный компонент лэндинга GUPIL.RU (Server Component)
 * @project: SaaS Bonus System
 * @dependencies: React, все компоненты лэндинга
 * @created: 2025-01-28
 * @updated: 2026-01-21 - Оптимизация: Server Component + вынос side effects
 * @author: AI Assistant + User
 */

import { LandingStyleManager } from './landing-style-manager';
import { Navbar } from './navbar';
import { HeroSection } from './hero-section';
import { ProblemSolution } from './problem-solution';
import { Advantages } from './advantages';
import { HowItWorks } from './how-it-works';
import { Features } from './features';
import { Pricing } from './pricing';
import { FAQ } from './faq';
import { CTASection } from './cta-section';
import { Footer } from './footer';

/**
 * Главная страница landing - теперь Server Component
 * Side effects вынесены в LandingStyleManager
 */
export function LandingPage() {
  return (
    <>
      <LandingStyleManager />
      <div className='min-h-screen w-full bg-[#0A0A0B] text-white antialiased'>
        <Navbar />
        <main>
          <HeroSection />
          <div id='problem-solution'>
            <ProblemSolution />
          </div>
          <div id='advantages'>
            <Advantages />
          </div>
          <div id='how-it-works'>
            <HowItWorks />
          </div>
          <div id='features'>
            <Features />
          </div>
          <div id='pricing'>
            <Pricing />
          </div>
          <div id='faq'>
            <FAQ />
          </div>
          <CTASection />
        </main>
        <Footer />
      </div>
    </>
  );
}
