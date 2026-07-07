import { useEffect, useMemo, useRef, useState } from "react";
import { Bot, CheckCircle, Eye, FileJson, Terminal, WandSparkles } from "lucide-react";
import { Button } from "../../../components/ui/Button";
import { Card } from "../../../components/ui/Card";
import { CustomSelect, GroupedCustomSelect } from "../../../components/ui/CustomSelect";
import { RawJsonViewer } from "../../agents/components/RawJsonViewer";
import { createAgent, listOpencodeModels, saveAgent, scanAgents, type ModelInfo } from "../../agents/api/agentsApi";
import { createEmptyEditableAgent, useAgentsStore } from "../../agents/store/agentsStore";
import { computeAgentChanges } from "../../agents/utils/agentDiff";
import { agentToEditable } from "../../../../shared/utils/agentConversion";
import { validateAgent } from "../../../../shared/utils/agentValidation";
import type { Agent } from "../../agents/types/agent.types";
import type { AgentMode, EditableAgent, PermissionValue, ProviderId } from "../../../../shared/types/editable-agent.dto";
import { PERMISSION_KEYS } from "../../../../shared/types/editable-agent.dto";
import { createAgentChatStreamId, listenAgentChatEvents, runAgentChat, type AgentChatStreamEvent } from "../api/chatbotApi";
import { isDefaultOpenCodeConfig } from "../../agents/utils/defaultConfig";

type ChatAction = "create" | "edit";
type Proposal = { agents: EditableAgent[]; raw: unknown; stdout: string; stderr: string; thoughts: string[] };
type ChatLogEntry = AgentChatStreamEvent & { id: string; visibleText?: string | null };
type ReviewStep = "overview" | "prompt" | "permissions" | "raw";

type AgentProposalShape = Partial<EditableAgent> & {
  model?: string;
  provider?: string;
  instructions?: string | string[];
  instruction?: string | string[];
  system?: string | string[];
  systemPrompt?: string | string[];
  permissions?: Record<string, unknown>;
};

const DEFAULT_TARGET_PATH = "~/.config/opencode/opencode.jsonc";
const MAX_LIVE_LOGS = 120;
const MAX_LIVE_LOG_TEXT = 6000;
const MAX_LIVE_RAW_TEXT = 12000;
const MAX_PROPOSAL_SCAN_TEXT = 2000;
const MAX_PROPOSAL_SCAN_DEPTH = 8;
const validModes = new Set(["primary", "subagent", "all"]);
const validPermissionValues = new Set(["allow", "ask", "deny"]);
const reviewSteps: Array<{ id: ReviewStep; label: string; help: string }> = [
  { id: "overview", label: "General", help: "Identity, model and target file" },
  { id: "prompt", label: "Prompt", help: "Full instructions without truncation" },
  { id: "permissions", label: "Permissions", help: "Simple, bash, task and workspace rules" },
  { id: "raw", label: "Raw", help: "Complete JSON payload" },
];

function parseModelId(modelId: string | undefined): { provider: ProviderId; model: string } {
  if (!modelId) return { provider: "openai", model: "gpt-5.5" };
  const [provider, ...modelParts] = modelId.split("/");
  const model = modelParts.join("/") || modelId;
  return { provider: (provider || "custom") as ProviderId, model };
}

function normalizeName(name: unknown, fallback: string) {
  const raw = typeof name === "string" ? name : fallback;
  const normalized = raw
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
  return normalized || fallback;
}

function normalizePermission(value: unknown): PermissionValue | undefined {
  return typeof value === "string" && validPermissionValues.has(value) ? value as PermissionValue : undefined;
}

function normalizeText(value: unknown): string | undefined {
  if (typeof value === "string" && value.trim()) return value;
  if (Array.isArray(value)) {
    const lines = value.filter((item): item is string => typeof item === "string" && item.trim().length > 0);
    if (lines.length > 0) return lines.join("\n");
  }
  return undefined;
}

function truncateText(value: string, maxLength: number) {
  if (value.length <= maxLength) return value;
  return `${value.slice(0, maxLength)}\n\n[truncated ${value.length - maxLength} chars in live preview]`;
}

function toDisplayLogEntry(entry: ChatLogEntry): ChatLogEntry {
  return {
    ...entry,
    text: truncateText(entry.text, MAX_LIVE_LOG_TEXT),
    raw: truncateText(entry.raw, MAX_LIVE_RAW_TEXT),
  };
}

function isObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function normalizeRuleArray<T>(value: unknown, fallback: T[]): T[] {
  return Array.isArray(value) ? value as T[] : fallback;
}

function resolveProposalName(base: EditableAgent, proposal: AgentProposalShape, fallbackName: string, action: ChatAction) {
  if (action === "edit") {
    return typeof proposal.name === "string" && proposal.name.trim() ? proposal.name.trim() : base.name;
  }
  return normalizeName(proposal.name, fallbackName);
}

