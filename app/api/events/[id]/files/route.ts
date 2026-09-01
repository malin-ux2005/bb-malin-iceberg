import { ensureSchema, getBindings } from '@/lib/iceberg-store';

type RouteContext = { params: Promise<{ id: string }> };

export const dynamic = 'force-dynamic';

export async function POST(request: Request, { params }: RouteContext) {
  let uploadedKey: string | null = null;

  try {
    const { id: eventId } = await params;
    await ensureSchema();
    const { db, files } = getBindings();
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
    if (file.size > 50 * 1024 * 1024) {
      return Response.json({ error: 'Один файл должен быть не больше 50 МБ.' }, { status: 413 });
    }

    const id = crypto.randomUUID();
    const safeName = file.name.replace(/[^\p{L}\p{N}._-]+/gu, '-').slice(0, 120) || 'file';
    uploadedKey = `events/${eventId}/${id}-${safeName}`;
    await files.put(uploadedKey, file.stream(), {
      httpMetadata: { contentType: file.type || 'application/octet-stream' },
    });

    await db
      .prepare(`INSERT INTO media (
        id, event_id, file_name, content_type, size, r2_key, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?)`)
      .bind(
        id,
        eventId,
        file.name.slice(0, 200) || 'file',
        file.type || 'application/octet-stream',
        file.size,
        uploadedKey,
        new Date().toISOString(),
      )
      .run();

    return Response.json({ id }, { status: 201 });
  } catch (error) {
    console.error(error);
    if (uploadedKey) {
      try {
        await getBindings().files.delete(uploadedKey);
      } catch {
        // The failed upload metadata is never exposed to the client.
      }
    }
    return Response.json({ error: 'Не удалось загрузить файл.' }, { status: 500 });
  }
}
