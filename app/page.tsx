"use client";

import { useState } from "react";
import styles from "./page.module.css";

const TABS = ["Competitors Analysis", "Content Creation"] as const;

type Tab = (typeof TABS)[number];

export default function Home() {
  const [activeTab, setActiveTab] = useState<Tab>(TABS[0]);

  return (
    <div className={styles.shell}>
      <header className={styles.header}>
        <div>
          <h1 className={styles.title}>Social Media Command Center</h1>
          <p className={styles.subtitle}>
            Competitor insights and content creation ideas for Altitut
          </p>
        </div>
        <button type="button" className={styles.helpButton}>
          Help ?
        </button>
      </header>
      <div className={styles.body}>
        <nav className={styles.sideNav} aria-label="Main navigation">
          <ul className={styles.navList}>
            {TABS.map((tab) => (
              <li key={tab}>
                <button
                  type="button"
                  className={`${styles.navItem} ${
                    tab === activeTab ? styles.navItemActive : ""
                  }`}
                  aria-current={tab === activeTab ? "page" : undefined}
                  onClick={() => setActiveTab(tab)}
                >
                  {tab}
                </button>
              </li>
            ))}
          </ul>
        </nav>
        <main className={styles.content}>
          <h2 className={styles.contentTitle}>{activeTab}</h2>
        </main>
      </div>
    </div>
  );
}
