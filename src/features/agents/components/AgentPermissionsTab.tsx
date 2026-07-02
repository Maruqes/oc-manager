import { Pencil } from "lucide-react";
import { RiskBadge } from "../../../components/common/RiskBadge";
import { Badge } from "../../../components/ui/Badge";
import { Button } from "../../../components/ui/Button";
import { Card } from "../../../components/ui/Card";
import type { Agent } from "../types/agent.types";
import { useAgentsStore } from "../store/agentsStore";
import { isPermissionProfileRelatedToAgent } from "../utils/agentRelations";
import { dedupeEquivalentProfiles } from "../utils/permissionDisplay";
import { PermissionRulesList } from "./PermissionRulesList";

function renderPermissionValue(value: unknown) {
  if (value === null || value === undefined) return "—";
  if (Array.isArray(value)) return value.join(", ");
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}

export function AgentPermissionsTab({ agent }: { agent: Agent }) {
  const { permissionProfiles, agents, startEditingProfile } = useAgentsStore();
  const relatedProfiles = dedupeEquivalentProfiles(
    permissionProfiles.filter((profile) => isPermissionProfileRelatedToAgent(profile, agent)),
    agents,
  );

  return (
    <div className="details-stack compact-stack">
      <Card>
        <div className="section-heading">
          <span>Permission summary</span>
          <span className="inline-badges">
            {agent.permissionProfile ? <Badge tone="blue">profile: {agent.permissionProfile}</Badge> : null}
            <small>{agent.permissions.length} direct entries</small>
          </span>
        </div>
        <div className="permission-list">
          {agent.permissions.length === 0 ? <p className="muted small">No direct permission entries on this agent.</p> : null}
          {agent.permissions.map((permission) => (
            <div className="permission-row" key={permission.key}>
              <span>{permission.key}</span>
              <code>{renderPermissionValue(permission.value)}</code>
              <RiskBadge risk={permission.risk} />
            </div>
          ))}
        </div>
      </Card>

      {relatedProfiles.map((profile) => (
        <Card key={profile.id}>
          <div className="section-heading">
            <span>{profile.name}</span>
            <span className="inline-badges">
              <Badge tone={profile.kind === "effective" ? "blue" : profile.kind === "customProfile" ? "violet" : "slate"}>{profile.kind}</Badge>
              <RiskBadge risk={profile.risk} />
              <Button variant="ghost" onClick={() => startEditingProfile(profile)}>
                <Pencil size={14} /> Edit
              </Button>
            </span>
          </div>
          <PermissionRulesList rules={profile.rules} idPrefix={profile.id} />
        </Card>
      ))}
    </div>
  );
}
