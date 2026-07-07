export type PermissionValue = "allow" | "ask" | "deny";

export type AgentMode = "primary" | "subagent" | "all";

export type ProviderId = "openai" | "anthropic" | "gemini" | "ollama" | "lmstudio" | "opencode-go" | "opencode" | "custom";

export type BashRule = {
  pattern: string;
  action: PermissionValue;
};

export type BashPolicy = {
  default: PermissionValue;
  rules: BashRule[];
};

export type TaskRule = {
  agentName: string;
  action: PermissionValue;
};

export type TaskPolicy = {
  default: PermissionValue;
  rules: TaskRule[];
};

export type SimplePermissions = {
  read?: PermissionValue;
  edit?: PermissionValue;
  glob?: PermissionValue;
  grep?: PermissionValue;
  list?: PermissionValue;
  webfetch?: PermissionValue;
  websearch?: PermissionValue;
  lsp?: PermissionValue;
  todowrite?: PermissionValue;
  question?: PermissionValue;
  doomLoop?: PermissionValue;
  externalDirectory?: PermissionValue;
  skill?: PermissionValue;
};

export type WorkspaceScope = {
  allowedPaths: string[];
  deniedPaths: string[];
};

export type ApprovalPolicy = {
  requirePlanBeforeEdit: boolean;
  requireUserApprovalBeforeEdit: boolean;
  requireUserApprovalBeforeBash: boolean;
  requireUserApprovalBeforeInstall: boolean;
  requireUserApprovalBeforeDelete: boolean;
  requireUserApprovalBeforeGitPush: boolean;
};

export type AgentLimits = {
  maxSteps: number;
  maxRuntimeSeconds?: number;
  maxCostEur?: number;
};

export type UiConfig = {
  color?: string;
  hidden?: boolean;
  icon?: string;
  order?: number;
};

export type EditableAgent = {
  id: string;
  name: string;
  description: string;
  enabled: boolean;
  mode: AgentMode;
  provider: ProviderId;
  model: string;
  variant?: string;
  temperature: number;
  topP?: number;
  steps: number;
  prompt: string;
  simplePermissions: SimplePermissions;
  bashPolicy: BashPolicy;
  taskPolicy: TaskPolicy;
  workspaceScope: WorkspaceScope;
  approvalPolicy: ApprovalPolicy;
  limits: AgentLimits;
  ui: UiConfig;
  permissionProfile?: string;
  sourcePath: string;
  version: number;
  createdAt: string;
  updatedAt: string;
};

export type ValidationError = {
  field: string;
  message: string;
};

export type AgentValidationResult = {
  valid: boolean;
  errors: ValidationError[];
};

export type SaveAgentResult = {
  success: boolean;
  backupPath?: string;
  newVersion: number;
  errors: string[];
};

export const PERMISSION_KEYS = [
  "read",
  "edit",
  "glob",
  "grep",
  "list",
  "webfetch",
  "websearch",
  "lsp",
  "todowrite",
  "question",
  "doomLoop",
  "externalDirectory",
  "skill",
] as const;

export const PERMISSION_LABELS: Record<string, string> = {
  read: "Read",
  edit: "Edit / Write / Patch",
  glob: "Glob",
  grep: "Grep",
  list: "List",
  webfetch: "Web Fetch",
  websearch: "Web Search",
  lsp: "LSP",
  todowrite: "Todo Write",
  question: "Question",
  doomLoop: "Doom Loop Guard",
  externalDirectory: "External Directory",
  skill: "Skill",
};

export const PROVIDER_OPTIONS: Array<{ value: ProviderId; label: string }> = [
  { value: "openai", label: "OpenAI" },
  { value: "anthropic", label: "Anthropic" },
  { value: "gemini", label: "Gemini" },
  { value: "ollama", label: "Ollama" },
  { value: "lmstudio", label: "LM Studio" },
  { value: "opencode-go", label: "OpenCode Go" },
  { value: "opencode", label: "OpenCode" },
  { value: "custom", label: "Custom" },
];

export const COLOR_OPTIONS = [
  "primary",
  "secondary",
  "accent",
  "success",
  "warning",
  "error",
  "info",
] as const;
