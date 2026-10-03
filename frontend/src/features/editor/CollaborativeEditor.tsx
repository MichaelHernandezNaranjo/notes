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
import { YjsSignalRProvider, type PresenceUser } from './YjsSignalRProvider';

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
  /** Note is in the trash: read-only, with a banner and a Restore action. */
  trashed?: boolean;
  /** Location of the trashed note (ancestor names). */
  trashPath?: string | null;
  onRestore?: () => Promise<void> | void;
};

/**
 * Real-time collaborative BlockNote editor. Uses a Yjs document synced over
 * SignalR (see YjsSignalRProvider) as the single source of truth for
 * concurrent edits, so multiple users editing the same note see changes
 * merge instantly and without conflicts.
 */
export function CollaborativeEditor({ nodeId, noteName, onShare, trashed = false, trashPath, onRestore }: CollaborativeEditorProps) {
  const { user } = useAuth();
  const { t } = useI18n();
  const containerRef = useRef<HTMLDivElement>(null);
  const [presence, setPresence] = useState<PresenceUser[]>([]);
  const [saveState, setSaveState] = useState<'saved' | 'saving'>('saved');
  const [loadState, setLoadState] = useState<'loading' | 'ready' | 'error'>('loading');
  const [attempt, setAttempt] = useState(0);
  const [restoring, setRestoring] = useState(false);

  const ydocRef = useRef<Y.Doc>(new Y.Doc());
  const providerRef = useRef<YjsSignalRProvider | null>(null);

  if (!providerRef.current) {
    providerRef.current = new YjsSignalRProvider(nodeId, ydocRef.current);
  }
  // Trashed notes never send edits or snapshots (the server rejects them as well).
  providerRef.current.readOnly = trashed;

  const resolverRef = useRef<ReturnType<typeof createFileResolver> | null>(null);
  resolverRef.current ??= createFileResolver();
  const [uploadError, setUploadError] = useState<string | null>(null);

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
    if (provider.isSynced) setLoadState('ready');

    // Never leave the skeleton up forever: fail after a timeout or a connection error.
    const timeout = setTimeout(() => {
      if (!provider.isSynced) setLoadState('error');
    }, LOAD_TIMEOUT_MS);
    provider.connect().catch((error) => {
      console.error(error);
      setLoadState('error');
    });

    const onUpdate = () => {
      setSaveState('saving');
      const timer = setTimeout(() => setSaveState('saved'), 800);
      return () => clearTimeout(timer);
    };
    ydocRef.current.on('update', onUpdate);

    return () => {
      clearTimeout(timeout);
      ydocRef.current.off('update', onUpdate);
      provider.disconnect().catch(console.error);
    };
  }, [nodeId, attempt]);

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
      <EditorToolbar
        shareDisabled={trashed}
        title={noteName || t('editor.untitled')}
        saveState={saveState}
        presence={presence}
        onShare={onShare}
        onExportPdf={() => containerRef.current && exportNoteAsPdf(containerRef.current, noteName || 'note')}
        onExportPng={() => containerRef.current && exportNoteAsImage(containerRef.current, noteName || 'note', 'png')}
        onExportJpg={() => containerRef.current && exportNoteAsImage(containerRef.current, noteName || 'note', 'jpeg')}
      />

      <div className="relative min-h-0 flex-1">
        <div ref={containerRef} className="h-full overflow-y-auto bg-bg-base px-6 py-4">
          <BlockNoteView editor={editor} theme="light" editable={!trashed} />
        </div>

        {loadState !== 'ready' && (
          <div className="absolute inset-0 z-10 overflow-hidden bg-bg-base px-6 py-4" role="status" aria-live="polite">
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
