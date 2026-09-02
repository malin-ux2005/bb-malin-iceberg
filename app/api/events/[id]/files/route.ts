import { ensureSchema, getBindings } from '@/lib/iceberg-store';

type RouteContext = { params: Promise<{ id: string }> };

export const dynamic = 'force-dynamic';

export async function POST(request: Request, { params }: RouteContext) {
  try {
    const { id: eventId } = await params;
    await ensureSchema();
    const { db } = getBindings();
    const event = await db
      .prepare('SELECT id FROM events WHERE id = ?')
      .bind(eventId)
      .first<{ id: string }>();

    if (!event) {
      return Response.json({ error: 'Событие не найдено.' }, { status: 404 });
    }

    const formData = await request.formData();
    const file = formData.get('file');
    if (!(file instanceof File)) {
      return Response.json({ error: 'Выбери файл.' }, { status: 400 });
    }
    if (file.size > 20 * 1024 * 1024) {
      return Response.json({ error: 'Один файл должен быть не больше 20 МБ.' }, { status: 413 });
    }

    const id = crypto.randomUUID();
    const bytes = new Uint8Array(await file.arrayBuffer());
    const chunkSize = 900 * 1024;
    const statements = [
      db
        .prepare(`INSERT INTO media (
        id, event_id, file_name, content_type, size, r2_key, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?)`)
        .bind(
          id,
          eventId,
          file.name.slice(0, 200) || 'file',
          file.type || 'application/octet-stream',
          file.size,
          `d1:${id}`,
          new Date().toISOString(),
        ),
    ];

    for (let offset = 0, chunkIndex = 0; offset < bytes.length; offset += chunkSize, chunkIndex += 1) {
      statements.push(
        db
          .prepare('INSERT INTO media_chunks (media_id, chunk_index, data) VALUES (?, ?, ?)')
          .bind(id, chunkIndex, bytes.slice(offset, offset + chunkSize).buffer),
      );
    }

    await db.batch(statements);

    return Response.json({ id }, { status: 201 });
  } catch (error) {
    console.error(error);
    return Response.json({ error: 'Не удалось загрузить файл.' }, { status: 500 });
  }
}
