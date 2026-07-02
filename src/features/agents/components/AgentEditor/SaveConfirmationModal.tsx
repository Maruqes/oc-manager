import { Save } from "lucide-react";
import { Button } from "../../../../components/ui/Button";
import { Modal } from "../../../../components/ui/Modal";
import type { AgentChange } from "../../utils/agentDiff";

type SaveConfirmationModalProps = {
  open: boolean;
  changes: AgentChange[];
  onCancel: () => void;
  onConfirm: () => void;
};

function truncate(value: string, maxLength: number = 120): string {
  if (value.length <= maxLength) return value;
  return value.slice(0, maxLength) + "...";
}

export function SaveConfirmationModal({ open, changes, onCancel, onConfirm }: SaveConfirmationModalProps) {
  return (
    <Modal open={open} onClose={onCancel} title="Confirm save" description={`${changes.length} change${changes.length !== 1 ? "s" : ""} will be applied.`} size="wide">
      <div className="diff-scroll-container">
        <div className="diff-list">
          {changes.map((change, index) => (
            <div className="diff-row" key={index}>
              <div className="diff-field">{change.field}</div>
              <div className="diff-values">
                <div className="diff-before">
                  <span className="diff-label">Before</span>
                  <span className="diff-value" title={change.before}>{truncate(change.before)}</span>
                </div>
                <div className="diff-after">
                  <span className="diff-label">After</span>
                  <span className="diff-value" title={change.after}>{truncate(change.after)}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
      <div className="modal-actions">
        <Button variant="ghost" onClick={onCancel}>Cancel</Button>
        <Button variant="primary" onClick={onConfirm}>
          <Save size={15} /> Save changes
        </Button>
      </div>
    </Modal>
  );
}
