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
import { PresenceAvatars } from './PresenceAvatars';
import { YjsSignalRProvider, type PresenceUser } from './YjsSignalRProvider';

const COLORS = ['#10B981', '#3B82F6', '#8B5CF6', '#F59E0B', '#EF4444'];

function colorForUser(id: string): string {
  const index = id.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0) % COLORS.length;
  return COLORS[index];
}

export type CollaborativeEditorProps = {
  nodeId: string;
  noteName: string;
};

/**
 * Real-time collaborative BlockNote editor. Uses a Yjs document synced over
 * SignalR (see YjsSignalRProvider) as the single source of truth for
 * concurrent edits, so multiple users editing the same note see changes
 * merge instantly and without conflicts.
 */
export function CollaborativeEditor({ nodeId, noteName }: CollaborativeEditorProps) {
  const { user } = useAuth();
  const { t } = useI18n();
  const containerRef = useRef<HTMLDivElement>(null);
  const [presence, setPresence] = useState<PresenceUser[]>([]);
  const [saveState, setSaveState] = useState<'saved' | 'saving'>('saved');

  const ydocRef = useRef<Y.Doc>(new Y.Doc());
  const providerRef = useRef<YjsSignalRProvider | null>(null);

  if (!providerRef.current) {
    providerRef.current = new YjsSignalRProvider(nodeId, ydocRef.current);
  }

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
    }),
  );

  useEffect(() => {
    const provider = providerRef.current!;
    provider.onPresenceUpdate(setPresence);
    provider.connect().catch(console.error);

    const onUpdate = () => {
      setSaveState('saving');
      const timer = setTimeout(() => setSaveState('saved'), 800);
      return () => clearTimeout(timer);
    };
    ydocRef.current.on('update', onUpdate);

    return () => {
      ydocRef.current.off('update', onUpdate);
      provider.disconnect().catch(console.error);
    };
  }, [nodeId]);

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between border-b border-border-subtle px-4 py-2">
        <div className="flex items-center gap-3">
          <h2 className="text-base font-medium text-white">{noteName || t('editor.untitled')}</h2>
          <span className="text-xs text-neutral-500">
            {saveState === 'saving' ? t('editor.saving') : t('editor.saved')}
          </span>
        </div>
        <div className="flex items-center gap-4">
          <PresenceAvatars users={presence} />
          <div className="flex gap-1">
            <button
              type="button"
              className="rounded border border-border-subtle px-2 py-1 text-xs hover:border-accent-emerald"
              onClick={() => containerRef.current && exportNoteAsPdf(containerRef.current, noteName || 'note')}
            >
              {t('editor.exportPdf')}
            </button>
            <button
              type="button"
              className="rounded border border-border-subtle px-2 py-1 text-xs hover:border-accent-blue"
              onClick={() => containerRef.current && exportNoteAsImage(containerRef.current, noteName || 'note', 'png')}
            >
              {t('editor.exportPng')}
            </button>
            <button
              type="button"
              className="rounded border border-border-subtle px-2 py-1 text-xs hover:border-accent-purple"
              onClick={() => containerRef.current && exportNoteAsImage(containerRef.current, noteName || 'note', 'jpeg')}
            >
              {t('editor.exportJpg')}
            </button>
          </div>
        </div>
      </div>

      <div ref={containerRef} className="flex-1 overflow-y-auto bg-bg-base px-6 py-4">
        <BlockNoteView editor={editor} theme="dark" />
      </div>
    </div>
  );
}
