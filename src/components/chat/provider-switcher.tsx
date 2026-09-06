'use client';

interface Props {
  value: 'OPENAI' | 'ANTHROPIC' | 'OPENROUTER' | 'OLLAMA' | 'CUSTOM' | 'DEEPSEEK' | undefined;
  onChange: (v: Props['value']) => void;
}

const OPTIONS = [
  { value: undefined, label: 'auto' },
  { value: 'OPENAI' as const, label: 'OpenAI' },
  { value: 'ANTHROPIC' as const, label: 'Anthropic' },
  { value: 'OPENROUTER' as const, label: 'OpenRouter' },
  { value: 'DEEPSEEK' as const, label: 'DeepSeek' },
  { value: 'OLLAMA' as const, label: 'Ollama (local)' },
  { value: 'CUSTOM' as const, label: 'Custom (BYOK)' },
];

export function ProviderSwitcher({ value, onChange }: Props) {
  return (
    <select
      value={value ?? ''}
      onChange={(e) => onChange((e.target.value || undefined) as Props['value'])}
      className="h-8 rounded-md border bg-background px-2 text-xs"
    >
      {OPTIONS.map((o) => (
        <option key={o.label} value={o.value ?? ''}>{o.label}</option>
      ))}
    </select>
  );
}
