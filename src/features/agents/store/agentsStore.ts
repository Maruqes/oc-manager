import { create } from "zustand";
import type { Agent, AgentType, ConfigFile, InstructionSource, PermissionProfile, ScanResult } from "../types/agent.types";
import type { AgentFilter } from "../utils/agentFilters";
import { agentToEditable } from "../../../../shared/utils/agentConversion";
import { permissionProfileToEditable } from "../../../../shared/utils/permissionProfileConversion";
import type { EditableAgent } from "../../../../shared/types/editable-agent.dto";
import type { EditablePermissionProfile } from "../../../../shared/types/editable-permission-profile.dto";

function generateId(): string {
  return `new-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function createEmptyEditableAgent(sourcePath: string): EditableAgent {
  const now = new Date().toISOString();
  return {
    id: generateId(),
    name: "",
    description: "",
    enabled: true,
    mode: "subagent",
    provider: "openai",
    model: "gpt-5.5",
    temperature: 0.2,
    steps: 25,
    prompt: "",
    simplePermissions: {
      read: "allow",
      edit: "ask",
      glob: "allow",
      grep: "allow",
      list: "allow",
      webfetch: "deny",
      websearch: "deny",
      lsp: "allow",
      todowrite: "allow",
      question: "allow",
      doomLoop: "allow",
      externalDirectory: "deny",
      skill: "allow",
    },
    bashPolicy: { default: "ask", rules: [] },
    taskPolicy: { default: "deny", rules: [] },
    workspaceScope: { allowedPaths: [], deniedPaths: [] },
    approvalPolicy: {
      requirePlanBeforeEdit: false,
      requireUserApprovalBeforeEdit: false,
      requireUserApprovalBeforeBash: false,
      requireUserApprovalBeforeInstall: false,
      requireUserApprovalBeforeDelete: false,
      requireUserApprovalBeforeGitPush: false,
    },
    limits: { maxSteps: 25 },
    ui: { color: "primary", hidden: false },
    sourcePath,
    version: 1,
    createdAt: now,
    updatedAt: now,
  };
}

type AgentsState = {
  agents: Agent[];
  permissionProfiles: PermissionProfile[];
  instructionSources: InstructionSource[];
  configFiles: ConfigFile[];
  selectedAgentId?: string;
  filter: AgentFilter;
  search: string;
  scanProjectRoot?: string | null;
  isLoading: boolean;
  error?: string;
  editingAgent?: EditableAgent;
  isCreatingAgent: boolean;
  isSaving: boolean;
  saveError?: string;
  editingPermissionProfile?: EditablePermissionProfile;
  isSavingProfile: boolean;
  saveProfileError?: string;
  setScanResult: (scanResult: ScanResult, scanProjectRoot?: string | null) => void;
  selectAgent: (agentId: string) => void;
  setFilter: (filter: AgentFilter) => void;
  setSearch: (search: string) => void;
  setLoading: (isLoading: boolean) => void;
  setError: (error?: string) => void;
  startEditing: (agent: Agent) => void;
  startCreating: (agent: EditableAgent) => void;
  startCreatingFromFile: (sourcePath: string, name?: string) => void;
  stopEditing: () => void;
  setSaving: (isSaving: boolean) => void;
  setSaveError: (error?: string) => void;
  startEditingProfile: (profile: PermissionProfile) => void;
  stopEditingProfile: () => void;
  setSavingProfile: (isSaving: boolean) => void;
  setSaveProfileError: (error?: string) => void;
};

export const useAgentsStore = create<AgentsState>((set) => ({
  agents: [],
  permissionProfiles: [],
  instructionSources: [],
  configFiles: [],
  filter: "any",
  search: "",
  isLoading: false,
  isCreatingAgent: false,
  isSaving: false,
  isSavingProfile: false,
  setScanResult: (scanResult, scanProjectRoot) =>
    set((state) => ({
      agents: scanResult.agents,
      permissionProfiles: scanResult.permissionProfiles,
      instructionSources: scanResult.instructionSources,
      configFiles: scanResult.configFiles,
      scanProjectRoot,
      selectedAgentId: scanResult.agents.some((agent) => agent.id === state.selectedAgentId)
        ? state.selectedAgentId
        : scanResult.agents[0]?.id,
    })),
  selectAgent: (agentId) => set({ selectedAgentId: agentId, editingAgent: undefined, isCreatingAgent: false }),
  setFilter: (filter) => set({ filter }),
  setSearch: (search) => set({ search }),
  setLoading: (isLoading) => set({ isLoading }),
  setError: (error) => set({ error }),
  startEditing: (agent) => set({ editingAgent: agentToEditable(agent), isCreatingAgent: false }),
  startCreating: (agent) => set({ editingAgent: agent, isCreatingAgent: true }),
  startCreatingFromFile: (sourcePath, name) => {
    const agent = createEmptyEditableAgent(sourcePath);
    if (name) agent.name = name;
    set({ editingAgent: agent, isCreatingAgent: true });
  },
  stopEditing: () => set({ editingAgent: undefined, isCreatingAgent: false, saveError: undefined }),
  setSaving: (isSaving) => set({ isSaving }),
  setSaveError: (error) => set({ saveError: error }),
  startEditingProfile: (profile) => set({ editingPermissionProfile: permissionProfileToEditable(profile) }),
  stopEditingProfile: () => set({ editingPermissionProfile: undefined, saveProfileError: undefined }),
  setSavingProfile: (isSaving) => set({ isSavingProfile: isSaving }),
  setSaveProfileError: (error) => set({ saveProfileError: error }),
}));
