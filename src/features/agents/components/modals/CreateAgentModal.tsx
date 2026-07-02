import { useState } from "react";
import { Modal } from "../../../../components/ui/Modal";
import { Button } from "../../../../components/ui/Button";

type CreateAgentModalProps = {
  open: boolean;
  onClose: () => void;
  onConfirm: (name: string) => void;
  sourcePath: string;
};

const NAME_PATTERN = /^[a-z0-9-]+$/;

function validateName(name: string): string | null {
  const trimmed = name.trim();
  if (!trimmed) return "Name is required.";
  if (trimmed.length < 2) return "Name must be at least 2 characters.";
  if (trimmed.length > 50) return "Name must be at most 50 characters.";
  if (!NAME_PATTERN.test(trimmed)) {
    return "Lowercase letters, numbers, and hyphens only. No spaces or accents.";
  }
  return null;
}

export function CreateAgentModal({ open, onClose, onConfirm, sourcePath }: CreateAgentModalProps) {
  const [name, setName] = useState("");
  const [touched, setTouched] = useState(false);

  const trimmedName = name.trim();
  const error = validateName(trimmedName);
  const hasError = touched && error !== null;

  const handleSubmit = () => {
    setTouched(true);
    if (error) return;
    onConfirm(trimmedName);
    setName("");
    setTouched(false);
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Enter") {
      event.preventDefault();
      handleSubmit();
    }
  };

  const handleClose = () => {
    setName("");
    setTouched(false);
    onClose();
  };

  const displayPath = sourcePath.split("/").slice(-2).join("/");

  return (
    <Modal
      open={open}
      onClose={handleClose}
      title="Create new agent"
      description={`Add a new agent to ${displayPath}`}
    >
      <div className="modal-form">
        <label className="form-field">
          <span className="form-label">Agent name</span>
          <input
            type="text"
            className={`form-input ${hasError ? "form-input-error" : ""}`}
            value={name}
            onChange={(event) => setName(event.target.value)}
            onBlur={() => setTouched(true)}
            onKeyDown={handleKeyDown}
            placeholder="reviewer"
            autoFocus
            spellCheck={false}
          />
          <span className="form-hint">
            Lowercase letters, numbers, and hyphens only. No spaces or accents.
          </span>
          {hasError ? <span className="form-error">{error}</span> : null}
        </label>

        <div className="modal-actions">
          <Button variant="ghost" onClick={handleClose}>Cancel</Button>
          <Button variant="primary" onClick={handleSubmit}>Create agent</Button>
        </div>
      </div>
    </Modal>
  );
}
