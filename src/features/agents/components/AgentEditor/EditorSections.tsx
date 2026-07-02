import { Plus, Trash2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Card } from "../../../../components/ui/Card";
import { CustomSelect, GroupedCustomSelect } from "../../../../components/ui/CustomSelect";
import { FieldGroup, NumberInput, SelectInput, TextInput, TextareaInput, ToggleInput } from "./FormInputs";
import { useConfirmAction } from "../../../../hooks/useConfirmAction";
import type {
  AgentMode,
  BashRule,
  EditableAgent,
  PermissionValue,
  ProviderId,
  TaskRule,
} from "../../../../../shared/types/editable-agent.dto";
import {
  COLOR_OPTIONS,
  PERMISSION_KEYS,
  PERMISSION_LABELS,
} from "../../../../../shared/types/editable-agent.dto";
import { PermissionToggle } from "./PermissionToggle";
import { listOpencodeModels, type ModelInfo } from "../../api/agentsApi";

type SectionProps = {
  agent: EditableAgent;
  update: (updates: Partial<EditableAgent>) => void;
  errors: Array<{ field: string; message: string }>;
};

function fieldError(errors: SectionProps["errors"], field: string) {
  return errors.find((error) => error.field === field)?.message;
}

export function IdentitySection({ agent, update, errors }: SectionProps) {
  return (
    <Card>
      <div className="section-heading"><span>Identity</span></div>
      <div className="form-grid">
        <TextInput
          label="Name"
          value={agent.name}
          onChange={(name) => update({ name })}
          placeholder="reviewer"
          hint="lowercase, no spaces, no accents"
          error={fieldError(errors, "name")}
        />
        <SelectInput<AgentMode>
          label="Mode"
          value={agent.mode}
          onChange={(mode) => update({ mode })}
          options={[
            { value: "primary", label: "Primary" },
            { value: "subagent", label: "Subagent" },
            { value: "all", label: "All" },
          ]}
        />
      </div>
      <TextareaInput
        label="Description"
        value={agent.description}
        onChange={(description) => update({ description })}
        placeholder="Revê código sem alterar ficheiros, procurando bugs e regressões."
        rows={2}
        error={fieldError(errors, "description")}
        hint="Used for routing and @ autocomplete"
      />
      <div className="form-grid form-grid-three">
        <ToggleInput
          label="Enabled"
          checked={agent.enabled}
          onChange={(enabled) => update({ enabled })}
          hint="Disabled agents are ignored"
        />
        {agent.mode === "subagent" ? (
          <ToggleInput
            label="Hidden"
            checked={agent.ui.hidden ?? false}
            onChange={(hidden) => update({ ui: { ...agent.ui, hidden } })}
            hint="Hide from @ menu"
          />
        ) : null}
        <SelectInput
          label="Color"
          value={agent.ui.color ?? "primary"}
          onChange={(color) => update({ ui: { ...agent.ui, color } })}
          options={COLOR_OPTIONS.map((color) => ({ value: color, label: color }))}
        />
      </div>
    </Card>
  );
}

