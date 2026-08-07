import type { Metadata } from "next";
import { notFound } from "next/navigation";
import {
  FAILURES,
  getFailure,
  getFailureNeighbours,
} from "../failures";
import { FailureStory } from "./failure-story";

type PageProps = {
  params: Promise<{ slug: string }>;
};

export function generateStaticParams() {
  return FAILURES.map((failure) => ({ slug: failure.slug }));
}

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const failure = getFailure(slug);
  if (!failure) {
    return { title: "Failure not found — Altitut" };
  }
  return {
    title: `${failure.title} — The Founder Failure Index`,
    description: failure.verdict,
    openGraph: {
      title: `${failure.title} — Altitut`,
      description: failure.verdict,
      images: [`/socials/${failure.slug}-hero.svg`],
    },
  };
}

export default async function FailurePage({ params }: PageProps) {
  const { slug } = await params;
  const failure = getFailure(slug);
  if (!failure) {
    notFound();
  }
  const { previous, next } = getFailureNeighbours(slug);

  return (
    <FailureStory
      failure={failure}
      index={FAILURES.indexOf(failure)}
      total={FAILURES.length}
      previous={previous}
      next={next}
    />
  );
}
