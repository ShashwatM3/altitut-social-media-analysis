"use client";

import Link from "next/link";
import { useEffect, useRef, type CSSProperties, type ReactNode } from "react";
import type { Failure } from "../failures";
import { toneFor } from "../tones";

type Props = {
  failure: Failure;
  index: number;
  total: number;
  previous: Failure;
  next: Failure;
};

/** Fades sections in as they enter the viewport. */
function useReveal() {
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    const targets = Array.from(root.querySelectorAll<HTMLElement>(".reveal"));
    if (typeof IntersectionObserver === "undefined") {
      targets.forEach((target) => target.classList.add("is-visible"));
      return;
    }
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add("is-visible");
            observer.unobserve(entry.target);
          }
        });
      },
      { rootMargin: "0px 0px -12% 0px", threshold: 0.08 },
    );
    targets.forEach((target) => observer.observe(target));
    return () => observer.disconnect();
  }, []);

  return rootRef;
}

function Plate({
  frame,
  caption,
  priority = false,
  className = "",
}: {
  frame: string;
  caption: string;
  priority?: boolean;
  className?: string;
}) {
  return (
    <figure className={`reveal group ${className}`}>
      <div className="overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-modern">
        {/* Generated brand artwork — see scripts/generate-failure-art.mjs. */}
        <img
          src={`/socials/${frame}.svg`}
          alt={caption}
          width={1200}
          height={800}
          loading={priority ? "eager" : "lazy"}
          decoding="async"
          className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-[1.03]"
        />
      </div>
      <figcaption className="mt-3 text-xs leading-relaxed text-gray-500">
        {caption}
      </figcaption>
    </figure>
  );
}

function SectionLabel({ children }: { children: ReactNode }) {
  return (
    <p className="text-[10px] font-bold uppercase tracking-[0.4em] text-deep-teal">
      {children}
    </p>
  );
}

