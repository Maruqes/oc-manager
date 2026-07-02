import { useMemo } from "react";
import { AlertTriangle, Cpu, FileText, Pencil, Palette, Route, ShieldCheck, SlidersHorizontal } from "lucide-react";
import { Badge } from "../../../components/ui/Badge";
import { Button } from "../../../components/ui/Button";
import { Card } from "../../../components/ui/Card";
import { RiskBadge } from "../../../components/common/RiskBadge";
import { SourceBadge } from "../../../components/common/SourceBadge";
import { useSelectedAgent } from "../hooks/useSelectedAgent";
import { getAgentTypeLabel } from "../utils/agentDisplay";
import { AgentInstructionsTab } from "./AgentInstructionsTab";
import { AgentPermissionsTab } from "./AgentPermissionsTab";
import { AgentEditor } from "./AgentEditor/AgentEditor";
import { RawJsonViewer } from "./RawJsonViewer";
import { useAgentsStore } from "../store/agentsStore";
import { isInstructionSourceRelatedToAgent, isPermissionProfileRelatedToAgent } from "../utils/agentRelations";
import { createAgent, saveAgent, scanAgents } from "../api/agentsApi";
import { agentToEditable } from "../../../../shared/utils/agentConversion";
import { BashPolicyView } from "./Views/BashPolicyView";
import { TaskPolicyView } from "./Views/TaskPolicyView";
import { WorkspaceScopeView } from "./Views/WorkspaceScopeView";
import { ApprovalPolicyView } from "./Views/ApprovalPolicyView";
import { SimplePermissionsView } from "./Views/SimplePermissionsView";
import { PermissionProfileEditorWrapper } from "./PermissionProfileEditor/PermissionProfileEditorWrapper";

export function AgentDetails() {
  const agent = useSelectedAgent();
  const { permissionProfiles, instructionSources, editingAgent, isCreatingAgent, isSaving, startEditing, stopEditing, setSaving, setSaveError, selectAgent, scanProjectRoot, setScanResult, setLoading, setError, editingPermissionProfile } = useAgentsStore();

  const editableAgent = useMemo(() => (agent ? agentToEditable(agent) : null), [agent]);

  const reloadAndSelect = async (name: string, sourcePath: string) => {
    setLoading(true);
    setError(undefined);
    try {
      const result = await scanAgents(scanProjectRoot ?? null);
      setScanResult(result, scanProjectRoot ?? null);
      const matched = result.agents.find((a) => a.name === name && a.sourcePath === sourcePath);
      if (matched) {
        selectAgent(matched.id);
      }
    } catch (error) {
      setError(error instanceof Error ? error.message : "Failed to reload agents");
    } finally {
      setLoading(false);
    }
  };

  if (editingPermissionProfile) {
    return <PermissionProfileEditorWrapper />;
  }

  if (editingAgent) {
    const handleSave = async (updated: typeof editingAgent) => {
      setSaving(true);
      setSaveError(undefined);
      try {
        const result = isCreatingAgent ? await createAgent(updated) : await saveAgent(updated);
        if (result.success) {
          stopEditing();
          await reloadAndSelect(updated.name, updated.sourcePath);
        } else {
          setSaveError(result.errors.join("\n"));
        }
      } catch (error) {
        setSaveError(error instanceof Error ? error.message : "Failed to save agent");
      } finally {
        setSaving(false);
      }
    };

    return <AgentEditor agent={editingAgent} onSave={handleSave} onCancel={stopEditing} isSaving={isSaving} isCreating={isCreatingAgent} />;
  }

  if (!agent) {
    return <Card className="empty-state">Select an agent to start.</Card>;
  }

  const agentProfiles = permissionProfiles.filter((profile) => isPermissionProfileRelatedToAgent(profile, agent));
  const agentInstructionSources = instructionSources.filter((source) => isInstructionSourceRelatedToAgent(source, agent));

  return (
    <div className="details-stack">
      <Card className="hero-card">
        <div>
          <div className="eyebrow">{getAgentTypeLabel(agent.type)}</div>
          <h1>{agent.name}</h1>
          <p>{agent.description}</p>
        </div>
        <div className="hero-actions">
          <Button variant="primary" onClick={() => startEditing(agent)}>
            <Pencil size={15} /> Edit
          </Button>
        </div>
      </Card>

      <div className="hero-badges">
        <Badge tone={agent.type === "primary" ? "violet" : agent.type === "subagent" ? "green" : "slate"}>{getAgentTypeLabel(agent.type)}</Badge>
        {agent.disabled ? <Badge tone="red">disabled</Badge> : null}
        {agent.hidden ? <Badge tone="amber">hidden</Badge> : null}
        <SourceBadge source={agent.source} />
        <RiskBadge risk={agent.risk} />
      </div>

      <div className="metric-grid">
        <Card><Cpu size={18} /><span>Model</span><strong>{agent.effectiveModel ?? agent.model ?? "inherited"}</strong><small>{agent.modelSource}</small></Card>
        <Card><FileText size={18} /><span>Source</span><strong>{agent.sourcePath}</strong></Card>
        <Card><ShieldCheck size={18} /><span>Profiles</span><strong>{agentProfiles.length}</strong></Card>
        <Card><AlertTriangle size={18} /><span>Validation</span><strong>{agent.validationErrors.length || "OK"}</strong></Card>
      </div>

      <div className="metric-grid">
        <Card><Route size={18} /><span>Mode</span><strong>{agent.mode ?? agent.type}</strong></Card>
        <Card><SlidersHorizontal size={18} /><span>Steps</span><strong>{agent.steps ?? "default"}</strong><small>temp {agent.temperature ?? "default"} · top_p {agent.topP ?? "default"}</small></Card>
        <Card><Palette size={18} /><span>Color</span><strong>{agent.color ?? "default"}</strong></Card>
        <Card><FileText size={18} /><span>Instruction sources</span><strong>{agentInstructionSources.length}</strong></Card>
      </div>

      {agent.permissionProfile || agent.commands.length > 0 ? (
        <Card>
          <div className="section-heading"><span>Agent wiring</span></div>
          {agent.permissionProfile ? <div className="status-row"><span>Permission profile</span><strong>{agent.permissionProfile}</strong></div> : null}
          {agent.commands.length > 0 ? <div className="status-row"><span>Commands</span><strong>{agent.commands.map((command) => `/${command}`).join(", ")}</strong></div> : null}
        </Card>
      ) : null}

      <AgentInstructionsTab agent={agent} />
      <AgentPermissionsTab agent={agent} />
      {editableAgent ? (
        <>
          <SimplePermissionsView permissions={editableAgent.simplePermissions} />
          <BashPolicyView policy={editableAgent.bashPolicy} />
          <TaskPolicyView policy={editableAgent.taskPolicy} />
          <WorkspaceScopeView scope={editableAgent.workspaceScope} />
          <ApprovalPolicyView policy={editableAgent.approvalPolicy} />
        </>
      ) : null}
      <RawJsonViewer value={agent.rawConfig} />
    </div>
  );
}
