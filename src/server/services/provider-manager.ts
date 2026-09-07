/**
 * ProviderManager — единая точка получения LLM-клиента по провайдеру и user/workspace.
 * Расшифровывает BYOK-ключ в RAM, возвращает Provider-инстанс Vercel AI SDK.
 */
import { createOpenAI } from '@ai-sdk/openai';
import { createAnthropic } from '@ai-sdk/anthropic';
import { createOpenAICompatible } from '@ai-sdk/openai-compatible';
import { AiProvider, type ByokKey } from '@prisma/client';
import { prisma } from '@/server/prisma';
import { decryptByokKey } from '@/server/crypto';

type AiSdkProvider =
  | ReturnType<typeof createOpenAI>
  | ReturnType<typeof createAnthropic>
  | ReturnType<typeof createOpenAICompatible>;

export interface ResolvedProvider {
  provider: AiProvider;
  model: string;
  client: AiSdkProvider;
  baseUrl?: string;
}

export const ProviderManager = {
  /**
   * Подбираем ключ: либо явно переданный keyId, либо isDefault, либо первый из workspace.
   */
  async resolve(opts: {
    workspaceId: string;
    userId: string;
    provider?: AiProvider;
    keyId?: string;
    model?: string;
  }): Promise<ResolvedProvider> {
    const key = await this.pickKey(opts);
    if (!key) throw new ProviderError('NO_KEY', 'No BYOK key configured');
    const apiKey = await decryptByokKey(key.encryptedKey, key.iv, key.salt, opts.userId);
    const model = opts.model ?? key.defaultModel ?? defaultModelFor(key.provider);

    const client = buildClient(key.provider, apiKey, key.baseUrl ?? undefined);
    // F-225 / usage tracking
    await prisma.byokKey.update({
      where: { id: key.id },
      data: { lastUsedAt: new Date() },
    });
    return {
      provider: key.provider,
      model,
      client,
      baseUrl: key.baseUrl ?? undefined,
    };
  },

  async pickKey(opts: {
    workspaceId: string;
    provider?: AiProvider;
    keyId?: string;
  }): Promise<ByokKey | null> {
    if (opts.keyId) return prisma.byokKey.findUnique({ where: { id: opts.keyId } });
    if (opts.provider) {
      return prisma.byokKey.findFirst({
        where: { workspaceId: opts.workspaceId, provider: opts.provider },
        orderBy: [{ isDefault: 'desc' }, { lastUsedAt: 'desc' }],
      });
    }
    return prisma.byokKey.findFirst({
      where: { workspaceId: opts.workspaceId },
      orderBy: [{ isDefault: 'desc' }, { lastUsedAt: 'desc' }],
    });
  },

  async recordUsage(opts: {
    keyId: string;
    inputTokens: number;
    outputTokens: number;
    costCent: number;
  }) {
    await prisma.byokKey.update({
      where: { id: opts.keyId },
      data: {
        monthlyTokens: { increment: BigInt(opts.inputTokens + opts.outputTokens) },
        monthlyCostCent: { increment: opts.costCent },
      },
    });
  },
};

export class ProviderError extends Error {
  constructor(
    public code: 'NO_KEY' | 'INVALID_KEY' | 'RATE_LIMIT' | 'PROVIDER_DOWN' | 'UNKNOWN',
    message: string,
  ) {
    super(message);
  }
}

function defaultModelFor(provider: AiProvider): string {
  switch (provider) {
    case 'OPENAI': return 'gpt-4o-mini';
    case 'ANTHROPIC': return 'claude-3-5-sonnet-latest';
    case 'OPENROUTER': return 'openai/gpt-4o-mini';
    case 'OLLAMA': return 'llama3.2';
    case 'DEEPSEEK': return 'deepseek-chat';
    default: return 'gpt-4o-mini';
  }
}

function buildClient(provider: AiProvider, apiKey: string, baseUrl?: string) {
  switch (provider) {
    case 'OPENAI':
      return createOpenAI({ apiKey, baseURL: baseUrl });
    case 'ANTHROPIC':
      return createAnthropic({ apiKey, baseURL: baseUrl });
    case 'OPENROUTER':
      return createOpenAICompatible({
        name: 'openrouter',
        apiKey,
        baseURL: baseUrl ?? 'https://openrouter.ai/api/v1',
      });
    case 'OLLAMA':
      return createOpenAICompatible({
        name: 'ollama',
        apiKey: apiKey || 'ollama',
        baseURL: baseUrl ?? 'http://localhost:11434/v1',
      });
    case 'CUSTOM':
      return createOpenAICompatible({
        name: 'custom',
        apiKey,
        baseURL: baseUrl ?? 'http://localhost:8080/v1',
      });
    case 'DEEPSEEK':
      return createOpenAICompatible({
        name: 'deepseek',
        apiKey,
        baseURL: baseUrl ?? 'https://api.deepseek.com/v1',
      });
  }
}
