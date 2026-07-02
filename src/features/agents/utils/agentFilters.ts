import type { Agent, AgentType } from "../types/agent.types";

export type AgentFilter = AgentType | "any";

export function filterAgents(agents: Agent[], filter: AgentFilter, search: string) {
  const normalizedSearch = search.trim().toLowerCase();

  return agents.filter((agent) => {
    const matchesType = filter === "any" || agent.type === filter;
    const matchesSearch =
      normalizedSearch.length === 0 ||
      agent.name.toLowerCase().includes(normalizedSearch) ||
      agent.description?.toLowerCase().includes(normalizedSearch);

    return matchesType && matchesSearch;
  });
}