export function FailureStory({
  failure,
  index,
  total,
  previous,
  next,
}: Props) {
  const rootRef = useReveal();
  const tone = toneFor(index);
  const counter = `${String(index + 1).padStart(2, "0")} / ${String(total).padStart(2, "0")}`;
  const [openingImage, secondImage, thirdImage] = failure.images;

  return (
    <div
      ref={rootRef}
      className="relative overflow-x-clip bg-white"
      style={
        { "--orb-from": tone.from, "--orb-to": tone.to } as CSSProperties
      }
    >
      <div
        className="pointer-events-none absolute inset-x-0 top-0 h-[900px] animate-aurora-drift socials-aurora"
        aria-hidden="true"
      />

      <header className="sticky top-0 z-30 border-b border-gray-100 bg-white/95 backdrop-blur-md">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-4 sm:px-6 lg:px-8">
          <Link
            href="/socials"
            className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.25em] text-gray-500 transition-colors hover:text-deep-teal"
          >
            <span aria-hidden="true">&larr;</span> All failures
          </Link>
          <p className="font-mono text-[11px] font-semibold uppercase tracking-[0.3em] text-gray-400">
            {counter}
          </p>
          <Link
            href="/"
            className="rounded-lg bg-teal-600 px-4 py-2 text-xs font-semibold text-white transition-colors hover:bg-teal-700"
          >
            Start with Altitut
          </Link>
        </div>
      </header>

      {/* ── Hero ─────────────────────────────────────────────────────────── */}
      <section className="relative mx-auto max-w-7xl px-4 pb-16 pt-14 sm:px-6 lg:px-8 lg:pb-24 lg:pt-20">
        <div className="grid items-center gap-12 lg:grid-cols-[minmax(0,1fr)_360px]">
          <div className="reveal is-visible">
            <SectionLabel>Failure {String(index + 1).padStart(2, "0")}</SectionLabel>
            <h1 className="mt-5 font-display text-4xl font-extrabold leading-[1.04] tracking-tight text-gray-900 sm:text-6xl lg:text-7xl">
              {failure.title}
            </h1>
            <p className="mt-6 max-w-2xl text-lg leading-relaxed text-gray-600 sm:text-xl">
              {failure.verdict}
            </p>
            <div className="mt-9 flex flex-wrap items-center gap-3">
              <Link
                href="/"
                className="rounded-lg bg-teal-600 px-6 py-3 text-sm font-semibold text-white shadow-modern transition-colors hover:bg-teal-700"
              >
                Make sure this never happens
              </Link>
              <Link
                href="/socials"
                className="rounded-lg border border-gray-300 px-6 py-3 text-sm font-semibold text-gray-700 transition-colors hover:bg-gray-50"
              >
                See the other eight
              </Link>
            </div>
          </div>

          <div className="relative mx-auto flex h-56 w-56 items-center justify-center sm:h-72 sm:w-72 lg:h-80 lg:w-80">
            <span
              className="orb-halo absolute -inset-12 animate-halo-breathe rounded-full opacity-30 blur-3xl"
              aria-hidden="true"
            />
            <span
              className="orb-skin absolute inset-0 animate-float-slow rounded-full"
              aria-hidden="true"
            />
            <span
              className="absolute inset-[-10px] animate-orbit-spin rounded-full border border-dashed border-deep-teal/25"
              aria-hidden="true"
            >
              <span className="absolute left-1/2 top-0 h-2.5 w-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-bright-coral" />
            </span>
            <span className="relative z-10 whitespace-pre-line px-8 text-center font-display text-2xl font-extrabold leading-tight text-white">
              {failure.label}
            </span>
          </div>
        </div>
      </section>

      {/* ── The stat + the lie ───────────────────────────────────────────── */}
      <section className="border-y border-gray-100 bg-gray-50/60">
        <div className="mx-auto grid max-w-7xl gap-10 px-4 py-14 sm:px-6 lg:grid-cols-2 lg:px-8 lg:py-20">
          <div className="reveal">
            <p className="font-display text-6xl font-extrabold tracking-tight text-bright-coral sm:text-7xl lg:text-8xl">
              {failure.stat}
            </p>
            <p className="mt-5 max-w-md text-sm leading-relaxed text-gray-600 sm:text-base">
              {failure.statNote}
            </p>
          </div>
          <div className="reveal flex flex-col justify-center">
            <p className="text-[10px] font-bold uppercase tracking-[0.4em] text-gray-400">
              What you tell yourself
            </p>
            <blockquote className="mt-5 border-l-2 border-bright-coral pl-6 font-display text-2xl font-bold leading-snug tracking-tight text-gray-900 sm:text-3xl">
              {failure.lie}
            </blockquote>
          </div>
        </div>
      </section>

      {/* ── How it actually happens ──────────────────────────────────────── */}
      <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8 lg:py-24">
        <div className="reveal max-w-3xl">
          <SectionLabel>How it actually happens</SectionLabel>
          <div className="mt-7 space-y-6">
            {failure.opening.map((paragraph, paragraphIndex) => (
              <p
                key={paragraph.slice(0, 24)}
                className={
                  paragraphIndex === 0
                    ? "text-xl leading-relaxed text-gray-900 sm:text-2xl"
                    : "text-base leading-relaxed text-gray-600 sm:text-lg"
                }
              >
                {paragraph}
              </p>
            ))}
          </div>
        </div>

        <div className="mt-14 grid gap-8 lg:grid-cols-2">
          <Plate
            frame={openingImage.frame}
            caption={openingImage.caption}
            priority
          />
          <Plate frame={secondImage.frame} caption={secondImage.caption} />
        </div>

        {/* Anatomy timeline */}
        <div className="mt-16 grid gap-10 lg:grid-cols-[minmax(0,420px)_minmax(0,1fr)]">
          <div className="reveal">
            <SectionLabel>Anatomy</SectionLabel>
            <h2 className="mt-5 font-display text-3xl font-extrabold tracking-tight text-gray-900 sm:text-4xl">
              It never feels like failure while it is happening.
            </h2>
            <div className="mt-7 rounded-xl border border-red-200 bg-red-50 p-5">
              <p className="text-[10px] font-bold uppercase tracking-[0.3em] text-red-500">
                How it ends
              </p>
              <p className="mt-3 text-sm leading-relaxed text-red-600">
                {failure.ending}
              </p>
            </div>
          </div>
          <ol className="reveal relative space-y-8 border-l border-gray-200 pl-8">
            {failure.anatomy.map((stage) => (
              <li key={stage.when} className="relative">
                <span
                  className="absolute -left-[41px] top-1.5 h-3 w-3 rounded-full border-2 border-white bg-bright-coral"
                  aria-hidden="true"
                />
                <p className="font-mono text-[11px] font-bold uppercase tracking-[0.3em] text-gray-400">
                  {stage.when}
                </p>
                <p className="mt-2 text-base leading-relaxed text-gray-800 sm:text-lg">
                  {stage.what}
                </p>
              </li>
            ))}
          </ol>
        </div>

        <div className="mt-14 grid gap-8 lg:grid-cols-2">
          <Plate frame={thirdImage.frame} caption={thirdImage.caption} />
          <Plate
            frame={`${failure.slug}-hero`}
            caption="The system you were inside, finally drawn from the outside."
            className="lg:mt-12"
          />
        </div>
      </section>

      {/* ── How Altitut stops it ─────────────────────────────────────────── */}
      <section className="relative border-t border-gray-100 bg-white">
        <div
          className="pointer-events-none absolute inset-0 socials-grid"
          aria-hidden="true"
        />
        <div className="relative mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8 lg:py-24">
          <div className="reveal max-w-3xl">
            <SectionLabel>Where Altitut steps in front of it</SectionLabel>
            <h2 className="mt-5 font-display text-3xl font-extrabold leading-tight tracking-tight text-gray-900 sm:text-5xl">
              Altitut is built so this failure has nowhere to hide.
            </h2>
            <p className="mt-5 text-base leading-relaxed text-gray-600 sm:text-lg">
              Not advice. Not a course you finish and forget. Three concrete
              parts of the platform intercept this specific ending — before it
              costs you a year.
            </p>
          </div>

          <div className="mt-12 grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {failure.remedies.map((remedy, remedyIndex) => (
              <article
                key={remedy.surface}
                className="reveal hover-lift flex flex-col rounded-xl border border-gray-100 bg-white p-6 shadow-custom-subtle"
              >
                <p className="font-mono text-[11px] font-bold uppercase tracking-[0.3em] text-vivid-green">
                  {String(remedyIndex + 1).padStart(2, "0")}
                </p>
                <h3 className="mt-4 font-display text-lg font-bold tracking-tight text-gray-900">
                  {remedy.surface}
                </h3>
                <p className="mt-3 text-sm leading-relaxed text-gray-600">
                  {remedy.how}
                </p>
              </article>
            ))}
          </div>

          <div className="reveal mt-14 grid gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
            <Plate
              frame={`${failure.slug}-resolution`}
              caption="What the same year looks like with evidence behind every decision."
            />
            <Plate
              frame={`${failure.slug}-horizon`}
              caption="Where founders who never hit this failure end up instead."
            />
          </div>
        </div>
      </section>

      {/* ── Reframe + CTA ────────────────────────────────────────────────── */}
      <section className="border-t border-gray-100 bg-gray-50/60">
        <div className="mx-auto max-w-4xl px-4 py-20 text-center sm:px-6 lg:px-8 lg:py-28">
          <p className="reveal text-[10px] font-bold uppercase tracking-[0.4em] text-deep-teal">
            The reframe
          </p>
          <p className="reveal mt-7 font-display text-3xl font-extrabold leading-tight tracking-tight sm:text-4xl lg:text-5xl">
            <span className="gradient-text">{failure.reframe}</span>
          </p>
          <div className="reveal mt-12 flex flex-col items-center justify-center gap-4 sm:flex-row">
            <Link
              href="/"
              className="w-full rounded-lg bg-teal-600 px-8 py-4 text-base font-semibold text-white shadow-modern transition-colors hover:bg-teal-700 sm:w-auto"
            >
              Build with Altitut instead
            </Link>
            <Link
              href="/"
              className="w-full rounded-lg border border-gray-300 bg-white px-8 py-4 text-base font-semibold text-gray-700 transition-colors hover:bg-gray-50 sm:w-auto"
            >
              See the platform
            </Link>
          </div>
          <p className="reveal mt-6 text-xs uppercase tracking-[0.25em] text-gray-400">
            One account. Two products. Nine failures you skip.
          </p>
        </div>
      </section>

      {/* ── Prev / next ──────────────────────────────────────────────────── */}
      <nav
        className="mx-auto max-w-7xl px-4 py-14 sm:px-6 lg:px-8"
        aria-label="Other failures"
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <Link
            href={`/socials/${previous.slug}`}
            className="reveal hover-lift rounded-xl border border-gray-100 bg-white p-6 shadow-custom-subtle"
          >
            <p className="text-[10px] font-bold uppercase tracking-[0.3em] text-gray-400">
              Previous failure
            </p>
            <p className="mt-3 font-display text-xl font-bold tracking-tight text-gray-900">
              {previous.title}
            </p>
            <p className="mt-2 text-sm text-gray-500">{previous.kicker}</p>
          </Link>
          <Link
            href={`/socials/${next.slug}`}
            className="reveal hover-lift rounded-xl border border-gray-100 bg-white p-6 text-right shadow-custom-subtle"
          >
            <p className="text-[10px] font-bold uppercase tracking-[0.3em] text-gray-400">
              Next failure
            </p>
            <p className="mt-3 font-display text-xl font-bold tracking-tight text-gray-900">
              {next.title}
            </p>
            <p className="mt-2 text-sm text-gray-500">{next.kicker}</p>
          </Link>
        </div>
      </nav>
    </div>
  );
}
