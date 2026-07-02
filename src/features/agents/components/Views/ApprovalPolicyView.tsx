import { Badge } from "../../../../components/ui/Badge";
import { Card } from "../../../../components/ui/Card";
import type { ApprovalPolicy } from "../../../../../shared/types/editable-agent.dto";

export function ApprovalPolicyView({ policy }: { policy: ApprovalPolicy }) {
  const items = [
    { label: "Require plan before edit", value: policy.requirePlanBeforeEdit },
    { label: "Approval before edit", value: policy.requireUserApprovalBeforeEdit },
    { label: "Approval before bash", value: policy.requireUserApprovalBeforeBash },
    { label: "Approval before install", value: policy.requireUserApprovalBeforeInstall },
    { label: "Approval before delete", value: policy.requireUserApprovalBeforeDelete },
    { label: "Approval before git push", value: policy.requireUserApprovalBeforeGitPush },
  ];

  const hasAnyEnabled = items.some((item) => item.value);

  return (
    <Card>
      <div className="section-heading">
        <span>Approval Policy</span>
        <small>approval shortcuts</small>
      </div>
      {hasAnyEnabled ? (
        <div className="approval-list">
          {items.map((item) => (
            <div className="status-row" key={item.label}>
              <span>{item.label}</span>
              <Badge tone={item.value ? "green" : "slate"}>{item.value ? "enabled" : "disabled"}</Badge>
            </div>
          ))}
        </div>
      ) : (
        <p className="muted small">No approval policies enabled.</p>
      )}
    </Card>
  );
}
