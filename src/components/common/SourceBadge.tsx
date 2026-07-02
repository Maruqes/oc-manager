import { Badge } from "../ui/Badge";
import type { AgentSource } from "../../features/agents/types/agent.types";

export function SourceBadge({ source }: { source: AgentSource }) {
  return <Badge tone={source === "global" ? "blue" : "green"}>{source === "global" ? "global" : "project"}</Badge>;
}
