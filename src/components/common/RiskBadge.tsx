import { Badge } from "../ui/Badge";
import type { RiskLevel } from "../../features/agents/types/agent.types";

const riskCopy: Record<RiskLevel, string> = {
  low: "low risk",
  medium: "medium risk",
  high: "high risk",
};

export function RiskBadge({ risk }: { risk: RiskLevel }) {
  const tone = risk === "high" ? "red" : risk === "medium" ? "amber" : "green";
  return <Badge tone={tone}>{riskCopy[risk]}</Badge>;
}
