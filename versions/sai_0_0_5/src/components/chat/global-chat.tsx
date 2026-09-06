'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { X, Send, Square, Loader2, History, SquarePen, Trash2, ArrowLeft, Pencil, RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { PersonaPicker } from './persona-picker';
import { ProviderSwitcher } from './provider-switcher';
import { MarkdownMessage } from './markdown-message';
import type { TreeProposal } from './tree-confirmation-dialog';
import { ResizablePanel } from '@/components/ui/resizable-panel';
import { trpc } from '@/trpc-client';
import type { PersonaId } from '@/server/ai/personas';
import { toast } from 'sonner';
import { processDataStream } from 'ai';
import { TREE_META } from '@/lib/utils';

type Msg = { id?: string; role: 'user' | 'assistant'; content: string };

interface Props {
  workspaceId: string;
  projectId: string;
  nodeId?: string | null;
  activeTree?: 'DEV' | 'FUNC' | 'BIZ';
  onClose: () => void;
  onCanvasMutated?: () => void;
}

function isTreeProposal(v: unknown): v is TreeProposal {
  if (!v || typeof v !== 'object') return false;
  const o = v as Record<string, unknown>;
  return (
    (o.type === 'tree_proposal' || (typeof o.treeKind === 'string' && o.root != null)) &&
    typeof o.treeKind === 'string' &&
    o.root != null &&
    typeof o.root === 'object'
  );
}

