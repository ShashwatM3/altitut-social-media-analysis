"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type MouseEvent as ReactMouseEvent,
} from "react";
import { FAILURES } from "./failures";
import { toneFor } from "./tones";

const FALLOFF = 0.62;
/** Pointer travel, in px, before a press on an orb counts as a drag. */
const DRAG_SLOP = 6;

type WipeState = {
  left: number;
  top: number;
  size: number;
  scale: number;
  from: string;
  to: string;
};

export function FailureRail() {
  const router = useRouter();
  const railRef = useRef<HTMLDivElement>(null);
  const orbRefs = useRef<Array<HTMLAnchorElement | null>>([]);
  const frameRef = useRef<number | null>(null);
  const draggedRef = useRef(false);
  const [activeIndex, setActiveIndex] = useState(
    Math.floor(FAILURES.length / 2),
  );
  const [wipe, setWipe] = useState<WipeState | null>(null);

  /**
   * Scales every orb by its distance from the centre of the viewport, so the
   * sequence tapers away in both directions as the rail is scrolled.
   */
  const paint = useCallback(() => {
    const rail = railRef.current;
    if (!rail) return;
    const railCentre = rail.getBoundingClientRect().width / 2;
    const falloffDistance = railCentre * 1.15;
    let nearest = 0;
    let nearestDistance = Number.POSITIVE_INFINITY;

    orbRefs.current.forEach((orb, index) => {
      if (!orb) return;
      const orbCentre =
        orb.offsetLeft + orb.offsetWidth / 2 - rail.scrollLeft;
      const distance = Math.abs(orbCentre - railCentre);
      const ratio = Math.min(distance / falloffDistance, 1);
      const eased = ratio * ratio;

      orb.style.setProperty("--orb-scale", (1 - eased * FALLOFF).toFixed(4));
      orb.style.setProperty("--orb-opacity", (1 - eased * 0.55).toFixed(4));
      orb.style.setProperty("--orb-lift", `${(eased * 26).toFixed(2)}px`);
      orb.style.setProperty("--orb-blur", `${(eased * 2.4).toFixed(2)}px`);
      orb.style.zIndex = String(50 - Math.round(ratio * 40));

      if (distance < nearestDistance) {
        nearestDistance = distance;
        nearest = index;
      }
    });

    setActiveIndex(nearest);
  }, []);

  const schedulePaint = useCallback(() => {
    if (frameRef.current !== null) return;
    frameRef.current = window.requestAnimationFrame(() => {
      frameRef.current = null;
      paint();
    });
  }, [paint]);

  /** Start centred on the middle failure. */
  useLayoutEffect(() => {
    const rail = railRef.current;
    const centreOrb = orbRefs.current[Math.floor(FAILURES.length / 2)];
    if (rail && centreOrb) {
      rail.scrollLeft =
        centreOrb.offsetLeft +
        centreOrb.offsetWidth / 2 -
        rail.getBoundingClientRect().width / 2;
    }
    paint();
  }, [paint]);

  useEffect(() => {
    window.addEventListener("resize", schedulePaint);
    return () => {
      window.removeEventListener("resize", schedulePaint);
      if (frameRef.current !== null) {
        window.cancelAnimationFrame(frameRef.current);
      }
    };
  }, [schedulePaint]);

  /** Vertical wheel gestures drive the horizontal rail. */
  useEffect(() => {
    const rail = railRef.current;
    if (!rail) return;
    const onWheel = (event: WheelEvent) => {
      if (Math.abs(event.deltaY) <= Math.abs(event.deltaX)) return;
      event.preventDefault();
      rail.scrollLeft += event.deltaY;
    };
    rail.addEventListener("wheel", onWheel, { passive: false });
    return () => rail.removeEventListener("wheel", onWheel);
  }, []);

  const centreOn = useCallback((index: number) => {
    const rail = railRef.current;
    const orb = orbRefs.current[index];
    if (!rail || !orb) return;
    rail.scrollTo({
      left:
        orb.offsetLeft +
        orb.offsetWidth / 2 -
        rail.getBoundingClientRect().width / 2,
      behavior: "smooth",
    });
  }, []);

  /** Settle a free-form drag onto whichever orb ended up nearest the centre. */
  const centreOnNearest = useCallback(() => {
    const rail = railRef.current;
    if (!rail) return;
    const railCentre = rail.getBoundingClientRect().width / 2;
    let nearest = 0;
    let nearestDistance = Number.POSITIVE_INFINITY;
    orbRefs.current.forEach((orb, index) => {
      if (!orb) return;
      const distance = Math.abs(
        orb.offsetLeft + orb.offsetWidth / 2 - rail.scrollLeft - railCentre,
      );
      if (distance < nearestDistance) {
        nearestDistance = distance;
        nearest = index;
      }
    });
    centreOn(nearest);
  }, [centreOn]);

  /**
   * Click-and-drag pans the rail, which desktop browsers do not do natively.
   * Travel past `DRAG_SLOP` marks the gesture as a drag so releasing on an orb
   * pans instead of opening its story.
   */
  useEffect(() => {
    const rail = railRef.current;
    if (!rail) return;

    let pointerId: number | null = null;
    let startX = 0;
    let startScroll = 0;

    const onPointerDown = (event: PointerEvent) => {
      if (event.pointerType !== "mouse" || event.button !== 0) return;
      pointerId = event.pointerId;
      startX = event.clientX;
      startScroll = rail.scrollLeft;
      draggedRef.current = false;
    };

    const onPointerMove = (event: PointerEvent) => {
      if (pointerId !== event.pointerId) return;
      const travel = event.clientX - startX;
      if (!draggedRef.current) {
        if (Math.abs(travel) < DRAG_SLOP) return;
        draggedRef.current = true;
        rail.setPointerCapture(event.pointerId);
      }
      event.preventDefault();
      rail.scrollLeft = startScroll - travel;
    };

    const onPointerUp = (event: PointerEvent) => {
      if (pointerId !== event.pointerId) return;
      pointerId = null;
      if (rail.hasPointerCapture(event.pointerId)) {
        rail.releasePointerCapture(event.pointerId);
      }
      if (!draggedRef.current) return;
      centreOnNearest();
      // Cleared after the click event that follows this release.
      window.setTimeout(() => {
        draggedRef.current = false;
      }, 0);
    };

    rail.addEventListener("pointerdown", onPointerDown);
    rail.addEventListener("pointermove", onPointerMove);
    rail.addEventListener("pointerup", onPointerUp);
    rail.addEventListener("pointercancel", onPointerUp);
    return () => {
      rail.removeEventListener("pointerdown", onPointerDown);
      rail.removeEventListener("pointermove", onPointerMove);
      rail.removeEventListener("pointerup", onPointerUp);
      rail.removeEventListener("pointercancel", onPointerUp);
    };
  }, [centreOnNearest]);

  /** Expand the clicked orb into a full-bleed wipe, then route to its story. */
  const openFailure = useCallback(
    (event: ReactMouseEvent<HTMLAnchorElement>, index: number) => {
      if (event.metaKey || event.ctrlKey || event.shiftKey) return;
      event.preventDefault();
      if (draggedRef.current) return;
      const orb = orbRefs.current[index];
      const failure = FAILURES[index];
      if (!orb) {
        router.push(`/socials/${failure.slug}`);
        return;
      }
      const rect = orb.getBoundingClientRect();
      const reach = Math.hypot(window.innerWidth, window.innerHeight);
      const tone = toneFor(index);
      setWipe({
        left: rect.left,
        top: rect.top,
        size: rect.width,
        scale: Math.ceil((reach * 2) / Math.max(rect.width, 1)),
        from: tone.from,
        to: tone.to,
      });
      window.setTimeout(() => router.push(`/socials/${failure.slug}`), 520);
    },
    [router],
  );

  const active = FAILURES[activeIndex];

  return (
    <div className="relative flex min-h-screen flex-col overflow-hidden bg-white">
      <div
        className="pointer-events-none absolute inset-0 animate-aurora-drift socials-aurora"
        aria-hidden="true"
      />
      <div
        className="pointer-events-none absolute inset-0 socials-grid"
        aria-hidden="true"
      />

      <header className="relative z-20 flex items-center justify-between px-5 py-5 sm:px-8 lg:px-12">
        <Link
          href="/"
          className="font-display text-sm font-extrabold uppercase tracking-[0.4em] text-deep-teal transition-opacity hover:opacity-70"
        >
          Altitut
        </Link>
        <Link
          href="/"
          className="group inline-flex items-center gap-2 rounded-full border border-gray-200 bg-white/70 px-5 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-gray-600 backdrop-blur-subtle transition-colors hover:border-deep-teal hover:text-deep-teal"
        >
          Enter Altitut
          <span className="transition-transform group-hover:translate-x-1">
            &rarr;
          </span>
        </Link>
      </header>

      <main className="relative z-10 flex flex-1 flex-col justify-center pb-10">
        <section className="px-5 text-center sm:px-8">
          <p className="text-[10px] font-semibold uppercase tracking-[0.45em] text-bright-coral sm:text-xs">
            The founder failure index
          </p>
          <h1 className="mx-auto mt-4 max-w-4xl font-display text-3xl font-extrabold leading-[1.08] tracking-tight text-gray-900 sm:text-4xl lg:text-5xl">
            Nine ways it ends.
            <span className="block gradient-text">None of them loud.</span>
          </h1>
          <p className="mx-auto mt-4 max-w-xl text-sm leading-relaxed text-gray-500">
            Startups rarely explode. They fade — quietly, predictably, in the
            same nine ways. Open one. See exactly where it begins, and where
            Altitut steps in front of it.
          </p>
        </section>

        <div
          ref={railRef}
          onScroll={schedulePaint}
          className="scrollbar-hide mt-4 flex cursor-grab select-none snap-x snap-mandatory items-center gap-6 active:cursor-grabbing overflow-x-auto overscroll-x-contain px-[calc(50vw-104px)] py-12 sm:gap-10 sm:px-[calc(50vw-144px)] lg:px-[calc(50vw-160px)]"
          role="list"
          aria-label="Founder failures"
        >
          {FAILURES.map((failure, index) => {
            const tone = toneFor(index);
            return (
              <Link
                key={failure.slug}
                href={`/socials/${failure.slug}`}
                ref={(node) => {
                  orbRefs.current[index] = node;
                }}
                onClick={(event) => openFailure(event, index)}
                onFocus={() => centreOn(index)}
                /* Otherwise the browser starts a native link drag and the
                   rail's pointer gesture is cancelled. */
                draggable={false}
                role="listitem"
                aria-label={`${failure.title} — ${failure.kicker}`}
                className="orb group relative flex h-52 w-52 flex-none snap-center items-center justify-center rounded-full outline-none sm:h-64 sm:w-64 lg:h-72 lg:w-72"
                style={
                  {
                    "--orb-from": tone.from,
                    "--orb-to": tone.to,
                  } as CSSProperties
                }
              >
                <span
                  className="orb-halo pointer-events-none absolute -inset-10 animate-halo-breathe rounded-full opacity-25 blur-2xl"
                  aria-hidden="true"
                />
                <span
                  className="orb-skin absolute inset-0 rounded-full transition-transform duration-500 group-hover:scale-[1.04] group-focus-visible:scale-[1.04]"
                  aria-hidden="true"
                />
                <span
                  className="pointer-events-none absolute inset-[-6px] animate-orbit-spin rounded-full border border-dashed border-deep-teal/25"
                  aria-hidden="true"
                >
                  <span className="absolute left-1/2 top-0 h-2 w-2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-bright-coral" />
                </span>
                <span className="relative z-10 flex flex-col items-center gap-3 px-8 text-center">
                  <span className="text-[9px] font-bold uppercase tracking-[0.4em] text-white/60">
                    Failure {String(index + 1).padStart(2, "0")}
                  </span>
                  <span className="whitespace-pre-line font-display text-xl font-extrabold leading-tight tracking-tight text-white sm:text-2xl">
                    {failure.label}
                  </span>
                  <span className="h-px w-8 bg-white/40" />
                  <span className="text-[10px] font-medium uppercase tracking-[0.18em] text-white/70">
                    {failure.kicker}
                  </span>
                </span>
              </Link>
            );
          })}
        </div>

        <section className="px-5 text-center sm:px-8" aria-live="polite">
          <p className="font-mono text-[11px] font-semibold uppercase tracking-[0.35em] text-gray-400">
            {String(activeIndex + 1).padStart(2, "0")} / {""}
            {String(FAILURES.length).padStart(2, "0")}
          </p>
          <p className="mx-auto mt-3 max-w-2xl text-base font-semibold text-gray-900 sm:text-lg">
            {active.verdict}
          </p>
          <div className="mt-6 flex flex-col items-center justify-center gap-3 sm:flex-row sm:gap-4">
            <Link
              href={`/socials/${active.slug}`}
              className="rounded-lg bg-teal-600 px-6 py-3 text-sm font-semibold text-white shadow-modern transition-colors hover:bg-teal-700"
            >
              Open failure {String(activeIndex + 1).padStart(2, "0")}
            </Link>
            <Link
              href="/"
              className="rounded-lg border border-gray-300 px-6 py-3 text-sm font-semibold text-gray-700 transition-colors hover:bg-gray-50"
            >
              Never reach it &mdash; start with Altitut
            </Link>
          </div>
          <p className="mt-6 inline-flex items-center gap-2 text-[10px] font-medium uppercase tracking-[0.3em] text-gray-400">
            Scroll sideways
            <span className="animate-hint-slide" aria-hidden="true">
              &rarr;
            </span>
          </p>
        </section>
      </main>

      {wipe ? (
        <span
          className="orb-wipe orb-skin"
          aria-hidden="true"
          style={
            {
              left: wipe.left,
              top: wipe.top,
              width: wipe.size,
              height: wipe.size,
              "--wipe-scale": wipe.scale,
              "--orb-from": wipe.from,
              "--orb-to": wipe.to,
            } as CSSProperties
          }
        />
      ) : null}
    </div>
  );
}
