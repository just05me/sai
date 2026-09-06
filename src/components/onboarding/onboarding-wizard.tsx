'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Lightbulb,
  Key,
  Rocket,
  ArrowRight,
  ArrowLeft,
  Trees,
  MessageSquare,
  Download,
  Keyboard,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { cn } from '@/lib/utils';

interface Props {
  open: boolean;
  onClose: () => void;
  onComplete: () => void;
}

const STEPS = [
  {
    icon: Lightbulb,
    title: 'Добро пожаловать в Sai',
    description: 'Инструмент для структурированного мышления с AI-ассистентом',
    details: [
      {
        icon: Trees,
        text: 'Три дерева идей: Разработка, Функции и Бизнес — на одном канвасе.',
      },
      {
        icon: MessageSquare,
        text: 'AI-чат привязан к конкретному узлу — ИИ понимает контекст того, над чем вы работаете.',
      },
      {
        icon: Download,
        text: 'Экспорт в Markdown одной кнопкой — готовое ТЗ или промпт для другой AI-модели.',
      },
      {
        icon: Keyboard,
        text: '16 горячих клавиш. Нажмите Ctrl+K чтобы увидеть все.',
      },
    ],
  },
  {
    icon: Key,
    title: 'Подключите AI-ключ',
    description: 'Sai работает с вашим ключом (BYOK)',
    details: [
      {
        icon: Key,
        text: 'Поддерживаются OpenAI, Anthropic, OpenRouter, DeepSeek, Ollama и совместимые API.',
      },
      {
        icon: Key,
        text: 'Ключ шифруется (AES-256-GCM) и хранится только у вас. Нулевое знание (zero-knowledge).',
      },
      {
        icon: Key,
        text: 'Можно пропустить — ключ добавляется в Настройки → Ключи в любой момент.',
      },
    ],
  },
  {
    icon: Rocket,
    title: 'Первый проект',
    description: 'Создайте проект или начните с быстрой идеи',
    details: [
      {
        icon: Rocket,
        text: '«Новый проект» — пустой канвас для ручной работы.',
      },
      {
        icon: Lightbulb,
        text: '«Быстрый захват» — опишите идею текстом, AI сгенерирует 9 узлов (по 3 на каждое дерево).',
      },
      {
        icon: Trees,
        text: 'Выберите узел на канвасе → откройте чат → общайтесь с AI по этому узлу.',
      },
    ],
  },
] as const;

export function OnboardingWizard({ open, onClose, onComplete }: Props) {
  const [step, setStep] = useState(0);
  const router = useRouter();

  const current = STEPS[step];
  if (!current) return null;

  const isLast = step === STEPS.length - 1;

  const handleNext = () => {
    if (isLast) {
      onComplete();
    } else {
      setStep((s) => s + 1);
    }
  };

  const handleStart = (mode: 'blank' | 'capture') => {
    onComplete();
    if (mode === 'capture') {
      router.push('/capture');
    } else {
      router.push('/projects/new');
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
              <current.icon className="h-5 w-5 text-primary" />
            </div>
            <div>
              <DialogTitle>{current.title}</DialogTitle>
              <DialogDescription className="mt-1">{current.description}</DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {/* Индикатор шагов */}
        <div className="flex gap-1.5">
          {STEPS.map((_, i) => (
            <div
              key={i}
              className={cn('h-1 flex-1 rounded-full transition-colors', i <= step ? 'bg-primary' : 'bg-muted')}
            />
          ))}
        </div>

        {/* Детали шага */}
        <div className="space-y-3">
          {current.details.map((item, i) => (
            <div key={i} className="flex gap-3 rounded-lg border p-3">
              <item.icon className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
              <p className="text-sm">{item.text}</p>
            </div>
          ))}
        </div>

        {/* Действия */}
        <div className="flex items-center justify-between">
          <div className="flex gap-2">
            {step > 0 && (
              <Button variant="outline" size="sm" onClick={() => setStep((s) => s - 1)}>
                <ArrowLeft className="mr-1 h-4 w-4" />
                Назад
              </Button>
            )}
          </div>
          <div className="flex gap-2">
            {step === 2 ? (
              <>
                <Button variant="outline" size="sm" onClick={() => handleStart('blank')}>
                  Новый проект
                </Button>
                <Button size="sm" onClick={() => handleStart('capture')}>
                  <Lightbulb className="mr-1 h-4 w-4" />
                  Быстрый захват
                </Button>
              </>
            ) : (
              <>
                <Button variant="ghost" size="sm" onClick={onClose}>
                  Пропустить
                </Button>
                <Button size="sm" onClick={handleNext}>
                  {isLast ? 'Начать' : 'Далее'}
                  <ArrowRight className="ml-1 h-4 w-4" />
                </Button>
              </>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
