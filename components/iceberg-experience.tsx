'use client';

import {
  ArrowDown,
  CalendarDays,
  Check,
  Download,
  ExternalLink,
  Eye,
  FileText,
  Link as LinkIcon,
  LoaderCircle,
  Minus,
  MousePointer2,
  Pencil,
  Plus,
  RotateCcw,
  Trash2,
  Upload,
  X,
} from 'lucide-react';
import {
  type CSSProperties,
  type FormEvent,
  type MouseEvent,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { Textarea } from '@/components/ui/textarea';

type MediaItem = {
  id: string;
  eventId: string;
  fileName: string;
  contentType: string;
  size: number;
  createdAt: string;
};

type IcebergEvent = {
  id: string;
  title: string;
  description: string;
  eventDate: string | null;
  links: string[];
  x: number;
  y: number;
  createdAt: string;
  updatedAt: string;
  media: MediaItem[];
};

type EditorState = {
  title: string;
  description: string;
  eventDate: string;
  linksText: string;
  x: number;
  y: number;
  files: File[];
};

const STAGE_HEIGHT = 5200;
const MIN_ZOOM = 0.75;
const MAX_ZOOM = 1.5;
const MAX_DEPTH_KM = 1488;

const blankEditor = (x = 50, y = 18): EditorState => ({
  title: '',
  description: '',
  eventDate: '',
  linksText: '',
  x,
  y,
  files: [],
});

const editorFromEvent = (event: IcebergEvent): EditorState => ({
  title: event.title,
  description: event.description,
  eventDate: event.eventDate ?? '',
  linksText: event.links.join('\n'),
  x: event.x,
  y: event.y,
  files: [],
});

function linksFromText(value: string) {
  return value
    .split(/\r?\n/)
    .map((item) => item.trim())
    .filter(Boolean);
}

async function readJson<T>(response: Response): Promise<T> {
  const body = (await response.json().catch(() => ({}))) as T & { error?: string };
  if (!response.ok) throw new Error(body.error || 'Что-то пошло не так.');
  return body;
}

function formatSize(size: number) {
  if (size < 1024 * 1024) return `${Math.max(1, Math.round(size / 1024))} КБ`;
  return `${(size / 1024 / 1024).toFixed(1)} МБ`;
}

function EventFields({
  value,
  onChange,
  compact = false,
}: {
  value: EditorState;
  onChange: (next: EditorState) => void;
  compact?: boolean;
}) {
  const set = <K extends keyof EditorState>(key: K, nextValue: EditorState[K]) =>
    onChange({ ...value, [key]: nextValue });

  return (
    <div className={compact ? 'event-fields compact' : 'event-fields'}>
      <label>
        <span>Слово / ярлык</span>
        <Input
          autoFocus={!compact}
          maxLength={120}
          onChange={(event) => set('title', event.target.value)}
          placeholder="Название события"
          required
          value={value.title}
        />
      </label>

      <label>
        <span>История</span>
        <Textarea
          maxLength={8000}
          onChange={(event) => set('description', event.target.value)}
          placeholder="Что произошло, кто участвовал, почему это важно…"
          rows={compact ? 8 : 5}
          value={value.description}
        />
      </label>

      <label>
        <span>Дата или период</span>
        <Input
          maxLength={60}
          onChange={(event) => set('eventDate', event.target.value)}
          placeholder="Например: лето 2024"
          value={value.eventDate}
        />
      </label>

      <label>
        <span>Ссылки, по одной на строке</span>
        <Textarea
          onChange={(event) => set('linksText', event.target.value)}
          placeholder={'https://…\nhttps://…'}
          rows={3}
          value={value.linksText}
        />
      </label>

      <div className="position-fields">
        <label>
          <span>По горизонтали</span>
          <input
            aria-label="Положение по горизонтали"
            max="98"
            min="2"
            onChange={(event) => set('x', Number(event.target.value))}
            type="range"
            value={value.x}
          />
        </label>
        <label>
          <span>Глубина</span>
          <input
            aria-label="Глубина события"
            max="98"
            min="2"
            onChange={(event) => set('y', Number(event.target.value))}
            type="range"
            value={value.y}
          />
        </label>
      </div>

      <label className="file-picker">
        <Upload />
        <span>
          {value.files.length
            ? `Выбрано файлов: ${value.files.length}`
            : 'Добавить фото, видео или файлы'}
        </span>
        <input
          multiple
          onChange={(event) => set('files', Array.from(event.target.files ?? []))}
          type="file"
        />
      </label>
    </div>
  );
}

function MediaGallery({
  items,
  editable,
  onDelete,
}: {
  items: MediaItem[];
  editable: boolean;
  onDelete: (id: string) => void;
}) {
  if (!items.length) return null;

  return (
    <div className="media-gallery">
      {items.map((item) => {
        const source = `/api/files/${item.id}`;
        const isImage = item.contentType.startsWith('image/');
        const isVideo = item.contentType.startsWith('video/');
        const isAudio = item.contentType.startsWith('audio/');

        return (
          <div className="media-card" key={item.id}>
            {isImage ? (
              // Files are user-authored event evidence served by this site.
              // eslint-disable-next-line @next/next/no-img-element
              <img alt={item.fileName} loading="lazy" src={source} />
            ) : isVideo ? (
              <video controls preload="metadata" src={source} />
            ) : isAudio ? (
              <div className="audio-card">
                <FileText />
                <audio controls preload="metadata" src={source} />
              </div>
            ) : (
              <a className="document-card" href={source} target="_blank" rel="noreferrer">
                <FileText />
                <span>{item.fileName}</span>
                <Download />
              </a>
            )}
            <div className="media-meta">
              <span title={item.fileName}>{item.fileName}</span>
              <small>{formatSize(item.size)}</small>
            </div>
            {editable && (
              <Button
                aria-label={`Удалить ${item.fileName}`}
                className="media-delete"
                onClick={() => onDelete(item.id)}
                size="icon-sm"
                title="Удалить файл"
                type="button"
                variant="destructive"
              >
                <X />
              </Button>
            )}
          </div>
        );
      })}
    </div>
  );
}

export function IcebergExperience() {
  const [events, setEvents] = useState<IcebergEvent[]>([]);
  const [mode, setMode] = useState<'view' | 'edit'>('view');
  const [zoom, setZoom] = useState(1);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [scrollDepth, setScrollDepth] = useState(0);
  const [notice, setNotice] = useState('');
  const [draftPoint, setDraftPoint] = useState<{ x: number; y: number } | null>(null);
  const [newEvent, setNewEvent] = useState<EditorState>(blankEditor());
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [editor, setEditor] = useState<EditorState>(blankEditor());

  const selectedEvent = useMemo(
    () => events.find((event) => event.id === selectedId) ?? null,
    [events, selectedId],
  );

  const refreshEvents = useCallback(async () => {
    const response = await fetch('/api/events', { cache: 'no-store' });
    const data = await readJson<{ events: IcebergEvent[] }>(response);
    setEvents(data.events);
  }, []);

  useEffect(() => {
    refreshEvents()
      .catch((error: Error) => setNotice(error.message))
      .finally(() => setLoading(false));
  }, [refreshEvents]);

  useEffect(() => {
    if (selectedEvent) setEditor(editorFromEvent(selectedEvent));
  }, [selectedEvent]);

  useEffect(() => {
    if (!notice) return;
    const timeout = window.setTimeout(() => setNotice(''), 3600);
    return () => window.clearTimeout(timeout);
  }, [notice]);

  useEffect(() => {
    const updateDepth = () => {
      const maximum = Math.max(1, document.documentElement.scrollHeight - window.innerHeight);
      setScrollDepth(Math.min(100, Math.max(0, (window.scrollY / maximum) * 100)));
    };

    updateDepth();
    window.addEventListener('scroll', updateDepth, { passive: true });
    window.addEventListener('resize', updateDepth);
    return () => {
      window.removeEventListener('scroll', updateDepth);
      window.removeEventListener('resize', updateDepth);
    };
  }, []);

  const uploadFiles = async (eventId: string, files: File[]) => {
    for (const file of files) {
      const body = new FormData();
      body.append('file', file);
      await readJson(
        await fetch(`/api/events/${eventId}/files`, { method: 'POST', body }),
      );
    }
  };

  const handleCanvasClick = (event: MouseEvent<HTMLElement>) => {
    if (mode !== 'edit' || saving) return;
    if ((event.target as HTMLElement).closest('[data-event-pin]')) return;

    const rect = event.currentTarget.getBoundingClientRect();
    const x = Math.min(98, Math.max(2, ((event.clientX - rect.left) / rect.width) * 100));
    const y = Math.min(98, Math.max(2, ((event.clientY - rect.top) / rect.height) * 100));
    const point = { x: Number(x.toFixed(2)), y: Number(y.toFixed(2)) };
    setDraftPoint(point);
    setNewEvent(blankEditor(point.x, point.y));
  };

  const createEvent = async (event: FormEvent) => {
    event.preventDefault();
    if (!newEvent.title.trim()) return;
    setSaving(true);

    try {
      const created = await readJson<{ id: string }>(
        await fetch('/api/events', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            ...newEvent,
            links: linksFromText(newEvent.linksText),
            files: undefined,
          }),
        }),
      );
      await uploadFiles(created.id, newEvent.files);
      await refreshEvents();
      setDraftPoint(null);
      setSelectedId(created.id);
      setNotice('Событие добавлено');
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'Не удалось создать событие.');
    } finally {
      setSaving(false);
    }
  };

  const saveEvent = async (event: FormEvent) => {
    event.preventDefault();
    if (!selectedEvent || !editor.title.trim()) return;
    setSaving(true);

    try {
      await readJson(
        await fetch(`/api/events/${selectedEvent.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            ...editor,
            links: linksFromText(editor.linksText),
            files: undefined,
          }),
        }),
      );
      await uploadFiles(selectedEvent.id, editor.files);
      await refreshEvents();
      setNotice('Изменения сохранены');
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'Не удалось сохранить изменения.');
    } finally {
      setSaving(false);
    }
  };

  const deleteEvent = async () => {
    if (!selectedEvent || !window.confirm(`Удалить «${selectedEvent.title}»?`)) return;
    setSaving(true);
    try {
      await readJson(await fetch(`/api/events/${selectedEvent.id}`, { method: 'DELETE' }));
      setSelectedId(null);
      await refreshEvents();
      setNotice('Событие удалено');
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'Не удалось удалить событие.');
    } finally {
      setSaving(false);
    }
  };

  const deleteMedia = async (id: string) => {
    try {
      await readJson(await fetch(`/api/files/${id}`, { method: 'DELETE' }));
      await refreshEvents();
      setNotice('Файл удалён');
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'Не удалось удалить файл.');
    }
  };

  const adjustZoom = (delta: number) => {
    setZoom((value) => Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, Number((value + delta).toFixed(2)))));
  };

  const pageStyle = {
    '--zoom': zoom,
    '--label-scale': Math.min(1.18, Math.max(0.86, zoom)),
    minHeight: `${420 + STAGE_HEIGHT * zoom}px`,
  } as CSSProperties;
  const depthKm = Math.round((scrollDepth / 100) * MAX_DEPTH_KM);

  return (
    <main className={`iceberg-page mode-${mode}`} style={pageStyle}>
      <header className="peak-intro">
        <div className="hero-meta" aria-hidden="true">
          <span>BBM / ARCHIVE</span>
          <span>ОБЩАЯ ХРОНОЛОГИЯ</span>
        </div>
        <p className="peak-kicker">BOLSHIE BROTHERS MALIN</p>
        <h1>
          <span>ПИК</span>
          <i>/</i>
          <span>АЙСБЕРГ</span>
        </h1>
        <p className="peak-copy">
          Общая история, которую собирают все участники. Чем ниже ты
          погружаешься, тем менее очевидными становятся события.
        </p>
        <a className="dive-link" href="#iceberg-start">
          <span>Начать погружение</span>
          <ArrowDown />
        </a>
      </header>

      <section
        id="iceberg-start"
        className="iceberg-stage"
        aria-busy={loading}
        aria-label="Айсберг истории"
        onClick={handleCanvasClick}
      >
        <div className="world-art" aria-hidden="true">
          <div className="art-iceberg" />
          <div className="art-water" />
          <div className="art-abyss" />
          <div className="art-hell" />
          <div className="art-inferno" />
          <div className="art-grain" />
        </div>
        <div className="surface-rule" aria-hidden="true" />

        {mode === 'edit' && (
          <div className="edit-hint">
            <MousePointer2 />
            <span>Нажмите в любом месте, чтобы добавить событие</span>
          </div>
        )}

        {events.map((event) => (
          <button
            className="event-pin"
            data-event-pin
            key={event.id}
            onClick={(click) => {
              click.stopPropagation();
              setSelectedId(event.id);
            }}
            style={{ left: `${event.x}%`, top: `${event.y}%` }}
            type="button"
          >
            <span className="event-dot" />
            <span className="event-label">{event.title}</span>
          </button>
        ))}

        {!events.length && mode === 'edit' && !loading && (
          <button
            className="empty-point"
            aria-label="Добавить первое событие"
            onClick={(click) => {
              click.stopPropagation();
              const point = { x: 50, y: 18 };
              setDraftPoint(point);
              setNewEvent(blankEditor(point.x, point.y));
            }}
            title="Добавить событие"
            type="button"
          >
            <Plus />
          </button>
        )}

        {loading && (
          <div className="stage-loader" aria-label="Загрузка">
            <LoaderCircle />
          </div>
        )}
      </section>

      <aside className="depth-meter" aria-hidden="true">
        <div className="depth-readout">
          <span className="depth-meter-label">ГЛУБИНА</span>
          <output>{String(depthKm).padStart(4, '0')}</output>
          <small>КМ</small>
        </div>
        <div className="depth-scale">
          <span className="depth-track">
            <span style={{ height: `${scrollDepth}%` }} />
          </span>
          <span className="depth-ticks">
            <i>0000</i>
            <i>0744</i>
            <i>1488</i>
          </span>
        </div>
      </aside>

      <nav className="floating-controls" aria-label="Управление айсбергом">
        <div className="mode-switch">
          <Button
            className={`control mode-control ${mode === 'view' ? 'active' : ''}`}
            onClick={() => setMode('view')}
            title="Просмотр"
            aria-label="Режим просмотра"
            variant="ghost"
          >
            <Eye />
            <span>Смотреть</span>
          </Button>
          <Button
            className={`control mode-control ${mode === 'edit' ? 'active' : ''}`}
            onClick={() => setMode('edit')}
            title="Редактирование"
            aria-label="Режим редактирования"
            variant="ghost"
          >
            <Pencil />
            <span>Редактировать</span>
          </Button>
        </div>
        <div className="zoom-switch">
          <Button
            className="control"
            disabled={zoom <= MIN_ZOOM}
            onClick={() => adjustZoom(-0.05)}
            size="icon-lg"
            title="Отдалить"
            aria-label="Уменьшить масштаб"
            variant="ghost"
          >
            <Minus />
          </Button>
          <span className="scale-value" aria-live="polite">{Math.round(zoom * 100)}%</span>
          <Button
            className="control"
            disabled={zoom >= MAX_ZOOM}
            onClick={() => adjustZoom(0.05)}
            size="icon-lg"
            title="Приблизить"
            aria-label="Увеличить масштаб"
            variant="ghost"
          >
            <Plus />
          </Button>
          <Button
            className="control reset-control"
            onClick={() => setZoom(1)}
            size="icon-lg"
            title="Сбросить масштаб"
            aria-label="Сбросить масштаб"
            variant="ghost"
          >
            <RotateCcw />
          </Button>
        </div>
      </nav>

      {notice && <div className="iceberg-notice" role="status">{notice}</div>}

      <Dialog
        open={Boolean(draftPoint)}
        onOpenChange={(open) => {
          if (!open && !saving) setDraftPoint(null);
        }}
      >
        <DialogContent className="event-dialog">
          <form onSubmit={createEvent}>
            <DialogHeader>
              <DialogTitle>Новое событие</DialogTitle>
              <DialogDescription>
                Ярлык появится ровно в выбранной точке айсберга.
              </DialogDescription>
            </DialogHeader>
            <EventFields onChange={setNewEvent} value={newEvent} />
            <DialogFooter>
              <Button disabled={saving || !newEvent.title.trim()} type="submit">
                {saving ? <LoaderCircle className="spin" /> : <Plus />}
                Добавить
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Sheet
        open={Boolean(selectedEvent)}
        onOpenChange={(open) => {
          if (!open && !saving) setSelectedId(null);
        }}
      >
        <SheetContent className="event-sheet" side="right">
          {selectedEvent && mode === 'view' ? (
            <>
              <SheetHeader>
                {selectedEvent.eventDate && (
                  <p className="event-date"><CalendarDays />{selectedEvent.eventDate}</p>
                )}
                <SheetTitle>{selectedEvent.title}</SheetTitle>
                <SheetDescription className="sr-only">
                  История и материалы события
                </SheetDescription>
              </SheetHeader>
              <div className="event-story">
                {selectedEvent.description && <p>{selectedEvent.description}</p>}
                <MediaGallery editable={false} items={selectedEvent.media} onDelete={() => undefined} />
                {selectedEvent.links.length > 0 && (
                  <div className="source-links">
                    {selectedEvent.links.map((link) => (
                      <a href={link} key={link} rel="noreferrer" target="_blank">
                        <LinkIcon />
                        <span>{new URL(link).hostname}</span>
                        <ExternalLink />
                      </a>
                    ))}
                  </div>
                )}
              </div>
            </>
          ) : selectedEvent ? (
            <form className="event-editor" onSubmit={saveEvent}>
              <SheetHeader>
                <SheetTitle>Редактирование</SheetTitle>
                <SheetDescription>Меняй историю, положение и материалы события.</SheetDescription>
              </SheetHeader>
              <EventFields compact onChange={setEditor} value={editor} />
              <MediaGallery editable items={selectedEvent.media} onDelete={deleteMedia} />
              <div className="editor-actions">
                <Button disabled={saving} onClick={deleteEvent} type="button" variant="destructive">
                  <Trash2 /> Удалить
                </Button>
                <Button disabled={saving || !editor.title.trim()} type="submit">
                  {saving ? <LoaderCircle className="spin" /> : <Check />}
                  Сохранить
                </Button>
              </div>
            </form>
          ) : null}
        </SheetContent>
      </Sheet>
    </main>
  );
}
