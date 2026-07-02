import { useCallback, useState, type ReactNode } from "react";
import { ConfirmDialog } from "../components/ui/ConfirmDialog";

type ConfirmOptions = {
  title: string;
  description: string;
  confirmLabel?: string;
};

type ConfirmState = ConfirmOptions & {
  action: () => void;
};

export function useConfirmAction() {
  const [pending, setPending] = useState<ConfirmState | null>(null);

  const requestConfirm = useCallback((options: ConfirmOptions, action: () => void) => {
    setPending({ ...options, action });
  }, []);

  const handleConfirm = useCallback(() => {
    pending?.action();
    setPending(null);
  }, [pending]);

  const handleClose = useCallback(() => {
    setPending(null);
  }, []);

  const element: ReactNode = pending ? (
    <ConfirmDialog
      open={true}
      onClose={handleClose}
      onConfirm={handleConfirm}
      title={pending.title}
      description={pending.description}
      confirmLabel={pending.confirmLabel}
    />
  ) : null;

  return { requestConfirm, ConfirmDialogElement: element };
}
