import '@blocknote/core/fonts/inter.css';
import { withCollaboration } from '@blocknote/core/yjs';
import { BlockNoteView } from '@blocknote/mantine';
import '@blocknote/mantine/style.css';
import { useCreateBlockNote } from '@blocknote/react';
import { useEffect, useRef, useState } from 'react';
import * as Y from 'yjs';
import { useAuth } from '../auth/AuthContext';
import { useI18n } from '../../i18n/I18nProvider';
import { exportNoteAsImage, exportNoteAsPdf } from './exportNote';
import { EditorToolbar } from './EditorToolbar';
import { createFileResolver, uploadNoteImage } from './noteFiles';
import { YjsSignalRProvider, type PresenceUser, type SaveState } from './YjsSignalRProvider';
import { formatBytes } from '../../utils/format';

const LOAD_TIMEOUT_MS = 10000;
const COLORS = ['#10B981', '#3B82F6', '#8B5CF6', '#F59E0B', '#EF4444'];

function colorForUser(id: string): string {
  const index = id.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0) % COLORS.length;
  return COLORS[index];
}

export type CollaborativeEditorProps = {
  nodeId: string;
  noteName: string;
  onShare: () => void;
  /** Mobile: go back to the explorer (shown as an arrow in the toolbar). */
  onBack?: () => void;
  /** Note is in the trash: read-only, with a banner and a Restore action. */
  trashed?: boolean;
  /** Location of the trashed note (ancestor names). */
  trashPath?: string | null;
  onRestore?: () => Promise<void> | void;
  /** The user may read but not edit (Read access): the editor is locked and nothing is sent to the server. */
  readOnly?: boolean;
  /** Only owners manage sharing; everybody else gets no Share button. */
  canManage?: boolean;
  /** Live access change pushed by the server (null = access lost). */
  onAccessChanged?: (access: string | null) => void;
  /** Stored size of the note and the per-note limit, in bytes (from the server). */
  sizeBytes?: number;
  maxBytes?: number;
};

/**
 * Real-time collaborative BlockNote editor. Uses a Yjs document synced over
 * SignalR (see YjsSignalRProvider) as the single source of truth for
 * concurrent edits, so multiple users editing the same note see changes
 * merge instantly and without conflicts.
 */
