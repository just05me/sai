import { auth } from '@/auth';
import { prisma } from '@/server/prisma';
import { ExportService, type ExportAudience, type ExportFormat } from '@/server/services/export';

export const runtime = 'nodejs';

const FORMATS: ExportFormat[] = ['md', 'txt', 'pdf', 'json', 'mermaid'];

function toResponseBody(body: string | Buffer): BodyInit {
  if (typeof body === 'string') return body;
  return Uint8Array.from(body);
}
function buildContentDisposition(disposition: 'attachment' | 'inline', filename: string): string {
  const asciiFallback =
    filename
      .replace(/[^\x20-\x7E]/g, '_')
      .replace(/["\\]/g, '_')
      .trim() || 'export';
  const encoded = encodeURIComponent(filename).replace(/[!'()*]/g, (c) =>
    `%${c.charCodeAt(0).toString(16).toUpperCase()}`,
  );
  return `${disposition}; filename="${asciiFallback}"; filename*=UTF-8''${encoded}`;
}

export async function GET(req: Request, { params }: { params: Promise<{ projectId: string }> }) {
  const session = await auth();
  if (!session?.user?.id) return new Response('Unauthorized', { status: 401 });

  const { projectId } = await params;
  const url = new URL(req.url);
  const formatParam = url.searchParams.get('format') ?? 'md';
  const format: ExportFormat = FORMATS.includes(formatParam as ExportFormat)
    ? (formatParam as ExportFormat)
    : 'md';
  const audience: ExportAudience = url.searchParams.get('audience') === 'ai' ? 'ai' : 'human';
  const trees = url.searchParams.get('trees')?.split(',') as ('DEV' | 'FUNC' | 'BIZ')[] | undefined;

  const project = await prisma.project.findUniqueOrThrow({
    where: { id: projectId },
    include: { workspace: { include: { members: { where: { userId: session.user.id } } } } },
  });
  if (!project.workspace.members.length) return new Response('Forbidden', { status: 403 });

  const { contentType, body, disposition, ext } = await ExportService.build(projectId, format, {
    trees,
    audience,
  });

  const suffix = audience === 'ai' ? '-prompt' : '';
  const safeName = project.name.replace(/[^\p{L}\p{N}\-_ ]/gu, '').trim() || 'project';
  const filename = `${safeName}${suffix}.${ext}`;

  const responseBody = toResponseBody(body);

  return new Response(responseBody, {
    headers: {
      'Content-Type': contentType,
      'Content-Disposition': buildContentDisposition(disposition, filename),
    },
  });
}
