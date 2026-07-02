import type { EditableAgent } from "../../../../shared/types/editable-agent.dto";
import { PERMISSION_LABELS } from "../../../../shared/types/editable-agent.dto";

export type AgentChange = {
  field: string;
  before: string;
  after: string;
};

function formatValue(value: unknown): string {
  if (value === undefined || value === null) return "(not set)";
  if (typeof value === "boolean") return value ? "Yes" : "No";
  if (typeof value === "number") return String(value);
  if (typeof value === "string") return value.length > 0 ? value : "(empty)";
  if (Array.isArray(value)) {
    if (value.length === 0) return "(empty)";
    return JSON.stringify(value);
  }
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}

function comparePrimitive(label: string, before: unknown, after: unknown, changes: AgentChange[]) {
  const beforeStr = formatValue(before);
  const afterStr = formatValue(after);
  if (beforeStr !== afterStr) {
    changes.push({ field: label, before: beforeStr, after: afterStr });
  }
}

function compareStringArray(label: string, before: string[], after: string[], changes: AgentChange[]) {
  const beforeJson = JSON.stringify(before);
  const afterJson = JSON.stringify(after);
  if (beforeJson !== afterJson) {
    changes.push({ field: label, before: formatValue(before), after: formatValue(after) });
  }
}

export function computeAgentChanges(before: EditableAgent, after: EditableAgent): AgentChange[] {
  const changes: AgentChange[] = [];

  comparePrimitive("Name", before.name, after.name, changes);
  comparePrimitive("Description", before.description, after.description, changes);
  comparePrimitive("Enabled", before.enabled, after.enabled, changes);
  comparePrimitive("Mode", before.mode, after.mode, changes);

  const beforeModel = `${before.provider}/${before.model}`;
  const afterModel = `${after.provider}/${after.model}`;
  comparePrimitive("Model", beforeModel, afterModel, changes);
  comparePrimitive("Variant", before.variant, after.variant, changes);

  comparePrimitive("Temperature", before.temperature, after.temperature, changes);
  comparePrimitive("Top P", before.topP ?? 1, after.topP ?? 1, changes);
  comparePrimitive("Steps", before.steps, after.steps, changes);
  comparePrimitive("Prompt", before.prompt, after.prompt, changes);

  comparePrimitive("Color", before.ui.color ?? "primary", after.ui.color ?? "primary", changes);
  comparePrimitive("Hidden", before.ui.hidden ?? false, after.ui.hidden ?? false, changes);

  for (const key of Object.keys(before.simplePermissions) as Array<keyof typeof before.simplePermissions>) {
    const label = PERMISSION_LABELS[key] ?? key;
    comparePrimitive(`Permission: ${label}`, before.simplePermissions[key], after.simplePermissions[key], changes);
  }

  comparePrimitive("Bash policy default", before.bashPolicy.default, after.bashPolicy.default, changes);
  comparePrimitive("Bash rules", before.bashPolicy.rules, after.bashPolicy.rules, changes);

  comparePrimitive("Task policy default", before.taskPolicy.default, after.taskPolicy.default, changes);
  comparePrimitive("Task rules", before.taskPolicy.rules, after.taskPolicy.rules, changes);

  compareStringArray("Allowed paths", before.workspaceScope.allowedPaths, after.workspaceScope.allowedPaths, changes);
  compareStringArray("Denied paths", before.workspaceScope.deniedPaths, after.workspaceScope.deniedPaths, changes);

  comparePrimitive("Require plan before edit", before.approvalPolicy.requirePlanBeforeEdit, after.approvalPolicy.requirePlanBeforeEdit, changes);
  comparePrimitive("Approval before edit", before.approvalPolicy.requireUserApprovalBeforeEdit, after.approvalPolicy.requireUserApprovalBeforeEdit, changes);
  comparePrimitive("Approval before bash", before.approvalPolicy.requireUserApprovalBeforeBash, after.approvalPolicy.requireUserApprovalBeforeBash, changes);
  comparePrimitive("Approval before install", before.approvalPolicy.requireUserApprovalBeforeInstall, after.approvalPolicy.requireUserApprovalBeforeInstall, changes);
  comparePrimitive("Approval before delete", before.approvalPolicy.requireUserApprovalBeforeDelete, after.approvalPolicy.requireUserApprovalBeforeDelete, changes);
  comparePrimitive("Approval before git push", before.approvalPolicy.requireUserApprovalBeforeGitPush, after.approvalPolicy.requireUserApprovalBeforeGitPush, changes);

  comparePrimitive("Max steps", before.limits.maxSteps, after.limits.maxSteps, changes);
  comparePrimitive("Max runtime (s)", before.limits.maxRuntimeSeconds, after.limits.maxRuntimeSeconds, changes);
  comparePrimitive("Max cost (EUR)", before.limits.maxCostEur, after.limits.maxCostEur, changes);

  comparePrimitive("Permission profile", before.permissionProfile, after.permissionProfile, changes);

  return changes;
}