export function CollaborativeEditor({ nodeId, noteName, onShare, onBack, trashed = false, trashPath, onRestore, readOnly = false, canManage = true, onAccessChanged, sizeBytes: initialSize, maxBytes: initialMax }: CollaborativeEditorProps) {
  const locked = trashed || readOnly;
  const { user } = useAuth();
  const { t } = useI18n();
  const containerRef = useRef<HTMLDivElement>(null);
  const [presence, setPresence] = useState<PresenceUser[]>([]);
  const [saveState, setSaveState] = useState<SaveState>('saved');
  const [size, setSize] = useState<{ bytes: number; max?: number }>({ bytes: initialSize ?? 0, max: initialMax || undefined });
  const [tooLarge, setTooLarge] = useState(false);
  const [dismissedLevel, setDismissedLevel] = useState<string | null>(null);
  // The node (size and limit) arrives after the editor mounts.
  useEffect(() => {
    if (initialMax) setSize({ bytes: initialSize ?? 0, max: initialMax });
  }, [initialSize, initialMax]);
  const [loadState, setLoadState] = useState<'loading' | 'ready' | 'error'>('loading');
  const [attempt, setAttempt] = useState(0);
  const [restoring, setRestoring] = useState(false);

  const ydocRef = useRef<Y.Doc>(new Y.Doc());
  const providerRef = useRef<YjsSignalRProvider | null>(null);

  if (!providerRef.current) {
    providerRef.current = new YjsSignalRProvider(nodeId, ydocRef.current);
  }
  // Trashed or read-only notes never send edits or snapshots (the server rejects them as well).
  providerRef.current.readOnly = locked;

  const resolverRef = useRef<ReturnType<typeof createFileResolver> | null>(null);
  resolverRef.current ??= createFileResolver();
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [quotaReached, setQuotaReached] = useState(false);
  const onAccessChangedRef = useRef(onAccessChanged);
  onAccessChangedRef.current = onAccessChanged;

  const editor = useCreateBlockNote(
    withCollaboration({
      collaboration: {
        provider: providerRef.current,
        fragment: ydocRef.current.getXmlFragment('blocknote'),
        user: {
          name: user?.displayName ?? 'Anonymous',
          color: colorForUser(user?.id ?? 'anon'),
        },
      },
      uploadFile: async (file: File) => {
        try {
          setUploadError(null);
          return await uploadNoteImage(nodeId, file);
        } catch (error) {
          setUploadError(error instanceof Error ? error.message : t('editor.uploadError'));
          throw error;
        }
      },
      resolveFileUrl: (url: string) => resolverRef.current!.resolve(url),
    }),
  );

  // Release the blob: URLs created for images when the editor goes away.
  useEffect(() => () => resolverRef.current?.dispose(), []);

  useEffect(() => {
    const provider = providerRef.current!;
    provider.onPresenceUpdate(setPresence);
    provider.onSynced(() => setLoadState('ready'));
    provider.onQuotaExceeded(() => setQuotaReached(true));
    provider.onSaveState((s) => {
      setSaveState(s);
      if (s === 'saved') setTooLarge(false);
    });
    provider.onSize((bytes, max) => {
      setSize({ bytes, max: max || undefined });
      setTooLarge(false);
    });
    provider.onNoteTooLarge((max) => {
      setTooLarge(true);
      if (max) setSize((prev) => ({ bytes: prev.bytes, max }));
    });
    provider.onAccessChanged((access) => onAccessChangedRef.current?.(access));
    if (provider.isSynced) setLoadState('ready');

    // Never leave the skeleton up forever: fail after a timeout or a connection error.
    const timeout = setTimeout(() => {
      if (!provider.isSynced) setLoadState('error');
    }, LOAD_TIMEOUT_MS);
    provider.connect().catch((error) => {
      console.error(error);
      setLoadState('error');
    });

    // Closing the tab with edits the server has not confirmed would lose them: ask first.
    const onBeforeUnload = (event: BeforeUnloadEvent) => {
      if (provider.hasUnsavedChanges) {
        event.preventDefault();
        event.returnValue = '';
      }
    };
    window.addEventListener('beforeunload', onBeforeUnload);

    return () => {
      clearTimeout(timeout);
      window.removeEventListener('beforeunload', onBeforeUnload);
      provider.disconnect().catch(console.error);
    };
  }, [nodeId, attempt]);

  // Size warnings: 80 % (dismissible), 95 % (fixed), at the limit or refused by the server (fixed, changes are not being saved).
  const ratio = size.max ? size.bytes / size.max : 0;
  const sizeLevel: 'warn' | 'critical' | 'limit' | null = tooLarge || ratio >= 1 ? 'limit' : ratio >= 0.95 ? 'critical' : ratio >= 0.8 ? 'warn' : null;

  const retry = () => {
    setLoadState('loading');
    setAttempt((n) => n + 1);
  };

  return (
    <div className="flex h-full min-h-0 flex-col">
      {trashed && (
        <div
          role="alert"
          className="flex shrink-0 items-center justify-between gap-3 border-b border-amber-300 bg-amber-50 px-4 py-2 text-sm text-amber-900"
        >
          <span className="min-w-0 truncate">
            {t('editor.trashedNotice')}
            {trashPath ? ` ${t('editor.trashedLocation')}: ${trashPath}` : ''}
          </span>
          {onRestore && (
            <button
              type="button"
              disabled={restoring}
              onClick={async () => {
                setRestoring(true);
                try {
                  await onRestore();
                } finally {
                  setRestoring(false);
                }
              }}
              className="shrink-0 rounded-md bg-amber-600 px-3 py-1 font-medium text-white hover:bg-amber-700 disabled:opacity-60"
            >
              {t('tree.restore')}
            </button>
          )}
        </div>
      )}
      {sizeLevel && !(sizeLevel === 'warn' && dismissedLevel === 'warn') && (
        <div
          role={sizeLevel === 'warn' ? 'status' : 'alert'}
          className={`flex shrink-0 items-center justify-between gap-3 border-b px-3 py-2 text-sm sm:px-4 ${
            sizeLevel === 'warn' ? 'border-amber-300 bg-amber-50 text-amber-900' : 'border-red-300 bg-red-50 text-red-800'
          }`}
        >
          <span className="min-w-0">
            {t(`editor.size.${sizeLevel}`)
              .replace('{used}', formatBytes(size.bytes))
              .replace('{max}', formatBytes(size.max ?? 0, 0))}
          </span>
          {sizeLevel === 'warn' && (
            <button type="button" onClick={() => setDismissedLevel('warn')} className="touch-target shrink-0 underline">
              {t('common.close')}
            </button>
          )}
        </div>
      )}
      {quotaReached && (
        <div
          role="alert"
          className="flex shrink-0 items-center justify-between gap-3 border-b border-red-300 bg-red-50 px-3 py-2 text-sm text-red-800 sm:px-4"
        >
          <span className="min-w-0">{t('storage.editorFull')}</span>
          <button type="button" onClick={() => setQuotaReached(false)} className="touch-target shrink-0 underline">
            {t('common.close')}
          </button>
        </div>
      )}
      {uploadError && (
        <div
          role="alert"
          className="flex shrink-0 items-center justify-between gap-3 border-b border-red-300 bg-red-50 px-4 py-2 text-sm text-red-800"
        >
          <span className="min-w-0 truncate">{uploadError}</span>
          <button type="button" onClick={() => setUploadError(null)} className="shrink-0 underline">
            {t('common.close')}
          </button>
        </div>
      )}
      {readOnly && !trashed && (
        <div role="status" className="flex shrink-0 items-center gap-2 border-b border-blue-200 bg-blue-50 px-3 py-2 text-sm text-blue-900 sm:px-4">
          <span aria-hidden="true">👁</span>
          <span className="min-w-0">{t('sharing.readOnlyNotice')}</span>
        </div>
      )}
      <EditorToolbar
        shareDisabled={trashed}
        canShare={canManage}
        readOnly={readOnly && !trashed}
        title={noteName || t('editor.untitled')}
        saveState={saveState}
        sizeLabel={size.max ? t('editor.size.label').replace('{used}', formatBytes(size.bytes)).replace('{max}', formatBytes(size.max, 0)) : undefined}
        presence={presence}
        onShare={onShare}
        onBack={onBack}
        onExportPdf={() => containerRef.current && exportNoteAsPdf(containerRef.current, noteName || 'note')}
        onExportPng={() => containerRef.current && exportNoteAsImage(containerRef.current, noteName || 'note', 'png')}
        onExportJpg={() => containerRef.current && exportNoteAsImage(containerRef.current, noteName || 'note', 'jpeg')}
      />

      <div className="relative min-h-0 flex-1">
        <div ref={containerRef} className="h-full overflow-y-auto bg-bg-base px-3 py-4 sm:px-6">
          <BlockNoteView editor={editor} theme="light" editable={!locked} />
        </div>

        {loadState !== 'ready' && (
          <div className="absolute inset-0 z-10 overflow-hidden bg-bg-base px-3 py-4 sm:px-6" role="status" aria-live="polite">
            {loadState === 'error' ? (
              <div className="flex h-full flex-col items-center justify-center gap-3 text-sm text-neutral-700">
                <p>{t('editor.loadError')}</p>
                <button
                  type="button"
                  onClick={retry}
                  className="rounded-md bg-accent-blue px-3 py-1.5 text-white hover:bg-accent-blue-dark"
                >
                  {t('editor.retry')}
                </button>
              </div>
            ) : (
              <div className="mx-auto max-w-3xl animate-pulse space-y-4 pt-4" aria-label={t('common.loading')}>
                <div className="h-8 w-2/5 rounded bg-neutral-200" />
                <div className="h-4 w-full rounded bg-neutral-200" />
                <div className="h-4 w-11/12 rounded bg-neutral-200" />
                <div className="h-4 w-4/5 rounded bg-neutral-200" />
                <div className="h-6 w-1/3 rounded bg-neutral-200" />
                <div className="h-4 w-full rounded bg-neutral-200" />
                <div className="h-4 w-10/12 rounded bg-neutral-200" />
                <div className="h-4 w-2/3 rounded bg-neutral-200" />
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
