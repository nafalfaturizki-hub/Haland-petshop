type TextAreaFieldProps = {
  label: string;
  value: string;
  onChange: (value: string) => void;
  rows?: number;
  required?: boolean;
  placeholder?: string;
  description?: string;
};

export function TextAreaField({ label, value, onChange, rows = 3, required = false, placeholder, description }: TextAreaFieldProps) {
  return (
    <FormField label={label} description={description}>
      <textarea
        value={value}
        onChange={(event) => onChange(event.target.value)}
        required={required}
        rows={rows}
        placeholder={placeholder}
        className="mt-1 w-full rounded-lg border border-zinc-200 px-3 py-2"
      />
    </FormField>
  );
}

import { FormField } from './FormField';
