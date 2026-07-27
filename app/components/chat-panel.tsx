"use client";

import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import { useEffect, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

const SUGGESTIONS = [
  "Which competitor is the biggest threat to Altitut right now?",
  "Compare the social strategies of Fe/male Switch and Startup Wars.",
  "What content whitespace can Altitut own this quarter?",
];

function SparkIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
      <path d="M8 0l1.8 4.9L15 6l-4.4 3 1.1 5.4L8 11.6 4.3 14.4 5.4 9 1 6l5.2-1.1L8 0z" />
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

function MarkdownAnswer({ text }: { text: string }) {
  return (
    <div className="chat-markdown text-sm leading-relaxed text-gray-900">
      <ReactMarkdown remarkPlugins={[remarkGfm]}>{text}</ReactMarkdown>
    </div>
  );
}

export function ChatPanel() {
  const [input, setInput] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);
  const { messages, sendMessage, status, error, clearError } = useChat({
    transport: new DefaultChatTransport({ api: "/api/chat" }),
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
    <section
      className="mb-6 rounded-xl border border-gray-200 bg-white shadow-modern md:mb-8"
      aria-label="Competitor analysis chat"
    >
      <header className="flex items-center gap-2.5 border-b border-gray-200 px-5 py-3.5">
        <span className="flex h-8 w-8 items-center justify-center rounded-full bg-teal-50 text-deep-teal">
          <SparkIcon />
        </span>
        <div>
          <h3 className="text-sm font-semibold text-gray-900">
            Ask the competitor copilot
          </h3>
          <p className="text-xs text-gray-500">
            RAG-powered — answers from every tracked competitor pack + Altitut context.
          </p>
        </div>
      </header>

      <div
        ref={scrollRef}
        className="scrollbar-modern max-h-96 overflow-y-auto px-5 py-4"
      >
        {messages.length === 0 ? (
          <div className="grid gap-2">
            <p className="text-sm text-gray-600">
              Ask about one competitor, compare several, or ask how to turn
              their playbook into Altitut&apos;s next move.
            </p>
            <div className="flex flex-wrap gap-2">
              {SUGGESTIONS.map((suggestion) => (
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
                    <MarkdownAnswer text={text} />
                  </div>
                </div>
              );
            })}
            {status === "submitted" ? (
              <div className="flex items-center gap-2 text-xs text-gray-500">
                <span className="h-2.5 w-2.5 animate-pulse rounded-full bg-amber-400" />
                Retrieving competitor intelligence…
              </div>
            ) : null}
          </div>
        )}
        {error ? (
          <div className="mt-3 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-600">
            {error.message || "The copilot hit an error — try again."}
          </div>
        ) : null}
      </div>

      <form
        className="flex items-center gap-3 border-t border-gray-200 px-5 py-3"
        onSubmit={(event) => {
          event.preventDefault();
          submit(input);
        }}
      >
        <input
          type="text"
          value={input}
          onChange={(event) => setInput(event.currentTarget.value)}
          onInput={(event) => setInput(event.currentTarget.value)}
          placeholder="e.g. What should we steal from Fe/male Switch's content engine?"
          className="w-full rounded-lg border border-gray-300 p-2.5 text-sm focus:border-transparent focus:ring-2 focus:ring-teal-500"
          aria-label="Ask the competitor copilot"
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
    </section>
  );
}
