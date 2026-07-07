import { useEffect, useMemo, useState } from "react";
import { Download, Info, RefreshCw, Search, Trash2 } from "lucide-react";
import { Button } from "../../../components/ui/Button";
import { Card } from "../../../components/ui/Card";
import { ConfirmDialog } from "../../../components/ui/ConfirmDialog";
import { deleteSkill, installSkill, listSkills, type SkillInfo } from "../api/skillsApi";

function getErrorMessage(error: unknown) {
  if (error && typeof error === "object" && "message" in error) {
    return String((error as { message: unknown }).message);
  }
  return error instanceof Error ? error.message : String(error);
}

export function SkillsView() {
  const [skills, setSkills] = useState<SkillInfo[]>([]);
  const [skillInput, setSkillInput] = useState("");
  const [loading, setLoading] = useState(true);
  const [installing, setInstalling] = useState(false);
  const [deletingSkill, setDeletingSkill] = useState<SkillInfo | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const sortedSkills = useMemo(() => [...skills].sort((a, b) => a.name.localeCompare(b.name)), [skills]);

  async function refreshSkills() {
    setLoading(true);
    setError(null);
    setSuccess(null);
    try {
      setSkills(await listSkills());
    } catch (error) {
      setError(getErrorMessage(error));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void refreshSkills();
  }, []);

  async function handleInstall(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const skill = skillInput.trim();
    if (!skill) {
      setError("Enter a skill to install.");
      return;
    }

    setInstalling(true);
    setError(null);
    setSuccess(null);
    try {
      setSkills(await installSkill(skill));
      setSkillInput("");
      setSuccess(`Skill '${skill}' installed.`);
    } catch (error) {
      setError(getErrorMessage(error));
    } finally {
      setInstalling(false);
    }
  }

  async function handleDelete() {
    if (!deletingSkill) return;

    setError(null);
    setSuccess(null);
    try {
      setSkills(await deleteSkill(deletingSkill.name));
      setSuccess(`Skill '${deletingSkill.name}' deleted.`);
    } catch (error) {
      setError(getErrorMessage(error));
    } finally {
      setDeletingSkill(null);
    }
  }

  return (
    <div className="details-stack">
      <Card className="hero-card compact-hero">
        <div>
          <span className="eyebrow">Skills</span>
          <h1>Install skills</h1>
          <p>
            Search for a skill on <code>skills.sh</code> and paste the identifier here. Example: <code>frontend-design</code>, <code>anthropics/skills@frontend-design</code>, or <code>https://github.com/juliusbrussee/caveman --skill caveman</code>.
          </p>
        </div>
      </Card>

      <Card>
        <form className="skills-install-form" onSubmit={handleInstall}>
          <label className="form-field">
            <span className="form-label skills-label">
              Skill
              <span className="skills-info" tabIndex={0} aria-label="Skill install examples">
                <Info size={14} />
                <span className="skills-info-tooltip" role="tooltip">
                  <strong>Install examples</strong>
                  <code>frontend-design</code>
                  <code>anthropics/skills@frontend-design</code>
                  <code>https://github.com/juliusbrussee/caveman --skill caveman</code>
                </span>
              </span>
            </span>
            <div className="skills-input-row">
              <div className="search-box skills-search-box">
                <Search size={16} />
                <input
                  value={skillInput}
                  onChange={(event) => setSkillInput(event.target.value)}
                  placeholder="frontend-design, owner/repo@skill, or URL --skill name"
                  disabled={installing}
                />
              </div>
              <Button type="submit" variant="primary" disabled={installing}>
                <Download size={16} /> {installing ? "Installing..." : "Download"}
              </Button>
            </div>
          </label>
          <span className="form-hint">Tip: open skills.sh, choose a skill, and use the install identifier shown on the page. For repo-based skills, use URL --skill name. Installation is global for your user.</span>
        </form>
      </Card>

      {error ? <Card className="validation-errors"><p className="error-text">{error}</p></Card> : null}
      {success ? <Card><p className="success-text">{success}</p></Card> : null}

      <Card className="skills-list-card">
        <div className="section-heading">
          <span>Installed skills</span>
          <button className="more-button skills-refresh" type="button" onClick={refreshSkills} disabled={loading || installing}>
            <RefreshCw size={14} /> Refresh
          </button>
        </div>

        {loading ? (
          <div className="empty-state">Loading skills...</div>
        ) : sortedSkills.length === 0 ? (
          <div className="empty-state">No skills installed yet.</div>
        ) : (
          <div className="skills-list">
            {sortedSkills.map((skill) => (
              <div className="skill-row" key={skill.name}>
                <div>
                  <strong>{skill.name}</strong>
                  <small className="path-text">{skill.path}</small>
                </div>
                <button className="skill-delete-button" type="button" onClick={() => setDeletingSkill(skill)} title={`Delete ${skill.name}`}>
                  <Trash2 size={16} />
                </button>
              </div>
            ))}
          </div>
        )}
      </Card>

      <ConfirmDialog
        open={Boolean(deletingSkill)}
        onClose={() => setDeletingSkill(null)}
        onConfirm={handleDelete}
        title="Delete skill"
        description={`Are you sure you want to delete the skill '${deletingSkill?.name ?? ""}'? This removes the local skill folder.`}
        confirmLabel="Delete"
      />
    </div>
  );
}
