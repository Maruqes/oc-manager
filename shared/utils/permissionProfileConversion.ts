import type { PermissionProfileDto } from "../types/agent.dto";
import type { EditablePermissionProfile, EditablePermissionRule } from "../types/editable-permission-profile.dto";
import type { PermissionValue } from "../types/editable-agent.dto";

export function permissionProfileToEditable(profile: PermissionProfileDto): EditablePermissionProfile {
  const rules: EditablePermissionRule[] = profile.rules.map((rule) => ({
    tool: rule.tool,
    pattern: rule.pattern ?? undefined,
    action: rule.action as PermissionValue,
  }));

  return {
    id: profile.id,
    name: profile.name,
    source: profile.source,
    sourcePath: profile.sourcePath,
    rules,
    version: 1,
  };
}

export function editableToPermissionProfileConfig(profile: EditablePermissionProfile): Record<string, unknown> {
  const permission: Record<string, unknown> = {};

  for (const rule of profile.rules) {
    const key = rule.tool;
    const existing = permission[key];

    if (!existing) {
      if (rule.pattern) {
        permission[key] = { [rule.pattern]: rule.action };
      } else {
        permission[key] = rule.action;
      }
    } else if (typeof existing === "string") {
      if (rule.pattern) {
        permission[key] = { "*": existing, [rule.pattern]: rule.action };
      } else {
        permission[key] = rule.action;
      }
    } else if (typeof existing === "object") {
      const obj = existing as Record<string, unknown>;
      if (rule.pattern) {
        permission[key] = { ...obj, [rule.pattern]: rule.action };
      } else {
        permission[key] = rule.action;
      }
    }
  }

  return permission;
}
