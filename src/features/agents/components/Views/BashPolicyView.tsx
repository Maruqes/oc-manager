import { Badge } from "../../../../components/ui/Badge";
import { Card } from "../../../../components/ui/Card";
import type { BashPolicy } from "../../../../../shared/types/editable-agent.dto";

function getActionTone(action: string): "green" | "amber" | "red" | "slate" {
  if (action === "allow") return "green";
  if (action === "ask") return "amber";
  if (action === "deny") return "red";
  return "slate";
}

export function BashPolicyView({ policy }: { policy: BashPolicy }) {
  const hasRules = policy.rules.length > 0;

  return (
    <Card>
      <div className="section-heading">
        <span>Bash Policy</span>
        <small>command-level rules</small>
      </div>
      <div className="status-row">
        <span>Default action</span>
        <Badge tone={getActionTone(policy.default)}>{policy.default}</Badge>
      </div>
      {hasRules ? (
        <div className="rule-list">
          <div className="rule-list-header view-header">
            <span>Pattern</span>
            <span>Action</span>
          </div>
          {policy.rules.map((rule, index) => (
            <div className="rule-list-row view-row" key={index}>
              <code>{rule.pattern || "(empty)"}</code>
              <Badge tone={getActionTone(rule.action)}>{rule.action}</Badge>
            </div>
          ))}
        </div>
      ) : (
        <p className="muted small">No specific rules defined.</p>
      )}
    </Card>
  );
}
