"""Competitor Scout 8-step pipeline."""

from __future__ import annotations

import re
from typing import Any

import httpx

from app.models import AnalysisPack, PackLinks, PackSection, Provider, ScoutState
from app.services.apify_client import scrape_instagram_profiles
from app.services.exa_client import contents as exa_contents
from app.services.exa_client import search as exa_search
from app.services.openai_client import complete_json
from app.services.pack_service import normalize_links, normalize_section, sort_sections

DIGEST_LIMIT = 12000


def clip(text: str, limit: int = DIGEST_LIMIT) -> str:
    return text if len(text) <= limit else f"{text[:limit]}\n…[truncated]"


def domain_of(url: str) -> str:
    try:
        return re.sub(r"^www\.", "", httpx.URL(url).host)
    except Exception:
        return url


SOCIAL_PATTERNS: list[tuple[str, re.Pattern]] = [
    ("instagram", re.compile(r"https?://(?:www\.)?instagram\.com/[A-Za-z0-9_.]+/?")),
    ("linkedin", re.compile(r"https?://(?:www\.)?linkedin\.com/(?:company|school)/[A-Za-z0-9_-]+/?")),
    ("twitter", re.compile(r"https?://(?:www\.)?(?:twitter|x)\.com/[A-Za-z0-9_]+/?")),
]


