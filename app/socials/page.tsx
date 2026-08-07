import type { Metadata } from "next";
import { FailureRail } from "./failure-rail";

export const metadata: Metadata = {
  title: "The Founder Failure Index — Altitut",
  description:
    "Nine ways a startup quietly ends, and how Altitut steps in front of each one.",
};

export default function SocialsPage() {
  return <FailureRail />;
}
