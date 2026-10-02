import type { InputHTMLAttributes, TextareaHTMLAttributes } from 'react'

const base =
  'w-full rounded-2xl border border-white/15 bg-white/5 px-4 py-3 text-cream outline-none transition placeholder:text-faint/70 focus:border-rose/60'

function FieldLabel({ text }: { text: string }) {
  return (
    <span className="mb-1.5 block text-[11px] uppercase tracking-[0.2em] text-faint">{text}</span>
  )
}

interface TextFieldProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string
}

export function TextField({ label, ...props }: TextFieldProps) {
  return (
    <label className="block">
      <FieldLabel text={label} />
      <input {...props} className={base} />
    </label>
  )
}

interface TextAreaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label: string
}

export function TextArea({ label, ...props }: TextAreaProps) {
  return (
    <label className="block">
      <FieldLabel text={label} />
      <textarea {...props} className={`${base} resize-none`} />
    </label>
  )
}
