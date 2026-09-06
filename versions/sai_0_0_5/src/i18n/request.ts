import { getRequestConfig } from 'next-intl/server';
import { cookies, headers } from 'next/headers';
import { env } from '@/env';

const SUPPORTED = ['ru', 'en'] as const;
type Locale = (typeof SUPPORTED)[number];

async function detectLocale(): Promise<Locale> {
  const ck = (await cookies()).get('NEXT_LOCALE')?.value;
  if (ck && (SUPPORTED as readonly string[]).includes(ck)) return ck as Locale;

  const accept = (await headers()).get('accept-language') ?? '';
  for (const part of accept.split(',')) {
    const code = part.split(';')[0].trim().slice(0, 2);
    if ((SUPPORTED as readonly string[]).includes(code)) return code as Locale;
  }
  return env.DEFAULT_LOCALE as Locale;
}

export default getRequestConfig(async () => {
  const locale = await detectLocale();
  const messages = (await import(`../../messages/${locale}.json`)).default;
  return { locale, messages };
});
