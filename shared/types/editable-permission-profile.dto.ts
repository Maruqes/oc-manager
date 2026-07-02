import type { PermissionValue } from "./editable-agent.dto";

export type EditablePermissionRule = {
  tool: string;
  pattern?: string;
  action: PermissionValue;
};

export type EditablePermissionProfile = {
  id: string;
  name: string;
  source: "project" | "global";
  sourcePath: string;
  rules: EditablePermissionRule[];
  version: number;
};
