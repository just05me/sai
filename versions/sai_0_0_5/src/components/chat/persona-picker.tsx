'use client';

import { PERSONAS, type PersonaId } from '@/server/ai/personas';

interface Props {
  value: PersonaId | undefined;
  onChange: (v: PersonaId) => void;
}

export function PersonaPicker({ value, onChange }: Props) {
  return (
    <select
      value={value ?? 'mentor'}
      onChange={(e) => onChange(e.target.value as PersonaId)}
      className="h-8 rounded-md border bg-background px-2 text-xs"
    >
      {PERSONAS.map((p) => (
        <option key={p.id} value={p.id}>{p.label}</option>
      ))}
    </select>
  );
}
