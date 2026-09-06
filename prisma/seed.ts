/**
 * Seed: 20 публичных шаблонов из ТЗ §4.2 F-134.
 * Запуск: `pnpm db:seed` после миграций.
 */
import { PrismaClient, TemplateScope, TreeKind } from '@prisma/client';

const prisma = new PrismaClient();

const templates = [
  {
    name: 'SaaS B2B MVP',
    category: 'saas',
    description: 'Skeleton для запуска SaaS: API, биллинг, юнит-экономика.',
  },
  {
    name: 'Marketplace двухсторонний',
    category: 'marketplace',
    description: 'Liquidity, comissions, два сегмента аудитории.',
  },
  {
    name: 'Mobile-приложение fitness',
    category: 'mobile',
    description: 'Онбординг, retention, push-уведомления.',
  },
  {
    name: 'AI-агент для поддержки',
    category: 'ai',
    description: 'RAG, эскалация, метрики качества ответов.',
  },
  {
    name: 'Devtool CLI',
    category: 'devtool',
    description: 'Установка, авторизация, dx-метрики.',
  },
  {
    name: 'Edtech курс-платформа',
    category: 'edtech',
    description: 'Прогресс, mentor-flow, certification.',
  },
  {
    name: 'Healthtech трекер сна',
    category: 'healthtech',
    description: 'HIPAA-готовность, sensors, longitudinal data.',
  },
  {
    name: 'Fintech P2P-платежи',
    category: 'fintech',
    description: 'KYC, fraud, settlement, regulation.',
  },
  {
    name: 'No-code конструктор лендингов',
    category: 'nocode',
    description: 'Editor, templates, publish flow.',
  },
  {
    name: 'Игровая студия — мобильная игра',
    category: 'gamedev',
    description: 'Loop, monetization, LiveOps.',
  },
  {
    name: 'Подкаст-платформа',
    category: 'media',
    description: 'Хостинг, дистрибуция, аналитика прослушиваний.',
  },
  {
    name: 'E-commerce ниша',
    category: 'ecom',
    description: 'CAC/LTV, fulfillment, repeat rate.',
  },
  {
    name: 'B2B Sales CRM-плагин',
    category: 'saas',
    description: 'Интеграция с Salesforce/HubSpot, прогнозы.',
  },
  {
    name: 'Open Source проект с монетизацией',
    category: 'oss',
    description: 'Community, sponsorship, dual-licensing.',
  },
  {
    name: 'Agency продуктизация',
    category: 'services',
    description: 'Productized service, retainer, capacity.',
  },
  {
    name: 'Newsletter business',
    category: 'media',
    description: 'Subscriber growth, monetization, sponsorships.',
  },
  {
    name: 'Hardware прототип IoT',
    category: 'hardware',
    description: 'BOM, поставщики, sertification, pre-orders.',
  },
  {
    name: 'Browser extension',
    category: 'devtool',
    description: 'Distribution, freemium, retention.',
  },
  {
    name: 'Discord-бот SaaS',
    category: 'saas',
    description: 'Server adoption, премиум-фичи, churn.',
  },
  {
    name: 'Образовательный воркшоп онлайн',
    category: 'edtech',
    description: 'Кohort-based, фасилитация, пост-продажи.',
  },
];

async function main() {
  for (const t of templates) {
    await prisma.template.upsert({
      where: { id: t.name.toLowerCase().replace(/\s+/g, '-') },
      create: {
        id: t.name.toLowerCase().replace(/\s+/g, '-'),
        name: t.name,
        description: t.description,
        category: t.category,
        scope: TemplateScope.PUBLIC,
        payload: {
          trees: Object.values(TreeKind).map((k) => ({ kind: k, nodes: [] })),
        },
      },
      update: { description: t.description, category: t.category },
    });
  }
  console.log(`✓ Seeded ${templates.length} public templates`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
