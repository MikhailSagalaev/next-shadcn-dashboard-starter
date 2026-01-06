/**
 * @file: homepage-page.tsx
 * @description: Главный компонент светлого лэндинга GUPIL
 * @project: SaaS Bonus System
 * @dependencies: React, все компоненты homepage
 * @created: 2026-01-06
 * @author: AI Assistant + User
 */

'use client';

import { useEffect } from 'react';
import { HomepageNavbar } from './homepage-navbar';
import { HomepageHero } from './homepage-hero';
import { HomepageMarquee } from './homepage-marquee';
import { HomepageFeatures } from './homepage-features';
import { HomepageSteps } from './homepage-steps';
import { HomepagePricing } from './homepage-pricing';
import { HomepageFooter } from './homepage-footer';

export function HomepagePage() {
  useEffect(() => {
    const body = document.body;
    const html = document.documentElement;

    body.classList.add('homepage-active');
    html.classList.add('homepage-active');

    body.style.setProperty('overflow', 'auto', 'important');
    body.style.setProperty('overscroll-behavior', 'auto', 'important');
    body.style.setProperty('height', 'auto', 'important');
    html.style.setProperty('overflow', 'auto', 'important');
    html.style.setProperty('height', 'auto', 'important');

    return () => {
      body.classList.remove('homepage-active');
      html.classList.remove('homepage-active');
      body.style.removeProperty('overflow');
      body.style.removeProperty('overscroll-behavior');
      body.style.removeProperty('height');
      html.style.removeProperty('overflow');
      html.style.removeProperty('height');
    };
  }, []);

  return (
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
      </main>
      <HomepageFooter />
    </div>
  );
}
