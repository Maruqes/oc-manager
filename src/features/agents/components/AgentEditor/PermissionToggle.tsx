import type { PermissionValue } from "../../../../../shared/types/editable-agent.dto";

const OPTIONS: Array<{ value: PermissionValue; label: string; className: string }> = [
  { value: "allow", label: "Allow", className: "perm-allow" },
  { value: "ask", label: "Ask", className: "perm-ask" },
  { value: "deny", label: "Deny", className: "perm-deny" },
];

type PermissionToggleProps = {
  label: string;
  value?: PermissionValue;
  onChange: (value: PermissionValue) => void;
};

export function PermissionToggle({ label, value, onChange }: PermissionToggleProps) {
  return (
    <div className="permission-toggle-row">
      <span className="permission-toggle-label">{label}</span>
      <div className="permission-toggle-group">
        {OPTIONS.map((option) => (
          <button
            key={option.value}
            type="button"
            className={`perm-option ${option.className} ${value === option.value ? "perm-selected" : ""}`}
            onClick={() => onChange(option.value)}
            aria-pressed={value === option.value}
          >
            {option.label}
          </button>
        ))}
      </div>
    </div>
  );
}
