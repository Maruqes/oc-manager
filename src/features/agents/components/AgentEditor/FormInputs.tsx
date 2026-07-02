import type { ChangeEvent, ReactNode } from "react";
import { CustomSelect } from "../../../../components/ui/CustomSelect";

type TextInputProps = {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  error?: string;
  hint?: string;
  disabled?: boolean;
};

export function TextInput({ label, value, onChange, placeholder, error, hint, disabled }: TextInputProps) {
  return (
    <label className="form-field">
      <span className="form-label">{label}</span>
      <input
        type="text"
        className={`form-input ${error ? "form-input-error" : ""}`}
        value={value}
        onChange={(event: ChangeEvent<HTMLInputElement>) => onChange(event.target.value)}
        placeholder={placeholder}
        disabled={disabled}
      />
      {hint ? <small className="form-hint">{hint}</small> : null}
      {error ? <small className="form-error">{error}</small> : null}
    </label>
  );
}

type NumberInputProps = {
  label: string;
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  step?: number;
  error?: string;
  hint?: string;
};

export function NumberInput({ label, value, onChange, min, max, step, error, hint }: NumberInputProps) {
  return (
    <label className="form-field">
      <span className="form-label">{label}</span>
      <input
        type="number"
        className={`form-input ${error ? "form-input-error" : ""}`}
        value={value}
        onChange={(event: ChangeEvent<HTMLInputElement>) => onChange(Number(event.target.value))}
        min={min}
        max={max}
        step={step}
      />
      {hint ? <small className="form-hint">{hint}</small> : null}
      {error ? <small className="form-error">{error}</small> : null}
    </label>
  );
}

type SelectInputProps<T extends string> = {
  label: string;
  value: T;
  onChange: (value: T) => void;
  options: Array<{ value: T; label: string }>;
  hint?: string;
  searchable?: boolean;
};

export function SelectInput<T extends string>({ label, value, onChange, options, hint, searchable }: SelectInputProps<T>) {
  return (
    <div className="form-field">
      <span className="form-label">{label}</span>
      <CustomSelect
        value={value}
        onChange={onChange}
        options={options}
        searchable={searchable}
      />
      {hint ? <small className="form-hint">{hint}</small> : null}
    </div>
  );
}

type ToggleInputProps = {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  hint?: string;
};

export function ToggleInput({ label, checked, onChange, hint }: ToggleInputProps) {
  return (
    <label className="form-field form-toggle">
      <span className="form-label">{label}</span>
      <button
        type="button"
        className={`toggle-switch ${checked ? "toggle-on" : "toggle-off"}`}
        onClick={() => onChange(!checked)}
        aria-pressed={checked}
      >
        <span className="toggle-knob" />
      </button>
      {hint ? <small className="form-hint">{hint}</small> : null}
    </label>
  );
}

type TextareaInputProps = {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  rows?: number;
  error?: string;
  hint?: string;
};

export function TextareaInput({ label, value, onChange, placeholder, rows, error, hint }: TextareaInputProps) {
  return (
    <label className="form-field">
      <span className="form-label">{label}</span>
      <textarea
        className={`form-textarea ${error ? "form-input-error" : ""}`}
        value={value}
        onChange={(event: ChangeEvent<HTMLTextAreaElement>) => onChange(event.target.value)}
        placeholder={placeholder}
        rows={rows ?? 6}
      />
      {hint ? <small className="form-hint">{hint}</small> : null}
      {error ? <small className="form-error">{error}</small> : null}
    </label>
  );
}

type FieldGroupProps = {
  title: string;
  children: ReactNode;
  description?: string;
};

export function FieldGroup({ title, children, description }: FieldGroupProps) {
  return (
    <div className="field-group">
      <div className="field-group-header">
        <span className="field-group-title">{title}</span>
        {description ? <small className="form-hint">{description}</small> : null}
      </div>
      <div className="field-group-body">{children}</div>
    </div>
  );
}
