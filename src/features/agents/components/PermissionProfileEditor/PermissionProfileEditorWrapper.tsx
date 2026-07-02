import { useAgentsStore } from "../../store/agentsStore";
import { PermissionProfileEditor } from "./PermissionProfileEditor";
import { savePermissionProfile, scanAgents } from "../../api/agentsApi";
import type { EditablePermissionProfile } from "../../../../../shared/types/editable-permission-profile.dto";

export function PermissionProfileEditorWrapper() {
  const { editingPermissionProfile, isSavingProfile, stopEditingProfile, setSavingProfile, setSaveProfileError, scanProjectRoot, setScanResult, setLoading, setError } = useAgentsStore();

  if (!editingPermissionProfile) return null;

  const handleSave = async (updated: EditablePermissionProfile) => {
    setSavingProfile(true);
    setSaveProfileError(undefined);
    try {
      const result = await savePermissionProfile(updated);
      if (result.success) {
        stopEditingProfile();
        setLoading(true);
        setError(undefined);
        try {
          const scanResult = await scanAgents(scanProjectRoot ?? null);
          setScanResult(scanResult, scanProjectRoot ?? null);
        } finally {
          setLoading(false);
        }
      } else {
        setSaveProfileError(result.errors.join("\n"));
      }
    } catch (error) {
      setSaveProfileError(error instanceof Error ? error.message : "Failed to save permission profile");
    } finally {
      setSavingProfile(false);
    }
  };

  return (
    <PermissionProfileEditor
      profile={editingPermissionProfile}
      onSave={handleSave}
      onCancel={stopEditingProfile}
      isSaving={isSavingProfile}
    />
  );
}
