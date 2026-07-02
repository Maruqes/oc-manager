import { AlertTriangle } from "lucide-react";
import { SourceBadge } from "../../../components/common/SourceBadge";
import { Badge } from "../../../components/ui/Badge";
import { Card } from "../../../components/ui/Card";
import { useAgentsStore } from "../store/agentsStore";
import { RawJsonViewer } from "./RawJsonViewer";

export function ConfigFilesView() {
  const configFiles = useAgentsStore((state) => state.configFiles);

  if (configFiles.length === 0) {
    return <Card className="empty-state">No OpenCode config files discovered.</Card>;
  }

  return (
    <div className="details-stack">
      <Card className="hero-card compact-hero">
        <div>
          <div className="eyebrow">Config explorer</div>
          <h1>Config Files</h1>
          <p>Every discovered OpenCode config file and its normalized counts.</p>
        </div>
      </Card>
      {configFiles.map((file) => (
        <Card key={file.id}>
          <div className="section-heading">
            <span>{file.path}</span>
            <span className="inline-badges"><Badge tone="slate">{file.kind}</Badge><SourceBadge source={file.source} /></span>
          </div>
          <div className="metric-grid compact-grid">
            <Card><span>Agents</span><strong>{file.agentsCount}</strong></Card>
            <Card><span>Permissions</span><strong>{file.permissionProfilesCount}</strong></Card>
            <Card><span>Instructions</span><strong>{file.instructionSourcesCount}</strong></Card>
            <Card><AlertTriangle size={16} /><span>Errors</span><strong>{file.validationErrors.length}</strong></Card>
          </div>
          {file.validationErrors.map((error) => <p className="error-text" key={error}>{error}</p>)}
          <RawJsonViewer value={file.rawConfig} />
        </Card>
      ))}
    </div>
  );
}
