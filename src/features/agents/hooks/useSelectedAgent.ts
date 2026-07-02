import { useAgentsStore } from "../store/agentsStore";

export function useSelectedAgent() {
  return useAgentsStore((state) =>
    state.agents.find((agent) => agent.id === state.selectedAgentId),
  );
}
