import { useMemo, useState } from "react";
import { ChevronDown, ChevronRight, RotateCcw, Save } from "lucide-react";
import { Button } from "../../../../components/ui/Button";
import { Card } from "../../../../components/ui/Card";
import { RawJsonViewer } from "../RawJsonViewer";
import { editableToOpenCodeAgent } from "../../../../../shared/utils/agentConversion";
import { validateAgent } from "../../../../../shared/utils/agentValidation";
import type { EditableAgent } from "../../../../../shared/types/editable-agent.dto";
import { computeAgentChanges, type AgentChange } from "../../utils/agentDiff";
import { SaveConfirmationModal } from "./SaveConfirmationModal";
import {
  ApprovalSection,
  BashPolicySection,
  IdentitySection,
  ModelSection,
  PermissionsSection,
  PromptSection,
  TaskPolicySection,
  WorkspaceSection,
} from "./EditorSections";

type AgentEditorProps = {
  agent: EditableAgent;
  onSave: (agent: EditableAgent) => void;
  onCancel: () => void;
  isSaving?: boolean;
  isCreating?: boolean;
};

export function AgentEditor({ agent: initialAgent, onSave, onCancel, isSaving, isCreating }: AgentEditorProps) {
  const [agent, setAgent] = useState<EditableAgent>(initialAgent);
  const [showPreview, setShowPreview] = useState(false);
  const [pendingChanges, setPendingChanges] = useState<AgentChange[] | null>(null);

  const validation = useMemo(() => validateAgent(agent), [agent]);
  const openCodeConfig = useMemo(() => editableToOpenCodeAgent(agent), [agent]);

  const update = (updates: Partial<EditableAgent>) => setAgent((current) => ({ ...current, ...updates }));

  const handleSave = () => {
    if (!validation.valid) return;
    const changes = computeAgentChanges(initialAgent, agent);
    if (changes.length === 0) {
      onSave(agent);
      return;
    }
    setPendingChanges(changes);
  };

  const handleConfirmSave = () => {
    setPendingChanges(null);
    onSave(agent);
  };

  const handleReset = () => setAgent(initialAgent);

  return (
    <div className="details-stack">
      <Card className="hero-card">
        <div>
          <div className="eyebrow">{isCreating ? "Creating" : "Editing"}</div>
          <h1>{agent.name || "New agent"}</h1>
          <p>Source: {agent.sourcePath}</p>
        </div>
        <div className="hero-actions">
          <Button variant="ghost" onClick={handleReset}><RotateCcw size={15} /> Reset</Button>
          <Button variant="ghost" onClick={onCancel}>Cancel</Button>
          <Button variant="primary" onClick={handleSave} disabled={!validation.valid || isSaving}>
            <Save size={15} /> {isSaving ? "Saving..." : "Save"}
          </Button>
        </div>
      </Card>

      {validation.errors.length > 0 ? (
        <Card className="validation-errors">
          <div className="section-heading"><span>Validation errors</span></div>
          <ul className="error-list">
            {validation.errors.map((error) => (
              <li key={`${error.field}-${error.message}`} className="error-text">{error.field}: {error.message}</li>
            ))}
          </ul>
        </Card>
      ) : null}

      <IdentitySection agent={agent} update={update} errors={validation.errors} />
      <ModelSection agent={agent} update={update} errors={validation.errors} />
      <PromptSection agent={agent} update={update} errors={validation.errors} />
      <PermissionsSection agent={agent} update={update} errors={validation.errors} />
      <BashPolicySection agent={agent} update={update} errors={validation.errors} />
      <TaskPolicySection agent={agent} update={update} errors={validation.errors} />
      <WorkspaceSection agent={agent} update={update} errors={validation.errors} />
      <ApprovalSection agent={agent} update={update} errors={validation.errors} />

      <Card>
        <button type="button" className="preview-toggle" onClick={() => setShowPreview((value) => !value)}>
          {showPreview ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
          Preview OpenCode config
        </button>
        {showPreview ? (
          <>
            <p className="muted small">This is what will be written to the agent entry in the config file:</p>
            <RawJsonViewer value={{ [agent.name]: openCodeConfig }} />
          </>
        ) : null}
      </Card>

      <SaveConfirmationModal
        open={pendingChanges !== null}
        changes={pendingChanges ?? []}
        onCancel={() => setPendingChanges(null)}
        onConfirm={handleConfirmSave}
      />
    </div>
  );
}
