import { Badge } from "../../../../components/ui/Badge";
import { Card } from "../../../../components/ui/Card";
import type { TaskPolicy } from "../../../../../shared/types/editable-agent.dto";

function getActionTone(action: string): "green" | "amber" | "red" | "slate" {
  if (action === "allow") return "green";
  if (action === "ask") return "amber";
  if (action === "deny") return "red";
  return "slate";
}

export function TaskPolicyView({ policy }: { policy: TaskPolicy }) {
  const hasRules = policy.rules.length > 0;

  return (
    <Card>
      <div className="section-heading">
        <span>Task Policy</span>
        <small>subagent access control</small>
      </div>
      <div className="status-row">
        <span>Default action</span>
        <Badge tone={getActionTone(policy.default)}>{policy.default}</Badge>
      </div>
      {hasRules ? (
        <div className="rule-list">
          <div className="rule-list-header view-header">
            <span>Agent</span>
            <span>Action</span>
          </div>
          {policy.rules.map((rule, index) => (
            <div className="rule-list-row view-row" key={index}>
              <code>{rule.agentName || "(empty)"}</code>
              <Badge tone={getActionTone(rule.action)}>{rule.action}</Badge>
            </div>
          ))}
        </div>
      ) : (
        <p className="muted small">No specific subagent rules defined.</p>
      )}
    </Card>
  );
}
