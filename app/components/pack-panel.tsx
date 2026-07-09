import styles from "../page.module.css";

export type ContentBlock =
  | { type: "paragraph"; text: string }
  | { type: "bullets"; items: string[] }
  | { type: "labeled"; label: string; items: string[] };

export type PackEntry = {
  label: string;
  blocks?: ContentBlock[];
  /** @deprecated Legacy single-string entries — normalized at render time */
  value?: string;
};

export type PackEpisode = {
  title: string;
  entries: PackEntry[];
};

export type PackSection = {
  id: string;
  title: string;
  entries?: PackEntry[];
  episodes?: PackEpisode[];
};

export type PackLinks = {
  website?: string;
  instagram?: string;
  linkedin?: string;
  twitter?: string;
};

export type AnalysisPack = {
  name: string;
  tag: string;
  meta: string;
  links?: PackLinks;
  referenceReels?: string[];
  sections: PackSection[];
};

function formatWebsiteLabel(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

function SocialIcon({ kind }: { kind: "website" | "instagram" | "linkedin" | "twitter" }) {
  if (kind === "website") {
    return (
      <svg width="16" height="16" viewBox="0 0 32 32" aria-hidden="true">
        <path
          fill="currentColor"
          d="M16 2a14 14 0 1 0 0 28 14 14 0 0 0 0-28zm0 2c2.2 0 4.2.6 6 1.7-1.5 1.4-3.1 3.3-4.2 5.5-1.3-.2-2.6-.3-3.8-.3s-2.5.1-3.8.3c-1.1-2.2-2.7-4.1-4.2-5.5A11.9 11.9 0 0 1 16 4zm-9.2 3.4c1.4 1.3 2.9 3 4 5-1.8.6-3.4 1.4-4.8 2.3A10 10 0 0 1 6.8 7.4zM4 16c0-.8.1-1.6.3-2.3 1.6-.9 3.4-1.7 5.4-2.3-1 2.2-1.6 4.6-1.8 7.1H4.6A9.9 9.9 0 0 1 4 16zm2.6 7.7c1.3.9 2.9 1.7 4.7 2.3-1.1 2-2.6 3.7-4 5A10 10 0 0 1 6.6 23.7zM15 27.4c-1.4 0-2.8-.2-4.1-.5 1.5-1.4 3-3.2 4.1-5.3 1.3.3 2.7.5 4 .5s2.7-.2 4-.5c1.1 2.1 2.6 3.9 4.1 5.3-1.3.3-2.7.5-4.1.5zm1-3.3h4.4c.2-2.5.8-4.9 1.8-7.1 2 .6 3.8 1.4 5.4 2.3.2.7.3 1.5.3 2.3 0 .8-.1 1.6-.3 2.3h-5.5c-.2-2.5-.8-4.9-1.8-7.1 2-.6 3.8-1.4 5.4-2.3-.2-.7-.3-1.5-.3-2.3 0-.8.1-1.6.3-2.3-1.6-.9-3.4-1.7-5.4-2.3 1-2.2 1.6-4.6 1.8-7.1H16c-.2 2.5-.8 4.9-1.8 7.1-2-.6-3.8-1.4-5.4-2.3A9.9 9.9 0 0 1 15 24.1zM23.2 7.4a10 10 0 0 1 2.7 6.2c-1.4-.9-3-1.7-4.8-2.3 1.1-2 2.6-3.7 4-5 .8.4 1.5.9 2.1 1.5z"
        />
      </svg>
    );
  }

  if (kind === "instagram") {
    return (
      <svg width="16" height="16" viewBox="0 0 32 32" aria-hidden="true">
        <path
          fill="currentColor"
          d="M16 3.5c4 0 4.5 0 6.1.1 1.5.1 2.3.3 2.8.5.7.3 1.2.6 1.7 1.1.5.5.8 1 1.1 1.7.2.5.4 1.3.5 2.8.1 1.6.1 2.1.1 6.1s0 4.5-.1 6.1c-.1 1.5-.3 2.3-.5 2.8-.3.7-.6 1.2-1.1 1.7-.5.5-1 .8-1.7 1.1-.5.2-1.3.4-2.8.5-1.6.1-2.1.1-6.1.1s-4.5 0-6.1-.1c-1.5-.1-2.3-.3-2.8-.5-.7-.3-1.2-.6-1.7-1.1-.5-.5-.8-1-1.1-1.7-.2-.5-.4-1.3-.5-2.8-.1-1.6-.1-2.1-.1-6.1s0-4.5.1-6.1c.1-1.5.3-2.3.5-2.8.3-.7.6-1.2 1.1-1.7.5-.5 1-.8 1.7-1.1.5-.2 1.3-.4 2.8-.5 1.6-.1 2.1-.1 6.1-.1zm0 2.7c-3.9 0-4.4 0-5.9.1-1.2.1-1.9.2-2.3.4-.6.2-1 .5-1.4.9-.4.4-.7.8-.9 1.4-.2.4-.3 1.1-.4 2.3-.1 1.5-.1 2-.1 5.9s0 4.4.1 5.9c.1 1.2.2 1.9.4 2.3.2.6.5 1 .9 1.4.4.4.8.7 1.4.9.4.2 1.1.3 2.3.4 1.5.1 2 .1 5.9.1s4.4 0 5.9-.1c1.2-.1 1.9-.2 2.3-.4.6-.2 1-.5 1.4-.9.4-.4.7-.8.9-1.4.2-.4.3-1.1.4-2.3.1-1.5.1-2 .1-5.9s0-4.4-.1-5.9c-.1-1.2-.2-1.9-.4-2.3-.2-.6-.5-1-.9-1.4-.4-.4-.8-.7-1.4-.9-.4-.2-1.1-.3-2.3-.4-1.5-.1-2-.1-5.9-.1zm0 4.4a6.4 6.4 0 1 1 0 12.8 6.4 6.4 0 0 1 0-12.8zm0 2.7a3.7 3.7 0 1 0 0 7.4 3.7 3.7 0 0 0 0-7.4zm6.5-4.8a1.5 1.5 0 1 1-3 0 1.5 1.5 0 0 1 3 0z"
        />
      </svg>
    );
  }

  if (kind === "linkedin") {
    return (
      <svg width="16" height="16" viewBox="0 0 32 32" aria-hidden="true">
        <path
          fill="currentColor"
          d="M8.2 11.2H4.8V26h3.4V11.2zM6.5 4.5a2 2 0 1 0 0 4 2 2 0 0 0 0-4zM26 18.6c0-4.1-2.2-6-5.1-6-2.3 0-3.4 1.3-4 2.2v-1.9h-3.4c0 .5.1 11.1.1 11.1H16v-6.2c0-.6 0-1.2.2-1.7.5-.9 1.5-1.8 3.2-1.8 2.3 0 3.2 1.7 3.2 4.2V26H26v-7.4z"
        />
      </svg>
    );
  }

  return (
    <svg width="16" height="16" viewBox="0 0 32 32" aria-hidden="true">
      <path
        fill="currentColor"
        d="M20.2 4.5h4.6l-10 11.4 11.8 15.6h-9.2L12.7 19.8 5.4 31.5H.8l10.7-12.2L.2 4.5h9.4l7.1 9.4 7.5-9.4zm-1.6 24h2.6L9.1 7.2H6.3l12.3 21.3z"
      />
    </svg>
  );
}

function PackLinksBar({ links }: { links: PackLinks }) {
  const socials = [
    { kind: "instagram" as const, href: links.instagram, label: "Instagram" },
    { kind: "linkedin" as const, href: links.linkedin, label: "LinkedIn" },
    { kind: "twitter" as const, href: links.twitter, label: "X (Twitter)" },
  ].filter((item) => Boolean(item.href));

  if (!links.website && socials.length === 0) {
    return null;
  }

  return (
    <div
      className={styles.packLinksBar}
      onClick={(event) => event.stopPropagation()}
      onKeyDown={(event) => event.stopPropagation()}
    >
      {links.website ? (
        <a
          href={links.website}
          className={styles.packWebsiteLink}
          target="_blank"
          rel="noopener noreferrer"
        >
          <SocialIcon kind="website" />
          <span>{formatWebsiteLabel(links.website)}</span>
        </a>
      ) : null}
      {socials.length > 0 ? (
        <div className={styles.packSocialLinks}>
          {socials.map((social) => (
            <a
              key={social.kind}
              href={social.href}
              className={styles.packSocialLink}
              target="_blank"
              rel="noopener noreferrer"
              aria-label={social.label}
              title={social.label}
            >
              <SocialIcon kind={social.kind} />
            </a>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function PackSummary({
  pack,
  showLinks,
}: {
  pack: AnalysisPack;
  showLinks: boolean;
}) {
  return (
    <>
      <div className={styles.packSummaryLeft}>
        <span className={styles.packName}>{pack.name}</span>
        <span className={styles.packTag}>{pack.tag}</span>
      </div>
      <div
        className={styles.packSummaryRight}
        onClick={(event) => event.stopPropagation()}
        onKeyDown={(event) => event.stopPropagation()}
      >
        {showLinks ? (
          <>
            <span className={styles.packTier}>{pack.meta}</span>
            {pack.links ? <PackLinksBar links={pack.links} /> : null}
          </>
        ) : (
          <span className={styles.packMeta}>{pack.meta}</span>
        )}
      </div>
    </>
  );
}

type PackPanelProps = {
  packs: AnalysisPack[];
  ariaLabel: string;
  variant?: "competitor" | "content";
};

function formatInstagramReference(url: string, index: number): string {
  const reelMatch = url.match(/\/reel\/([^/?]+)/);
  if (reelMatch) {
    return `Reel ${index + 1} · ${reelMatch[1]}`;
  }

  const postMatch = url.match(/\/p\/([^/?]+)/);
  if (postMatch) {
    return `Post ${index + 1} · ${postMatch[1]}`;
  }

  return `Reference ${index + 1}`;
}

function ReferenceReelsSection({ urls }: { urls: string[] }) {
  return (
    <section className={styles.referenceReelsSection} aria-label="Reference Reels">
      <h3 className={styles.referenceReelsTitle}>Reference Reels</h3>
      <p className={styles.referenceReelsDescription}>
        Style and format references for this content series — study pacing, hooks,
        and visual treatment before filming.
      </p>
      <ul className={styles.referenceReelsList}>
        {urls.map((url, index) => (
          <li key={url}>
            <a
              href={url}
              className={styles.referenceReelsLink}
              target="_blank"
              rel="noopener noreferrer"
            >
              <SocialIcon kind="instagram" />
              <span>{formatInstagramReference(url, index)}</span>
            </a>
          </li>
        ))}
      </ul>
    </section>
  );
}

function normalizeBlocks(entry: PackEntry): ContentBlock[] {
  if (Array.isArray(entry.blocks) && entry.blocks.length > 0) {
    return entry.blocks;
  }

  if (typeof entry.value === "string" && entry.value.trim().length > 0) {
    return [{ type: "paragraph", text: entry.value }];
  }

  return [
    {
      type: "paragraph",
      text: "Content pending — this entry has not been populated yet.",
    },
  ];
}

function EntryContent({ blocks }: { blocks: ContentBlock[] }) {
  if (!Array.isArray(blocks) || blocks.length === 0) {
    return null;
  }

  return (
    <div className={styles.entryContent}>
      {blocks.map((block, index) => {
        if (block.type === "paragraph") {
          return (
            <p key={index} className={styles.entryParagraph}>
              {block.text}
            </p>
          );
        }

        if (block.type === "bullets") {
          const items = block.items ?? [];
          return (
            <ul key={index} className={styles.entryList}>
              {items.map((item, itemIndex) => (
                <li key={`${index}-${itemIndex}`}>{item}</li>
              ))}
            </ul>
          );
        }

        const items = block.items ?? [];
        return (
          <div key={index} className={styles.entryLabeledGroup}>
            <p className={styles.entryLabeledTitle}>{block.label}</p>
            <ul className={styles.entryList}>
              {items.map((item, itemIndex) => (
                <li key={`${index}-${itemIndex}`}>{item}</li>
              ))}
            </ul>
          </div>
        );
      })}
    </div>
  );
}

function EntryRow({ entry }: { entry: PackEntry }) {
  const blocks = normalizeBlocks(entry);

  return (
    <div className={styles.entryRow}>
      <p className={styles.entryLabel}>{entry.label}</p>
      <EntryContent blocks={blocks} />
    </div>
  );
}

export function PackPanel({
  packs,
  ariaLabel,
  variant = "content",
}: PackPanelProps) {
  const isCompetitor = variant === "competitor";

  return (
    <section className={styles.packGrid} aria-label={ariaLabel}>
      {packs.map((pack) => (
        <article key={pack.name} className={styles.packCard}>
          <details className={styles.packDetails}>
            <summary className={styles.packSummary}>
              <PackSummary pack={pack} showLinks={isCompetitor} />
            </summary>
            <div className={styles.sectionsContainer}>
              {pack.referenceReels && pack.referenceReels.length > 0 ? (
                <ReferenceReelsSection urls={pack.referenceReels} />
              ) : null}
              {pack.sections.map((section) => (
                <details
                  key={`${pack.name}-${section.id}`}
                  className={styles.sectionDetails}
                >
                  <summary className={styles.sectionSummary}>
                    {section.title}
                  </summary>
                  <div className={styles.sectionBox}>
                    {section.entries?.map((entry) => (
                      <EntryRow
                        key={`${pack.name}-${section.id}-${entry.label}`}
                        entry={entry}
                      />
                    ))}
                    {section.episodes?.map((episode) => (
                      <details
                        key={`${pack.name}-${section.id}-${episode.title}`}
                        className={styles.episodeDetails}
                      >
                        <summary className={styles.episodeSummary}>
                          {episode.title}
                        </summary>
                        <div className={styles.episodeBox}>
                          {episode.entries.map((entry) => (
                            <EntryRow
                              key={`${pack.name}-${episode.title}-${entry.label}`}
                              entry={entry}
                            />
                          ))}
                        </div>
                      </details>
                    ))}
                  </div>
                </details>
              ))}
            </div>
          </details>
        </article>
      ))}
    </section>
  );
}
