/**
 * @file: layout.tsx
 * @description: Layout для страницы лэндинга с разрешенным скроллом
 * @project: SaaS Bonus System
 * @dependencies: Next.js
 * @created: 2025-01-28
 * @author: AI Assistant + User
 */

export default function LandingLayout({
  children
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <style
        dangerouslySetInnerHTML={{
          __html: `
          body.landing-page-active {
            overflow: auto !important;
            overscroll-behavior: auto !important;
            height: auto !important;
          }
          html.landing-page-active {
            overflow: auto !important;
            height: auto !important;
          }
        `
        }}
      />
      {children}
    </>
  );
}
