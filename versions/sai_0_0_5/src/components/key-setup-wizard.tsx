'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import { Key, Trash2, CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { encryptKey, maskKey } from '@/lib/byok';
import { trpc } from '@/trpc-client';

const PROVIDERS = [
  { value: 'OPENAI', label: 'OpenAI', placeholder: 'sk-…', help: 'https://platform.openai.com/api-keys' },
  { value: 'ANTHROPIC', label: 'Anthropic', placeholder: 'sk-ant-…', help: 'https://console.anthropic.com/settings/keys' },
  { value: 'OPENROUTER', label: 'OpenRouter', placeholder: 'sk-or-…', help: 'https://openrouter.ai/keys' },
  { value: 'DEEPSEEK', label: 'DeepSeek', placeholder: 'sk-…', help: 'https://platform.deepseek.com/api_keys' },
  { value: 'OLLAMA', label: 'Ollama (local)', placeholder: 'localhost:11434', help: 'https://ollama.com' },
  { value: 'CUSTOM', label: 'OpenAI-compatible', placeholder: 'sk-…', help: '' },
] as const;

interface Props {
  workspaceId: string;
  userId: string;
}

export function KeySetupWizard({ workspaceId, userId: _userId }: Props) {
  const [provider, setProvider] = useState<typeof PROVIDERS[number]['value']>('OPENAI');
  const [key, setKey] = useState('');
  const [label, setLabel] = useState('Default');
  const [model, setModel] = useState('');
  const [baseUrl, setBaseUrl] = useState('');
  const [saving, setSaving] = useState(false);

  const keys = trpc.byok.list.useQuery({ workspaceId });
  // Серверная половина master-passphrase. Только она же используется при decrypt.
  const passphraseQ = trpc.byok.passphrase.useQuery(undefined, { staleTime: Infinity });
  const utils = trpc.useUtils();
  const save = trpc.byok.save.useMutation({
    onSuccess: () => utils.byok.list.invalidate({ workspaceId }),
  });
  const remove = trpc.byok.remove.useMutation({
    onSuccess: () => utils.byok.list.invalidate({ workspaceId }),
  });

  const onSave = async () => {
    if (!passphraseQ.data) {
      toast.error('Сессия не готова, попробуй ещё раз');
      return;
    }
    setSaving(true);
    try {
      const blob = await encryptKey(key, passphraseQ.data.passphrase);
      await save.mutateAsync({
        workspaceId,
        provider,
        label,
        baseUrl: baseUrl || undefined,
        defaultModel: model || undefined,
        isDefault: keys.data?.length === 0,
        ...blob,
      });
      toast.success(`Ключ ${provider} сохранён зашифрованным`);
      setKey('');
    } catch (e) {
      toast.error('Не удалось сохранить ключ');
      console.error(e);
    } finally {
      setSaving(false);
    }
  };

  const meta = PROVIDERS.find((p) => p.value === provider)!;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Key className="h-4 w-4" /> Добавить провайдера
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <select
              value={provider}
              onChange={(e) => setProvider(e.target.value as typeof provider)}
              className="h-10 rounded-md border bg-background px-3 text-sm"
            >
              {PROVIDERS.map((p) => (
                <option key={p.value} value={p.value}>{p.label}</option>
              ))}
            </select>
            <Input placeholder="Название (метка)" value={label} onChange={(e) => setLabel(e.target.value)} />
          </div>
          <Input
            type="password"
            placeholder={meta.placeholder}
            value={key}
            onChange={(e) => setKey(e.target.value)}
            autoComplete="off"
          />
          <div className="grid grid-cols-2 gap-3">
            <Input
              placeholder="Модель по умолчанию (опц.)"
              value={model}
              onChange={(e) => setModel(e.target.value)}
            />
            <Input
              placeholder="Base URL (для CUSTOM / Ollama)"
              value={baseUrl}
              onChange={(e) => setBaseUrl(e.target.value)}
            />
          </div>
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>Web Crypto · AES-256-GCM · PBKDF2 250k iter</span>
            {meta.help && (
              <a href={meta.help} target="_blank" rel="noreferrer" className="underline">
                Получить ключ ↗
              </a>
            )}
          </div>
          <Button onClick={onSave} disabled={!key || saving || !passphraseQ.data}>
            {saving ? 'Шифруем…' : 'Сохранить'}
          </Button>
        </CardContent>
      </Card>

      <div className="space-y-2">
        <h3 className="text-sm font-semibold text-muted-foreground">Активные ключи</h3>
        {keys.data?.length === 0 && (
          <div className="rounded-md border bg-card p-4 text-sm text-muted-foreground">
            Пока нет ключей. AI-функции отключены.
          </div>
        )}
        {keys.data?.map((k) => (
          <div key={k.id} className="flex items-center justify-between rounded-md border bg-card p-3">
            <div>
              <div className="flex items-center gap-2 text-sm font-medium">
                {k.provider} · {k.label}
                {k.isDefault && <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />}
              </div>
              <div className="text-xs text-muted-foreground">
                {k.defaultModel ?? '—'} · {Number(k.monthlyTokens)} токенов в этом месяце
              </div>
            </div>
            <Button variant="ghost" size="icon" onClick={() => remove.mutate({ workspaceId, id: k.id })}>
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        ))}
      </div>
    </div>
  );
}
