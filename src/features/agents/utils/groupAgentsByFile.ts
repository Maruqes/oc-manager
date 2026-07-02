import type { Agent } from "../types/agent.types";

export type AgentFileGroup = {
  sourcePath: string;
  source: Agent["source"];
  agents: Agent[];
};

export function groupAgentsByFile(agents: Agent[]): AgentFileGroup[] {
  const groups = new Map<string, AgentFileGroup>();

  for (const agent of agents) {
    const key = agent.sourcePath;
    const existing = groups.get(key);
    if (existing) {
      existing.agents.push(agent);
    } else {
      groups.set(key, {
        sourcePath: agent.sourcePath,
        source: agent.source,
        agents: [agent],
      });
    }
  }

  return Array.from(groups.values()).sort((a, b) => a.sourcePath.localeCompare(b.sourcePath));
}

export function shortenPath(path: string): string {
  const segments = path.split("/");
  if (segments.length <= 2) return path;
  return `.../${segments.slice(-2).join("/")}`;
}
