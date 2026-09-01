import {
  clampCoordinate,
  ensureSchema,
  getBindings,
  listEvents,
  normalizeLinks,
  safeDate,
  safeDescription,
  safeTitle,
} from '@/lib/iceberg-store';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    return Response.json({ events: await listEvents() }, {
      headers: { 'Cache-Control': 'no-store' },
    });
  } catch (error) {
    console.error(error);
    return Response.json({ error: 'Не удалось загрузить айсберг.' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as Record<string, unknown>;
    const title = safeTitle(body.title);
    if (!title) {
      return Response.json({ error: 'Добавь слово или название события.' }, { status: 400 });
    }

    await ensureSchema();
    const { db } = getBindings();
    const id = crypto.randomUUID();
    const now = new Date().toISOString();

    await db
      .prepare(`INSERT INTO events (
        id, title, description, event_date, links, x, y, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`)
      .bind(
        id,
        title,
        safeDescription(body.description),
        safeDate(body.eventDate),
        JSON.stringify(normalizeLinks(body.links)),
        clampCoordinate(body.x, 50),
        clampCoordinate(body.y, 18),
        now,
        now,
      )
      .run();

    return Response.json({ id }, { status: 201 });
  } catch (error) {
    console.error(error);
    return Response.json({ error: 'Не удалось создать событие.' }, { status: 500 });
  }
}
