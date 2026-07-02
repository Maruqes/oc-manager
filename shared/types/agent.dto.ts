export type AgentType = "primary" | "subagent" | "all" | "unknown";
export type AgentSource = "project" | "global";
export type RiskLevel = "low" | "medium" | "high";
export type PermissionProfileKind = "global" | "customProfile" | "agentOverride" | "effective" | "legacyTools";
export type InstructionSourceKind = "agentPrompt" | "promptFileReference" | "configInstructions" | "rulesFile" | "markdownAgentBody";
export type ConfigFileKind = "json" | "jsonc" | "markdownAgent" | "rulesFile";

export type AgentDto = {
  id: string;
  name: string;
  type: AgentType;
  source: AgentSource;
  sourcePath: string;
  description?: string;
  model?: string;
  effectiveModel?: string;
  modelSource?: string;
  variant?: string;
  permissionProfile?: string;
  mode?: string;
  disabled?: boolean;
  hidden?: boolean;
  color?: string;
  temperature?: number;
  topP?: number;
  steps?: number;
  commands: string[];
  instructions?: string;
  permissions: Array<{
    key: string;
    value: unknown;
    risk: RiskLevel;
  }>;
  rawConfig: unknown;
  risk: RiskLevel;
  validationErrors: string[];
  lastModified: number;
};

export type PermissionRuleDto = {
  tool: string;
  pattern?: string | null;
  action: string;
  source: string;
  risk: RiskLevel;
};

export type PermissionProfileDto = {
  id: string;
  name: string;
  kind: PermissionProfileKind;
  agentId?: string | null;
  source: AgentSource;
  sourcePath: string;
  rules: PermissionRuleDto[];
  risk: RiskLevel;
  rawConfig: unknown;
  validationErrors: string[];
};

export type InstructionSourceDto = {
  id: string;
  kind: InstructionSourceKind;
  agentId?: string | null;
  source: AgentSource;
  sourcePath: string;
  label: string;
  content?: string | null;
  reference?: string | null;
  validationErrors: string[];
};

export type ConfigFileDto = {
  id: string;
  source: AgentSource;
  path: string;
  kind: ConfigFileKind;
  rawConfig: unknown;
  agentsCount: number;
  permissionProfilesCount: number;
  instructionSourcesCount: number;
  validationErrors: string[];
  lastModified: number;
};

export type ScanResultDto = {
  agents: AgentDto[];
  permissionProfiles: PermissionProfileDto[];
  instructionSources: InstructionSourceDto[];
  configFiles: ConfigFileDto[];
};
