"use client";

import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import { useEffect, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { PLATFORM_GUIDE_SECTIONS } from "../../lib/platform-guide-content";

const HELP_SUGGESTIONS = [
  "How do I add a new competitor?",
  "What's the difference between the two chats?",
  "How do content packs get created?",
  "What does Competitor Scout actually do?",
];

type HelpView = "guide" | "chat";

function CloseIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path
        d="M4 4l8 8M12 4l-8 8"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
    </svg>
  );
}

function ChatIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path
        d="M2.5 3.5h11a1 1 0 0 1 1 1v6a1 1 0 0 1-1 1H6l-3 2.5V4.5a1 1 0 0 1 1-1z"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function BookIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path
        d="M3 2.5h4.5A2.5 2.5 0 0 1 10 5v8.5H5A2 2 0 0 0 3 15.5v-13zM13 2.5H8.5A2.5 2.5 0 0 0 6 5v8.5h5A2 2 0 0 1 13 15.5v-13z"
        stroke="currentColor"
        strokeWidth="1.3"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function SendIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path
        d="M14.5 1.5 7 9m7.5-7.5L9.7 14.3a.4.4 0 0 1-.74-.02L7 9m7.5-7.5L1.7 6.3a.4.4 0 0 0 .02.75L7 9"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function GuideMarkdown({ text }: { text: string }) {
  return (
    <div className="chat-markdown text-sm leading-relaxed text-gray-800">
      <ReactMarkdown remarkPlugins={[remarkGfm]}>{text}</ReactMarkdown>
    </div>
  );
}

function HelpChatPanel() {
  const [input, setInput] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);
  const { messages, sendMessage, status, error, clearError } = useChat({
    transport: new DefaultChatTransport({ api: "/api/help-chat" }),
  });

  const isBusy = status === "submitted" || status === "streaming";

  useEffect(() => {
    const node = scrollRef.current;
    if (node) {
      node.scrollTop = node.scrollHeight;
    }
  }, [messages, status]);

  const submit = (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || isBusy) return;
    clearError();
    void sendMessage({ text: trimmed });
    setInput("");
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div ref={scrollRef} className="scrollbar-modern min-h-0 flex-1 overflow-y-auto px-1 py-2">
        {messages.length === 0 ? (
          <div className="grid gap-3">
            <p className="text-sm text-gray-600">
              Ask how to navigate the dashboard, run Competitor Scout, read packs,
              or create content packs. Answers come from the platform guide via RAG.
            </p>
            <div className="flex flex-wrap gap-2">
              {HELP_SUGGESTIONS.map((suggestion) => (
                <button
                  key={suggestion}
                  type="button"
                  onClick={() => submit(suggestion)}
                  className="rounded-full border border-teal-200 bg-teal-50 px-3 py-1.5 text-xs font-medium text-deep-teal transition-colors hover:bg-teal-100"
                >
                  {suggestion}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="grid gap-4">
            {messages.map((message) => {
              const text = message.parts
                .filter(
                  (part): part is { type: "text"; text: string } =>
                    part.type === "text",
                )
                .map((part) => part.text)
                .join("");
              if (message.role === "user") {
                return (
                  <div key={message.id} className="flex justify-end">
                    <div className="max-w-[85%] rounded-2xl rounded-br-md bg-teal-600 px-4 py-2.5 text-sm leading-relaxed text-white">
                      {text}
                    </div>
                  </div>
                );
              }
              return (
                <div key={message.id} className="flex justify-start">
                  <div className="max-w-[92%] rounded-2xl rounded-bl-md border border-gray-200 bg-gray-50 px-4 py-3">
                    <GuideMarkdown text={text} />
                  </div>
                </div>
              );
            })}
            {status === "submitted" ? (
              <div className="flex items-center gap-2 text-xs text-gray-500">
                <span className="h-2.5 w-2.5 animate-pulse rounded-full bg-amber-400" />
                Searching the platform guide…
              </div>
            ) : null}
          </div>
        )}
        {error ? (
          <div className="mt-3 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-600">
            {error.message || "The help assistant hit an error — try again."}
          </div>
        ) : null}
      </div>

      <form
        className="flex flex-none items-center gap-3 border-t border-gray-200 pt-3"
        onSubmit={(event) => {
          event.preventDefault();
          submit(input);
        }}
      >
        <input
          type="text"
          value={input}
          onChange={(event) => setInput(event.target.value)}
          placeholder="e.g. How do I run Competitor Scout?"
          className="w-full rounded-lg border border-gray-300 p-2.5 text-sm focus:border-transparent focus:ring-2 focus:ring-teal-500"
          aria-label="Ask the help assistant"
        />
        <button
          type="submit"
          disabled={isBusy || input.trim().length === 0}
          className="inline-flex flex-none items-center gap-2 rounded-lg bg-teal-600 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-teal-700 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <span>{isBusy ? "Thinking…" : "Send"}</span>
          {!isBusy ? <SendIcon /> : null}
        </button>
      </form>
    </div>
  );
}

function GuidePanel({
  activeSectionId,
  onSelectSection,
}: {
  activeSectionId: string;
  onSelectSection: (id: string) => void;
}) {
  const active =
    PLATFORM_GUIDE_SECTIONS.find((section) => section.id === activeSectionId) ??
    PLATFORM_GUIDE_SECTIONS[0];

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4 md:flex-row">
      <nav
        className="flex flex-none gap-2 overflow-x-auto md:w-52 md:flex-col md:overflow-visible"
        aria-label="Guide sections"
      >
        {PLATFORM_GUIDE_SECTIONS.map((section) => (
          <button
            key={section.id}
            type="button"
            onClick={() => onSelectSection(section.id)}
            className={`whitespace-nowrap rounded-lg px-3 py-2 text-left text-sm transition-colors ${
              section.id === active.id
                ? "bg-teal-50 font-semibold text-deep-teal"
                : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
            }`}
          >
            {section.title}
          </button>
        ))}
      </nav>
      <article className="scrollbar-modern min-h-0 flex-1 overflow-y-auto rounded-lg border border-gray-200 bg-gray-50 p-4 md:p-5">
        <h3 className="font-display text-lg font-semibold text-gray-900">
          {active.title}
        </h3>
        <div className="mt-3">
          <GuideMarkdown text={active.body} />
        </div>
      </article>
    </div>
  );
}

