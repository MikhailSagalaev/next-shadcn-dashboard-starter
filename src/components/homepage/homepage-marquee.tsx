/**
 * @file: homepage-marquee.tsx
 * @description: Бегущая строка в стиле Meridian
 * @project: SaaS Bonus System
 * @dependencies: React
 * @created: 2026-01-06
 * @author: AI Assistant + User
 */

'use client';

export function HomepageMarquee() {
  const items = [
    'NEW SEARCH.',
    'NEW RULES.',
    'NEW SEARCH.',
    'NEW RULES.',
    'NEW SEARCH.',
    'NEW RULES.',
    'NEW SEARCH.',
    'NEW RULES.'
  ];

  return (
    <section className='overflow-hidden border-y border-[#E5E5E5] bg-white py-5'>
      <div className='animate-marquee flex whitespace-nowrap'>
        {[...items, ...items].map((item, i) => (
          <span
            key={i}
            className='mx-8 text-2xl font-semibold tracking-tight text-[#1A1A1A]'
          >
            {item}
          </span>
        ))}
      </div>
      <style jsx>{`
        @keyframes marquee {
          0% {
            transform: translateX(0);
          }
          100% {
            transform: translateX(-50%);
          }
        }
        .animate-marquee {
          animation: marquee 25s linear infinite;
        }
      `}</style>
    </section>
  );
}
