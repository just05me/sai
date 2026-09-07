import Link from 'next/link';
import { startApp } from '@/app/actions';
import { LandingReveal } from './landing-reveal';
import styles from './landing.module.css';

const GITHUB_URL = 'https://github.com/sai-app/sai';

const GitHubIcon = () => (
  <svg viewBox="0 0 24 24" fill="currentColor">
    <path d="M12 .5a12 12 0 0 0-3.79 23.4c.6.11.82-.26.82-.58v-2.23c-3.34.73-4.04-1.42-4.04-1.42-.55-1.4-1.34-1.77-1.34-1.77-1.09-.75.08-.73.08-.73 1.2.08 1.84 1.24 1.84 1.24 1.08 1.84 2.83 1.31 3.52 1 .11-.78.42-1.31.76-1.61-2.66-.3-5.47-1.33-5.47-5.93 0-1.31.47-2.38 1.24-3.22-.12-.3-.54-1.52.12-3.17 0 0 1.01-.32 3.3 1.23a11.5 11.5 0 0 1 6.02 0c2.29-1.55 3.3-1.23 3.3-1.23.66 1.65.24 2.87.12 3.17.77.84 1.24 1.91 1.24 3.22 0 4.61-2.81 5.63-5.49 5.92.43.37.81 1.1.81 2.22v3.29c0 .32.22.7.83.58A12 12 0 0 0 12 .5z" />
  </svg>
);

const LockIcon = ({ style }: { style?: React.CSSProperties }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" style={style}>
    <path d="M7 11V8a5 5 0 0 1 9-3M5 11h12a2 2 0 0 1 2 2v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-6a2 2 0 0 1 2-2z" />
  </svg>
);

const CheckIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
    <path d="M5 12l5 5L20 7" />
  </svg>
);

