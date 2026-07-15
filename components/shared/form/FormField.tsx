type FormFieldProps = {
  label: string;
  children: React.ReactNode;
  description?: string;
  className?: string;
};

export function FormField({ label, children, description, className }: FormFieldProps) {
  return (
    <label className={`block text-sm text-zinc-600 ${className ?? ''}`}>
      <span className="mb-1 block font-medium text-zinc-700">{label}</span>
      {children}
      {description ? <span className="mt-1 block text-xs text-zinc-500">{description}</span> : null}
    </label>
  );
}
