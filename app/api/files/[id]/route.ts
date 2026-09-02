import { ensureSchema, getBindings, getMediaRow } from '@/lib/iceberg-store';

type RouteContext = { params: Promise<{ id: string }> };

export const dynamic = 'force-dynamic';

type ChunkRow = { data: ArrayBuffer | ArrayBufferView | number[] };

function chunkBytes(value: ChunkRow['data']) {
  if (value instanceof ArrayBuffer) return new Uint8Array(value);
  if (ArrayBuffer.isView(value)) {
    return new Uint8Array(value.buffer, value.byteOffset, value.byteLength);
  }
  return Uint8Array.from(value);
}

export async function GET(_request: Request, { params }: RouteContext) {
  try {
    const { id } = await params;
    const row = await getMediaRow(id);
    if (!row) return new Response('Not found', { status: 404 });

    const { db } = getBindings();
    const chunks = await db
      .prepare('SELECT data FROM media_chunks WHERE media_id = ? ORDER BY chunk_index ASC')
      .bind(id)
      .all<ChunkRow>();
    if (!chunks.results.length && row.size > 0) {
      return new Response('Not found', { status: 404 });
    }

    const headers = new Headers();
    headers.set('Content-Type', row.content_type || 'application/octet-stream');
    headers.set('Content-Length', String(row.size));
    headers.set('Cache-Control', 'public, max-age=31536000, immutable');
    headers.set(
      'Content-Disposition',
      `inline; filename*=UTF-8''${encodeURIComponent(row.file_name)}`,
    );
    return new Response(new Blob(chunks.results.map((chunk) => chunkBytes(chunk.data))), {
      headers,
    });
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

    const { db } = getBindings();
    await db.batch([
      db.prepare('DELETE FROM media_chunks WHERE media_id = ?').bind(id),
      db.prepare('DELETE FROM media WHERE id = ?').bind(id),
    ]);
    return Response.json({ ok: true });
  } catch (error) {
    console.error(error);
    return Response.json({ error: 'Не удалось удалить файл.' }, { status: 500 });
  }
}
