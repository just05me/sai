'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Loader2, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { trpc } from '@/trpc-client';

export default function NewProjectPage() {
  const router = useRouter();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const { data: workspaces } = trpc.workspace.list.useQuery();
  const wsId = workspaces?.[0]?.workspaceId;

  const create = trpc.projects.create.useMutation({
    onSuccess: (p) => {
      toast.success('Проект создан');
      router.push(`/projects/${p.id}`);
    },
    onError: (e) => toast.error(e.message),
  });

  return (
    <div className="container mx-auto max-w-2xl px-6 py-10">
      <h1 className="mb-6 text-2xl font-semibold tracking-tight">Новый проект</h1>
      <Card>
        <CardHeader>
          <CardTitle>Blank</CardTitle>
          <CardDescription>Создаст пустой проект с тремя деревьями (Разработка / Функции / Бизнес).</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-3">
            <Input
              placeholder="Название проекта"
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoFocus
            />
          </div>
          <Textarea
            placeholder="Описание (опционально)"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
          <Button
            disabled={!name || !wsId || create.isPending}
            onClick={() => wsId && create.mutate({ workspaceId: wsId, name, description })}
          >
            {create.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Plus className="mr-2 h-4 w-4" />}
            Создать
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