export function ModelSection({ agent, update, errors }: SectionProps) {
  const [models, setModels] = useState<ModelInfo[]>([]);
  const [loadingModels, setLoadingModels] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoadingModels(true);
    listOpencodeModels()
      .then((result) => {
        if (!cancelled) setModels(result);
      })
      .catch(() => {
        if (!cancelled) setModels([]);
      })
      .finally(() => {
        if (!cancelled) setLoadingModels(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const groupedModels = useMemo(() => {
    const groups = new Map<string, ModelInfo[]>();
    for (const model of models) {
      const list = groups.get(model.provider) ?? [];
      list.push(model);
      groups.set(model.provider, list);
    }
    return Array.from(groups.entries()).sort((a, b) => a[0].localeCompare(b[0]));
  }, [models]);

  const currentValue = `${agent.provider}/${agent.model}`;
  const currentModel = models.find((m) => m.id === currentValue);
  const currentInList = Boolean(currentModel);
  const variantOptions = agent.variant && !currentModel?.variants.includes(agent.variant)
    ? [...(currentModel?.variants ?? []), agent.variant]
    : currentModel?.variants ?? [];

  const handleModelSelect = (id: string) => {
    const selected = models.find((m) => m.id === id);
    if (selected) {
      update({
        provider: selected.provider as ProviderId,
        model: selected.model,
        variant: agent.variant && selected.variants.includes(agent.variant) ? agent.variant : undefined,
      });
    }
  };

  return (
    <Card>
      <div className="section-heading"><span>Model &amp; Runtime</span>{loadingModels ? <small>loading models...</small> : null}</div>
      <div className="form-field">
        <span className="form-label">Model {currentInList ? null : <span className="form-error">(custom)</span>}</span>
        <GroupedCustomSelect
          value={currentValue}
          onChange={handleModelSelect}
          groups={groupedModels.map(([provider, providerModels]) => ({
            label: provider,
            options: providerModels.map((model) => ({
              value: model.id,
              label: model.model,
            })),
          }))}
          searchable
          placeholder="Select a model..."
        />
        <small className="form-hint">from opencode models</small>
      </div>
      {variantOptions.length > 0 ? (
        <SelectInput<string>
          label="Variant"
          value={agent.variant ?? ""}
          onChange={(variant) => update({ variant: variant || undefined })}
          options={[
            { value: "", label: "Default" },
            ...variantOptions.map((variant) => ({ value: variant, label: variant })),
          ]}
          hint="variants from opencode models --verbose"
        />
      ) : null}
      <div className="form-grid form-grid-three">
        <NumberInput
          label="Temperature"
          value={agent.temperature}
          onChange={(temperature) => update({ temperature })}
          min={0}
          max={2}
          step={0.1}
          hint="0 = deterministic, 2 = creative"
          error={fieldError(errors, "temperature")}
        />
        <NumberInput
          label="Top P"
          value={agent.topP ?? 1}
          onChange={(topP) => update({ topP })}
          min={0}
          max={1}
          step={0.05}
          hint="Alternative to temperature"
        />
        <NumberInput
          label="Steps"
          value={agent.steps}
          onChange={(steps) => update({ steps })}
          min={1}
          max={1000}
          hint="Max agentic iterations"
          error={fieldError(errors, "steps")}
        />
      </div>
    </Card>
  );
}

export function PromptSection({ agent, update, errors }: SectionProps) {
  return (
    <Card>
      <div className="section-heading"><span>Prompt</span><small>system prompt sent to the model</small></div>
      <TextareaInput
        label="Prompt"
        value={agent.prompt}
        onChange={(prompt) => update({ prompt })}
        placeholder="You are a code reviewer. Focus on bugs, regressions, and security."
        rows={12}
        error={fieldError(errors, "prompt")}
      />
    </Card>
  );
}

export function PermissionsSection({ agent, update }: SectionProps) {
  return (
    <Card>
      <div className="section-heading"><span>Permissions</span><small>global tool access</small></div>
      <FieldGroup title="Tool permissions">
        {PERMISSION_KEYS.map((key) => (
          <PermissionToggle
            key={key}
            label={PERMISSION_LABELS[key]}
            value={agent.simplePermissions[key]}
            onChange={(value) => update({ simplePermissions: { ...agent.simplePermissions, [key]: value } })}
          />
        ))}
      </FieldGroup>
    </Card>
  );
}

export function BashPolicySection({ agent, update, errors }: SectionProps) {
  const { requestConfirm, ConfirmDialogElement } = useConfirmAction();

  const addRule = () => {
    update({ bashPolicy: { ...agent.bashPolicy, rules: [...agent.bashPolicy.rules, { pattern: "", action: "ask" }] } });
  };
  const removeRule = (index: number) => {
    const rule = agent.bashPolicy.rules[index];
    requestConfirm(
      { title: "Remove bash rule", description: `Remove the bash policy rule for pattern "${rule.pattern || "(empty)"}"? This action cannot be undone.` },
      () => update({ bashPolicy: { ...agent.bashPolicy, rules: agent.bashPolicy.rules.filter((_, i) => i !== index) } }),
    );
  };
  const updateRule = (index: number, updates: Partial<BashRule>) => {
    update({
      bashPolicy: {
        ...agent.bashPolicy,
        rules: agent.bashPolicy.rules.map((rule, i) => (i === index ? { ...rule, ...updates } : rule)),
      },
    });
  };

  return (
    <>
    <Card>
      <div className="section-heading"><span>Bash Policy</span><small>fine-grained command rules</small></div>
      <PermissionToggle
        label="Default bash action"
        value={agent.bashPolicy.default}
        onChange={(value: PermissionValue) => update({ bashPolicy: { ...agent.bashPolicy, default: value } })}
      />
      <div className="rule-list">
        <div className="rule-list-header">
          <span>Pattern</span>
          <span>Action</span>
          <span />
        </div>
        {agent.bashPolicy.rules.map((rule, index) => (
          <div className="rule-list-row" key={index}>
            <input
              type="text"
              className="form-input"
              value={rule.pattern}
              onChange={(event) => updateRule(index, { pattern: event.target.value })}
              placeholder="git status*"
            />
            <CustomSelect
              value={rule.action}
              onChange={(action) => updateRule(index, { action: action as PermissionValue })}
              options={[
                { value: "allow", label: "Allow" },
                { value: "ask", label: "Ask" },
                { value: "deny", label: "Deny" },
              ]}
            />
            <button type="button" className="rule-remove" onClick={() => removeRule(index)} aria-label="Remove rule">
              <Trash2 size={14} />
            </button>
          </div>
        ))}
        {fieldError(errors, "bash") ? <small className="form-error">{fieldError(errors, "bash")}</small> : null}
        <button type="button" className="more-button" onClick={addRule}>
          <Plus size={14} /> Add rule
        </button>
      </div>
    </Card>
    {ConfirmDialogElement}
  </>
  );
}

export function TaskPolicySection({ agent, update, errors }: SectionProps) {
  const { requestConfirm, ConfirmDialogElement } = useConfirmAction();

  const addRule = () => {
    update({ taskPolicy: { ...agent.taskPolicy, rules: [...agent.taskPolicy.rules, { agentName: "", action: "allow" }] } });
  };
  const removeRule = (index: number) => {
    const rule = agent.taskPolicy.rules[index];
    requestConfirm(
      { title: "Remove task rule", description: `Remove the task policy rule for agent "${rule.agentName || "(empty)"}"? This action cannot be undone.` },
      () => update({ taskPolicy: { ...agent.taskPolicy, rules: agent.taskPolicy.rules.filter((_, i) => i !== index) } }),
    );
  };
  const updateRule = (index: number, updates: Partial<TaskRule>) => {
    update({
      taskPolicy: {
        ...agent.taskPolicy,
        rules: agent.taskPolicy.rules.map((rule, i) => (i === index ? { ...rule, ...updates } : rule)),
      },
    });
  };

  return (
    <>
    <Card>
      <div className="section-heading"><span>Task Policy</span><small>which subagents this agent can invoke</small></div>
      <PermissionToggle
        label="Default task action"
        value={agent.taskPolicy.default}
        onChange={(value: PermissionValue) => update({ taskPolicy: { ...agent.taskPolicy, default: value } })}
      />
      <div className="rule-list">
        <div className="rule-list-header">
          <span>Agent</span>
          <span>Action</span>
          <span />
        </div>
        {agent.taskPolicy.rules.map((rule, index) => (
          <div className="rule-list-row" key={index}>
            <input
              type="text"
              className="form-input"
              value={rule.agentName}
              onChange={(event) => updateRule(index, { agentName: event.target.value })}
              placeholder="planner"
            />
            <CustomSelect
              value={rule.action}
              onChange={(action) => updateRule(index, { action: action as PermissionValue })}
              options={[
                { value: "allow", label: "Allow" },
                { value: "ask", label: "Ask" },
                { value: "deny", label: "Deny" },
              ]}
            />
            <button type="button" className="rule-remove" onClick={() => removeRule(index)} aria-label="Remove rule">
              <Trash2 size={14} />
            </button>
          </div>
        ))}
        {fieldError(errors, "task") ? <small className="form-error">{fieldError(errors, "task")}</small> : null}
        <button type="button" className="more-button" onClick={addRule}>
          <Plus size={14} /> Add subagent
        </button>
      </div>
    </Card>
    {ConfirmDialogElement}
    </>
  );
}

export function WorkspaceSection({ agent, update }: SectionProps) {
  const { requestConfirm, ConfirmDialogElement } = useConfirmAction();

  const addAllowed = () => update({ workspaceScope: { ...agent.workspaceScope, allowedPaths: [...agent.workspaceScope.allowedPaths, ""] } });
  const addDenied = () => update({ workspaceScope: { ...agent.workspaceScope, deniedPaths: [...agent.workspaceScope.deniedPaths, ""] } });
  const updateAllowed = (index: number, value: string) => update({ workspaceScope: { ...agent.workspaceScope, allowedPaths: agent.workspaceScope.allowedPaths.map((p, i) => (i === index ? value : p)) } });
  const updateDenied = (index: number, value: string) => update({ workspaceScope: { ...agent.workspaceScope, deniedPaths: agent.workspaceScope.deniedPaths.map((p, i) => (i === index ? value : p)) } });
  const removeAllowed = (index: number) => {
    const path = agent.workspaceScope.allowedPaths[index];
    requestConfirm(
      { title: "Remove allowed path", description: `Remove the allowed path "${path || "(empty)"}"? The agent will no longer have explicit access to this path.` },
      () => update({ workspaceScope: { ...agent.workspaceScope, allowedPaths: agent.workspaceScope.allowedPaths.filter((_, i) => i !== index) } }),
    );
  };
  const removeDenied = (index: number) => {
    const path = agent.workspaceScope.deniedPaths[index];
    requestConfirm(
      { title: "Remove denied path", description: `Remove the denied path "${path || "(empty)"}"? The agent will no longer be blocked from this path.` },
      () => update({ workspaceScope: { ...agent.workspaceScope, deniedPaths: agent.workspaceScope.deniedPaths.filter((_, i) => i !== index) } }),
    );
  };

  return (
    <>
    <Card>
      <div className="section-heading"><span>Workspace Scope</span><small>path-level access control</small></div>
      <FieldGroup title="Allowed paths">
        {agent.workspaceScope.allowedPaths.map((path, index) => (
          <div className="rule-list-row" key={`allowed-${index}`}>
            <input type="text" className="form-input" value={path} onChange={(event) => updateAllowed(index, event.target.value)} placeholder="src/**" />
            <button type="button" className="rule-remove" onClick={() => removeAllowed(index)} aria-label="Remove path"><Trash2 size={14} /></button>
          </div>
        ))}
        <button type="button" className="more-button" onClick={addAllowed}><Plus size={14} /> Add allowed path</button>
      </FieldGroup>
      <FieldGroup title="Denied paths">
        {agent.workspaceScope.deniedPaths.map((path, index) => (
          <div className="rule-list-row" key={`denied-${index}`}>
            <input type="text" className="form-input" value={path} onChange={(event) => updateDenied(index, event.target.value)} placeholder=".env" />
            <button type="button" className="rule-remove" onClick={() => removeDenied(index)} aria-label="Remove path"><Trash2 size={14} /></button>
          </div>
        ))}
        <button type="button" className="more-button" onClick={addDenied}><Plus size={14} /> Add denied path</button>
      </FieldGroup>
    </Card>
    {ConfirmDialogElement}
    </>
  );
}

export function ApprovalSection({ agent, update }: SectionProps) {
  return (
    <Card>
      <div className="section-heading"><span>Approval Policy</span><small>shortcuts that generate permissions</small></div>
      <div className="form-grid form-grid-two">
        <ToggleInput label="Require plan before edit" checked={agent.approvalPolicy.requirePlanBeforeEdit} onChange={(requirePlanBeforeEdit) => update({ approvalPolicy: { ...agent.approvalPolicy, requirePlanBeforeEdit } })} />
        <ToggleInput label="Approval before edit" checked={agent.approvalPolicy.requireUserApprovalBeforeEdit} onChange={(requireUserApprovalBeforeEdit) => update({ approvalPolicy: { ...agent.approvalPolicy, requireUserApprovalBeforeEdit } })} />
        <ToggleInput label="Approval before bash" checked={agent.approvalPolicy.requireUserApprovalBeforeBash} onChange={(requireUserApprovalBeforeBash) => update({ approvalPolicy: { ...agent.approvalPolicy, requireUserApprovalBeforeBash } })} />
        <ToggleInput label="Approval before install" checked={agent.approvalPolicy.requireUserApprovalBeforeInstall} onChange={(requireUserApprovalBeforeInstall) => update({ approvalPolicy: { ...agent.approvalPolicy, requireUserApprovalBeforeInstall } })} />
        <ToggleInput label="Approval before delete" checked={agent.approvalPolicy.requireUserApprovalBeforeDelete} onChange={(requireUserApprovalBeforeDelete) => update({ approvalPolicy: { ...agent.approvalPolicy, requireUserApprovalBeforeDelete } })} />
        <ToggleInput label="Approval before git push" checked={agent.approvalPolicy.requireUserApprovalBeforeGitPush} onChange={(requireUserApprovalBeforeGitPush) => update({ approvalPolicy: { ...agent.approvalPolicy, requireUserApprovalBeforeGitPush } })} />
      </div>
    </Card>
  );
}
