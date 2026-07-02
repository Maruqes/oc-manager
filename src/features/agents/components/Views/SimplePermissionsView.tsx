import { Badge } from "../../../../components/ui/Badge";
import { Card } from "../../../../components/ui/Card";
import type { SimplePermissions } from "../../../../../shared/types/editable-agent.dto";
import { PERMISSION_KEYS, PERMISSION_LABELS } from "../../../../../shared/types/editable-agent.dto";

function getActionTone(action: string | undefined): "green" | "amber" | "red" | "slate" {
  if (action === "allow") return "green";
  if (action === "ask") return "amber";
  if (action === "deny") return "red";
  return "slate";
}

export function SimplePermissionsView({ permissions }: { permissions: SimplePermissions }) {
  const hasAny = PERMISSION_KEYS.some((key) => permissions[key]);

  return (
    <Card>
      <div className="section-heading">
        <span>Tool Permissions</span>
        <small>global tool access</small>
      </div>
      {hasAny ? (
        <div className="permission-grid">
          {PERMISSION_KEYS.map((key) => {
            const value = permissions[key];
            if (!value) return null;
            return (
              <div className="status-row" key={key}>
                <span>{PERMISSION_LABELS[key]}</span>
                <Badge tone={getActionTone(value)}>{value}</Badge>
              </div>
            );
          })}
        </div>
      ) : (
        <p className="muted small">No tool permissions defined.</p>
      )}
    </Card>
  );
}