async def step_discover(state: ScoutState) -> ScoutState:
    product_description = state.productDescription
    existing_names = state.existingNames

    company_queries = [
        f"platforms similar to: {product_description[:300]}",
        "gamified entrepreneurship education platform for students and early founders",
        "startup simulation learning platform customer discovery pitch practice software",
    ]
    article_queries = [
        f"article roundup of the best platforms and tools like: {product_description[:250]}",
        "best entrepreneurship education platforms for students article comparison review",
        "top startup simulation games and founder training tools roundup blog post",
    ]

    company_results_per_query = await _gather_searches(
        company_queries, category="company", num_results=10, max_characters=1200
    )
    article_results_per_query = await _gather_searches(
        article_queries, num_results=5, max_characters=2500
    )

    seen: set[str] = set()
    company_candidates = []
    for result in _flatten(company_results_per_query):
        d = domain_of(result.url)
        if d in seen:
            continue
        seen.add(d)
        company_candidates.append(result)
    company_candidates = company_candidates[:24]

    seen_articles: set[str] = set()
    articles = []
    for result in _flatten(article_results_per_query):
        if result.url in seen_articles or not result.text:
            continue
        seen_articles.add(result.url)
        articles.append(result)
    articles = articles[:8]

    if not company_candidates and not articles:
        raise ValueError("Exa returned no company candidates or articles — try again.")

    article_companies: list[dict[str, str]] = []
    if articles:
        try:
            extraction = complete_json(
                system=(
                    "You extract companies/products that are explicitly named AND described inside articles. "
                    "Only include a company if the article's text genuinely describes it as a product matching the target pattern — quote the describing sentence as evidence. "
                    "Never include the article's publisher itself, ad networks, or companies mentioned only in passing. "
                    'Respond with JSON {"companies": [{"name", "website", "evidence", "source_article"}]} (website may be an empty string if the article gives none).'
                ),
                user=(
                    f"TARGET PRODUCT PATTERN:\n{product_description}\n\n"
                    f"SKIP THESE (already tracked): {', '.join(existing_names) or 'none'}\n\n"
                    f"ARTICLES:\n"
                    + "\n\n".join(
                        f"--- Article {i + 1}: {result.title or result.url} ({result.url}) ---\n{(result.text or '')[:2200]}"
                        for i, result in enumerate(articles)
                    )
                ),
                max_output_tokens=2500,
            )
            if isinstance(extraction, dict):
                article_companies = [
                    c for c in extraction.get("companies", []) if isinstance(c, dict) and c.get("name")
                ]
        except Exception:
            pass

    selection = complete_json(
        system=(
            "You select the single best NEW competitor for a competitive-intelligence pack. "
            "A good competitor matches the product pattern closely (entrepreneurship education / startup-building platform for students or early founders, ideally gamified or AI-assisted). "
            "STRONGLY prefer candidates that appear in BOTH lists (found by company search AND independently described in an article) — article corroboration means the company is real and genuinely in this domain. "
            "Exclude accelerators, VC funds, news sites/publishers, marketplaces, generic AI tools, and anything already tracked. The company's own description must clearly match the product pattern — name similarity alone is meaningless. "
            'Respond with JSON: {"name", "website", "why_chosen", "corroboration" (which sources back this pick — cite the article if one does), "alternates": [{"name", "website"}] (2-4, ranked)}.'
        ),
        user=(
            f"OUR PRODUCT:\n{product_description}\n\n"
            f"ALREADY-TRACKED COMPETITORS (never pick these): {', '.join(existing_names) or 'none'}\n\n"
            f"LIST 1 — CANDIDATES FROM LIVE COMPANY SEARCH:\n"
            + ("\n\n".join(
                f"{i + 1}. {result.title or domain_of(result.url)} — {result.url}\n{(result.text or '')[:600]}"
                for i, result in enumerate(company_candidates)
            ) or "(none found)")
            + "\n\nLIST 2 — COMPANIES DESCRIBED IN RELEVANT ARTICLES (independently corroborated):\n"
            + ("\n".join(
                f"{i + 1}. {company.get('name')}{(' — ' + company.get('website')) if company.get('website') else ''}\n   evidence: \"{company.get('evidence')}\" (from {company.get('source_article')})"
                for i, company in enumerate(article_companies)
            ) or "(none extracted)")
        ),
    )

    if not selection.get("website") or not selection.get("name"):
        raise ValueError("Could not select a competitor from search results.")

    existing_lower = [n.lower() for n in existing_names]
    name_lower = selection["name"].lower()
    if any(name_lower in n or n in name_lower for n in existing_lower):
        fallback = next(
            (a for a in selection.get("alternates", []) if a.get("name") and not any(a["name"].lower() in n or n in a["name"].lower() for n in existing_lower)),
            None,
        )
        if fallback:
            selection["name"] = fallback["name"]
            selection["website"] = fallback["website"]
            selection["why_chosen"] = "Chosen as best untracked alternate."

    candidate = ScoutCandidate(
        name=selection["name"],
        website=selection["website"],
        whyChosen=" Corroboration: ".join(filter(None, [selection.get("why_chosen"), selection.get("corroboration")])),
        links=PackLinks(website=selection["website"]),
    )
    return state.model_copy(update={
        "candidate": candidate,
        "alternates": selection.get("alternates", []),
    })


async def _gather_searches(
    queries: list[str],
    *,
    num_results: int,
    max_characters: int,
    category: str | None = None,
) -> list[list[Any]]:
    results: list[list[Any]] = []
    for query in queries:
        try:
            results.append(
                exa_search(
                    query,
                    num_results=num_results,
                    include_text=True,
                    max_characters=max_characters,
                    category=category,
                )
            )
        except Exception:
            results.append([])
    return results


def _flatten(nested: list[list[Any]]) -> list[Any]:
    return [item for sub in nested for item in sub]


async def _extract_social_links(website_url: str) -> PackLinks:
    links: dict[str, str] = {}
    try:
        with httpx.Client(timeout=15) as client:
            response = client.get(
                website_url,
                headers={"User-Agent": "Mozilla/5.0 (compatible; AltitutScout/1.0)"},
            )
            response.raise_for_status()
            html = response.text
        for key, pattern in SOCIAL_PATTERNS:
            match = pattern.search(html)
            if match:
                url = match.group(0)
                if re.search(r"intent|share|sharer", url, re.I):
                    continue
                if key == "twitter":
                    links.setdefault("twitter", url)
                else:
                    links[key] = url
    except Exception:
        pass
    return PackLinks.model_validate(links)


