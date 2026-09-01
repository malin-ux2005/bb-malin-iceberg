import { env } from 'cloudflare:workers';

export type StoredMedia = {
  id: string;
  eventId: string;
  fileName: string;
  contentType: string;
  size: number;
  createdAt: string;
};

export type StoredEvent = {
  id: string;
  title: string;
  description: string;
  eventDate: string | null;
  links: string[];
  x: number;
  y: number;
  createdAt: string;
  updatedAt: string;
  media: StoredMedia[];
};

type EventRow = {
  id: string;
  title: string;
  description: string;
  event_date: string | null;
  links: string;
  x: number;
  y: number;
  created_at: string;
  updated_at: string;
};

export type MediaRow = {
  id: string;
  event_id: string;
  file_name: string;
  content_type: string;
  size: number;
  r2_key: string;
  created_at: string;
};

let schemaPromise: Promise<void> | null = null;

export function getBindings() {
  if (!env.DB || !env.FILES) {
    throw new Error('Хранилище сайта пока недоступно.');
  }

  return { db: env.DB, files: env.FILES };
}

export async function ensureSchema() {
  if (!schemaPromise) {
    const { db } = getBindings();
    schemaPromise = db
      .batch([
        db.prepare(`CREATE TABLE IF NOT EXISTS events (
          id TEXT PRIMARY KEY,
          title TEXT NOT NULL,
          description TEXT NOT NULL DEFAULT '',
          event_date TEXT,
          links TEXT NOT NULL DEFAULT '[]',
          x REAL NOT NULL,
          y REAL NOT NULL,
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL
        )`),
        db.prepare(`CREATE TABLE IF NOT EXISTS media (
          id TEXT PRIMARY KEY,
          event_id TEXT NOT NULL,
          file_name TEXT NOT NULL,
          content_type TEXT NOT NULL,
          size INTEGER NOT NULL,
          r2_key TEXT NOT NULL,
          created_at TEXT NOT NULL,
          FOREIGN KEY (event_id) REFERENCES events(id) ON DELETE CASCADE
        )`),
        db.prepare(
          'CREATE INDEX IF NOT EXISTS events_position_idx ON events(y, x)',
        ),
        db.prepare(
          'CREATE INDEX IF NOT EXISTS media_event_id_idx ON media(event_id)',
        ),
      ])
      .then(() => undefined)
      .catch((error) => {
        schemaPromise = null;
        throw error;
      });
  }

  return schemaPromise;
}

function parseLinks(value: string) {
  try {
    const parsed = JSON.parse(value) as unknown;
    return Array.isArray(parsed)
      ? parsed.filter((item): item is string => typeof item === 'string')
      : [];
  } catch {
    return [];
  }
}

function publicMedia(row: MediaRow): StoredMedia {
  return {
    id: row.id,
    eventId: row.event_id,
    fileName: row.file_name,
    contentType: row.content_type,
    size: row.size,
    createdAt: row.created_at,
  };
}

export async function listEvents(): Promise<StoredEvent[]> {
  await ensureSchema();
  const { db } = getBindings();
  const [eventResult, mediaResult] = await Promise.all([
    db.prepare('SELECT * FROM events ORDER BY y ASC, created_at ASC').all<EventRow>(),
    db.prepare('SELECT * FROM media ORDER BY created_at ASC').all<MediaRow>(),
  ]);
  const mediaByEvent = new Map<string, StoredMedia[]>();

  for (const row of mediaResult.results) {
    const eventMedia = mediaByEvent.get(row.event_id) ?? [];
    eventMedia.push(publicMedia(row));
    mediaByEvent.set(row.event_id, eventMedia);
  }

  return eventResult.results.map((row) => ({
    id: row.id,
    title: row.title,
    description: row.description,
    eventDate: row.event_date,
    links: parseLinks(row.links),
    x: row.x,
    y: row.y,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    media: mediaByEvent.get(row.id) ?? [],
  }));
}

export async function getMediaRow(id: string) {
  await ensureSchema();
  const { db } = getBindings();
  return db.prepare('SELECT * FROM media WHERE id = ?').bind(id).first<MediaRow>();
}

export function normalizeLinks(value: unknown) {
  if (!Array.isArray(value)) return [];
  const links: string[] = [];

  for (const item of value) {
    if (typeof item !== 'string') continue;
    try {
      const url = new URL(item.trim());
      if ((url.protocol === 'http:' || url.protocol === 'https:') && links.length < 12) {
        links.push(url.toString());
      }
    } catch {
      // Invalid URLs are ignored rather than saved as broken source links.
    }
  }

  return links;
}

export function clampCoordinate(value: unknown, fallback: number) {
  const number = Number(value);
  if (!Number.isFinite(number)) return fallback;
  return Math.min(98, Math.max(2, number));
}

export function safeTitle(value: unknown) {
  return typeof value === 'string' ? value.trim().slice(0, 120) : '';
}

export function safeDescription(value: unknown) {
  return typeof value === 'string' ? value.trim().slice(0, 8000) : '';
}

export function safeDate(value: unknown) {
  if (typeof value !== 'string' || !value.trim()) return null;
  return value.trim().slice(0, 60);
}
