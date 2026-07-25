"""Altitut product context constants (mirrors `lib/altitut.ts`)."""

from __future__ import annotations

DEFAULT_ALTITUT_DESCRIPTION = (
    "Altitut is an AI-powered entrepreneurship platform for students and early-stage founders. "
    "It combines learning modules, customer discovery tooling, pitch practice, and progress tracking "
    "so users can validate ideas and build startup momentum in one place. It ships as two products on "
    'one platform: a web app — a structured "startup operating system" / LMS with courses, funding '
    "discovery, a pitch toolkit, customer interviews, MVP builders, Ikigai idea discovery, and personas — "
    "and a pixel-art RPG game that teaches the same curriculum through play, with an AI mentor (Alti), "
    "an XP/coin economy, mini-games, and classroom features for instructors running cohorts."
)

ALTITUT_CHAT_CONTEXT = """Altitut is an entrepreneurship-education platform that teaches students and early founders how to build a startup — idea discovery, customer interviews, MVP building, pitching, and funding applications. One shared platform (Firebase auth/data + FastAPI backend + AI features) ships through two products:

1. Altitut Web App — a React "startup operating system" / LMS: Home dashboard, Course (class/LMS layer for instructors with gradebook), My Startup profile builder, Funding discovery with AI match scores, Pitch toolkit (AI deck review / guided crafting / practice recording), Learning curriculum, Interviews hub (AI transcription + insight extraction), MVP builders (AI mockups, prototypes, GitHub scaffolds), Ikigai idea discovery, Personas, badges/credentials.

2. Altitut Game — a Phaser 3 pixel-art RPG teaching the same curriculum through play: a Garage hub, Startup City, a Pitch Arena, and four skill worlds (Spark: ideation, Forge: product building, Vault: finance, Summit: growth) with mini-games, a coin/XP economy, pets, leaderboards, and an AI mentor named Alti.

Audience: students (high school through college), early-stage founders, and instructors running entrepreneurship classes. Both products share accounts, backend, and curriculum. Altitut's social media growth stage: roughly 700–1K users, early in building a consistent social presence."""
