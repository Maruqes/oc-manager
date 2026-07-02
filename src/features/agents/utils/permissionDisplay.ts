import type { Agent, PermissionProfile, PermissionRule } from "../types/agent.types";

export function permissionRulesSignature(rules: PermissionRule[]) {
  return rules
    .map((rule) => `${rule.tool}\u0000${rule.pattern ?? ""}\u0000${rule.action}`)
    .sort()
    .join("\u0001");
}

export function dedupeEquivalentProfiles(profiles: PermissionProfile[], agents: Agent[]) {
  return profiles.filter((profile) => {
    if (profile.kind !== "effective") return true;

    const agent = agents.find((item) => item.id === profile.agentId);
    if (!agent?.permissionProfile) return true;

    const customProfile = profiles.find(
      (candidate) =>
        candidate.kind === "customProfile" &&
        candidate.name === `${agent.permissionProfile} Profile` &&
        permissionRulesSignature(candidate.rules) === permissionRulesSignature(profile.rules),
    );

    return !customProfile;
  });
}
