export function reelsTabEligible(m: {
  width?: number;
  height?: number;
  durationSec?: number;
}) {
  if (!m.width || !m.height || !m.durationSec) {
    return { eligible: true, reason: "unknown" as const };
  }
  const ar = m.width / m.height;
  const is916 = Math.abs(ar - 9 / 16) < 0.02;
  const inRange = m.durationSec >= 5 && m.durationSec <= 90;
  return {
    eligible: is916 && inRange,
    reason: !is916
      ? "aspect ratio is not 9:16"
      : !inRange
        ? "duration is outside 5–90s"
        : "ok",
  };
}