async def _verify_candidate_relevance(
    product_description: str, candidate_name: str, website: str, homepage_text: str
) -> dict[str, Any]:
    verdict = complete_json(
        system=(
            "You are a strict competitive-intelligence gatekeeper. Given OUR product and the live homepage text of a candidate company, decide whether the candidate is genuinely a competitor/similar product. "
            "is_match is true ONLY if the homepage clearly shows a product in the same space (entrepreneurship education, startup-building tools, founder/student training, startup simulation). "
            "Publishers, agencies, generic AI/video tools, unrelated SaaS, dead/parked pages => false. Name similarity is meaningless. "
            'Respond with JSON {"is_match": boolean, "reason": "one sentence citing homepage evidence"}.'
        ),
        user=(
            f"OUR PRODUCT:\n{product_description}\n\n"
            f"CANDIDATE: {candidate_name} ({website})\n\nHOMEPAGE TEXT (live crawl):\n{homepage_text[:5000] or '(no text could be crawled)'}"
        ),
        max_output_tokens=300,
    )
    return {"is_match": bool(verdict.get("is_match")), "reason": verdict.get("reason", "")}


async def step_website(state: ScoutState) -> ScoutState:
    if not state.candidate:
        raise ValueError("No candidate selected yet.")

    queue: list[ScoutCandidate] = [state.candidate]
    for alt in state.alternates or []:
        website = alt.get("website") if isinstance(alt, dict) else alt.website
        if website:
            queue.append(
                ScoutCandidate(
                    name=alt.get("name") if isinstance(alt, dict) else alt.name,
                    website=website,
                    whyChosen="Promoted from alternates after the primary pick failed the homepage relevance check.",
                    links=PackLinks(website=website),
                )
            )
    queue = queue[:3]

    rejections: list[str] = []
    for candidate in queue:
        try:
            homepage = exa_contents([candidate.website], 8000)
        except Exception:
            homepage = []
        homepage_text = homepage[0].text if homepage else ""
        try:
            relevance = await _verify_candidate_relevance(
                state.productDescription, candidate.name, candidate.website, homepage_text
            )
        except Exception:
            relevance = {"is_match": True, "reason": "relevance check unavailable — proceeding"}

        if not relevance["is_match"]:
            rejections.append(f"{candidate.name} ({candidate.website}): {relevance['reason']}")
            continue

        try:
            product_pages = exa_search(
                f"{candidate.name} product features pricing how it works",
                num_results=5,
                include_text=True,
                max_characters=2000,
                include_domains=[domain_of(candidate.website)],
            )
        except Exception:
            product_pages = []

        try:
            social_links = await _extract_social_links(candidate.website)
        except Exception:
            social_links = PackLinks()

        digest = "\n".join(
            [
                f"RELEVANCE CHECK PASSED: {relevance['reason']}",
                f"(Earlier picks rejected by the relevance gate: {' | '.join(rejections)})" if rejections else "",
                "",
                f"HOMEPAGE ({candidate.website}):",
                homepage_text or "(homepage text unavailable)",
                "",
                "OTHER PAGES ON THEIR SITE:",
                *[
                    f"— {page.title or page.url} ({page.url})\n{page.text or ''}"
                    for page in product_pages
                ],
            ]
        )

        verified_links = PackLinks.model_validate({
            **social_links.model_dump(exclude_none=True),
            "website": candidate.website,
        })
        return state.model_copy(update={
            "candidate": candidate.model_copy(update={"links": verified_links}),
            "websiteDigest": clip(digest),
        })

    raise ValueError(
        f"No candidate passed the homepage relevance check. Rejected: {' | '.join(rejections) or 'all candidates unreachable'}. Re-run the scout."
    )


