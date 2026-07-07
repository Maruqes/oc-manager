import { invoke } from "@tauri-apps/api/core";

export type SkillInfo = {
  name: string;
  path: string;
};

const isTauriRuntime = () => "__TAURI_INTERNALS__" in window;

const mockSkills: SkillInfo[] = [
  { name: "frontend-design", path: "~/.agents/skills/frontend-design" },
  { name: "find-skills", path: "~/.agents/skills/find-skills" },
];

export async function listSkills(): Promise<SkillInfo[]> {
  if (!isTauriRuntime()) {
    return mockSkills;
  }

  return invoke<SkillInfo[]>("list_skills");
}

export async function installSkill(skill: string): Promise<SkillInfo[]> {
  if (!isTauriRuntime()) {
    const name = skill.trim().split("/").filter(Boolean).pop() ?? skill.trim();
    return Array.from(new Map([...mockSkills, { name, path: `~/.agents/skills/${name}` }].map((item) => [item.name, item])).values());
  }

  return invoke<SkillInfo[]>("install_skill", { skill });
}

export async function deleteSkill(skillName: string): Promise<SkillInfo[]> {
  if (!isTauriRuntime()) {
    return mockSkills.filter((skill) => skill.name !== skillName);
  }

  return invoke<SkillInfo[]>("delete_skill", { skillName });
}
