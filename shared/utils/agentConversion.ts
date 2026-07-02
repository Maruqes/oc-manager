import type { AgentDto } from "../types/agent.dto";
import type {
  AgentMode,
  BashPolicy,
  EditableAgent,
  PermissionValue,
  ProviderId,
  SimplePermissions,
  TaskPolicy,
} from "../types/editable-agent.dto";
import { isValidPermissionValue } from "./agentValidation";

const KNOWN_SIMPLE_PERMISSIONS = [
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

const PERMISSION_KEY_TO_OPENCODE: Record<keyof SimplePermissions, string> = {
  read: "read",
  edit: "edit",
  glob: "glob",
  grep: "grep",
  list: "list",
  webfetch: "webfetch",
  websearch: "websearch",
  lsp: "lsp",
  todowrite: "todowrite",
  question: "question",
  doomLoop: "doom_loop",
  externalDirectory: "external_directory",
  skill: "skill",
};

const PERMISSION_KEY_MAP: Record<string, keyof SimplePermissions> = {
  read: "read",
  edit: "edit",
  glob: "glob",
  grep: "grep",
  list: "list",
  webfetch: "webfetch",
  websearch: "websearch",
  lsp: "lsp",
  todowrite: "todowrite",
  question: "question",
  doom_loop: "doomLoop",
  external_directory: "externalDirectory",
  skill: "skill",
};

function nowIso(): string {
  return new Date().toISOString();
}

function emptyBashPolicy(): BashPolicy {
  return { default: "ask", rules: [] };
}

function emptyTaskPolicy(): TaskPolicy {
  return { default: "deny", rules: [] };
}

function parseProviderModel(model: string | undefined): { provider: ProviderId; model: string } {
  if (!model) return { provider: "openai", model: "" };
  const trimmed = model.trim();
  const slashIndex = trimmed.indexOf("/");
  if (slashIndex <= 0) return { provider: "custom", model: trimmed };

  const providerRaw = trimmed.slice(0, slashIndex).toLowerCase();
  const modelPart = trimmed.slice(slashIndex + 1);
  const known: ProviderId[] = ["openai", "anthropic", "gemini", "ollama", "lmstudio", "opencode-go"];
  const provider = known.includes(providerRaw as ProviderId) ? (providerRaw as ProviderId) : "custom";
  return { provider, model: modelPart };
}

function parseBashPolicy(permissionConfig: unknown): BashPolicy {
  const policy = emptyBashPolicy();

  if (!permissionConfig || typeof permissionConfig !== "object") return policy;
  const permission = permissionConfig as Record<string, unknown>;
  const bash = permission.bash;

  if (!bash) return policy;

  if (typeof bash === "string" && isValidPermissionValue(bash)) {
    policy.default = bash;
    return policy;
  }

  if (bash && typeof bash === "object") {
    const rules = bash as Record<string, unknown>;
    for (const [pattern, action] of Object.entries(rules)) {
      if (typeof action === "string" && isValidPermissionValue(action)) {
        if (pattern === "*") {
          policy.default = action;
        } else {
          policy.rules.push({ pattern, action });
        }
      }
    }
  }

  return policy;
}

function parseTaskPolicy(permissionConfig: unknown): TaskPolicy {
  const policy = emptyTaskPolicy();

  if (!permissionConfig || typeof permissionConfig !== "object") return policy;
  const permission = permissionConfig as Record<string, unknown>;
  const task = permission.task;

  if (!task) return policy;

  if (typeof task === "string" && isValidPermissionValue(task)) {
    policy.default = task;
    return policy;
  }

  if (task && typeof task === "object") {
    const rules = task as Record<string, unknown>;
    for (const [agentName, action] of Object.entries(rules)) {
      if (typeof action === "string" && isValidPermissionValue(action)) {
        if (agentName === "*") {
          policy.default = action;
        } else {
          policy.rules.push({ agentName, action });
        }
      }
    }
  }

  return policy;
}

function parseSimplePermissions(permissionConfig: unknown): SimplePermissions {
  const result: SimplePermissions = {};

  if (!permissionConfig || typeof permissionConfig !== "object") return result;
  const permission = permissionConfig as Record<string, unknown>;

  for (const rawKey of Object.keys(permission)) {
    const value = permission[rawKey];
    const mappedKey = PERMISSION_KEY_MAP[rawKey];
    if (!mappedKey || !KNOWN_SIMPLE_PERMISSIONS.includes(mappedKey)) continue;

    if (typeof value === "string" && isValidPermissionValue(value)) {
      result[mappedKey] = value;
    } else if (typeof value === "boolean") {
      result[mappedKey] = value ? "allow" : "deny";
    } else if (value && typeof value === "object") {
      const patterns = value as Record<string, unknown>;
      const defaultAction = patterns["*"];
      if (typeof defaultAction === "string" && isValidPermissionValue(defaultAction)) {
        result[mappedKey] = defaultAction;
      }
    }
  }

  return result;
}

function parseRawPermissions(rawConfig: unknown): {
  simple: SimplePermissions;
  bash: BashPolicy;
  task: TaskPolicy;
} {
  if (!rawConfig || typeof rawConfig !== "object") {
    return { simple: {}, bash: emptyBashPolicy(), task: emptyTaskPolicy() };
  }

  const root = rawConfig as Record<string, unknown>;
  const permissionConfig = root.permission ?? root.permissions ?? root.tools;
  return {
    simple: parseSimplePermissions(permissionConfig),
    bash: parseBashPolicy(permissionConfig),
    task: parseTaskPolicy(permissionConfig),
  };
}

function parseWorkspaceScope(rawConfig: unknown): { allowedPaths: string[]; deniedPaths: string[] } {
  if (!rawConfig || typeof rawConfig !== "object") {
    return { allowedPaths: [], deniedPaths: [] };
  }

  const root = rawConfig as Record<string, unknown>;
  const read = root.permission as Record<string, unknown> | undefined;

  if (!read || typeof read !== "object") {
    return { allowedPaths: [], deniedPaths: [] };
  }

  const allowedPaths: string[] = [];
  const deniedPaths: string[] = [];

  for (const [key, value] of Object.entries(read)) {
    if (key === "read" && value && typeof value === "object") {
      const patterns = value as Record<string, unknown>;
      for (const [pattern, action] of Object.entries(patterns)) {
        if (pattern === "*") continue;
        if (action === "allow") allowedPaths.push(pattern);
        if (action === "deny") deniedPaths.push(pattern);
      }
    }
  }

  return { allowedPaths, deniedPaths };
}

export function agentToEditable(agent: AgentDto): EditableAgent {
  const { provider, model } = parseProviderModel(agent.effectiveModel ?? agent.model ?? undefined);
  const { simple, bash, task } = parseRawPermissions(agent.rawConfig);
  const workspaceScope = parseWorkspaceScope(agent.rawConfig);

  const rawConfig = (agent.rawConfig ?? {}) as Record<string, unknown>;
  const agentConfig = (rawConfig.agent as Record<string, Record<string, unknown>> | undefined)?.[agent.name] ?? rawConfig;

  const modeRaw = (agentConfig.mode ?? agent.mode ?? agent.type) as string | undefined;
  const mode: AgentMode =
    modeRaw === "primary" ? "primary" : modeRaw === "all" ? "all" : modeRaw === "subagent" ? "subagent" : "subagent";

  const now = nowIso();
  return {
    id: agent.id,
    name: agent.name,
    description: agent.description ?? "",
    enabled: !agent.disabled,
    mode,
    provider,
    model,
    variant: typeof agentConfig.variant === "string" ? agentConfig.variant : agent.variant,
    temperature: typeof agentConfig.temperature === "number" ? agentConfig.temperature : 0.2,
    topP: typeof agentConfig.top_p === "number" ? agentConfig.top_p : undefined,
    steps: typeof agent.steps === "number" ? agent.steps : 25,
    prompt: agent.instructions ?? "",
    simplePermissions: simple,
    bashPolicy: bash,
    taskPolicy: task,
    workspaceScope,
    approvalPolicy: {
      requirePlanBeforeEdit: simple.edit === "ask",
      requireUserApprovalBeforeEdit: simple.edit === "ask",
      requireUserApprovalBeforeBash: bash.default === "ask",
      requireUserApprovalBeforeInstall: bash.rules.some((r) => r.pattern.includes("install") && r.action === "ask"),
      requireUserApprovalBeforeDelete: bash.rules.some((r) => r.pattern.includes("rm") && r.action === "ask"),
      requireUserApprovalBeforeGitPush: bash.rules.some((r) => r.pattern.includes("git push") && r.action === "ask"),
    },
    limits: {
      maxSteps: typeof agent.steps === "number" ? agent.steps : 25,
    },
    ui: {
      color: agent.color,
      hidden: agent.hidden,
    },
    permissionProfile: agent.permissionProfile,
    sourcePath: agent.sourcePath,
    version: 1,
    createdAt: now,
    updatedAt: now,
  };
}

export function editableToOpenCodeAgent(agent: EditableAgent): Record<string, unknown> {
  const config: Record<string, unknown> = {
    description: agent.description,
    mode: agent.mode,
    model: `${agent.provider}/${agent.model}`.replace(/\/+/, "/"),
    temperature: agent.temperature,
    steps: agent.steps,
    prompt: agent.prompt,
    disable: !agent.enabled,
  };

  if (agent.topP !== undefined) config.top_p = agent.topP;
  if (agent.variant) config.variant = agent.variant;
  if (agent.ui.color) config.color = agent.ui.color;
  if (agent.ui.hidden !== undefined && agent.mode === "subagent") config.hidden = agent.ui.hidden;
  if (agent.permissionProfile) config.permission_profile = agent.permissionProfile;

  const permission: Record<string, unknown> = {};

  for (const key of KNOWN_SIMPLE_PERMISSIONS) {
    const value = agent.simplePermissions[key];
    if (value) permission[PERMISSION_KEY_TO_OPENCODE[key]] = value;
  }

  permission.bash = {
    "*": agent.bashPolicy.default,
    ...Object.fromEntries(agent.bashPolicy.rules.map((rule) => [rule.pattern, rule.action])),
  };

  permission.task = {
    "*": agent.taskPolicy.default,
    ...Object.fromEntries(agent.taskPolicy.rules.map((rule) => [rule.agentName, rule.action])),
  };

  if (agent.workspaceScope.allowedPaths.length > 0 || agent.workspaceScope.deniedPaths.length > 0) {
    const readRules: Record<string, PermissionValue> = { "*": "allow" };
    for (const path of agent.workspaceScope.allowedPaths) readRules[path] = "allow";
    for (const path of agent.workspaceScope.deniedPaths) readRules[path] = "deny";
    permission.read = readRules;
  }

  config.permission = permission;

  return config;
}

export function applyApprovalPolicyToPermissions(agent: EditableAgent): EditableAgent {
  const updated = structuredClone(agent);

  if (updated.approvalPolicy.requireUserApprovalBeforeEdit) {
    updated.simplePermissions.edit = "ask";
  }

  if (updated.approvalPolicy.requireUserApprovalBeforeBash) {
    updated.bashPolicy.default = "ask";
  }

  if (updated.approvalPolicy.requireUserApprovalBeforeInstall) {
    const existing = updated.bashPolicy.rules.find((rule) => rule.pattern === "npm install*");
    if (existing) existing.action = "ask";
    else updated.bashPolicy.rules.push({ pattern: "npm install*", action: "ask" });
  }

  if (updated.approvalPolicy.requireUserApprovalBeforeDelete) {
    const existing = updated.bashPolicy.rules.find((rule) => rule.pattern === "rm -rf *");
    if (existing) existing.action = "deny";
    else updated.bashPolicy.rules.push({ pattern: "rm -rf *", action: "deny" });
  }

  if (updated.approvalPolicy.requireUserApprovalBeforeGitPush) {
    const existing = updated.bashPolicy.rules.find((rule) => rule.pattern === "git push*");
    if (existing) existing.action = "ask";
    else updated.bashPolicy.rules.push({ pattern: "git push*", action: "ask" });
  }

  return updated;
}