export default function LandingPage() {
  return (
    <div className={styles.root}>
      <link rel="preconnect" href="https://fonts.googleapis.com" />
      <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
      {/* eslint-disable-next-line @next/next/no-page-custom-font -- landing-only typography */}
      <link
        href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@500;600;700&family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap"
        rel="stylesheet"
      />

      <LandingReveal />

      <header className={styles.nav}>
        <div className={`${styles.container} ${styles.navInner}`}>
          <Link className={styles.logo} href="/">
            <svg className={styles.logoMark} viewBox="0 0 26 26" fill="none">
              <circle cx="6" cy="8" r="3" fill="#4D8DFF" />
              <circle cx="13" cy="19" r="3" fill="#2BD4A0" />
              <circle cx="20" cy="8" r="3" fill="#FF9D4D" />
              <path d="M8.2 9.6L11.2 16.6M17.8 9.6L14.8 16.6" stroke="#3A3F52" strokeWidth="1.4" />
            </svg>
            Sai
          </Link>
          <nav className={styles.navLinks}>
            <a href="#trees">Деревья</a>
            <a href="#features">Возможности</a>
            <a href="#oss">Открытый код</a>
            <Link href="/explore">Explore</Link>
          </nav>
          <div className={styles.navCta}>
            <a className={styles.iconLink} href={GITHUB_URL} target="_blank" rel="noreferrer">
              <GitHubIcon />
              GitHub
            </a>
            <form action={startApp}>
              <button className={`${styles.btn} ${styles.btnPrimary}`} style={{ padding: '10px 18px' }} type="submit">
                Попробовать
              </button>
            </form>
          </div>
        </div>
      </header>

      <main>
        {/* HERO */}
        <section className={styles.hero}>
          <div className={styles.heroGrid} aria-hidden="true" />
          <div className={`${styles.container} ${styles.heroInner}`}>
            <div className={styles.badgePill}>
              <span className={styles.dot} />
              100% open source · LGPL-3.0 · self-host за 2 минуты
            </div>
            <h1>
              Превращай идею
              <br />в карту знаний за 3 минуты
            </h1>
            <p className={styles.lede}>
              Sai объединяет n8n-канвас, ментальную карту и трёхдеревную модель. ИИ расширяет,
              рефакторит и связывает узлы — а ты остаёшься у руля.
            </p>
            <div className={styles.ctaRow}>
              <form action={startApp}>
                <button className={`${styles.btn} ${styles.btnPrimary}`} type="submit">
                  Попробовать без регистрации
                </button>
              </form>
              <a
                className={`${styles.btn} ${styles.btnSecondary}`}
                href={GITHUB_URL}
                target="_blank"
                rel="noreferrer"
              >
                <GitHubIcon />
                Смотреть код
              </a>
              <Link className={styles.btnText} href="/capture">
                Quick Capture →
              </Link>
            </div>
            <p className={styles.audience}>
              Для соло-фаундеров, вайбкодеров и небольших команд, проектирующих архитектуру через ИИ.
            </p>
          </div>

          <div className={`${styles.container} ${styles.heroVisual} ${styles.reveal}`} data-reveal>
            <svg viewBox="0 0 1200 300" role="img" aria-label="Три связанных дерева на одном канвасе">
              <defs>
                <marker
                  id="arrow"
                  viewBox="0 0 10 10"
                  refX="8"
                  refY="5"
                  markerWidth="6"
                  markerHeight="6"
                  orient="auto-start-reverse"
                >
                  <path d="M0 0L10 5L0 10z" fill="#9B8CFF" />
                </marker>
              </defs>

              <g stroke="#4D8DFF" strokeOpacity=".55" strokeWidth="1.4">
                <line x1="150" y1="130" x2="232" y2="92" />
                <line x1="232" y1="92" x2="256" y2="188" />
                <line x1="150" y1="130" x2="121" y2="219" />
                <line x1="256" y1="188" x2="121" y2="219" />
              </g>
              <g fill="#4D8DFF">
                <circle cx="150" cy="130" r="6" />
                <circle cx="232" cy="92" r="9" />
                <circle cx="256" cy="188" r="6" />
                <circle cx="121" cy="219" r="5" />
              </g>

              <g stroke="#2BD4A0" strokeOpacity=".55" strokeWidth="1.4">
                <line x1="562" y1="98" x2="641" y2="70" />
                <line x1="641" y1="70" x2="651" y2="168" />
                <line x1="651" y1="168" x2="561" y2="199" />
                <line x1="561" y1="199" x2="562" y2="98" />
              </g>
              <g fill="#2BD4A0">
                <circle cx="562" cy="98" r="6" />
                <circle cx="641" cy="70" r="9" />
                <circle cx="651" cy="168" r="6" />
                <circle cx="561" cy="199" r="5" />
              </g>

              <g stroke="#FF9D4D" strokeOpacity=".55" strokeWidth="1.4">
                <line x1="980" y1="138" x2="1061" y2="100" />
                <line x1="1061" y1="100" x2="1071" y2="208" />
                <line x1="1071" y1="208" x2="971" y2="229" />
                <line x1="971" y1="229" x2="980" y2="138" />
              </g>
              <g fill="#FF9D4D">
                <circle cx="980" cy="138" r="6" />
                <circle cx="1061" cy="100" r="9" />
                <circle cx="1071" cy="208" r="6" />
                <circle cx="971" cy="229" r="5" />
              </g>

              <path
                className={styles.bridgeLine}
                d="M256 188 Q 410 230 562 98"
                fill="none"
                stroke="#9B8CFF"
                strokeWidth="1.8"
                markerEnd="url(#arrow)"
              />
              <path
                className={styles.bridgeLine}
                d="M651 168 Q 800 235 980 138"
                fill="none"
                stroke="#9B8CFF"
                strokeWidth="1.8"
                markerEnd="url(#arrow)"
              />
              <circle className={styles.pulseDot} cx="410" cy="222" r="2.6" fill="#9B8CFF" />
              <circle className={styles.pulseDot} cx="800" cy="227" r="2.6" fill="#9B8CFF" />

              <g fontFamily="JetBrains Mono, monospace" fontSize="13">
                <text x="188" y="265" fill="#4D8DFF" textAnchor="middle">
                  Разработка
                </text>
                <text x="606" y="245" fill="#2BD4A0" textAnchor="middle">
                  Функции
                </text>
                <text x="1020" y="265" fill="#FF9D4D" textAnchor="middle">
                  Бизнес
                </text>
              </g>
            </svg>
          </div>
        </section>

        {/* TREES */}
        <section className={styles.trees} id="trees">
          <div className={styles.container}>
            <div className={`${styles.sectionHead} ${styles.reveal}`} data-reveal>
              <div className={styles.eyebrow}>Центральная механика</div>
              <h2>Три дерева, один холст</h2>
              <p>
                Можно работать в любом дереве отдельно, не блокируя остальные. Синхронизация —
                вручную, по кнопке: ИИ предлагает изменения смежных деревьев, ты подтверждаешь.
              </p>
            </div>
            <div className={`${styles.treeGrid} ${styles.reveal}`} data-reveal>
              <div className={`${styles.treeCard} ${styles.dev}`}>
                <div className={styles.tag}>
                  <span className={styles.sw} />
                  development
                </div>
                <h3>Разработка</h3>
                <p>API, БД, компоненты, сервисы — техническая декомпозиция продукта.</p>
              </div>
              <div className={`${styles.treeCard} ${styles.func}`}>
                <div className={styles.tag}>
                  <span className={styles.sw} />
                  functional
                </div>
                <h3>Функции</h3>
                <p>Экраны, флоу, состояния, события — пользовательский опыт.</p>
              </div>
              <div className={`${styles.treeCard} ${styles.biz}`}>
                <div className={styles.tag}>
                  <span className={styles.sw} />
                  business
                </div>
                <h3>Бизнес</h3>
                <p>Сегменты, каналы, юнит-экономика — модель монетизации.</p>
              </div>
            </div>
          </div>
        </section>

        {/* FEATURES */}
        <section id="features">
          <div className={styles.container}>
            <div className={`${styles.sectionHead} ${styles.reveal}`} data-reveal>
              <div className={styles.eyebrow}>Возможности</div>
              <h2>Всё нужное, чтобы идея не потерялась</h2>
            </div>
            <div className={`${styles.featureGrid} ${styles.reveal}`} data-reveal>
              <div className={`${styles.feature} ${styles.f1}`}>
                <div className={styles.ic}>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7">
                    <circle cx="6" cy="6" r="2.6" />
                    <circle cx="18" cy="6" r="2.6" />
                    <circle cx="12" cy="18" r="2.6" />
                    <path d="M8.2 7.6L10.4 15.8M15.8 7.6L13.6 15.8M8.6 6H15.4" />
                  </svg>
                </div>
                <h3>Три связанных дерева</h3>
                <p>Один граф, три ментальные модели. CrossTreeEdge сшивает идею насквозь.</p>
              </div>
              <div className={`${styles.feature} ${styles.f2}`}>
                <div className={styles.ic}>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7">
                    <path d="M12 3l7 3v5c0 5-3.2 8-7 10-3.8-2-7-5-7-10V6l7-3z" />
                  </svg>
                </div>
                <h3>BYOK без наценки</h3>
                <p>Свой API-ключ, AES-256-GCM в браузере. Sai не видит и не хранит ключи.</p>
              </div>
              <div className={`${styles.feature} ${styles.f3}`}>
                <div className={styles.ic}>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7">
                    <path d="M4 12a8 8 0 0 1 14-5.3M20 12a8 8 0 0 1-14 5.3M18 4v3.5h-3.5M6 20v-3.5h3.5" />
                  </svg>
                </div>
                <h3>Three-tree sync</h3>
                <p>Анализ несоответствий между DEV, FUNC и BIZ. Bridge-связи сшивают модели.</p>
              </div>
              <div className={`${styles.feature} ${styles.f4}`}>
                <div className={styles.ic}>
                  <LockIcon />
                </div>
                <h3>Открытый код</h3>
                <p>Полный исходный код на GitHub. Self-host через Docker — без лимитов.</p>
              </div>
            </div>
          </div>
        </section>

        {/* OPEN SOURCE */}
        <section className={styles.ossSection} id="oss">
          <div className={`${styles.container} ${styles.ossLayout}`}>
            <div className={styles.reveal} data-reveal>
              <div className={styles.eyebrow} style={{ color: 'var(--oss)' }}>
                Открытый исходный код
              </div>
              <h2>Sai создаётся в открытую</h2>
              <p style={{ color: 'var(--text-2)', marginTop: 14, fontSize: 16 }}>
                Весь код продукта — от канваса до шифрования ключей — открыт полностью. Если завтра
                облако Sai исчезнет, твои данные и твой инструмент останутся с тобой.
              </p>

              <div className={styles.licensePill}>
                <LockIcon style={{ width: 14, height: 14 }} />
                Лицензия: LGPL-3.0
              </div>

              <div className={styles.reasonList}>
                <div className={styles.reason}>
                  <div className={styles.dotIc}>
                    <CheckIcon />
                  </div>
                  <div>
                    <h4>Без замка на данные</h4>
                    <p>
                      Экспорт в Markdown, PDF или PNG в любой момент — формат открытый, а не
                      проприетарный.
                    </p>
                  </div>
                </div>
                <div className={styles.reason}>
                  <div className={styles.dotIc}>
                    <CheckIcon />
                  </div>
                  <div>
                    <h4>Можно проверить</h4>
                    <p>
                      Шифрование ключей, синхронизация деревьев, биллинг — весь код читается
                      построчно.
                    </p>
                  </div>
                </div>
                <div className={styles.reason}>
                  <div className={styles.dotIc}>
                    <CheckIcon />
                  </div>
                  <div>
                    <h4>Свой хостинг без лимитов</h4>
                    <p>Self-host версия на Docker Compose — без Limit Gate, без подписки.</p>
                  </div>
                </div>
              </div>

              <div className={styles.ossCta}>
                <a
                  className={`${styles.btn} ${styles.btnGhostOss}`}
                  href={GITHUB_URL}
                  target="_blank"
                  rel="noreferrer"
                >
                  <GitHubIcon />
                  Смотреть репозиторий
                </a>
                <a className={styles.btnText} href={`${GITHUB_URL}/blob/main/CONTRIBUTING.md`} target="_blank" rel="noreferrer">
                  Стать контрибьютором →
                </a>
              </div>
            </div>

            <div className={styles.reveal} data-reveal>
              <div className={styles.terminal}>
                <div className={styles.terminalBar}>
                  <span className={`${styles.tdot} ${styles.t1}`} />
                  <span className={`${styles.tdot} ${styles.t2}`} />
                  <span className={`${styles.tdot} ${styles.t3}`} />
                  <span>sai — self-host</span>
                </div>
                <div className={styles.terminalBody}>
                  <div className={styles.termStep}>
                    <div className={styles.num}>1</div>
                    <div style={{ flex: 1 }}>
                      <div className={styles.label}>Клонировать репозиторий</div>
                      <code>
                        <span className={styles.pfx}>$</span>git clone https://github.com/sai-app/sai.git
                      </code>
                    </div>
                  </div>
                  <div className={styles.termStep}>
                    <div className={styles.num}>2</div>
                    <div style={{ flex: 1 }}>
                      <div className={styles.label}>Настроить окружение</div>
                      <code>
                        <span className={styles.pfx}>$</span>cp .env.example .env
                      </code>
                    </div>
                  </div>
                  <div className={styles.termStep}>
                    <div className={styles.num}>3</div>
                    <div style={{ flex: 1 }}>
                      <div className={styles.label}>Запустить</div>
                      <code>
                        <span className={styles.pfx}>$</span>docker compose up -d
                      </code>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* FINAL CTA */}
        <section className={`${styles.closer} ${styles.reveal}`} data-reveal>
          <div className={styles.container}>
            <h2>Готов превратить идею в структуру?</h2>
            <p>Без регистрации, без карты. Или разверни свою копию за две минуты.</p>
            <div className={styles.ctaRow}>
              <form action={startApp}>
                <button className={`${styles.btn} ${styles.btnPrimary}`} type="submit">
                  Попробовать без регистрации
                </button>
              </form>
              <Link className={`${styles.btn} ${styles.btnSecondary}`} href="/capture">
                Quick Capture
              </Link>
            </div>
          </div>
        </section>
      </main>

      <footer className={styles.footer}>
        <div className={styles.container}>
          <div className={styles.footerTop}>
            <div className={styles.footerBrand}>
              <Link className={styles.logo} href="/">
                <svg className={styles.logoMark} viewBox="0 0 26 26" fill="none">
                  <circle cx="6" cy="8" r="3" fill="#4D8DFF" />
                  <circle cx="13" cy="19" r="3" fill="#2BD4A0" />
                  <circle cx="20" cy="8" r="3" fill="#FF9D4D" />
                </svg>
                Sai
              </Link>
              <p>
                Инструмент для структурированного мышления через ИИ. Один холст, три дерева, открытый
                код.
              </p>
            </div>
            <div className={styles.footerCol}>
              <h4>Продукт</h4>
              <ul>
                <li>
                  <a href="#trees">Деревья</a>
                </li>
                <li>
                  <a href="#features">Возможности</a>
                </li>
                <li>
                  <Link href="/explore">Explore</Link>
                </li>
                <li>
                  <Link href="/capture">Quick Capture</Link>
                </li>
              </ul>
            </div>
            <div className={styles.footerCol}>
              <h4>Открытый код</h4>
              <ul>
                <li>
                  <a href={GITHUB_URL} target="_blank" rel="noreferrer">
                    GitHub
                  </a>
                </li>
                <li>
                  <a href={`${GITHUB_URL}/blob/main/LICENSE`} target="_blank" rel="noreferrer">
                    Лицензия LGPL-3.0
                  </a>
                </li>
                <li>
                  <a href={`${GITHUB_URL}#readme`} target="_blank" rel="noreferrer">
                    Документация
                  </a>
                </li>
                <li>
                  <a href="#oss">Контрибьютинг</a>
                </li>
              </ul>
            </div>
          </div>
          <div className={styles.footerBottom}>
            <span>© 2026 Sai</span>
            <div className={styles.pills}>
              <span className={styles.pill}>open source</span>
              <span className={styles.pill}>LGPL-3.0</span>
              <span className={styles.pill}>v0.0.5</span>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