function mergeProposal(base: EditableAgent, proposal: AgentProposalShape, fallbackName: string, action: ChatAction): EditableAgent {
  const fullModel = typeof proposal.model === "string" && proposal.model.includes("/")
    ? parseModelId(proposal.model)
    : { provider: (proposal.provider ?? base.provider) as ProviderId, model: proposal.model ?? base.model };
  const prompt = normalizeText(proposal.prompt)
    ?? normalizeText(proposal.instructions)
    ?? normalizeText(proposal.instruction)
    ?? normalizeText(proposal.system)
    ?? normalizeText(proposal.systemPrompt)
    ?? base.prompt;

  const simplePermissions = { ...base.simplePermissions };
  const proposedPermissions = proposal.simplePermissions ?? proposal.permissions;
  if (proposedPermissions && typeof proposedPermissions === "object") {
    for (const key of PERMISSION_KEYS) {
      const value = normalizePermission((proposedPermissions as Record<string, unknown>)[key]);
      if (value) simplePermissions[key] = value;
    }
  }

  const bashPolicy = (isObject(proposal.bashPolicy) ? proposal.bashPolicy : {}) as Partial<EditableAgent["bashPolicy"]>;
  const taskPolicy = (isObject(proposal.taskPolicy) ? proposal.taskPolicy : {}) as Partial<EditableAgent["taskPolicy"]>;
  const workspaceScope = (isObject(proposal.workspaceScope) ? proposal.workspaceScope : {}) as Partial<EditableAgent["workspaceScope"]>;
  const approvalPolicy = (isObject(proposal.approvalPolicy) ? proposal.approvalPolicy : {}) as Partial<EditableAgent["approvalPolicy"]>;
  const limits = (isObject(proposal.limits) ? proposal.limits : {}) as Partial<EditableAgent["limits"]>;
  const ui = (isObject(proposal.ui) ? proposal.ui : {}) as Partial<EditableAgent["ui"]>;

  return {
    ...base,
    name: resolveProposalName(base, proposal, fallbackName, action),
    description: typeof proposal.description === "string" ? proposal.description : base.description,
    enabled: typeof proposal.enabled === "boolean" ? proposal.enabled : base.enabled,
    mode: typeof proposal.mode === "string" && validModes.has(proposal.mode) ? proposal.mode as AgentMode : base.mode,
    provider: fullModel.provider,
    model: fullModel.model,
    variant: typeof proposal.variant === "string" && proposal.variant.trim() ? proposal.variant.trim() : base.variant,
    temperature: typeof proposal.temperature === "number" ? proposal.temperature : base.temperature,
    topP: typeof proposal.topP === "number" ? proposal.topP : base.topP,
    steps: typeof proposal.steps === "number" ? proposal.steps : base.steps,
    prompt,
    simplePermissions,
    bashPolicy: { ...base.bashPolicy, ...bashPolicy, rules: normalizeRuleArray(bashPolicy.rules, base.bashPolicy.rules) },
    taskPolicy: { ...base.taskPolicy, ...taskPolicy, rules: normalizeRuleArray(taskPolicy.rules, base.taskPolicy.rules) },
    workspaceScope: {
      ...base.workspaceScope,
      ...workspaceScope,
      allowedPaths: normalizeRuleArray(workspaceScope.allowedPaths, base.workspaceScope.allowedPaths),
      deniedPaths: normalizeRuleArray(workspaceScope.deniedPaths, base.workspaceScope.deniedPaths),
    },
    approvalPolicy: { ...base.approvalPolicy, ...approvalPolicy },
    limits: { ...base.limits, ...limits },
    ui: { ...base.ui, ...ui },
    permissionProfile: typeof proposal.permissionProfile === "string" ? proposal.permissionProfile : base.permissionProfile,
  };
}

