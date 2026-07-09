import { invoke } from "@tauri-apps/api/core";

const isTauriRuntime = () => "__TAURI_INTERNALS__" in window;

export type OpencodeInstallationStatus = {
  installed: boolean;
  version: string | null;
  error: string | null;
};

export async function checkOpencodeInstallation(): Promise<OpencodeInstallationStatus> {
  if (!isTauriRuntime()) {
    return {
      installed: true,
      version: "browser mock",
      error: null,
    };
  }

  return invoke<OpencodeInstallationStatus>("check_opencode_installation");
}
