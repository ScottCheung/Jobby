// LabeledInput component – wraps an input with a label and a tooltip icon
import React from 'react';
import { HelpCircle } from 'lucide-react'; // using a placeholder icon library; adjust import as needed

export interface LabeledInputProps {
  label: string;
  tooltip: string;
  children: React.ReactNode; // the actual input element (e.g., <input ... />)
  disabled?: boolean;
}

export const LabeledInput: React.FC<LabeledInputProps> = ({ label, tooltip, children, disabled }) => {
  return (
    <div className="flex flex-col gap-1">
      <label className="label flex items-center gap-2">
        <span>{label}</span>
        {/* Simple question‑mark tooltip */}
        <span className="cursor-help opacity-70" title={tooltip}>?</span>
      </label>
      {/* Clone children to enforce disabled prop */}
      {React.cloneElement(children as any, { disabled })}
    </div>
  );
};

export default LabeledInput;