def _instagram_username(url: str) -> str | None:
    match = re.search(r"instagram\.com/([A-Za-z0-9_.]+)", url)
    if not match:
        return None
    username = match.group(1)
    if username in {"p", "reel", "reels", "explore", "stories"}:
        return None
    return username


def _verify_social_profiles(
    candidate: dict[str, Any], product_description: str, profiles: list[dict[str, Any]]
) -> dict[str, dict[str, Any]]:
    verdicts: dict[str, dict[str, Any]] = {}
    if not profiles:
        return verdicts
    try:
        result = complete_json(
            system=(
                "You verify whether social media profiles belong to a specific company. Be STRICT. "
                "A profile belongs only if its bio, display name, posted content, or linked website clearly matches the company, its product, or its founders. "
                "A similar-looking handle or brand name is NOT evidence — unrelated accounts often share names. Content in a completely different domain (e.g. AI art, memes, personal lifestyle) means it does NOT belong, no matter the name. "
                "Profiles listed on the company's own website should be kept unless the evidence clearly shows a different company. When evidence is too thin to decide, belongs = false — a missing link is better than a wrong one. "
                'Respond with JSON {"verdicts": [{"url", "belongs": boolean, "reason": "one sentence"}]} covering EVERY profile given.'
            ),
            user=(
                f"COMPANY: {candidate['name']} ({candidate['website']})\n"
                f"WHAT THE COMPANY DOES (context): {product_description[:400]}\n"
                f"WHY IT WAS PICKED: {candidate['whyChosen'][:300]}\n\n"
                f"PROFILES TO VERIFY:\n"
                + "\n\n".join(
                    f"{i + 1}. [{p['platform']}] {p['url']}{' (listed on the company\'s own website)' if p.get('fromOwnWebsite') else ' (found via web search)'}\nOBSERVED EVIDENCE:\n{p.get('evidence', '(no evidence could be gathered)')[:1500]}"
                    for i, p in enumerate(profiles)
                )
            ),
            max_output_tokens=1200,
        )
        for verdict in result.get("verdicts", []) or []:
            if isinstance(verdict, dict) and isinstance(verdict.get("url"), str):
                verdicts[verdict["url"]] = {
                    "keep": bool(verdict.get("belongs")),
                    "reason": verdict.get("reason", ""),
                }
    except Exception:
        for profile in profiles:
            verdicts[profile["url"]] = {
                "keep": profile.get("fromOwnWebsite", False),
                "reason": (
                    "Listed on the company's own website (verifier unavailable)."
                    if profile.get("fromOwnWebsite")
                    else "Dropped — could not verify ownership (verifier unavailable)."
                ),
            }
    return verdicts


