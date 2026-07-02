import { invoke } from "@tauri-apps/api/core";
import type { ScanResult } from "../types/agent.types";
import { mockScanResult } from "../utils/mockAgents";
import type { EditableAgent, SaveAgentResult } from "../../../../shared/types/editable-agent.dto";
import type { EditablePermissionProfile } from "../../../../shared/types/editable-permission-profile.dto";

const isTauriRuntime = () => "__TAURI_INTERNALS__" in window;

export async function scanAgents(projectRoot?: string | null): Promise<ScanResult> {
  if (!isTauriRuntime()) {
    return mockScanResult;
  }

  return invoke<ScanResult>("scan_agents", { projectRoot: projectRoot ?? null });
}

export async function openAgentLocation(sourcePath: string, projectRoot?: string | null): Promise<void> {
  if (!isTauriRuntime()) {
    console.info("Open location is only available in the desktop app:", sourcePath);
    return;
  }

  await invoke("open_agent_location", { sourcePath, projectRoot: projectRoot ?? null });
}

export async function saveAgent(agent: EditableAgent): Promise<SaveAgentResult> {
  if (!isTauriRuntime()) {
    return {
      success: true,
      newVersion: agent.version + 1,
      errors: [],
    };
  }

  return invoke<SaveAgentResult>("save_agent", { agent, targetPath: agent.sourcePath });
}

export async function createAgent(agent: EditableAgent): Promise<SaveAgentResult> {
  if (!isTauriRuntime()) {
    return {
      success: true,
      newVersion: 1,
      errors: [],
    };
  }

  return invoke<SaveAgentResult>("create_agent", { agent, targetPath: agent.sourcePath });
}

export async function createConfigFile(fileName: string, agentName: string, extension: string): Promise<{ success: boolean; errors: string[] }> {
  if (!isTauriRuntime()) {
    return {
      success: true,
      errors: [],
    };
  }

  return invoke<{ success: boolean; errors: string[] }>("create_config_file", { fileName, agentName, extension });
}

export async function deleteAgent(agentId: string, sourcePath: string): Promise<void> {
  if (!isTauriRuntime()) {
    return;
  }

  await invoke("delete_agent", { agentId, configPath: sourcePath });
}

export async function deleteConfigFile(configPath: string, projectRoot?: string | null): Promise<void> {
  if (!isTauriRuntime()) {
    return;
  }

  await invoke("delete_config_file", { configPath, projectRoot: projectRoot ?? null });
}

export async function savePermissionProfile(profile: EditablePermissionProfile): Promise<SaveAgentResult> {
  if (!isTauriRuntime()) {
    return {
      success: true,
      newVersion: profile.version + 1,
      errors: [],
    };
  }

  return invoke<SaveAgentResult>("save_permission_profile", { profile, targetPath: profile.sourcePath });
}

export type ModelInfo = {
  id: string;
  provider: string;
  model: string;
  variants: string[];
};

const fallbackModels: ModelInfo[] = [
  { id: "openai/gpt-5.5", provider: "openai", model: "gpt-5.5", variants: ["none", "low", "medium", "high", "xhigh"] },
  { id: "openai/gpt-5.5-fast", provider: "openai", model: "gpt-5.5-fast", variants: ["none", "low", "medium", "high", "xhigh"] },
  { id: "openai/gpt-5.4", provider: "openai", model: "gpt-5.4", variants: ["none", "low", "medium", "high", "xhigh"] },
  { id: "openai/gpt-5.4-mini", provider: "openai", model: "gpt-5.4-mini", variants: ["none", "low", "medium", "high", "xhigh"] },
  { id: "anthropic/claude-sonnet-4-5", provider: "anthropic", model: "claude-sonnet-4-5", variants: [] },
  { id: "anthropic/claude-haiku-4-5", provider: "anthropic", model: "claude-haiku-4-5", variants: [] },
  { id: "opencode-go/glm-5.2", provider: "opencode-go", model: "glm-5.2", variants: ["high", "max"] },
  { id: "opencode-go/deepseek-v4-pro", provider: "opencode-go", model: "deepseek-v4-pro", variants: ["low", "medium", "high", "max"] },
  { id: "opencode-go/qwen3.7-plus", provider: "opencode-go", model: "qwen3.7-plus", variants: [] },
  { id: "opencode-go/kimi-k2.7-code", provider: "opencode-go", model: "kimi-k2.7-code", variants: [] },
  { id: "opencode/deepseek-v4-flash-free", provider: "opencode", model: "deepseek-v4-flash-free", variants: [] },
];

export async function listOpencodeModels(): Promise<ModelInfo[]> {
  if (!isTauriRuntime()) {
    return fallbackModels;
  }

  try {
    return await invoke<ModelInfo[]>("list_opencode_models");
  } catch (error) {
    console.error("Failed to list opencode models, using fallback", error);
    return fallbackModels;
  }
}