function stripAnsi(value: string) {
  return value.replace(/[\u001b\u009b][[\]()#;?]*(?:(?:(?:[a-zA-Z\d]*(?:;[a-zA-Z\d]*)*)?\u0007)|(?:(?:\d{1,4}(?:;\d{0,4})*)?[\dA-PR-TZcf-nq-uy=><~]))/g, "");
}

function extractJson(rawText: string): unknown {
  const clean = stripAnsi(rawText).trim();
  try {
    return JSON.parse(clean);
  } catch {
    const fenced = clean.match(/```(?:json)?\s*([\s\S]*?)```/i)?.[1];
    if (fenced) return JSON.parse(fenced);
  }

  const start = clean.indexOf("{");
  if (start < 0) throw new Error("OpenCode did not return JSON.");
  let depth = 0;
  let inString = false;
  let escaped = false;
  for (let index = start; index < clean.length; index += 1) {
    const char = clean[index];
    if (escaped) {
      escaped = false;
      continue;
    }
    if (char === "\\") {
      escaped = inString;
      continue;
    }
    if (char === '"') {
      inString = !inString;
      continue;
    }
    if (inString) continue;
    if (char === "{") depth += 1;
    if (char === "}") depth -= 1;
    if (depth === 0) return JSON.parse(clean.slice(start, index + 1));
  }
  throw new Error("OpenCode returned incomplete JSON.");
}

function getProposalItems(value: unknown, action: ChatAction): AgentProposalShape[] {
  if (!value || typeof value !== "object") throw new Error("The chatbot response must be a JSON object.");
  const object = value as Record<string, unknown>;
  const items = Array.isArray(object.agents) ? object.agents : object.agent ? [object.agent] : [];
  if (items.length === 0) throw new Error(action === "create" ? "No agents were proposed." : "No edited agent was proposed.");
  return items.filter((item): item is AgentProposalShape => Boolean(item && typeof item === "object"));
}

function hasProposalShape(value: unknown) {
  if (!value || typeof value !== "object") return false;
  const object = value as Record<string, unknown>;
  return Array.isArray(object.agents) || Boolean(object.agent && typeof object.agent === "object" && !Array.isArray(object.agent));
}

function findProposalShape(value: unknown, depth = 0): unknown | undefined {
  if (depth > MAX_PROPOSAL_SCAN_DEPTH) return undefined;
  if (hasProposalShape(value)) return value;
  if (typeof value === "string") {
    if (value.length > MAX_PROPOSAL_SCAN_TEXT) return undefined;
    for (const candidate of extractJsonObjects(value).reverse()) {
      const nested = findProposalShape(candidate, depth + 1);
      if (nested) return nested;
    }
    return undefined;
  }
  if (Array.isArray(value)) {
    for (const item of value) {
      const nested = findProposalShape(item, depth + 1);
      if (nested) return nested;
    }
    return undefined;
  }
  if (value && typeof value === "object") {
    const object = value as Record<string, unknown>;
    const nestedValues = [object.text, object.content, object.message, object.delta, object.data];
    if (object.part && typeof object.part === "object") {
      const part = object.part as Record<string, unknown>;
      nestedValues.push(part.text, part.content, part.message, part.delta);
    }
    for (const child of nestedValues) {
      const nested = findProposalShape(child, depth + 1);
      if (nested) return nested;
    }
  }
  return undefined;
}

function tryParseJson(value: string): unknown | undefined {
  try {
    return JSON.parse(stripAnsi(value).trim());
  } catch {
    return undefined;
  }
}

function extractVisibleText(value: unknown): string | undefined {
  if (!value || typeof value !== "object") return undefined;
  const object = value as Record<string, unknown>;
  for (const key of ["text", "content", "message", "delta"] as const) {
    const text = object[key];
    if (typeof text === "string" && text.trim()) return text.trim();
  }
  const partText = object.part && typeof object.part === "object" ? (object.part as Record<string, unknown>).text : undefined;
  if (typeof partText === "string" && partText.trim()) return partText.trim();
  return undefined;
}

function getVisibleOutputText(entry: ChatLogEntry): string | null {
  const rawParsed = tryParseJson(entry.raw);
  if (rawParsed) {
    if (findProposalShape(rawParsed)) return null;
    const visible = extractVisibleText(rawParsed);
    if (visible) return getVisibleOutputText({ ...entry, raw: "", text: visible });
    return null;
  }

  const text = entry.text.trim();
  if (!text) return null;
  const parsed = tryParseJson(text);
  if (parsed) {
    if (findProposalShape(parsed)) return null;
    return extractVisibleText(parsed) ?? null;
  }
  if (text.length <= MAX_PROPOSAL_SCAN_TEXT && extractJsonObjects(text).some((candidate) => findProposalShape(candidate))) return null;
  return text;
}

function getStringArray(value: unknown): string[] {
  if (typeof value === "string" && value.trim()) return [value.trim()];
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === "string" && item.trim().length > 0).map((item) => item.trim());
}

function extractProposalThoughts(raw: unknown, logs: ChatLogEntry[]): string[] {
  const fromLogs = logs
    .filter((entry) => entry.kind === "thinking")
    .map((entry) => truncateText(entry.text.trim(), MAX_LIVE_LOG_TEXT))
    .filter(Boolean);
  if (!raw || typeof raw !== "object") return fromLogs;

  const object = raw as Record<string, unknown>;
  const fromProposal = [
    ...getStringArray(object.thoughts),
    ...getStringArray(object.reasoning),
    ...getStringArray(object.reasoningSummary),
    ...getStringArray(object.summary),
  ];
  return [...fromLogs, ...fromProposal.map((item) => truncateText(item, MAX_LIVE_LOG_TEXT))].filter((item, index, items) => items.indexOf(item) === index).slice(-MAX_LIVE_LOGS);
}

function extractJsonObjects(text: string): unknown[] {
  const objects: unknown[] = [];
  const clean = stripAnsi(text);
  for (let start = clean.indexOf("{"); start >= 0; start = clean.indexOf("{", start + 1)) {
    let depth = 0;
    let inString = false;
    let escaped = false;
    for (let index = start; index < clean.length; index += 1) {
      const char = clean[index];
      if (escaped) {
        escaped = false;
        continue;
      }
      if (char === "\\") {
        escaped = inString;
        continue;
      }
      if (char === '"') {
        inString = !inString;
        continue;
      }
      if (inString) continue;
      if (char === "{") depth += 1;
      if (char === "}") depth -= 1;
      if (depth === 0) {
        try {
          objects.push(JSON.parse(clean.slice(start, index + 1)));
        } catch {
          // Keep scanning; streaming output can contain partial/non-proposal JSON.
        }
        break;
      }
    }
  }
  return objects;
}

function extractProposalJson(result: { stdout: string }, logs: ChatLogEntry[]): unknown {
  const outputText = logs
    .filter((entry) => entry.kind === "output")
    .map((entry) => entry.text)
    .join("\n");
  for (const source of [result.stdout, outputText]) {
    if (!source.trim()) continue;
    for (const candidate of extractJsonObjects(source).reverse()) {
      const proposal = findProposalShape(candidate);
      if (proposal) return proposal;
    }
    try {
      const candidate = extractJson(source);
      const proposal = findProposalShape(candidate);
      if (proposal) return proposal;
    } catch {
      // Try the next source.
    }
  }
  throw new Error("OpenCode did not return a proposal JSON with agent or agents.");
}

function buildSystemPrompt(action: ChatAction, userPrompt: string, selectedModel: string, selectedVariant: string | undefined, targetAgent: Agent | undefined, currentProposal: Proposal | null) {
  const isRefinement = Boolean(currentProposal);
  const baseSchema = `Return only JSON. No markdown. Include a short visible reasoning summary in "thoughts" (array of concise strings), not hidden chain-of-thought. Shape for create/refine creation: {"thoughts":[...],"agents":[{...}]}. Shape for edit/refine edit: {"thoughts":[...],"agent":{...}}. Agent fields: name, description, mode (primary|subagent|all), model (provider/model), variant, temperature, steps, prompt, simplePermissions, bashPolicy, taskPolicy, workspaceScope, approvalPolicy, ui. Permission values: allow, ask, deny.`;
  const constraints = `Use OpenCode agent config semantics. Do not write files. Do not run tools. Prefer safe permissions: read/glob/grep/list/lsp/todowrite allow, edit/bash ask unless the user clearly needs otherwise, destructive/network/external directory deny by default. If using the shorter permissions key, treat it like simplePermissions.`;
  const selected = `Selected generator model: ${selectedModel}${selectedVariant ? ` variant ${selectedVariant}` : ""}.`;
  const target = targetAgent ? `Current agent JSON to edit: ${JSON.stringify(agentToEditable(targetAgent))}` : "";
  const proposalContext = currentProposal ? `Current proposal JSON to refine: ${JSON.stringify(currentProposal.agents)}` : "";
  const refinement = isRefinement ? "Apply the user request by editing the current proposal. Return the full revised proposal, not a patch." : "";
  return [baseSchema, constraints, selected, target, proposalContext, refinement, `User request: ${userPrompt}`].filter(Boolean).join("\n\n");
}

function validationErrors(agents: EditableAgent[]) {
  return agents.flatMap((agent) => validateAgent(agent).errors.map((error) => `${agent.name || "new agent"}: ${error.field}: ${error.message}`));
}

function permissionEntries(permissions: EditableAgent["simplePermissions"]) {
  return Object.entries(permissions).filter((entry): entry is [string, PermissionValue] => typeof entry[1] === "string");
}

export function ChatbotView() {
  const { agents, configFiles, scanProjectRoot, setScanResult, setLoading, setError, selectAgent } = useAgentsStore();
  const [models, setModels] = useState<ModelInfo[]>([]);
  const [modelId, setModelId] = useState("openai/gpt-5.5");
  const [variant, setVariant] = useState("");
  const [action, setAction] = useState<ChatAction>("create");
  const [targetPath, setTargetPath] = useState(DEFAULT_TARGET_PATH);
  const [targetAgentId, setTargetAgentId] = useState("");
  const [prompt, setPrompt] = useState("");
  const [proposal, setProposal] = useState<Proposal | null>(null);
  const [isGenerating, setGenerating] = useState(false);
  const [isApplying, setApplying] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [chatLogs, setChatLogs] = useState<ChatLogEntry[]>([]);
  const [selectedProposalIndex, setSelectedProposalIndex] = useState(0);
  const [reviewStep, setReviewStep] = useState<ReviewStep>("overview");
  const pendingLogEntriesRef = useRef<ChatLogEntry[]>([]);
  const logFlushTimerRef = useRef<number | null>(null);

  const flushPendingLogs = () => {
    if (logFlushTimerRef.current !== null) {
      window.clearTimeout(logFlushTimerRef.current);
      logFlushTimerRef.current = null;
    }
    const pending = pendingLogEntriesRef.current;
    if (pending.length === 0) return;
    pendingLogEntriesRef.current = [];
    setChatLogs((current) => [...current, ...pending].slice(-MAX_LIVE_LOGS));
  };

  useEffect(() => {
    let cancelled = false;
    listOpencodeModels()
      .then((items) => {
        if (!cancelled) {
          setModels(items);
          if (!items.some((item) => item.id === modelId) && items[0]) setModelId(items[0].id);
        }
      })
      .catch(() => {
        if (!cancelled) setModels([]);
      });
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    setSelectedProposalIndex(0);
    setReviewStep("overview");
  }, [proposal]);

  useEffect(() => {
    if (proposal && selectedProposalIndex >= proposal.agents.length) setSelectedProposalIndex(0);
  }, [proposal, selectedProposalIndex]);

  const selectedModel = models.find((model) => model.id === modelId);
  const editableAgents = useMemo(() => agents.filter((agent) => !isDefaultOpenCodeConfig(agent.sourcePath, agent.source)), [agents]);
  const editableConfigFiles = useMemo(() => configFiles.filter((file) => !isDefaultOpenCodeConfig(file.path, file.source)), [configFiles]);
  const selectedTargetAgent = editableAgents.find((agent) => agent.id === targetAgentId);
  const variantOptions = selectedModel?.variants ?? [];

  useEffect(() => {
    if (!editableAgents.some((agent) => agent.id === targetAgentId)) setTargetAgentId(editableAgents[0]?.id ?? "");
  }, [editableAgents, targetAgentId]);

  useEffect(() => {
    if (!editableConfigFiles.some((file) => file.path === targetPath)) setTargetPath(editableConfigFiles[0]?.path ?? "");
  }, [editableConfigFiles, targetPath]);

  const groupedModels = useMemo(() => {
    const groups = new Map<string, ModelInfo[]>();
    for (const model of models) groups.set(model.provider, [...(groups.get(model.provider) ?? []), model]);
    return Array.from(groups.entries()).sort((a, b) => a[0].localeCompare(b[0]));
  }, [models]);

  const diffs = action === "edit" && selectedTargetAgent && proposal?.agents[0]
    ? computeAgentChanges(agentToEditable(selectedTargetAgent), proposal.agents[0])
    : [];
  const proposalErrors = proposal ? validationErrors(proposal.agents) : [];
  const selectedProposalAgent = proposal?.agents[selectedProposalIndex] ?? proposal?.agents[0];
  const simplePermissionRows = selectedProposalAgent ? permissionEntries(selectedProposalAgent.simplePermissions) : [];

  const handleGenerate = async () => {
    const proposalToRefine = proposal;
    setGenerating(true);
    setLocalError(null);
    setSuccess(null);
    setChatLogs([]);
    pendingLogEntriesRef.current = [];
    if (logFlushTimerRef.current !== null) {
      window.clearTimeout(logFlushTimerRef.current);
      logFlushTimerRef.current = null;
    }
    let unsubscribe: (() => void) | undefined;
    try {
      if (action === "edit" && !selectedTargetAgent) throw new Error("Select an agent to edit.");
      if (action === "create" && !targetPath && !proposalToRefine) throw new Error("Create a workflow/config file before generating agents. The default OpenCode config is read-only.");
      const chatPrompt = buildSystemPrompt(action, prompt, modelId, variant || undefined, selectedTargetAgent, proposalToRefine);
      const streamId = createAgentChatStreamId();
      const liveLogs: ChatLogEntry[] = [];
      unsubscribe = await listenAgentChatEvents(streamId, (event) => {
        const displayEntry = toDisplayLogEntry({ ...event, id: `${event.streamId}-${liveLogs.length}-${Date.now()}` });
        const entry: ChatLogEntry = {
          ...displayEntry,
          visibleText: displayEntry.kind === "output" ? getVisibleOutputText(displayEntry) : undefined,
        };
        liveLogs.push(entry);
        if (liveLogs.length > MAX_LIVE_LOGS) liveLogs.splice(0, liveLogs.length - MAX_LIVE_LOGS);
        pendingLogEntriesRef.current.push(entry);
        if (pendingLogEntriesRef.current.length > MAX_LIVE_LOGS) pendingLogEntriesRef.current.splice(0, pendingLogEntriesRef.current.length - MAX_LIVE_LOGS);
        if (logFlushTimerRef.current === null) {
          logFlushTimerRef.current = window.setTimeout(flushPendingLogs, 80);
        }
      });
      const result = await runAgentChat(modelId, variant || undefined, chatPrompt, streamId);
      const raw = extractProposalJson(result, liveLogs);
      const items = getProposalItems(raw, action);
      const generatedAgents = items.map((item, index) => {
        const base = proposalToRefine?.agents[index]
          ?? (action === "edit" && selectedTargetAgent
          ? agentToEditable(selectedTargetAgent)
          : createEmptyEditableAgent(targetPath));
        return mergeProposal(base, item, `generated-agent-${index + 1}`, action);
      });
      setProposal({
        agents: generatedAgents,
        raw,
        stdout: truncateText(result.stdout, MAX_LIVE_RAW_TEXT),
        stderr: truncateText(result.stderr, MAX_LIVE_RAW_TEXT),
        thoughts: extractProposalThoughts(raw, liveLogs),
      });
    } catch (error) {
      setLocalError(error instanceof Error ? error.message : "Failed to generate proposal.");
    } finally {
      flushPendingLogs();
      unsubscribe?.();
      setGenerating(false);
    }
  };

  const thinkingLogs = useMemo(() => chatLogs.filter((entry) => entry.kind === "thinking"), [chatLogs]);
  const actionLogs = useMemo(() => chatLogs.filter((entry) => entry.kind === "action" || entry.kind === "status" || entry.kind === "stderr" || entry.kind === "error"), [chatLogs]);
  const outputLogs = useMemo(() => chatLogs.filter((entry) => entry.kind === "output"), [chatLogs]);
  const visibleOutputLogs = useMemo(() => outputLogs
    .filter((entry) => typeof entry.visibleText === "string" && entry.visibleText.length > 0)
    .map((entry) => ({ ...entry, text: entry.visibleText as string })), [outputLogs]);

  const reloadAndSelect = async (name: string, sourcePath: string) => {
    const result = await scanAgents(scanProjectRoot ?? null);
    setScanResult(result, scanProjectRoot ?? null);
    const matched = result.agents.find((agent) => agent.name === name && agent.sourcePath === sourcePath)
      ?? result.agents.find((agent) => agent.name === name);
    if (matched) selectAgent(matched.id);
  };

  const handleApply = async () => {
    if (!proposal || proposalErrors.length > 0) return;
    setApplying(true);
    setLocalError(null);
    setError(undefined);
    setLoading(true);
    try {
      if (action === "create") {
        const createdNames = new Set<string>();
        for (const agent of proposal.agents) {
          const result = await createAgent(agent).catch(async (error) => {
            const result = await scanAgents(scanProjectRoot ?? null);
            setScanResult(result, scanProjectRoot ?? null);
            setProposal((current) => current
              ? { ...current, agents: current.agents.filter((item) => !createdNames.has(`${item.sourcePath}:${item.name}`)) }
              : current);
            throw error;
          });
          if (!result.success) throw new Error(result.errors.join("\n") || `Failed to create agent ${agent.name}.`);
          createdNames.add(`${agent.sourcePath}:${agent.name}`);
        }
        const last = proposal.agents[proposal.agents.length - 1];
        await reloadAndSelect(last.name, last.sourcePath);
        setSuccess(`${proposal.agents.length} agent(s) created.`);
      } else {
        const edited = proposal.agents[0];
        const result = await saveAgent(edited);
        if (!result.success) throw new Error(result.errors.join("\n") || `Failed to update agent ${edited.name}.`);
        await reloadAndSelect(edited.name, edited.sourcePath);
        setSuccess(`Agent ${edited.name} updated.`);
      }
      setProposal(null);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to apply proposal.";
      setLocalError(message);
    } finally {
      setLoading(false);
      setApplying(false);
    }
  };

  const handleDenyProposal = () => {
    setProposal(null);
    setSelectedProposalIndex(0);
    setReviewStep("overview");
    setSuccess(null);
    setLocalError(null);
  };

  return (
    <div className="details-stack chatbot-view">
      <Card className="hero-card">
        <div>
          <div className="eyebrow">OpenCode Chatbot</div>
          <h1>Chat</h1>
          <p>Generate or edit OpenCode agents with a review step before anything is saved.</p>
        </div>
        <Bot size={32} />
      </Card>

      <Card>
        <div className="section-heading"><span>Request</span><small>model, variant, action, prompt</small></div>
        <div className="form-grid form-grid-two">
          <div className="form-field">
            <span className="form-label">Model</span>
            <GroupedCustomSelect
              value={modelId}
              onChange={(value) => { setModelId(value); setVariant(""); }}
              groups={groupedModels.map(([provider, providerModels]) => ({
                label: provider,
                options: providerModels.map((model) => ({ value: model.id, label: model.model })),
              }))}
              searchable
            />
          </div>
          <div className="form-field">
            <span className="form-label">Variant</span>
            <CustomSelect
              value={variant}
              onChange={setVariant}
              options={[{ value: "", label: "Default" }, ...variantOptions.map((item) => ({ value: item, label: item }))]}
            />
          </div>
        </div>

        <div className="form-grid form-grid-two">
          <div className="form-field">
            <span className="form-label">Action</span>
            <CustomSelect<ChatAction>
              value={action}
              onChange={(value) => { setAction(value); setProposal(null); }}
              options={[{ value: "create", label: "Create agent(s)" }, { value: "edit", label: "Edit agent" }]}
            />
          </div>
          {action === "create" ? (
            <div className="form-field">
              <span className="form-label">Target file</span>
              <CustomSelect
                value={targetPath}
                onChange={setTargetPath}
                options={editableConfigFiles.map((file) => ({ value: file.path, label: file.path }))}
                searchable
              />
              {editableConfigFiles.length === 0 ? <span className="form-hint">Create a workflow/config file first. Default OpenCode config files are read-only.</span> : null}
            </div>
          ) : (
            <div className="form-field">
              <span className="form-label">Agent to edit</span>
              <CustomSelect
                value={targetAgentId}
                onChange={setTargetAgentId}
                options={editableAgents.map((agent) => ({ value: agent.id, label: agent.name, description: agent.sourcePath }))}
                searchable
              />
              {editableAgents.length === 0 ? <span className="form-hint">No editable agents available. Agents in the default OpenCode config are read-only.</span> : null}
            </div>
          )}
        </div>

        <label className="form-field">
          <span className="form-label">Prompt</span>
          <textarea
            className="form-textarea"
            rows={7}
            value={prompt}
            onChange={(event) => setPrompt(event.target.value)}
            placeholder={proposal ? "Refine the current proposal: change the prompt, permissions, names, descriptions..." : action === "create" ? "Create one primary agent and three subagents for..." : "Edit this agent so it..."}
          />
        </label>

        <div className="chat-actions">
          <Button variant="primary" onClick={handleGenerate} disabled={isGenerating || !prompt.trim() || (action === "create" && !targetPath && !proposal) || (action === "edit" && !selectedTargetAgent)}>
            <WandSparkles size={15} /> {isGenerating ? "Generating..." : proposal ? "Update proposal" : "Generate proposal"}
          </Button>
        </div>
      </Card>

      {localError ? <Card className="validation-errors"><p className="error-text">{localError}</p></Card> : null}
      {success ? <Card><p className="success-text"><CheckCircle size={14} /> {success}</p></Card> : null}

      {(isGenerating || chatLogs.length > 0) ? (
        <Card>
          <div className="section-heading">
            <span>Live model run</span>
            <small>{isGenerating ? "streaming from OpenCode" : "completed"}</small>
          </div>
          <div className="chat-live-grid">
            <div className="chat-live-panel">
              <div className="chat-live-title"><Eye size={14} /> Thinking</div>
              <div className="chat-live-scroll">
                {thinkingLogs.length === 0 ? <p className="muted small">No thinking blocks received yet.</p> : thinkingLogs.map((entry) => (
                  <div key={entry.id} className="chat-log chat-log-thinking">{entry.text}</div>
                ))}
              </div>
            </div>
            <div className="chat-live-panel">
              <div className="chat-live-title"><Terminal size={14} /> Actions</div>
              <div className="chat-live-scroll">
                {actionLogs.length === 0 ? <p className="muted small">No actions yet.</p> : actionLogs.map((entry) => (
                  <div key={entry.id} className={`chat-log chat-log-${entry.kind}`}>{entry.text}</div>
                ))}
              </div>
            </div>
          </div>
          <div className="chat-live-output">
            <div className="chat-live-title">Model output</div>
            <div className="chat-live-scroll chat-live-scroll-wide">
              {visibleOutputLogs.length === 0 ? <p className="muted small">Waiting for visible model text...</p> : visibleOutputLogs.map((entry) => (
                <div key={entry.id} className="chat-log">{entry.text}</div>
              ))}
            </div>
          </div>
        </Card>
      ) : null}

      {proposal ? (
        <Card>
          <div className="section-heading">
            <span>{action === "create" ? "Creation preview" : "Edit review"}</span>
            <small>{proposal.agents.length} proposed agent(s)</small>
          </div>
          {proposalErrors.length > 0 ? (
            <ul className="error-list">
              {proposalErrors.map((error) => <li key={error} className="error-text">{error}</li>)}
            </ul>
          ) : null}

          {proposal.thoughts.length > 0 ? (
            <div className="proposal-thoughts">
              <div className="chat-live-title"><Eye size={14} /> Model thinking</div>
              <div className="chat-live-scroll">
                {proposal.thoughts.map((thought, index) => <div key={`${thought}-${index}`} className="chat-log chat-log-thinking">{thought}</div>)}
              </div>
            </div>
          ) : null}

          <div className="agent-review-shell">
            <div className="agent-review-list" aria-label="Proposed agents">
              {proposal.agents.map((agent, index) => (
                <button
                  key={`${agent.sourcePath}-${agent.name}-${index}`}
                  className={`agent-review-item ${index === selectedProposalIndex ? "selected" : ""}`}
                  onClick={() => { setSelectedProposalIndex(index); setReviewStep("overview"); }}
                  type="button"
                >
                  <span className="agent-review-index">{String(index + 1).padStart(2, "0")}</span>
                  <span className="agent-review-name">{agent.name || "Unnamed agent"}</span>
                  <span className="agent-review-meta">{agent.mode} · {agent.provider}/{agent.model}</span>
                </button>
              ))}
            </div>

            <div className="agent-review-workspace">
              <div className="review-stepper" aria-label="Review steps">
                {reviewSteps.map((step) => (
                  <button
                    key={step.id}
                    className={`review-step ${reviewStep === step.id ? "active" : ""}`}
                    onClick={() => setReviewStep(step.id)}
                    type="button"
                  >
                    <span>{step.label}</span>
                    <small>{step.help}</small>
                  </button>
                ))}
              </div>

              {selectedProposalAgent ? (
                <div className="review-step-panel">
                  {reviewStep === "overview" ? (
                    <div className="review-overview-grid">
                      <div className="review-spec-card"><span>Name</span><strong>{selectedProposalAgent.name}</strong></div>
                      <div className="review-spec-card"><span>Description</span><strong>{selectedProposalAgent.description || "No description"}</strong></div>
                      <div className="review-spec-card"><span>Mode</span><strong>{selectedProposalAgent.mode}</strong></div>
                      <div className="review-spec-card"><span>Model</span><strong>{selectedProposalAgent.provider}/{selectedProposalAgent.model}</strong></div>
                      <div className="review-spec-card"><span>Variant</span><strong>{selectedProposalAgent.variant || "default"}</strong></div>
                      <div className="review-spec-card"><span>Temperature</span><strong>{selectedProposalAgent.temperature}</strong></div>
                      <div className="review-spec-card"><span>Steps</span><strong>{selectedProposalAgent.steps}</strong></div>
                      <div className="review-spec-card"><span>Target file</span><strong>{selectedProposalAgent.sourcePath}</strong></div>
                      <div className="review-spec-card"><span>Enabled</span><strong>{selectedProposalAgent.enabled ? "yes" : "no"}</strong></div>
                      <div className="review-spec-card"><span>Permission profile</span><strong>{selectedProposalAgent.permissionProfile || "none"}</strong></div>
                    </div>
                  ) : null}

                  {reviewStep === "prompt" ? (
                    <div className="review-prompt-panel">
                      <div className="review-panel-heading">
                        <strong>Full prompt</strong>
                        <span>{selectedProposalAgent.prompt.length} characters</span>
                      </div>
                      <pre>{selectedProposalAgent.prompt || "No prompt proposed."}</pre>
                    </div>
                  ) : null}

                  {reviewStep === "permissions" ? (
                    <div className="review-permissions-grid">
                      <div className="review-permission-section">
                        <div className="review-panel-heading"><strong>Simple permissions</strong><span>{simplePermissionRows.length} rules</span></div>
                        {simplePermissionRows.length === 0 ? <p className="muted small">No simple permissions.</p> : simplePermissionRows.map(([key, value]) => (
                          <div key={key} className="review-rule-row"><span>{key}</span><strong className={`perm-${value}`}>{value}</strong></div>
                        ))}
                      </div>
                      <div className="review-permission-section">
                        <div className="review-panel-heading"><strong>Bash policy</strong><span>{selectedProposalAgent.bashPolicy.rules.length} custom rules</span></div>
                        <div className="review-rule-row"><span>*</span><strong className={`perm-${selectedProposalAgent.bashPolicy.default}`}>{selectedProposalAgent.bashPolicy.default}</strong></div>
                        {selectedProposalAgent.bashPolicy.rules.map((rule) => <div key={`${rule.pattern}-${rule.action}`} className="review-rule-row"><span>{rule.pattern}</span><strong className={`perm-${rule.action}`}>{rule.action}</strong></div>)}
                      </div>
                      <div className="review-permission-section">
                        <div className="review-panel-heading"><strong>Task policy</strong><span>{selectedProposalAgent.taskPolicy.rules.length} custom rules</span></div>
                        <div className="review-rule-row"><span>*</span><strong className={`perm-${selectedProposalAgent.taskPolicy.default}`}>{selectedProposalAgent.taskPolicy.default}</strong></div>
                        {selectedProposalAgent.taskPolicy.rules.map((rule) => <div key={`${rule.agentName}-${rule.action}`} className="review-rule-row"><span>{rule.agentName}</span><strong className={`perm-${rule.action}`}>{rule.action}</strong></div>)}
                      </div>
                      <div className="review-permission-section">
                        <div className="review-panel-heading"><strong>Workspace scope</strong><span>{selectedProposalAgent.workspaceScope.allowedPaths.length + selectedProposalAgent.workspaceScope.deniedPaths.length} paths</span></div>
                        {selectedProposalAgent.workspaceScope.allowedPaths.map((path) => <div key={`allow-${path}`} className="review-rule-row"><span>{path}</span><strong className="perm-allow">allow</strong></div>)}
                        {selectedProposalAgent.workspaceScope.deniedPaths.map((path) => <div key={`deny-${path}`} className="review-rule-row"><span>{path}</span><strong className="perm-deny">deny</strong></div>)}
                        {selectedProposalAgent.workspaceScope.allowedPaths.length === 0 && selectedProposalAgent.workspaceScope.deniedPaths.length === 0 ? <p className="muted small">No scoped paths.</p> : null}
                      </div>
                    </div>
                  ) : null}

                  {reviewStep === "raw" ? <RawJsonViewer value={selectedProposalAgent} /> : null}
                </div>
              ) : null}
            </div>
          </div>

          {selectedProposalAgent ? (
            <div className="review-changes-section">
              <div className="section-heading">
                <span>Changes</span>
                <small>{action === "edit" ? "Before applying" : "Creation target"}</small>
              </div>
              {action === "edit" ? (
                <div className="diff-scroll-container review-diff-container">
                  <div className="diff-list">
                    {diffs.length === 0 ? <div className="diff-row muted">No changes proposed.</div> : diffs.map((change) => (
                      <div key={change.field} className="diff-row">
                        <span className="diff-field">{change.field}</span>
                        <div className="diff-values">
                          <div className="diff-before"><span className="diff-label">Before</span><span className="diff-value">{change.before}</span></div>
                          <div className="diff-after"><span className="diff-label">After</span><span className="diff-value">{change.after}</span></div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="review-created-summary">
                  <FileJson size={18} />
                  <div>
                    <strong>New agent proposal</strong>
                    <p>This agent will be added to <code>{selectedProposalAgent.sourcePath}</code>. Use General, Prompt and Permissions above to inspect its complete config.</p>
                  </div>
                </div>
              )}
            </div>
          ) : null}

          <div className="chat-actions">
            <Button variant="ghost" onClick={handleDenyProposal} disabled={isApplying || isGenerating}>
              Deny proposal
            </Button>
            <Button variant="primary" onClick={handleApply} disabled={isApplying || proposalErrors.length > 0 || (action === "edit" && diffs.length === 0)}>
              {isApplying ? "Applying..." : "Apply proposal"}
            </Button>
          </div>
        </Card>
      ) : null}
    </div>
  );
}