async def step_social(state: ScoutState) -> ScoutState:
    candidate = state.candidate
    if not candidate:
        raise ValueError("No candidate selected yet.")

    notes: list[str] = []
    profiles: list[dict[str, Any]] = []

    # Instagram
    instagram_url = candidate.links.instagram if candidate.links else None
    instagram_from_website = bool(instagram_url)
    if not instagram_url:
        try:
            results = exa_search(
                f"{candidate.name} {domain_of(candidate.website)} instagram profile",
                num_results=3,
                include_domains=["instagram.com"],
                include_text=True,
                max_characters=600,
            )
            for result in results:
                username = _instagram_username(result.url)
                if username:
                    instagram_url = f"https://www.instagram.com/{username}/"
                    break
        except Exception:
            pass

    instagram_scrape_notes = ""
    if instagram_url:
        username = _instagram_username(instagram_url)
        if username:
            instagram_url = f"https://www.instagram.com/{username}/"
            try:
                profile_list = scrape_instagram_profiles([username])
                profile = profile_list[0] if profile_list else None
                if profile:
                    latest_posts = profile.get("latestPosts", []) or []
                    if isinstance(latest_posts, list):
                        posts_texts = [
                            f"post {i + 1}: type={post.get('type', '?')} likes={post.get('likesCount', '?')} comments={post.get('commentsCount', '?')} ts={post.get('timestamp', '?')} caption=\"{str(post.get('caption', ''))[:180]}\""
                            for i, post in enumerate(latest_posts[:6])
                        ]
                    else:
                        posts_texts = []
                    instagram_scrape_notes = "\n".join(
                        [
                            f"handle=@{username} fullName=\"{profile.get('fullName', '')}\" verified={profile.get('verified', '?')}",
                            f"followers={profile.get('followersCount', '?')} following={profile.get('followsCount', '?')} posts={profile.get('postsCount', '?')}",
                            f"bio: {profile.get('biography', '')}",
                            f"external link in bio: {profile.get('externalUrl', '(none)')}",
                            *posts_texts,
                        ]
                    )
            except Exception as exc:
                instagram_scrape_notes = f"live scrape failed: {exc}"
            profiles.append(
                {
                    "platform": "instagram",
                    "url": instagram_url,
                    "evidence": instagram_scrape_notes,
                    "fromOwnWebsite": instagram_from_website,
                }
            )

    # LinkedIn / X / YouTube / TikTok
    platform_lookups = [
        {
            "platform": "linkedin",
            "existing": candidate.links.linkedin if candidate.links else None,
            "domains": ["linkedin.com"],
            "pattern": re.compile(r"https?://(?:www\.)?linkedin\.com/(?:company|school)/[A-Za-z0-9_-]+"),
        },
        {
            "platform": "twitter",
            "existing": candidate.links.twitter if candidate.links else None,
            "domains": ["x.com", "twitter.com"],
            "pattern": re.compile(r"https?://(?:www\.)?(?:twitter|x)\.com/[A-Za-z0-9_]+"),
        },
        {
            "platform": "youtube",
            "existing": None,
            "domains": ["youtube.com"],
            "pattern": re.compile(r"https?://(?:www\.)?youtube\.com/(?:@|channel/|c/)[A-Za-z0-9_.-]+"),
        },
        {
            "platform": "tiktok",
            "existing": None,
            "domains": ["tiktok.com"],
            "pattern": re.compile(r"https?://(?:www\.)?tiktok\.com/@[A-Za-z0-9_.]+"),
        },
    ]

    for lookup in platform_lookups:
        try:
            results = exa_search(
                f"{candidate.name} {domain_of(candidate.website)} official profile",
                num_results=2,
                include_domains=lookup["domains"],
                include_text=True,
                max_characters=900,
            )
            search_evidence = "\n---\n".join(f"{r.url}\n{r.text or ''}" for r in results)
            if lookup["existing"]:
                profiles.append(
                    {
                        "platform": lookup["platform"],
                        "url": lookup["existing"],
                        "evidence": search_evidence or "(no page text retrievable)",
                        "fromOwnWebsite": True,
                    }
                )
                continue
            match = next(
                (
                    r
                    for r in results
                    if lookup["pattern"].search(r.url) and not re.search(r"intent|share|sharer", r.url, re.I)
                ),
                None,
            )
            if match:
                matched_url = lookup["pattern"].search(match.url)
                profiles.append(
                    {
                        "platform": lookup["platform"],
                        "url": matched_url.group(0) if matched_url else match.url,
                        "evidence": f"{match.title or ''}\n{match.text or ''}",
                        "fromOwnWebsite": False,
                    }
                )
            else:
                notes.append(f"{lookup['platform'].upper()}: no profile found — treat as absent/unverified.")
        except Exception:
            notes.append(f"{lookup['platform'].upper()}: lookup failed — treat as unverified.")

    verdicts = _verify_social_profiles(
        {
            "name": candidate.name,
            "website": candidate.website,
            "whyChosen": candidate.whyChosen,
        },
        state.productDescription,
        profiles,
    )

    verified_links: dict[str, str] = {"website": candidate.website}
    for profile in profiles:
        verdict = verdicts.get(profile["url"], {"keep": False, "reason": "No verdict returned — dropped to be safe."})
        if verdict["keep"]:
            if profile["platform"] == "instagram":
                verified_links["instagram"] = profile["url"]
            elif profile["platform"] == "linkedin":
                verified_links["linkedin"] = profile["url"]
            elif profile["platform"] == "twitter":
                verified_links["twitter"] = profile["url"]
            notes.append(
                f"{profile['platform'].upper()} ✓ VERIFIED {profile['url']} — {verdict['reason']}"
            )
            notes.append(profile["evidence"])
        else:
            notes.append(
                f"{profile['platform'].upper()} ✗ REJECTED {profile['url']} — {verdict['reason']} Treat this platform as having NO verified presence; do not cite this account's stats."
            )

    return state.model_copy(update={
        "candidate": candidate.model_copy(update={"links": PackLinks.model_validate(verified_links)}),
        "socialDigest": clip("\n\n".join(notes)),
    })


