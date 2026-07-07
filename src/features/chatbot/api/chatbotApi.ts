import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";

const isTauriRuntime = () => "__TAURI_INTERNALS__" in window;

export type AgentChatRunResult = {
  stdout: string;
  stderr: string;
};

export type AgentChatStreamEvent = {
  streamId: string;
  stream: string;
  kind: "status" | "thinking" | "action" | "output" | "stderr" | "error" | string;
  text: string;
  raw: string;
};

function toStringValue(value: unknown): string {
  if (typeof value === "string") return value;
  if (value === null || value === undefined) return "";
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

function normalizeAgentChatEvent(value: unknown): AgentChatStreamEvent | null {
  if (!value || typeof value !== "object") return null;
  const event = value as Record<string, unknown>;
  return {
    streamId: toStringValue(event.streamId),
    stream: toStringValue(event.stream),
    kind: toStringValue(event.kind),
    text: toStringValue(event.text),
    raw: toStringValue(event.raw),
  };
}

export function createAgentChatStreamId() {
  return `chat-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

export async function listenAgentChatEvents(streamId: string, onEvent: (event: AgentChatStreamEvent) => void) {
  if (!isTauriRuntime()) return () => undefined;
  return listen<unknown>("agent-chat-event", (event) => {
    const payload = normalizeAgentChatEvent(event.payload);
    if (payload?.streamId === streamId) onEvent(payload);
  });
}

export async function runAgentChat(model: string, variant: string | undefined, prompt: string, streamId: string): Promise<AgentChatRunResult> {
  if (!isTauriRuntime()) {
    return {
      stdout: JSON.stringify({
        thoughts: ["Browser mock: desktop mode will stream model thinking and return the proposed agent JSON."],
        agents: [
          {
            name: "generated-agent",
            mode: "subagent",
            description: "Mock generated agent from browser mode.",
            model,
            variant,
            prompt: "You are a generated OpenCode agent. Replace this prompt in desktop mode.",
          },
        ],
      }, null, 2),
      stderr: "",
    };
  }

  return invoke<AgentChatRunResult>("run_agent_chat", { model, variant: variant || null, prompt, streamId });
}