export function HelpButton() {
  const [open, setOpen] = useState(false);
  const [view, setView] = useState<HelpView>("guide");
  const [activeSectionId, setActiveSectionId] = useState(
    PLATFORM_GUIDE_SECTIONS[0].id,
  );

  const close = () => {
    setOpen(false);
    setView("guide");
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="rounded-lg border border-gray-300 px-6 py-2 font-semibold text-gray-700 transition-colors hover:bg-gray-50"
      >
        Help ?
      </button>

      {open ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-gray-900/50 p-4 backdrop-blur-subtle"
          role="dialog"
          aria-modal="true"
          aria-label="Platform help"
        >
          <div className="flex h-[min(88vh,820px)] w-full max-w-4xl flex-col rounded-xl bg-white p-5 shadow-modern-lg sm:p-6">
            <header className="flex flex-none flex-wrap items-start justify-between gap-3 border-b border-gray-200 pb-4">
              <div>
                <h2 className="font-display text-xl font-semibold text-gray-900 sm:text-2xl">
                  How to use this platform
                </h2>
                <p className="mt-1 text-sm text-gray-600">
                  Read the guide, or ask the help assistant in natural language.
                </p>
              </div>
              <button
                type="button"
                onClick={close}
                className="rounded-lg border border-gray-300 p-2 text-gray-600 transition-colors hover:bg-gray-50"
                aria-label="Close help"
              >
                <CloseIcon />
              </button>
            </header>

            <div className="mt-4 flex flex-none flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => setView("guide")}
                className={`inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold transition-colors ${
                  view === "guide"
                    ? "bg-teal-600 text-white"
                    : "border border-gray-300 text-gray-700 hover:bg-gray-50"
                }`}
              >
                <BookIcon />
                Guide
              </button>
              <button
                type="button"
                onClick={() => setView("chat")}
                className={`inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold transition-colors ${
                  view === "chat"
                    ? "bg-teal-600 text-white"
                    : "border border-gray-300 text-gray-700 hover:bg-gray-50"
                }`}
              >
                <ChatIcon />
                Ask the help assistant
              </button>
            </div>

            <div className="mt-4 flex min-h-0 flex-1 flex-col">
              <div
                className={
                  view === "guide" ? "flex min-h-0 flex-1 flex-col" : "hidden"
                }
              >
                <GuidePanel
                  activeSectionId={activeSectionId}
                  onSelectSection={setActiveSectionId}
                />
              </div>
              <div
                className={
                  view === "chat" ? "flex min-h-0 flex-1 flex-col" : "hidden"
                }
              >
                <HelpChatPanel />
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