async def step_research(state: ScoutState) -> ScoutState:
    candidate = state.candidate
    if not candidate:
        raise ValueError("No candidate selected yet.")
    name = candidate.name
    domain = domain_of(candidate.website)

    research = [
        (
            "NEWS & FUNDING",
            lambda: exa_search(
                f"{name} {domain} startup news funding launch announcement",
                num_results=5,
                include_text=True,
                max_characters=1200,
            ),
        ),
        (
            "REVIEWS & USER SENTIMENT",
            lambda: exa_search(
                f"{name} reviews what users say pros cons",
                num_results=6,
                include_text=True,
                max_characters=1200,
                include_domains=["g2.com", "capterra.com", "trustpilot.com", "reddit.com", "producthunt.com"],
            ),
        ),
        (
            "CONTENT & MARKETING FOOTPRINT",
            lambda: exa_search(
                f"{name} content marketing strategy blog series social media posts",
                num_results=5,
                include_text=True,
                max_characters=1200,
            ),
        ),
        (
            "PARTNERSHIPS, ADS & DISTRIBUTION",
            lambda: exa_search(
                f"{name} partnership collaboration ambassador program advertising",
                num_results=5,
                include_text=True,
                max_characters=1000,
            ),
        ),
    ]

    settled: list[str] = []
    for label, call in research:
        try:
            results = call()
            text = "\n\n".join(f"— {r.title or r.url} ({r.url}, {r.published_date or 'n.d.'})\n{r.text or ''}" for r in results) or "(nothing found)"
        except Exception as exc:
            text = f"(lookup failed: {exc})"
        settled.append(f"### {label}\n{text}")

    return state.model_copy(update={"researchDigest": clip("\n\n".join(settled), 16000)})


BLOCK_FORMAT_RULES = """Each section is {"id", "title", "entries": [{"label", "blocks"}]}.
Each block is ONE of:
  {"type": "paragraph", "text": "..."} — a short framing paragraph
  {"type": "bullets", "items": ["...", "..."]} — 4-7 substantive bullets
  {"type": "labeled", "label": "Group name", "items": ["...", "..."]} — a labeled bullet group
Entry pattern used across the dashboard: one opening paragraph block, then one or two bullets/labeled blocks.
Every bullet must be a full, specific sentence with real facts from the research — never generic filler.
When the research does not verify something, say so explicitly in the bullet (e.g. "Directional — verify via scrape" / "No verified account found"), exactly like an honest analyst would. Do NOT invent follower counts, revenue, or quotes.
Where relevant, end entries with an actionable "Altitut" takeaway bullet."""

SYNTHESIS_SYSTEM = (
    "You are a senior competitive-intelligence analyst producing a structured competitor pack for Altitut's Social Media Command Center. "
    "You write dense, specific, honest analysis in the exact JSON structure requested. "
    + BLOCK_FORMAT_RULES
)


