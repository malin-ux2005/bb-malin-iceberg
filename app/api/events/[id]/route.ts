import {
  clampCoordinate,
  ensureSchema,
  getBindings,
  normalizeLinks,
  safeDate,
  safeDescription,
  safeTitle,
} from '@/lib/iceberg-store';

type RouteContext = { params: Promise<{ id: string }> };

export const dynamic = 'force-dynamic';

export async function PATCH(request: Request, { params }: RouteContext) {
  try {
    const { id } = await params;
    const body = (await request.json()) as Record<string, unknown>;
    const title = safeTitle(body.title);
    if (!title) {
      return Response.json({ error: 'Название не может быть пустым.' }, { status: 400 });
    }

    await ensureSchema();
    const { db } = getBindings();
    const result = await db
      .prepare(`UPDATE events SET
        title = ?, description = ?, event_date = ?, links = ?, x = ?, y = ?, updated_at = ?
        WHERE id = ?`)
      .bind(
        title,
        safeDescription(body.description),
        safeDate(body.eventDate),
        JSON.stringify(normalizeLinks(body.links)),
        clampCoordinate(body.x, 50),
        clampCoordinate(body.y, 18),
        new Date().toISOString(),
        id,
      )
      .run();

    if (!result.meta.changes) {
      return Response.json({ error: 'Событие не найдено.' }, { status: 404 });
    }

    return Response.json({ ok: true });
  } catch (error) {
    console.error(error);
    return Response.json({ error: 'Не удалось сохранить изменения.' }, { status: 500 });
  }
}

export async function DELETE(_request: Request, { params }: RouteContext) {
  try {
    const { id } = await params;
    await ensureSchema();
    const { db } = getBindings();
    await db.batch([
      db
        .prepare('DELETE FROM media_chunks WHERE media_id IN (SELECT id FROM media WHERE event_id = ?)')
        .bind(id),
      db.prepare('DELETE FROM media WHERE event_id = ?').bind(id),
      db.prepare('DELETE FROM events WHERE id = ?').bind(id),
    ]);

    return Response.json({ ok: true });
  } catch (error) {
    console.error(error);
    return Response.json({ error: 'Не удалось удалить событие.' }, { status: 500 });
  }
}
