/**
 * @file: layout.tsx
 * @description: Layout для светлого лэндинга /homepage
 * @project: SaaS Bonus System
 * @dependencies: Next.js
 * @created: 2026-01-06
 * @author: AI Assistant + User
 */

export default function HomepageLayout({
  children
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <style
        dangerouslySetInnerHTML={{
          __html: `
          body.homepage-active {
            overflow: auto !important;
            overscroll-behavior: auto !important;
            height: auto !important;
          }
          html.homepage-active {
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
