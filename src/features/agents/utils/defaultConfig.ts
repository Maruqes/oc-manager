import type { AgentSource } from "../types/agent.types";

export function isDefaultOpenCodeConfig(sourcePath: string, source?: AgentSource) {
  if (source && source !== "global") return false;

  const normalizedPath = sourcePath.replace(/\\/g, "/");
  return /(^~\/\.config\/opencode|\/\.config\/opencode|\/opencode)\/opencode\.jsonc?$/.test(normalizedPath);
}
