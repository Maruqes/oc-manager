import { AlertTriangle } from "lucide-react";
import { Button } from "./Button";
import { Modal } from "./Modal";

type ConfirmDialogProps = {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  description: string;
  confirmLabel?: string;
  isDestructive?: boolean;
};

export function ConfirmDialog({
  open,
  onClose,
  onConfirm,
  title,
  description,
  confirmLabel = "Delete",
  isDestructive = true,
}: ConfirmDialogProps) {
  return (
    <Modal open={open} onClose={onClose} title={title}>
      <div className="confirm-dialog-body">
        {isDestructive ? (
          <div className="confirm-dialog-icon">
            <AlertTriangle size={22} />
          </div>
        ) : null}
        <p className="confirm-dialog-message">{description}</p>
      </div>
      <div className="modal-actions">
        <Button variant="ghost" onClick={onClose}>Cancel</Button>
        <Button
          variant={isDestructive ? "primary" : "secondary"}
          className={isDestructive ? "button-danger" : ""}
          onClick={() => {
            onConfirm();
            onClose();
          }}
        >
          {confirmLabel}
        </Button>
      </div>
    </Modal>
  );
}
