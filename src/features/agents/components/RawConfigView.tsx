import { Card } from "../../../components/ui/Card";
import { useAgentsStore } from "../store/agentsStore";
import { RawJsonViewer } from "./RawJsonViewer";

export function RawConfigView() {
  const { agents, permissionProfiles, instructionSources, configFiles } = useAgentsStore();

  return (
    <div className="details-stack">
      <Card className="hero-card compact-hero">
        <div>
          <div className="eyebrow">Raw</div>
          <h1>Full Scan Result</h1>
          <p>Complete frontend representation received from the backend scanner.</p>
        </div>
      </Card>
      <RawJsonViewer value={{ agents, permissionProfiles, instructionSources, configFiles }} />
    </div>
  );
}
