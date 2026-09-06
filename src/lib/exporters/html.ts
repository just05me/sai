import type { Edge, Node, Project, Tree } from '@prisma/client';
import { marked } from 'marked';
import { buildSpecMarkdown, type ExportAudience } from './spec';

/**
 * Самодостаточная HTML-страница для печати в PDF. Открывается в новой вкладке
 * и сразу вызывает window.print() — пользователь сохраняет «Сохранить как PDF».
 */
export function exportHtml(
  project: Project,
  trees: Tree[],
  nodes: Node[],
  audience: ExportAudience = 'human',
  edges: Edge[] = [],
): string {
  const md = buildSpecMarkdown(project, trees, nodes, { audience, edges });
  const bodyHtml = marked.parse(md, { async: false }) as string;
  const title = escapeHtml(project.name);

  return `<!DOCTYPE html>
<html lang="ru">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${title}</title>
<style>
  :root { color-scheme: light; }
  * { box-sizing: border-box; }
  body {
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
    line-height: 1.6;
    color: #1a1a1a;
    max-width: 760px;
    margin: 0 auto;
    padding: 48px 32px;
  }
  h1 { font-size: 28px; border-bottom: 2px solid #eaeaea; padding-bottom: 12px; margin-top: 0; }
  h2 { font-size: 22px; margin-top: 32px; border-bottom: 1px solid #eaeaea; padding-bottom: 6px; }
  h3 { font-size: 18px; margin-top: 24px; }
  h4, h5, h6 { font-size: 15px; margin-top: 18px; }
  blockquote { margin: 16px 0; padding: 8px 16px; border-left: 4px solid #d0d0d0; color: #555; background: #fafafa; }
  code { background: #f2f2f2; padding: 2px 6px; border-radius: 4px; font-size: 0.9em; }
  ul { padding-left: 22px; }
  hr { border: none; border-top: 1px solid #eaeaea; margin: 32px 0; }
  a { color: #2563eb; }
  @media print {
    body { padding: 0; max-width: none; }
    .print-hint { display: none; }
  }
</style>
</head>
<body>
<div class="print-hint" style="background:#fff7ed;border:1px solid #fed7aa;border-radius:8px;padding:12px 16px;margin-bottom:24px;font-size:14px;color:#9a3412;">
  Откройте печать (Ctrl/Cmd&nbsp;+&nbsp;P) и выберите «Сохранить как PDF». Окно печати откроется автоматически.
</div>
${bodyHtml}
<script>
  window.addEventListener('load', function () {
    setTimeout(function () { window.print(); }, 300);
  });
</script>
</body>
</html>`;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
