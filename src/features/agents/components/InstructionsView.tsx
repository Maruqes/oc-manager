import { SourceBadge } from "../../../components/common/SourceBadge";
import { Badge } from "../../../components/ui/Badge";
import { Card } from "../../../components/ui/Card";
import { useAgentsStore } from "../store/agentsStore";

export function InstructionsView() {
  const { instructionSources, agents } = useAgentsStore();

  if (instructionSources.length === 0) {
    return <Card className="empty-state">No instruction sources found.</Card>;
  }

  return (
    <div className="details-stack">
      <Card className="hero-card compact-hero">
        <div>
          <div className="eyebrow">Prompts and rules</div>
          <h1>Instructions</h1>
          <p>Agent prompts, markdown bodies, file references and config instruction entries.</p>
        </div>
      </Card>

      {instructionSources.map((source) => {
        const linkedAgent = agents.find((agent) => agent.id === source.agentId);
        return (
          <Card key={source.id}>
            <div className="section-heading">
              <span>{source.label}</span>
              <span className="inline-badges"><Badge tone="blue">{source.kind}</Badge><SourceBadge source={source.source} /></span>
            </div>
            {linkedAgent ? <p className="muted small">Agent: {linkedAgent.name}</p> : null}
            <p className="path-text">{source.sourcePath}</p>
            {source.reference ? <code>{source.reference}</code> : null}
            {source.content ? <pre className="raw-viewer instruction-raw">{source.content}</pre> : null}
          </Card>
        );
      })}
    </div>
  );
}
