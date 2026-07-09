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

export type AnalysisPack = {
  name: string;
  tag: string;
  meta: string;
  sections: PackSection[];
};

type PackPanelProps = {
  packs: AnalysisPack[];
  ariaLabel: string;
};

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

export function PackPanel({ packs, ariaLabel }: PackPanelProps) {
  return (
    <section className={styles.packGrid} aria-label={ariaLabel}>
      {packs.map((pack) => (
        <article key={pack.name} className={styles.packCard}>
          <details className={styles.packDetails} open>
            <summary className={styles.packSummary}>
              <div className={styles.packSummaryLeft}>
                <span className={styles.packName}>{pack.name}</span>
                <span className={styles.packTag}>{pack.tag}</span>
              </div>
              <span className={styles.packMeta}>{pack.meta}</span>
            </summary>
            <div className={styles.sectionsContainer}>
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