def _synthesis_context(state: ScoutState) -> str:
    candidate = state.candidate
    return "\n".join(
        [
            f"COMPETITOR: {candidate.name} ({candidate.website})",
            f"WHY CHOSEN: {candidate.whyChosen}",
            f"KNOWN LINKS: {candidate.links.model_dump_json(exclude_none=True) if candidate.links else '{}'}",
            "",
            "=== ALTITUT (OUR PRODUCT) ===",
            state.productDescription,
            "",
            "=== WEBSITE RESEARCH ===",
            state.websiteDigest or "(none)",
            "",
            "=== SOCIAL PRESENCE RESEARCH ===",
            state.socialDigest or "(none)",
            "",
            "=== DEEP RESEARCH (news, reviews, content, partnerships) ===",
            state.researchDigest or "(none)",
        ]
    )


def _parse_sections(parsed: Any, expected_ids: list[str]) -> list[PackSection]:
    if not isinstance(parsed, dict):
        raise ValueError("missing sections array")
    raw = parsed.get("sections")
    if not isinstance(raw, list):
        raise ValueError("missing sections array")
    sections = [s for s in (normalize_section(item) for item in raw) if s is not None]
    if len(sections) < len(expected_ids):
        raise ValueError(
            f"expected {len(expected_ids)} sections ({', '.join(expected_ids)}), got {len(sections)}"
        )
    return sections


async def step_synthesize_identity(state: ScoutState) -> ScoutState:
    parsed = complete_json(
        system=SYNTHESIS_SYSTEM,
        user=(
            f"{_synthesis_context(state)}\n\n"
            + """Produce JSON {"sections": [...]} with EXACTLY these two sections:
1) id "identity", title "1. IDENTITY", entries labeled: "1.1 Snapshot" (one-liner, competitive tier, buyer/user split, websites, social reality, strategic read), "1.2 Positioning" (value prop, differentiation, whitespace vs Altitut), "1.3 Target Audience / ICP" (use labeled blocks: "Primary buyers"/"Primary users"/"Who they are NOT targeting" or similar), "1.4 Similarity to Us" (labeled blocks scoring "C1 — Product similarity: N/10", "C2 — Learning flow similarity: N/10", "C3 — Gamification similarity: N/10" with rationale bullets comparing to Altitut's features).
2) id "product", title "2. PRODUCT & WEBSITE", entries labeled: "2.1 Highlight Features", "2.2 Most-Attractive Features", "2.3 Messaging & Conversion" (labeled blocks like "Headline patterns"/"Conversion funnel"/"Social proof"), "2.4 Insights to Imbibe" (what Altitut should borrow)."""
        ),
        max_output_tokens=8000,
        validate=lambda value: _parse_sections(value, ["identity", "product"]),
    )
    current = list(state.sections or [])
    current.extend(parsed)
    return state.model_copy(update={"sections": current})


async def step_synthesize_social(state: ScoutState) -> ScoutState:
    parsed = complete_json(
        system=SYNTHESIS_SYSTEM,
        user=(
            f"{_synthesis_context(state)}\n\n"
            + """Produce JSON {"sections": [...]} with EXACTLY these three sections:
1) id "social", title "3. SOCIAL PRESENCE", entries labeled: "3.x.1 Profile Stats" (per-platform labeled blocks with real numbers from the research, or explicit "no verified presence found"), "3.x.2 Cadence & Consistency", "3.x.3 Format Mix", "3.x.4 Engagement Rate" (normalize to followers when numbers exist), "3.x.5 Growth Velocity".
2) id "content", title "4. CONTENT STRATEGY", entries labeled: "4.1 Content Pillars / Themes", "4.2 Recurring Series / Franchises", "4.3 Hook Patterns" (labeled blocks with example hooks), "4.4 CTA / Funnel Intent", "4.5 Brand Voice / Tone", "4.6 Production Style".
3) id "top-performers", title "5. TOP PERFORMERS", entries labeled: "5.x.1 The Content" (labeled block per best real post found — caption/format/audience; if none verified, clearly-flagged hypothetical posts that would win), "5.x.2 The Numbers" (real metrics or explicit absence), "5.x.3 Why It Won" (the repeatable formula + what Altitut should copy)."""
        ),
        max_output_tokens=8000,
        validate=lambda value: _parse_sections(value, ["social", "content", "top-performers"]),
    )
    current = list(state.sections or [])
    current.extend(parsed)
    return state.model_copy(update={"sections": current})


