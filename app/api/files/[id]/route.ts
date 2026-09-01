import { ensureSchema, getBindings, getMediaRow } from '@/lib/iceberg-store';

type RouteContext = { params: Promise<{ id: string }> };

export const dynamic = 'force-dynamic';

export async function GET(_request: Request, { params }: RouteContext) {
  try {
    const { id } = await params;
    const row = await getMediaRow(id);
    if (!row) return new Response('Not found', { status: 404 });

    const object = await getBindings().files.get(row.r2_key);
    if (!object) return new Response('Not found', { status: 404 });

    const headers = new Headers();
    object.writeHttpMetadata(headers);
    headers.set('Content-Type', row.content_type || 'application/octet-stream');
    headers.set('Content-Length', String(row.size));
    headers.set('Cache-Control', 'public, max-age=31536000, immutable');
    headers.set(
      'Content-Disposition',
      `inline; filename*=UTF-8''${encodeURIComponent(row.file_name)}`,
    );
    return new Response(object.body, { headers });
  } catch (error) {
    console.error(error);
    return new Response('File unavailable', { status: 500 });
  }
}

export async function DELETE(_request: Request, { params }: RouteContext) {
  try {
    const { id } = await params;
    await ensureSchema();
    const row = await getMediaRow(id);
    if (!row) {
      return Response.json({ error: 'Файл не найден.' }, { status: 404 });
    }

    const { db, files } = getBindings();
    await files.delete(row.r2_key);
    await db.prepare('DELETE FROM media WHERE id = ?').bind(id).run();
    return Response.json({ ok: true });
  } catch (error) {
    console.error(error);
    return Response.json({ error: 'Не удалось удалить файл.' }, { status: 500 });
  }
}
