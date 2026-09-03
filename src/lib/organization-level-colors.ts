const GOLDEN_ANGLE_DEGREES = 137.508;
const LEVEL_SPECTRUM_OFFSET = 25;

/**
 * Stable hue for an arbitrary positive organization level.
 * The golden angle spreads neighbouring levels around the full spectrum and
 * avoids the early repetitions of a short fixed palette.
 */
export function getOrganizationLevelHue(level: number): number {
  const normalizedLevel = Number.isFinite(level)
    ? Math.max(1, Math.trunc(level))
    : 1;
  const hue =
    (LEVEL_SPECTRUM_OFFSET + (normalizedLevel - 1) * GOLDEN_ANGLE_DEGREES) %
    360;

  return Number(hue.toFixed(3));
}
