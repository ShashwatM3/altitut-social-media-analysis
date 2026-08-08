"use client";

import { useCallback, useState } from "react";
import { apiFetch } from "./api";
import { newTraceId, raiseForTrace, TRACE_ID_HEADER, TraceableError } from "./trace";

type ChatMessagePart = { type: "text"; text: string };

export type ChatMessage = {
  id: string;
  role: "user" | "assistant";
  parts: ChatMessagePart[];
};

type Status = "submitted" | "streaming" | "ready" | "error";

function generateId() {
  return crypto.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export function useStreamingChat({ api: path }: { api: string }) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [status, setStatus] = useState<Status>("ready");
  const [error, setError] = useState<TraceableError | null>(null);

  const clearError = useCallback(() => setError(null), []);

  const sendMessage = useCallback(
    async ({ text }: { text: string }) => {
      const trimmed = text.trim();
      if (!trimmed) return;
      clearError();

      const userMessage: ChatMessage = {
        id: generateId(),
        role: "user",
        parts: [{ type: "text", text: trimmed }],
      };
      const history = [...messages, userMessage];
      setMessages(history);
      setStatus("submitted");

      const traceId = newTraceId();
      try {
        const response = await apiFetch(path, {
          method: "POST",
          headers: { "Content-Type": "application/json", [TRACE_ID_HEADER]: traceId },
          body: JSON.stringify({ messages: history }),
        });

        if (!response.ok) {
          await raiseForTrace(response, `HTTP ${response.status}`);
        }

        if (!response.body) {
          throw new TraceableError("No response body from chat stream.", traceId);
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let assistantId = generateId();
        let buffer = "";
        setMessages([...history, { id: assistantId, role: "assistant", parts: [{ type: "text", text: "" }] }]);
        setStatus("streaming");

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() ?? "";

          for (const line of lines) {
            const trimmedLine = line.trim();
            if (!trimmedLine.startsWith("data: ")) continue;
            const data = trimmedLine.slice(6);
            if (data === "[DONE]") continue;

            setMessages((prev) => {
              const last = prev[prev.length - 1];
              if (last && last.role === "assistant" && last.id === assistantId) {
                const existing = last.parts[0]?.text ?? "";
                const updated = [
                  { type: "text" as const, text: existing + data },
                ];
                return [...prev.slice(0, -1), { ...last, parts: updated }];
              }
              return [
                ...prev,
                { id: assistantId, role: "assistant", parts: [{ type: "text", text: data }] },
              ];
            });
          }
        }

        // Flush any trailing content
        if (buffer.trim().startsWith("data: ")) {
          const data = buffer.trim().slice(6);
          if (data !== "[DONE]") {
            setMessages((prev) => {
              const last = prev[prev.length - 1];
              if (last && last.role === "assistant" && last.id === assistantId) {
                const existing = last.parts[0]?.text ?? "";
                return [
                  ...prev.slice(0, -1),
                  { ...last, parts: [{ type: "text", text: existing + data }] },
                ];
              }
              return prev;
            });
          }
        }

        setStatus("ready");
      } catch (err) {
        setStatus("error");
        setError(
          err instanceof TraceableError
            ? err
            : new TraceableError(err instanceof Error ? err.message : String(err), traceId),
        );
      }
    },
    [path, messages, clearError],
  );

  return {
    messages,
    status,
    error,
    sendMessage,
    clearError,
  };
}
