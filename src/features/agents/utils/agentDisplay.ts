import type { AgentType } from "../types/agent.types";

const agentTypeLabels: Record<AgentType, string> = {
  primary: "Primary",
  subagent: "Subagent",
  all: "All modes",
  unknown: "Unknown",
};

export function getAgentTypeLabel(type: AgentType) {
  return agentTypeLabels[type];
}
