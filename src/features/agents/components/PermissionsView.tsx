import { Pencil } from "lucide-react";
import { RiskBadge } from "../../../components/common/RiskBadge";
import { SourceBadge } from "../../../components/common/SourceBadge";
import { Badge } from "../../../components/ui/Badge";
import { Button } from "../../../components/ui/Button";
import { Card } from "../../../components/ui/Card";
import { useAgentsStore } from "../store/agentsStore";
import { dedupeEquivalentProfiles } from "../utils/permissionDisplay";
import { PermissionRulesList } from "./PermissionRulesList";
import { RawJsonViewer } from "./RawJsonViewer";
import { PermissionProfileEditorWrapper } from "./PermissionProfileEditor/PermissionProfileEditorWrapper";
import { isDefaultOpenCodeConfig } from "../utils/defaultConfig";

const knownPermissions = [
  ["read", "Reads files. Defaults allow, with env files denied by OpenCode defaults."],
  ["edit", "All file modifications: edit, write and apply_patch."],
  ["glob", "File discovery by glob pattern."],
  ["grep", "Content search by regex."],
  ["list", "Directory listing."],
  ["bash", "Shell commands; object rules match command patterns."],
  ["task", "Launch subagents; object rules match agent names."],
  ["external_directory", "Access outside the project worktree. Defaults ask."],
  ["todowrite", "Todo management."],
  ["question", "Ask the user questions."],
  ["webfetch", "Fetch a known URL."],
  ["websearch", "Search the web."],
  ["lsp", "Language-server/code-intelligence operations."],
  ["skill", "Load agent skills."],
  ["doom_loop", "Repeated identical tool-call guard. Defaults ask."],
] as const;

export function PermissionsView() {
  const { permissionProfiles, agents, startEditingProfile, editingPermissionProfile } = useAgentsStore();
  const visibleProfiles = dedupeEquivalentProfiles(permissionProfiles, agents);

  if (editingPermissionProfile) {
    return <PermissionProfileEditorWrapper />;
  }

  if (permissionProfiles.length === 0) {
    return <Card className="empty-state">No permissions found in discovered OpenCode config.</Card>;
  }

  return (
    <div className="details-stack">
      <Card className="hero-card compact-hero">
        <div>
          <div className="eyebrow">Permission profiles</div>
          <h1>Permissions</h1>
          <p>Derived from global <code>permission</code>, custom <code>permission_profiles</code>, agent overrides, effective permissions and deprecated <code>tools</code>.</p>
        </div>
      </Card>

      <Card>
        <div className="section-heading"><span>OpenCode permission keys</span><small>defaults and possible capabilities</small></div>
        <div className="capability-grid">
          {knownPermissions.map(([key, description]) => (
            <div className="capability-item" key={key}>
              <code>{key}</code>
              <span>{description}</span>
            </div>
          ))}
        </div>
      </Card>

      {visibleProfiles.map((profile) => {
        const linkedAgent = agents.find((agent) => agent.id === profile.agentId);
        const isReadOnlyDefaultConfig = isDefaultOpenCodeConfig(profile.sourcePath, profile.source);
        return (
          <Card key={profile.id}>
            <div className="section-heading">
              <span>{profile.name}</span>
              <span className="inline-badges">
                <Badge tone={profile.kind === "legacyTools" ? "amber" : profile.kind === "effective" ? "blue" : profile.kind === "customProfile" ? "violet" : "slate"}>{profile.kind}</Badge>
                <SourceBadge source={profile.source} />
                <RiskBadge risk={profile.risk} />
                {isReadOnlyDefaultConfig ? <Badge tone="amber">read-only</Badge> : null}
                <Button variant="ghost" onClick={() => startEditingProfile(profile)} disabled={isReadOnlyDefaultConfig} title={isReadOnlyDefaultConfig ? "Default OpenCode config is read-only" : "Edit permission profile"}>
                  <Pencil size={14} /> Edit
                </Button>
              </span>
            </div>
            {linkedAgent ? <p className="muted small">Agent: {linkedAgent.name}</p> : null}
            <PermissionRulesList rules={profile.rules} idPrefix={profile.id} />
            <RawJsonViewer value={profile.rawConfig} />
          </Card>
        );
      })}
    </div>
  );
}
