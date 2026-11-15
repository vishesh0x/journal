import type { ReactNode, InputHTMLAttributes, TextareaHTMLAttributes, SelectHTMLAttributes } from "react";
import type { LucideIcon } from "lucide-react";

export function PageHead({ title, hint, action }: { title: string; hint?: string; action?: ReactNode }) {
  return (
    <header className="dash-head">
      <div>
        <h1 className="dash-title">{title}</h1>
        {hint ? <p className="muted mt-3">{hint}</p> : null}
      </div>
      {action}
    </header>
  );
}

export function StatusChip({ on, children }: { on: boolean; children: ReactNode }) {
  return <span className={`chip ${on ? "chip-on" : ""}`}>{children}</span>;
}

export function Icon({ as: Glyph, size = 18 }: { as: LucideIcon; size?: number }) {
  return <Glyph size={size} strokeWidth={2.25} aria-hidden="true" className="icon" />;
}

export function Section({ title, icon, children }: { title: string; icon?: LucideIcon; children: ReactNode }) {
  return (
    <section className="section-card">
      <h2 className="flex items-center gap-3">
        {icon ? <Icon as={icon} size={26} /> : null}
        {title}
      </h2>
      {children}
    </section>
  );
}

type FieldProps = { label: string; hint?: string; id: string };

export function Field({ label, hint, id, ...rest }: FieldProps & InputHTMLAttributes<HTMLInputElement>) {
  return (
    <div>
      <label htmlFor={id} className="form-label">
        {label}
      </label>
      <input id={id} className="field" {...rest} />
      {hint ? <p className="form-hint">{hint}</p> : null}
    </div>
  );
}

export function TextArea({ label, hint, id, ...rest }: FieldProps & TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <div>
      <label htmlFor={id} className="form-label">
        {label}
      </label>
      <textarea id={id} className="field" {...rest} />
      {hint ? <p className="form-hint">{hint}</p> : null}
    </div>
  );
}

export function Select({ label, hint, id, children, ...rest }: FieldProps & SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <div>
      <label htmlFor={id} className="form-label">
        {label}
      </label>
      <select id={id} className="field" {...rest}>
        {children}
      </select>
      {hint ? <p className="form-hint">{hint}</p> : null}
    </div>
  );
}

export function Toggle({
  id,
  label,
  hint,
  checked,
  onChange,
}: {
  id: string;
  label: string;
  hint?: string;
  checked: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <div className="toggle-row">
      <input id={id} type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      <label htmlFor={id}>
        <span className="font-bold">{label}</span>
        {hint ? <span className="form-hint block">{hint}</span> : null}
      </label>
    </div>
  );
}
