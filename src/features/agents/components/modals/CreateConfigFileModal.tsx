import { useState } from "react";
import { Modal } from "../../../../components/ui/Modal";
import { Button } from "../../../../components/ui/Button";

type CreateConfigFileModalProps = {
  open: boolean;
  onClose: () => void;
  onConfirm: (name: string, extension: string) => void;
};

const NAME_PATTERN = /^[a-z0-9-]+$/;
const VALID_EXTENSIONS = [".json", ".jsonc"];

function validateName(name: string): string | null {
  const trimmed = name.trim();
  if (!trimmed) return "Name is required.";
  if (trimmed.length < 2) return "Name must be at least 2 characters.";
  if (trimmed.length > 50) return "Name must be at most 50 characters.";
  if (!NAME_PATTERN.test(trimmed)) {
    return "Lowercase letters, numbers, and hyphens only.";
  }
  return null;
}

export function CreateConfigFileModal({ open, onClose, onConfirm }: CreateConfigFileModalProps) {
  const [name, setName] = useState("");
  const [extension, setExtension] = useState(".json");
  const [touched, setTouched] = useState(false);

  const trimmedName = name.trim();
  const error = validateName(trimmedName);
  const hasError = touched && error !== null;

  const handleSubmit = () => {
    setTouched(true);
    if (error) return;
    onConfirm(trimmedName, extension);
    setName("");
    setExtension(".json");
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
    setExtension(".json");
    setTouched(false);
    onClose();
  };

  return (
    <Modal
      open={open}
      onClose={handleClose}
      title="Create workflow"
      description="Creates a new workflow file with a primary agent in ~/.config/opencode/workflows/"
    >
      <div className="modal-form">
        <label className="form-field">
          <span className="form-label">Workflow name</span>
          <div className="name-with-extension">
            <input
              type="text"
              className={`form-input ${hasError ? "form-input-error" : ""}`}
              value={name}
              onChange={(event) => setName(event.target.value)}
              onBlur={() => setTouched(true)}
              onKeyDown={handleKeyDown}
              placeholder="my-workflow"
              autoFocus
              spellCheck={false}
            />
            <span className="name-extension">{extension}</span>
          </div>
          <span className="form-hint">
            Lowercase letters, numbers, and hyphens only.
          </span>
          {hasError ? <span className="form-error">{error}</span> : null}
        </label>

        <div className="form-field">
          <span className="form-label">Format</span>
          <div className="extension-picker">
            {VALID_EXTENSIONS.map((ext) => (
              <button
                key={ext}
                type="button"
                className={`extension-option ${extension === ext ? "extension-selected" : ""}`}
                onClick={() => setExtension(ext)}
              >
                {ext}
              </button>
            ))}
          </div>
          <span className="form-hint">
            .jsonc allows comments and trailing commas.
          </span>
        </div>

        <div className="modal-actions">
          <Button variant="ghost" onClick={handleClose}>Cancel</Button>
          <Button variant="primary" onClick={handleSubmit}>Create workflow</Button>
        </div>
      </div>
    </Modal>
  );
}
