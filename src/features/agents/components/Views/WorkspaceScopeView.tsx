import { Card } from "../../../../components/ui/Card";
import type { WorkspaceScope } from "../../../../../shared/types/editable-agent.dto";

export function WorkspaceScopeView({ scope }: { scope: WorkspaceScope }) {
  const hasAllowed = scope.allowedPaths.length > 0;
  const hasDenied = scope.deniedPaths.length > 0;
  const hasAny = hasAllowed || hasDenied;

  return (
    <Card>
      <div className="section-heading">
        <span>Workspace Scope</span>
        <small>path-level access</small>
      </div>
      {hasAny ? (
        <>
          {hasAllowed ? (
            <div>
              <div className="status-row">
                <span>Allowed paths</span>
              </div>
              <div className="path-list">
                {scope.allowedPaths.map((path, index) => (
                  <code key={`allowed-${index}`} className="path-item">{path}</code>
                ))}
              </div>
            </div>
          ) : null}
          {hasDenied ? (
            <div>
              <div className="status-row">
                <span>Denied paths</span>
              </div>
              <div className="path-list">
                {scope.deniedPaths.map((path, index) => (
                  <code key={`denied-${index}`} className="path-item denied">{path}</code>
                ))}
              </div>
            </div>
          ) : null}
        </>
      ) : (
        <p className="muted small">No path restrictions defined.</p>
      )}
    </Card>
  );
}
