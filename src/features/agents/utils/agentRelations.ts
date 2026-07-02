import type { Agent, InstructionSource, PermissionProfile } from "../types/agent.types";

export function isPermissionProfileRelatedToAgent(profile: PermissionProfile, agent: Agent) {
  if (profile.agentId === agent.id) return true;
  if (profile.kind === "global") return true;
  if (!agent.permissionProfile) return false;
  return profile.kind === "customProfile" && profile.name === `${agent.permissionProfile} Profile`;
}

export function isInstructionSourceRelatedToAgent(source: InstructionSource, agent: Agent) {
  return source.agentId === agent.id || source.agentId == null;
}
