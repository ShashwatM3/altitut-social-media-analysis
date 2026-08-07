/**
 * Orb gradients walk the brand ramp from teal (the edges of the sequence)
 * through coral (the centre and beyond), so the nine failures read as one
 * continuous brand object rather than nine unrelated circles.
 */
export const ORB_TONES = [
  { from: "#00424F", to: "#0E7C8C" },
  { from: "#005A6A", to: "#1E96A8" },
  { from: "#00666F", to: "#00B86B" },
  { from: "#0A6C6E", to: "#5FCBA0" },
  { from: "#005A6A", to: "#FF6B6B" },
  { from: "#3B5F63", to: "#FF8E7A" },
  { from: "#5C2F3A", to: "#FF6B6B" },
  { from: "#800000", to: "#FF8E7A" },
  { from: "#5C0000", to: "#C2504F" },
] as const;

export type OrbTone = (typeof ORB_TONES)[number];

export function toneFor(index: number): OrbTone {
  return ORB_TONES[((index % ORB_TONES.length) + ORB_TONES.length) % ORB_TONES.length];
}
