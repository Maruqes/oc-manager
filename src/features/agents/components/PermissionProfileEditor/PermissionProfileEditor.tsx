import { useMemo, useState } from "react";
import { Plus, RotateCcw, Save, Trash2 } from "lucide-react";
import { Button } from "../../../../components/ui/Button";
import { Card } from "../../../../components/ui/Card";
import { Badge } from "../../../../components/ui/Badge";
import { CustomSelect } from "../../../../components/ui/CustomSelect";
import { FieldGroup, TextInput } from "../AgentEditor/FormInputs";
import { useConfirmAction } from "../../../../hooks/useConfirmAction";
import type { EditablePermissionProfile, EditablePermissionRule } from "../../../../../shared/types/editable-permission-profile.dto";
import type { PermissionValue } from "../../../../../shared/types/editable-agent.dto";

type PermissionProfileEditorProps = {
  profile: EditablePermissionProfile;
  onSave: (profile: EditablePermissionProfile) => void;
  onCancel: () => void;
  isSaving?: boolean;
};

const TOOL_OPTIONS = [
  { value: "read", label: "Read" },
  { value: "edit", label: "Edit / Write / Patch" },
  { value: "bash", label: "Bash" },
  { value: "glob", label: "Glob" },
  { value: "grep", label: "Grep" },
  { value: "list", label: "List" },
  { value: "webfetch", label: "Web Fetch" },
  { value: "websearch", label: "Web Search" },
  { value: "lsp", label: "LSP" },
  { value: "todowrite", label: "Todo Write" },
  { value: "question", label: "Question" },
  { value: "task", label: "Task" },
  { value: "doom_loop", label: "Doom Loop" },
  { value: "external_directory", label: "External Directory" },
  { value: "skill", label: "Skill" },
];

export function PermissionProfileEditor({ profile: initialProfile, onSave, onCancel, isSaving }: PermissionProfileEditorProps) {
  const [profile, setProfile] = useState<EditablePermissionProfile>(initialProfile);
  const { requestConfirm, ConfirmDialogElement } = useConfirmAction();

  const update = (updates: Partial<EditablePermissionProfile>) => setProfile((current) => ({ ...current, ...updates }));

  const handleSave = () => {
    onSave(profile);
  };

  const handleReset = () => setProfile(initialProfile);

  const addRule = () => {
    update({ rules: [...profile.rules, { tool: "bash", action: "ask" }] });
  };

  const removeRule = (index: number) => {
    const rule = profile.rules[index];
    requestConfirm(
      { title: "Remove permission rule", description: `Remove the "${rule.tool}" permission rule${rule.pattern ? ` for pattern "${rule.pattern}"` : ""}? This action cannot be undone.` },
      () => update({ rules: profile.rules.filter((_, i) => i !== index) }),
    );
  };

  const updateRule = (index: number, updates: Partial<EditablePermissionRule>) => {
    update({
      rules: profile.rules.map((rule, i) => (i === index ? { ...rule, ...updates } : rule)),
    });
  };

  const getActionTone = (action: string): "green" | "amber" | "red" | "slate" => {
    if (action === "allow") return "green";
    if (action === "ask") return "amber";
    if (action === "deny") return "red";
    return "slate";
  };

  return (
    <>
    <div className="details-stack">
      <Card className="hero-card">
        <div>
          <div className="eyebrow">Editing</div>
          <h1>{profile.name}</h1>
          <p>Source: {profile.sourcePath}</p>
        </div>
        <div className="hero-actions">
          <Button variant="ghost" onClick={handleReset}><RotateCcw size={15} /> Reset</Button>
          <Button variant="ghost" onClick={onCancel}>Cancel</Button>
          <Button variant="primary" onClick={handleSave} disabled={isSaving}>
            <Save size={15} /> {isSaving ? "Saving..." : "Save"}
          </Button>
        </div>
      </Card>

      <Card>
        <div className="section-heading">
          <span>Profile Info</span>
        </div>
        <div className="form-grid">
          <TextInput
            label="Name"
            value={profile.name}
            onChange={(name) => update({ name })}
            placeholder="custom-profile"
          />
          <div className="form-field">
            <span className="form-label">Source</span>
            <Badge tone={profile.source === "project" ? "blue" : "slate"}>{profile.source}</Badge>
          </div>
        </div>
      </Card>

      <Card>
        <div className="section-heading">
          <span>Permission Rules</span>
          <small>{profile.rules.length} rules</small>
        </div>
        <div className="rule-list">
          <div className="rule-list-header">
            <span>Tool</span>
            <span>Pattern (optional)</span>
            <span>Action</span>
            <span />
          </div>
          {profile.rules.map((rule, index) => (
            <div className="rule-list-row four-col" key={index}>
              <CustomSelect
                value={rule.tool}
                onChange={(tool) => updateRule(index, { tool })}
                options={TOOL_OPTIONS}
                searchable
              />
              <input
                type="text"
                className="form-input"
                value={rule.pattern ?? ""}
                onChange={(event) => updateRule(index, { pattern: event.target.value || undefined })}
                placeholder="*"
              />
              <CustomSelect
                value={rule.action}
                onChange={(action) => updateRule(index, { action: action as PermissionValue })}
                options={[
                  { value: "allow", label: "Allow" },
                  { value: "ask", label: "Ask" },
                  { value: "deny", label: "Deny" },
                ]}
              />
              <button type="button" className="rule-remove" onClick={() => removeRule(index)} aria-label="Remove rule">
                <Trash2 size={14} />
              </button>
            </div>
          ))}
          <button type="button" className="more-button" onClick={addRule}>
            <Plus size={14} /> Add rule
          </button>
        </div>
      </Card>
    </div>
    {ConfirmDialogElement}
    </>
  );
}