async def step_synthesize_verdict(state: ScoutState) -> ScoutState:
    parsed = complete_json(
        system=SYNTHESIS_SYSTEM,
        user=(
            f"{_synthesis_context(state)}\n\n"
            + f"ALREADY-WRITTEN SECTIONS 1-5 (for consistency):\n{str([s.model_dump(mode='json', exclude_none=True) for s in (state.sections or [])])[:6000]}\n\n"
            + """Produce JSON {"sections": [...], "tldr": "...", "tag": "...", "meta": "..."} where sections are EXACTLY:
1) id "paid", title "6. PAID & PARTNERSHIPS", entries labeled: "6.1 Active Ads" (Meta Ad Library / Google Ads evidence or explicit absence), "6.2 Partnerships".
2) id "audience", title "7. AUDIENCE & COMMUNITY", entries labeled: "7.1 Sentiment" (labeled blocks "Expected praise"/"Potential complaints" grounded in reviews found), "7.2 Whitespace" (gaps Altitut can own), "7.3 Responsiveness", "7.4 Owned Community".
3) id "synthesis", title "8. SYNTHESIS", entries labeled: "8.1 Winning Formula" (their strategy in one line + bullets), "8.2 Recent Strategic Shifts", "8.3 Steal / Avoid / Test" (three labeled blocks: "Steal", "Avoid", "Test"), "8.4 Hooks into Content Packs" (how this feeds Altitut's content series).

"tldr": a 4-5 line executive summary as TWO paragraphs separated by \n\n — paragraph 1: who they are + tier + product shape; paragraph 2: social/content reality + the single clearest play for Altitut.
"tag": a 1-3 word similarity label (e.g. "High Similarity", "Closest Match", "Category Match", "Adjacent Player").
"meta": a tier label like "Tier 1 competitor" or "Tier 2 competitor" based on overlap with Altitut."""
        ),
        max_output_tokens=8000,
        validate=lambda value: _validate_verdict(value),
    )
    verdict = parsed
    current = list(state.sections or [])
    current.extend(verdict["sections"])
    return state.model_copy(update={
        "sections": current,
        "tldr": verdict["tldr"],
        "tag": verdict["tag"],
        "meta": verdict["meta"],
    })


def _validate_verdict(value: Any) -> dict[str, Any]:
    if not isinstance(value, dict):
        raise ValueError("invalid verdict response")
    sections = _parse_sections(value, ["paid", "audience", "synthesis"])
    tldr = str(value.get("tldr", "")).strip()
    if not tldr:
        raise ValueError("missing tldr")
    tag = str(value.get("tag", "")).strip() or "New Entrant"
    meta = str(value.get("meta", "")).strip() or "Tier 2 competitor"
    return {"sections": sections, "tldr": tldr, "tag": tag, "meta": meta}


def assemble_pack(state: ScoutState) -> AnalysisPack:
    if not state.candidate or not state.sections or not state.tldr:
        raise ValueError("Scout state is incomplete — synthesis has not finished.")
    ordered = sort_sections(list(state.sections))
    if len(ordered) != 8:
        raise ValueError(f"Pack has {len(ordered)} sections; expected all 8.")
    return AnalysisPack(
        name=state.candidate.name,
        tag=state.tag or "New Entrant",
        meta=state.meta or "Tier 2 competitor",
        links=state.candidate.links or PackLinks(),
        tldr=state.tldr,
        sections=ordered,
    )
