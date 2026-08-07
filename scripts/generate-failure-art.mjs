/**
 * Generates the abstract SVG artwork used by the /socials failure pages into
 * `public/socials/`. The art is deterministic (seeded PRNG) so re-running the
 * script reproduces byte-identical files.
 *
 *   node scripts/generate-failure-art.mjs
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const OUT_DIR = resolve(
  dirname(fileURLToPath(import.meta.url)),
  "../public/socials",
);

const W = 1200;
const H = 800;

const PALETTES = {
  // Failure tone: coral fracture on cold grey.
  wound: {
    bg: "#FFFFFF",
    haze: "#FFF1F1",
    ink: "#343A40",
    line: "#E9ECEF",
    accent: "#FF6B6B",
    accent2: "#800000",
    glow: "#FF6B6B",
  },
  // Diagnosis tone: brand teal on white.
  signal: {
    bg: "#FFFFFF",
    haze: "#EAF4F6",
    ink: "#1F2937",
    line: "#E9ECEF",
    accent: "#005A6A",
    accent2: "#00424F",
    glow: "#005A6A",
  },
  // Resolution tone: teal + vivid green.
  ascent: {
    bg: "#FFFFFF",
    haze: "#E6F4EA",
    ink: "#1F2937",
    line: "#E9ECEF",
    accent: "#00B86B",
    accent2: "#005A6A",
    glow: "#00B86B",
  },
};

/** Mulberry32 — small deterministic PRNG. */
function prng(seedText) {
  let seed = 2166136261;
  for (const char of seedText) {
    seed ^= char.charCodeAt(0);
    seed = Math.imul(seed, 16777619);
  }
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const round = (value) => Math.round(value * 100) / 100;

function defs(palette, id) {
  return `
  <defs>
    <linearGradient id="sky-${id}" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="${palette.bg}"/>
      <stop offset="1" stop-color="${palette.haze}"/>
    </linearGradient>
    <radialGradient id="bloom-${id}" cx="0.5" cy="0.5" r="0.5">
      <stop offset="0" stop-color="${palette.glow}" stop-opacity="0.28"/>
      <stop offset="1" stop-color="${palette.glow}" stop-opacity="0"/>
    </radialGradient>
    <linearGradient id="stroke-${id}" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="${palette.accent}"/>
      <stop offset="1" stop-color="${palette.accent2}"/>
    </linearGradient>
  </defs>`;
}

/** Faint measurement grid shared by every motif — the "instrument" feel. */
function grid(palette, rand) {
  const lines = [];
  for (let x = 0; x <= W; x += 50) {
    lines.push(
      `<line x1="${x}" y1="0" x2="${x}" y2="${H}" stroke="${palette.line}" stroke-width="1" opacity="${round(0.35 + rand() * 0.25)}"/>`,
    );
  }
  for (let y = 0; y <= H; y += 50) {
    lines.push(
      `<line x1="0" y1="${y}" x2="${W}" y2="${y}" stroke="${palette.line}" stroke-width="1" opacity="${round(0.35 + rand() * 0.25)}"/>`,
    );
  }
  return lines.join("\n    ");
}

const MOTIFS = {
  /** Concentric orbit rings with satellites — "the system you never mapped". */
  orbit(palette, rand, id) {
    const cx = W / 2;
    const cy = H / 2;
    const parts = [
      `<circle cx="${cx}" cy="${cy}" r="360" fill="url(#bloom-${id})"/>`,
    ];
    for (let ring = 0; ring < 7; ring += 1) {
      const r = 70 + ring * 45;
      parts.push(
        `<circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="url(#stroke-${id})" stroke-width="${round(1.1 + rand() * 2.2)}" opacity="${round(0.35 + rand() * 0.5)}" stroke-dasharray="${ring % 2 ? `${round(4 + rand() * 10)} ${round(6 + rand() * 12)}` : "none"}"/>`,
      );
      const satellites = 1 + Math.floor(rand() * 3);
      for (let s = 0; s < satellites; s += 1) {
        const angle = rand() * Math.PI * 2;
        parts.push(
          `<circle cx="${round(cx + Math.cos(angle) * r)}" cy="${round(cy + Math.sin(angle) * r)}" r="${round(3 + rand() * 8)}" fill="${palette.accent}" opacity="${round(0.6 + rand() * 0.4)}"/>`,
        );
      }
    }
    parts.push(
      `<circle cx="${cx}" cy="${cy}" r="26" fill="${palette.accent2}" opacity="0.9"/>`,
    );
    return parts.join("\n    ");
  },

  /** Node network with weighted edges — "the conversations that never happened". */
  network(palette, rand, id) {
    const nodes = Array.from({ length: 26 }, () => ({
      x: round(90 + rand() * (W - 180)),
      y: round(90 + rand() * (H - 180)),
      r: round(3 + rand() * 11),
    }));
    const edges = [];
    nodes.forEach((a, i) => {
      nodes.slice(i + 1).forEach((b) => {
        const distance = Math.hypot(a.x - b.x, a.y - b.y);
        if (distance < 230 && rand() > 0.45) {
          edges.push(
            `<line x1="${a.x}" y1="${a.y}" x2="${b.x}" y2="${b.y}" stroke="url(#stroke-${id})" stroke-width="${round(0.8 + rand() * 1.4)}" opacity="${round(0.28 + rand() * 0.4)}"/>`,
          );
        }
      });
    });
    return [
      `<circle cx="${W / 2}" cy="${H / 2}" r="420" fill="url(#bloom-${id})"/>`,
      ...edges,
      ...nodes.map(
        (n) =>
          `<circle cx="${n.x}" cy="${n.y}" r="${n.r}" fill="${palette.accent}" opacity="${round(0.55 + rand() * 0.45)}"/>`,
      ),
    ].join("\n    ");
  },

  /** Signal readout — a truth line against noisy attempts. */
  wave(palette, rand, id) {
    const path = (amp, phase, drift) => {
      const points = [];
      for (let x = 0; x <= W; x += 20) {
        const t = x / W;
        const y =
          H / 2 +
          Math.sin(t * Math.PI * 6 + phase) * amp * (1 - t * 0.35) +
          Math.sin(t * Math.PI * 17 + phase) * drift;
        points.push(`${x},${round(y)}`);
      }
      return points.join(" ");
    };
    const noisy = Array.from({ length: 6 }, (_, i) => {
      const amp = 40 + rand() * 150;
      return `<polyline points="${path(amp, rand() * 6, rand() * 18)}" fill="none" stroke="url(#stroke-${id})" stroke-width="${round(1.2 + rand() * 2)}" opacity="${round(0.22 + i * 0.07)}"/>`;
    });
    return [
      `<rect x="0" y="${H / 2 - 170}" width="${W}" height="340" fill="url(#bloom-${id})"/>`,
      ...noisy,
      `<polyline points="${path(96, 0.4, 6)}" fill="none" stroke="${palette.accent}" stroke-width="6" stroke-linecap="round" opacity="1"/>`,
      `<line x1="0" y1="${H / 2}" x2="${W}" y2="${H / 2}" stroke="${palette.ink}" stroke-width="1.5" opacity="0.3" stroke-dasharray="6 10"/>`,
    ].join("\n    ");
  },

  /** Fractured shards — the moment a startup breaks. */
  shards(palette, rand, id) {
    const cx = W / 2;
    const cy = H / 2;
    const pieces = [];
    const slices = 18;
    for (let i = 0; i < slices; i += 1) {
      const a0 = (i / slices) * Math.PI * 2;
      const a1 = ((i + 1) / slices) * Math.PI * 2;
      const r0 = 60 + rand() * 40;
      const r1 = 200 + rand() * 220;
      const gap = 6 + rand() * 26;
      const ox = round(Math.cos((a0 + a1) / 2) * gap);
      const oy = round(Math.sin((a0 + a1) / 2) * gap);
      pieces.push(
        `<path d="M ${round(cx + Math.cos(a0) * r0 + ox)} ${round(cy + Math.sin(a0) * r0 + oy)} L ${round(cx + Math.cos(a0) * r1 + ox)} ${round(cy + Math.sin(a0) * r1 + oy)} L ${round(cx + Math.cos(a1) * r1 + ox)} ${round(cy + Math.sin(a1) * r1 + oy)} L ${round(cx + Math.cos(a1) * r0 + ox)} ${round(cy + Math.sin(a1) * r0 + oy)} Z" fill="${palette.accent}" opacity="${round(0.14 + rand() * 0.34)}" stroke="url(#stroke-${id})" stroke-width="1.2"/>`,
      );
    }
    return [
      `<circle cx="${cx}" cy="${cy}" r="400" fill="url(#bloom-${id})"/>`,
      ...pieces,
    ].join("\n    ");
  },

  /** Ascending columns — compounding progress. */
  ascend(palette, rand, id) {
    const bars = [];
    const count = 34;
    for (let i = 0; i < count; i += 1) {
      const x = round(60 + (i * (W - 120)) / count);
      const growth = Math.pow(i / count, 1.7);
      const h = round(40 + growth * 520 + rand() * 60);
      bars.push(
        `<rect x="${x}" y="${round(H - 90 - h)}" width="${round((W - 120) / count - 10)}" height="${h}" rx="6" fill="url(#stroke-${id})" opacity="${round(0.3 + growth * 0.7)}"/>`,
      );
    }
    return [
      `<rect x="0" y="${H - 520}" width="${W}" height="520" fill="url(#bloom-${id})"/>`,
      ...bars,
      `<line x1="40" y1="${H - 90}" x2="${W - 40}" y2="${H - 90}" stroke="${palette.ink}" stroke-width="2" opacity="0.4"/>`,
    ].join("\n    ");
  },

  /** Perspective horizon — the runway ahead. */
  horizon(palette, rand, id) {
    const cx = W / 2;
    const hy = H * 0.42;
    const rays = [];
    for (let i = -16; i <= 16; i += 1) {
      rays.push(
        `<line x1="${cx}" y1="${hy}" x2="${round(cx + i * 130)}" y2="${H}" stroke="url(#stroke-${id})" stroke-width="1.4" opacity="${round(0.2 + rand() * 0.4)}"/>`,
      );
    }
    const bands = [];
    for (let i = 1; i <= 12; i += 1) {
      const y = round(hy + Math.pow(i / 12, 2.4) * (H - hy));
      bands.push(
        `<line x1="0" y1="${y}" x2="${W}" y2="${y}" stroke="${palette.accent}" stroke-width="${round(1 + i * 0.22)}" opacity="${round(0.16 + i * 0.05)}"/>`,
      );
    }
    const stars = Array.from({ length: 40 }, () => {
      return `<circle cx="${round(rand() * W)}" cy="${round(rand() * hy)}" r="${round(1.2 + rand() * 3)}" fill="${palette.accent2}" opacity="${round(0.35 + rand() * 0.5)}"/>`;
    });
    return [
      `<ellipse cx="${cx}" cy="${hy}" rx="520" ry="240" fill="url(#bloom-${id})"/>`,
      ...stars,
      ...rays,
      ...bands,
      `<circle cx="${cx}" cy="${hy}" r="${round(24 + rand() * 10)}" fill="${palette.accent}" opacity="0.85"/>`,
    ].join("\n    ");
  },

  /** Contour topography — mapping a market. */
  contour(palette, rand, id) {
    const layers = [];
    for (let i = 0; i < 16; i += 1) {
      const points = [];
      const baseline = 120 + i * 42;
      for (let x = -40; x <= W + 40; x += 40) {
        const y =
          baseline +
          Math.sin((x / W) * Math.PI * 3 + i * 0.6) * (30 + i * 3) +
          Math.sin((x / W) * Math.PI * 8 + i) * 12;
        points.push(`${x},${round(y)}`);
      }
      layers.push(
        `<polyline points="${points.join(" ")}" fill="none" stroke="url(#stroke-${id})" stroke-width="${round(1.2 + rand() * 1.6)}" opacity="${round(0.28 + rand() * 0.4)}"/>`,
      );
    }
    return [
      `<circle cx="${W * 0.7}" cy="${H * 0.35}" r="380" fill="url(#bloom-${id})"/>`,
      ...layers,
    ].join("\n    ");
  },

  /** Checklist / lattice of gates — the process that catches you. */
  lattice(palette, rand, id) {
    const cells = [];
    const cols = 12;
    const rows = 8;
    for (let r = 0; r < rows; r += 1) {
      for (let c = 0; c < cols; c += 1) {
        const filled = rand() > 0.62;
        const x = round(70 + c * ((W - 140) / cols));
        const y = round(70 + r * ((H - 140) / rows));
        const size = round((W - 140) / cols - 16);
        cells.push(
          `<rect x="${x}" y="${y}" width="${size}" height="${size}" rx="10" fill="${filled ? palette.accent : "none"}" opacity="${filled ? round(0.2 + rand() * 0.6) : 1}" stroke="url(#stroke-${id})" stroke-width="1.4" />`,
        );
        if (filled && rand() > 0.55) {
          cells.push(
            `<circle cx="${round(x + size / 2)}" cy="${round(y + size / 2)}" r="${round(size * 0.16)}" fill="${palette.accent2}" opacity="0.75"/>`,
          );
        }
      }
    }
    return [
      `<rect x="0" y="0" width="${W}" height="${H}" fill="url(#bloom-${id})"/>`,
      ...cells,
    ].join("\n    ");
  },
};

function render({ id, motif, palette }) {
  const rand = prng(id);
  const tone = PALETTES[palette];
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" role="img">
  ${defs(tone, id)}
  <rect width="${W}" height="${H}" fill="url(#sky-${id})"/>
  <g>
    ${grid(tone, rand)}
  </g>
  <g>
    ${MOTIFS[motif](tone, rand, id)}
  </g>
</svg>
`;
}

/**
 * Four frames per failure: the hero, the failure itself, the diagnosis and the
 * Altitut resolution.
 */
const SLUGS = [
  "building-for-nobody",
  "in-love-with-the-idea",
  "the-invisible-pitch",
  "the-forever-mvp",
  "runway-blindness",
  "the-lonely-founder",
  "chasing-cheques",
  "vanity-metrics",
  "the-quiet-quit",
];

const FRAMES = [
  { key: "hero", motif: "orbit", palette: "signal" },
  { key: "failure", motif: "shards", palette: "wound" },
  { key: "diagnosis", motif: "wave", palette: "wound" },
  { key: "map", motif: "contour", palette: "signal" },
  { key: "system", motif: "lattice", palette: "signal" },
  { key: "network", motif: "network", palette: "signal" },
  { key: "resolution", motif: "ascend", palette: "ascent" },
  { key: "horizon", motif: "horizon", palette: "ascent" },
];

mkdirSync(OUT_DIR, { recursive: true });

let written = 0;
for (const slug of SLUGS) {
  for (const frame of FRAMES) {
    const id = `${slug}-${frame.key}`;
    writeFileSync(
      resolve(OUT_DIR, `${id}.svg`),
      render({ id, motif: frame.motif, palette: frame.palette }),
    );
    written += 1;
  }
}

console.log(`Wrote ${written} SVG frames to public/socials/`);
