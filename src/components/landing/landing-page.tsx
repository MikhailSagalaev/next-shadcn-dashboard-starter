/**
 * @file: landing-page.tsx
 * @description: Главный компонент лэндинга GUPIL.RU - современный дизайн
 * @project: SaaS Bonus System
 * @dependencies: React, все компоненты лэндинга
 * @created: 2025-01-28
 * @author: AI Assistant + User
 */

'use client';

import { useEffect } from 'react';
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

export function LandingPage() {
  useEffect(() => {
    // Разрешаем скролл для лэндинга
    const body = document.body;
    const html = document.documentElement;

    body.classList.add('landing-page-active');
    html.classList.add('landing-page-active');

    // Дополнительно устанавливаем через style для гарантии
    body.style.setProperty('overflow', 'auto', 'important');
    body.style.setProperty('overscroll-behavior', 'auto', 'important');
    body.style.setProperty('height', 'auto', 'important');
    html.style.setProperty('overflow', 'auto', 'important');
    html.style.setProperty('height', 'auto', 'important');

    return () => {
      body.classList.remove('landing-page-active');
      html.classList.remove('landing-page-active');
      body.style.removeProperty('overflow');
      body.style.removeProperty('overscroll-behavior');
      body.style.removeProperty('height');
      html.style.removeProperty('overflow');
      html.style.removeProperty('height');
    };
  }, []);

  return (
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
  );
}
