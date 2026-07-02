import { Badge } from "../../../components/ui/Badge";
import { Card } from "../../../components/ui/Card";
import type { Agent } from "../types/agent.types";
import { useAgentsStore } from "../store/agentsStore";
import { isInstructionSourceRelatedToAgent } from "../utils/agentRelations";

export function AgentInstructionsTab({ agent }: { agent: Agent }) {
  const instructionSources = useAgentsStore((state) => state.instructionSources);
  const relatedSources = dedupeInstructionSources(
    instructionSources.filter((source) => isInstructionSourceRelatedToAgent(source, agent)),
    agent.instructions,
  );

  return (
    <div className="details-stack compact-stack">
      {agent.instructions ? (
        <Card>
          <div className="section-heading">
            <span>Prompt / Instructions</span>
            <small>read-only</small>
          </div>
          <textarea aria-label="Agent instructions" className="instruction-editor" value={agent.instructions} readOnly />
        </Card>
      ) : null}

      {relatedSources.map((source) => (
        <Card key={source.id}>
          <div className="section-heading">
            <span>{source.label}</span>
            <span className="inline-badges"><Badge tone={source.agentId ? "blue" : "slate"}>{source.kind}</Badge></span>
          </div>
          <p className="path-text">{source.sourcePath}</p>
          {source.reference ? <code>{source.reference}</code> : null}
          {source.content ? <pre className="raw-viewer instruction-raw">{source.content}</pre> : null}
        </Card>
      ))}
    </div>
  );
}

function dedupeInstructionSources<T extends { content?: string | null; reference?: string | null; kind: string }>(sources: T[], agentInstructions?: string) {
  const seen = new Set<string>();
  const normalizedAgentInstructions = normalizeInstruction(agentInstructions);

  return sources.filter((source) => {
    const normalizedContent = normalizeInstruction(source.content);
    if (normalizedContent && normalizedContent === normalizedAgentInstructions) return false;

    const key = normalizedContent || `ref:${source.reference ?? ""}` || source.kind;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function normalizeInstruction(value?: string | null) {
  return value?.trim().replace(/\r\n/g, "\n").replace(/\n{3,}/g, "\n\n") ?? "";
}
