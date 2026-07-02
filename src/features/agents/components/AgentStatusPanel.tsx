import { useState } from "react";
import { Clock, Folder } from "lucide-react";
import { Button } from "../../../components/ui/Button";
import { Card } from "../../../components/ui/Card";
import { RiskBadge } from "../../../components/common/RiskBadge";
import { openAgentLocation } from "../api/agentsApi";
import { useSelectedAgent } from "../hooks/useSelectedAgent";
import { useAgentsStore } from "../store/agentsStore";

export function AgentStatusPanel() {
  const agent = useSelectedAgent();
  const scanProjectRoot = useAgentsStore((state) => state.scanProjectRoot);
  const [openError, setOpenError] = useState<string | null>(null);

  if (!agent) return <Card className="empty-state">No agent selected.</Card>;

  const handleOpenLocation = async () => {
    setOpenError(null);
    try {
      await openAgentLocation(agent.sourcePath, scanProjectRoot);
    } catch (error) {
      console.error("Failed to open agent location", error);
      setOpenError(getErrorMessage(error));
    }
  };

  return (
    <div className="status-stack">
      <Card>
        <div className="section-heading"><span>Status</span></div>
        <div className="status-row"><span>Risk</span><RiskBadge risk={agent.risk} /></div>
        <div className="status-row"><span>Errors</span><strong>{agent.validationErrors.length}</strong></div>
        <div className="status-row"><Clock size={15} /><span>{new Date(agent.lastModified).toLocaleString("pt-PT")}</span></div>
      </Card>

      <Card>
        <div className="section-heading"><span>File</span></div>
        <p className="path-text">{agent.sourcePath}</p>
        <Button variant="ghost" onClick={() => void handleOpenLocation()}>
          <Folder size={15} /> Open location
        </Button>
        {openError ? <p className="muted small">{openError}</p> : null}
      </Card>

    </div>
  );
}

function getErrorMessage(error: unknown) {
  if (error instanceof Error) return error.message;
  if (typeof error === "string") return error;
  if (typeof error === "object" && error !== null && "message" in error) {
    return String((error as { message: unknown }).message);
  }
  return "Could not open this location.";
}