export function GlobalChat({ workspaceId, projectId, nodeId, activeTree, onClose, onCanvasMutated }: Props) {
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState('');
  const [persona, setPersona] = useState<PersonaId | undefined>('mentor');
  const [provider, setProvider] = useState<'OPENAI' | 'ANTHROPIC' | 'OPENROUTER' | 'OLLAMA' | 'CUSTOM' | 'DEEPSEEK' | undefined>();
  const [streaming, setStreaming] = useState(false);
  const [chatId, setChatId] = useState<string | null>(null);
  const [showHistory, setShowHistory] = useState(false);
  const [pendingProposal, setPendingProposal] = useState<TreeProposal | null>(null);
  const [applyingTree, setApplyingTree] = useState(false);

  const abortRef = useRef<AbortController | null>(null);
  const wasAbortedRef = useRef(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const autoGrow = () => {
    const el = inputRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 200)}px`;
  };
  useEffect(autoGrow, [input]);

  const utils = trpc.useUtils();
  const chatsQuery = trpc.chats.list.useQuery(
    { workspaceId, projectId },
    { enabled: showHistory },
  );
  const openChat = trpc.chats.open.useMutation();
  const addMessages = trpc.chats.addMessages.useMutation();
  const truncateAfter = trpc.chats.truncateAfter.useMutation();
  const clearMessages = trpc.chats.clearMessages.useMutation();
  const deleteChat = trpc.chats.delete.useMutation({
    onSuccess: () => utils.chats.list.invalidate({ workspaceId, projectId }),
  });

  const storageKey = `sai:chat:lastId:${projectId}`;
  const restoredRef = useRef(false);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages, pendingProposal]);

  const rowsToMsgs = (rows: { id: string; role: string; content: string }[]): Msg[] =>
    rows
      .filter((r) => r.role === 'USER' || r.role === 'ASSISTANT')
      .map((r) => ({
        id: r.id,
        role: r.role === 'USER' ? 'user' : 'assistant',
        content: r.content,
      }));

  useEffect(() => {
    if (restoredRef.current) return;
    restoredRef.current = true;
    const saved = typeof window !== 'undefined' ? window.localStorage.getItem(storageKey) : null;
    if (!saved) return;
    void (async () => {
      try {
        const rows = await utils.chats.messages.fetch({ workspaceId, chatId: saved });
        setMessages(rowsToMsgs(rows));
        setChatId(saved);
      } catch {
        window.localStorage.removeItem(storageKey);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storageKey, workspaceId]);

  useEffect(() => {
    if (chatId) window.localStorage.setItem(storageKey, chatId);
  }, [chatId, storageKey]);

  const startNewChat = () => {
    setMessages([]);
    setChatId(null);
    setShowHistory(false);
    setInput('');
    setPendingProposal(null);
    if (typeof window !== 'undefined') window.localStorage.removeItem(storageKey);
  };

  const loadChat = async (id: string) => {
    try {
      const rows = await utils.chats.messages.fetch({ workspaceId, chatId: id });
      setMessages(rowsToMsgs(rows));
      setChatId(id);
      setShowHistory(false);
      setPendingProposal(null);
    } catch {
      // молча
    }
  };

  const truncateDbHistory = async (keepUntilIndex: number) => {
    if (!chatId) return;
    if (keepUntilIndex < 0) {
      await clearMessages.mutateAsync({ workspaceId, chatId });
      return;
    }
    let anchor = messages[keepUntilIndex];
    if (!anchor?.id) {
      const rows = await utils.chats.messages.fetch({ workspaceId, chatId });
      const refreshed = rowsToMsgs(rows);
      anchor = refreshed[keepUntilIndex];
    }
    if (anchor?.id) {
      await truncateAfter.mutateAsync({ workspaceId, chatId, messageId: anchor.id });
    }
  };

  const applyTreeProposal = useCallback(
    async (proposal: TreeProposal, mode: TreeProposal['suggestedMode']) => {
      setApplyingTree(true);
      try {
        const r = await fetch('/api/ai/apply-tree', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            workspaceId,
            projectId,
            treeKind: proposal.treeKind,
            mutationMode: mode,
            parentNodeId: proposal.parentNodeId,
            replaceAtNodeId: proposal.replaceAtNodeId,
            root: proposal.root,
          }),
        });
        const j = await r.json().catch(() => ({}));
        if (!r.ok || !j.ok) {
          toast.error(j.message ?? 'Не удалось применить дерево');
          return;
        }
        toast.success(`Добавлено ${j.count} узл.${j.deletedCount ? `, удалено ${j.deletedCount}` : ''}`);
        onCanvasMutated?.();
        setPendingProposal(null);
      } finally {
        setApplyingTree(false);
      }
    },
    [workspaceId, projectId, onCanvasMutated],
  );

  const handleTreeProposal = useCallback(
    (proposal: TreeProposal) => {
      const inTarget = proposal.existingInTargetTree ?? proposal.existingNodes[proposal.treeKind] ?? 0;
      const destructive = proposal.suggestedMode !== 'append';
      // Пустое целевое дерево — сразу добавляем, не спрашиваем.
      if (inTarget === 0 && !destructive) {
        void applyTreeProposal(proposal, 'append');
        return;
      }
      setPendingProposal(proposal);
    },
    [applyTreeProposal],
  );

  const runChat = async (history: Msg[], userContent: string) => {
    const userMsg: Msg = { role: 'user', content: userContent };
    setMessages([...history, userMsg, { role: 'assistant', content: '' }]);
    setInput('');
    setStreaming(true);
    wasAbortedRef.current = false;
    abortRef.current = new AbortController();

    let activeChatId = chatId;
    try {
      if (!activeChatId) {
        const chat = await openChat.mutateAsync({
          workspaceId,
          projectId,
          kind: nodeId ? 'NODE' : 'GLOBAL',
          nodeId: nodeId ?? undefined,
          persona,
        });
        activeChatId = chat.id;
        setChatId(chat.id);
      }
    } catch {
      // продолжаем без сохранения
    }

    let finalContent = '';
    let treeProposal: TreeProposal | null = null;

    try {
      const res = await fetch('/api/ai/stream', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: abortRef.current.signal,
        body: JSON.stringify({
          workspaceId,
          projectId,
          chatId: activeChatId ?? undefined,
          nodeId: nodeId ?? undefined,
          activeTree,
          persona,
          provider,
          messages: [...history, userMsg].map((m) => ({ role: m.role, content: m.content })),
        }),
      });

      if (!res.ok || !res.body) {
        const j = await res.json().catch(() => ({}));
        setMessages((prev) =>
          prev.slice(0, -1).concat({ role: 'assistant', content: `[Ошибка] ${j.message ?? 'Ошибка AI'}` }),
        );
        return;
      }

      let acc = '';
      let errText = '';

      await processDataStream({
        stream: res.body,
        onTextPart: (text) => {
          acc += text;
          setMessages((prev) => {
            const next = [...prev];
            next[next.length - 1] = { role: 'assistant', content: acc };
            return next;
          });
        },
        onErrorPart: (err) => {
          errText += err;
        },
        onToolResultPart: ({ result }) => {
          if (isTreeProposal(result)) treeProposal = result;
        },
      });

      if (treeProposal) handleTreeProposal(treeProposal);

      finalContent =
        acc ||
        (treeProposal
          ? 'Подготовил структуру дерева — выбери, как применить на холсте.'
          : errText
            ? `[Ошибка] ${errText}`
            : '[Пустой ответ]');

      setMessages((prev) => {
        const next = [...prev];
        next[next.length - 1] = { role: 'assistant', content: finalContent };
        return next;
      });
    } catch (e) {
      if ((e as Error).name === 'AbortError') {
        setMessages((prev) => {
          const last = prev[prev.length - 1];
          if (last?.role === 'assistant') {
            return prev.slice(0, -1);
          }
          return prev;
        });
      } else {
        console.error(e);
        setMessages((prev) =>
          prev.slice(0, -1).concat({ role: 'assistant', content: `[Ошибка] ${(e as Error).message}` }),
        );
      }
    } finally {
      setStreaming(false);
      abortRef.current = null;

      if (wasAbortedRef.current) return;

      if (activeChatId && finalContent && !finalContent.startsWith('[Ошибка]')) {
        try {
          await addMessages.mutateAsync({
            workspaceId,
            chatId: activeChatId,
            messages: [
              { role: 'user', content: userMsg.content },
              { role: 'assistant', content: finalContent },
            ],
          });
          const rows = await utils.chats.messages.fetch({ workspaceId, chatId: activeChatId });
          setMessages(rowsToMsgs(rows));
          utils.chats.list.invalidate({ workspaceId, projectId });
        } catch {
          // не критично
        }
      }
    }
  };

  const send = () => {
    if (!input.trim() || streaming) return;
    void runChat(messages, input.trim());
  };

  const stop = () => {
    wasAbortedRef.current = true;
    abortRef.current?.abort();
  };

  const startEdit = (index: number) => {
    if (streaming) return;
    const msg = messages[index];
    if (msg.role !== 'user') return;
    void truncateDbHistory(index - 1);
    setMessages(messages.slice(0, index));
    setInput(msg.content);
    inputRef.current?.focus();
  };

  const regenerateFrom = (userIndex: number) => {
    if (streaming) return;
    const userMsg = messages[userIndex];
    if (userMsg.role !== 'user') return;
    const history = messages.slice(0, userIndex);
    void truncateDbHistory(userIndex - 1);
    setMessages(history);
    void runChat(history, userMsg.content);
  };

  return (
    <>
      <ResizablePanel
        side="right"
        defaultWidth={420}
        minWidth={320}
        maxWidth={820}
        storageKey="panel-width:chat"
        className="flex shrink-0 flex-col border-l bg-card/40"
      >
        <header className="flex items-center justify-between border-b px-4 py-3">
          <div className="flex min-w-0 flex-col gap-1">
            <div className="flex items-center gap-2">
              <PersonaPicker value={persona} onChange={setPersona} />
              <ProviderSwitcher value={provider} onChange={setProvider} />
            </div>
            {nodeId && (
              <span className="truncate rounded bg-primary/10 px-2 py-0.5 text-[11px] text-primary">
                контекст узла
              </span>
            )}
          </div>
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="icon" title="Новый чат" onClick={startNewChat}>
              <SquarePen className="h-4 w-4" />
            </Button>
            <Button
              variant={showHistory ? 'secondary' : 'ghost'}
              size="icon"
              title="История чатов"
              onClick={() => setShowHistory((v) => !v)}
            >
              <History className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="icon" onClick={onClose}>
              <X className="h-4 w-4" />
            </Button>
          </div>
        </header>

        {showHistory ? (
          <div className="scroll-area min-h-0 flex-1 overflow-y-auto p-2">
            <div className="mb-2 flex items-center gap-2 px-2 py-1 text-xs text-muted-foreground">
              <button
                className="flex items-center gap-1 hover:text-foreground"
                onClick={() => setShowHistory(false)}
              >
                <ArrowLeft className="h-3.5 w-3.5" />
                К текущему чату
              </button>
            </div>
            {chatsQuery.isLoading ? (
              <div className="flex items-center gap-2 px-3 py-4 text-sm text-muted-foreground">
                <Loader2 className="h-3 w-3 animate-spin" /> Загрузка истории…
              </div>
            ) : !chatsQuery.data || chatsQuery.data.length === 0 ? (
              <div className="px-3 py-4 text-sm text-muted-foreground">Пока нет сохранённых чатов.</div>
            ) : (
              <ul className="space-y-1">
                {chatsQuery.data.map((c) => (
                  <li
                    key={c.id}
                    className={`group flex items-center gap-2 rounded-lg px-2 py-2 hover:bg-accent ${
                      c.id === chatId ? 'bg-accent' : ''
                    }`}
                  >
                    <button className="min-w-0 flex-1 text-left" onClick={() => loadChat(c.id)}>
                      <div className="truncate text-sm font-medium">{c.title || 'Без названия'}</div>
                      <div className="mt-0.5 flex items-center gap-2 text-[11px] text-muted-foreground">
                        <span>{new Date(c.createdAt).toLocaleString('ru')}</span>
                        <span>·</span>
                        <span>{c.messageCount} сообщ.</span>
                        {c.kind === 'NODE' && <span className="text-primary">узел</span>}
                      </div>
                    </button>
                    <button
                      className="shrink-0 rounded p-1 text-muted-foreground opacity-0 transition hover:text-destructive group-hover:opacity-100"
                      title="Удалить чат"
                      onClick={() => {
                        deleteChat.mutate({ workspaceId, chatId: c.id });
                        if (c.id === chatId) startNewChat();
                      }}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        ) : (
          <div ref={scrollRef} className="scroll-area min-h-0 flex-1 overflow-y-auto p-4">
            {messages.length === 0 ? (
              <div className="text-sm text-muted-foreground">
                {nodeId
                  ? 'AI знает контекст выбранного узла. Задай вопрос по нему.'
                  : 'Начни диалог. AI знает контекст всего проекта (до 50 узлов). Выбери узел на канвасе для точного контекста.'}
              </div>
            ) : (
              <div className="space-y-3">
                {messages.map((m, i) => (
                  <div
                    key={m.id ?? i}
                    className={`group relative max-w-[85%] ${
                      m.role === 'user' ? 'ml-auto' : ''
                    }`}
                  >
                    <div
                      className={`overflow-hidden break-words rounded-lg p-3 text-sm ${
                        m.role === 'user'
                          ? 'whitespace-pre-wrap bg-primary text-primary-foreground'
                          : 'bg-secondary'
                      }`}
                    >
                      {m.content ? (
                        m.role === 'assistant' ? (
                          <MarkdownMessage content={m.content} />
                        ) : (
                          m.content
                        )
                      ) : streaming && i === messages.length - 1 ? (
                        <Loader2 className="h-3 w-3 animate-spin" />
                      ) : null}
                    </div>
                    {!streaming && m.role === 'user' && (
                      <div className="mt-1 flex justify-end gap-1 opacity-0 transition group-hover:opacity-100">
                        <button
                          type="button"
                          className="rounded px-2 py-0.5 text-[11px] text-muted-foreground hover:bg-accent hover:text-foreground"
                          title="Изменить запрос и отправить заново"
                          onClick={() => startEdit(i)}
                        >
                          <Pencil className="mr-0.5 inline h-3 w-3" />
                          Изменить
                        </button>
                        <button
                          type="button"
                          className="rounded px-2 py-0.5 text-[11px] text-muted-foreground hover:bg-accent hover:text-foreground"
                          title="Ответить заново на этот запрос"
                          onClick={() => regenerateFrom(i)}
                        >
                          <RotateCcw className="mr-0.5 inline h-3 w-3" />
                          Заново
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
            {pendingProposal && !showHistory && (
              <div className="mt-4 rounded-lg border border-primary/40 bg-primary/5 p-3 text-sm">
                <div className="font-medium">
                  Применить «{pendingProposal.root.title}» → {TREE_META[pendingProposal.treeKind].label}
                </div>
                <p className="mt-1 text-xs text-muted-foreground">
                  Выбери режим ниже. {pendingProposal.nodeCount} узл.
                </p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {(
                    [
                      ['append', 'Добавить'],
                      ['replace_subtree', 'Заменить часть'],
                      ['replace_tree', 'Перестроить дерево'],
                      ['rewrite_all', 'С нуля (все деревья)'],
                    ] as const
                  ).map(([mode, label]) => (
                    <Button
                      key={mode}
                      size="sm"
                      variant={pendingProposal.suggestedMode === mode ? 'default' : 'outline'}
                      disabled={applyingTree}
                      onClick={() => void applyTreeProposal(pendingProposal, mode)}
                    >
                      {label}
                    </Button>
                  ))}
                  <Button size="sm" variant="ghost" disabled={applyingTree} onClick={() => setPendingProposal(null)}>
                    Отмена
                  </Button>
                </div>
              </div>
            )}
          </div>
        )}

        <footer className="border-t p-3">
          {streaming && (
            <div className="mb-2 text-xs text-muted-foreground">
              AI думает… Нажми ■ чтобы остановить, затем «Изменить» у своего сообщения.
            </div>
          )}
          <div className="flex items-end gap-2">
            <textarea
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Спроси или попроси AI…"
              rows={1}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  send();
                }
              }}
              disabled={streaming || showHistory}
              autoFocus
              className="scroll-area flex max-h-[200px] min-h-10 w-full resize-none overflow-y-auto rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
            />
            {streaming ? (
              <Button size="icon" variant="destructive" onClick={stop} title="Остановить">
                <Square className="h-4 w-4" />
              </Button>
            ) : (
              <Button size="icon" onClick={send} disabled={showHistory}>
                <Send className="h-4 w-4" />
              </Button>
            )}
          </div>
        </footer>
      </ResizablePanel>
    </>
  );
}
