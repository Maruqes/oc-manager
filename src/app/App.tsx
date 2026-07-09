import { AgentsPage } from "../pages/AgentsPage";
import { OpencodeInstallGuard } from "../features/system/components/OpencodeInstallGuard";

export function App() {
  return (
    <OpencodeInstallGuard>
      <AgentsPage />
    </OpencodeInstallGuard>
  );
}
