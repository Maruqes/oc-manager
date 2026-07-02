import { useState } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import { RiskBadge } from "../../../components/common/RiskBadge";
import { Badge } from "../../../components/ui/Badge";
import type { PermissionRule } from "../types/agent.types";

type PermissionRulesListProps = {
  rules: PermissionRule[];
  idPrefix: string;
  initialLimit?: number;
};

export function PermissionRulesList({ rules, idPrefix, initialLimit = 10 }: PermissionRulesListProps) {
  const [expanded, setExpanded] = useState(false);
  const visibleRules = expanded ? rules : rules.slice(0, initialLimit);
  const hiddenCount = Math.max(0, rules.length - visibleRules.length);

  return (
    <div className="permission-list">
      {visibleRules.map((rule, index) => (
        <div className="permission-row" key={`${idPrefix}-${index}`}>
          <span><strong>{rule.tool}</strong>{rule.pattern ? <small> · {rule.pattern}</small> : null}</span>
          <Badge tone={rule.action === "allow" ? "green" : rule.action === "ask" ? "amber" : "red"}>{rule.action}</Badge>
          <RiskBadge risk={rule.risk} />
        </div>
      ))}
      {hiddenCount > 0 || expanded && rules.length > initialLimit ? (
        <button className="more-button" type="button" onClick={() => setExpanded((value) => !value)}>
          {expanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
          {expanded ? "Show less" : `More (${hiddenCount})`}
        </button>
      ) : null}
    </div>
  );
}
