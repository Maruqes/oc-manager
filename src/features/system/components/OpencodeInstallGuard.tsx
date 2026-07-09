import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import { AlertTriangle, RefreshCw } from "lucide-react";
import { Button } from "../../../components/ui/Button";
import { checkOpencodeInstallation, type OpencodeInstallationStatus } from "../api/systemApi";

type OpencodeInstallGuardProps = {
  children: ReactNode;
};

type CheckState = "checking" | "ready" | "missing";

export function OpencodeInstallGuard({ children }: OpencodeInstallGuardProps) {
  const [state, setState] = useState<CheckState>("checking");
  const [status, setStatus] = useState<OpencodeInstallationStatus | null>(null);

  const runCheck = async () => {
    setState("checking");
    try {
      const result = await checkOpencodeInstallation();
      setStatus(result);
      setState(result.installed ? "ready" : "missing");
    } catch (error) {
      setStatus({
        installed: false,
        version: null,
        error: getErrorMessage(error),
      });
      setState("missing");
    }
  };

  useEffect(() => {
    void runCheck();
  }, []);

  if (state === "ready") {
    return <>{children}</>;
  }

  return (
    <div className="install-check-screen">
      <div className="install-check-card" role="status" aria-live="polite">
        <div className={`install-check-icon ${state === "missing" ? "missing" : "checking"}`}>
          {state === "missing" ? <AlertTriangle size={28} /> : <RefreshCw size={28} className="spin-icon" />}
        </div>
        <p className="eyebrow">OpenCode requirement</p>
        <h1>{state === "missing" ? "OpenCode is not installed" : "Checking OpenCode..."}</h1>
        {state === "missing" ? (
          <>
            <p>
              This app needs the <code>opencode</code> CLI available in your PATH before it can manage agents and run chat.
            </p>
            {status?.error ? <pre className="install-check-error" role="alert">{status.error}</pre> : null}
            <div className="install-check-actions">
              <Button variant="primary" onClick={() => void runCheck()}>
                <RefreshCw size={15} /> Check again
              </Button>
            </div>
          </>
        ) : (
          <p>Confirming that the <code>opencode</code> command can be executed.</p>
        )}
      </div>
    </div>
  );
}

function getErrorMessage(error: unknown) {
  if (error instanceof Error) return error.message;
  if (typeof error === "string") return error;
  if (typeof error === "object" && error !== null && "message" in error) {
    return String((error as { message: unknown }).message);
  }
  return "Could not confirm the OpenCode installation.";
}
