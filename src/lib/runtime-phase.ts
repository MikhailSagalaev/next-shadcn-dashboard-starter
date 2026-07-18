/**
 * @file: runtime-phase.ts
 * @description: Определение build-фазы Next.js для блокировки runtime side effects.
 * @project: SaaS Bonus System
 * @dependencies: Next.js process environment
 * @created: 2026-07-18
 * @author: AI Assistant + User
 */

const NEXT_PRODUCTION_BUILD_PHASE = 'phase-production-build';

export function isProductionBuildPhase(): boolean {
  return (
    process.env.NEXT_PHASE === NEXT_PRODUCTION_BUILD_PHASE ||
    process.env.npm_lifecycle_event === 'build'
  );
}
