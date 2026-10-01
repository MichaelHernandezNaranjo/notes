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
import { YjsSignalRProvider, type PresenceUser } from './YjsSignalRProvider';

const COLORS = ['#10B981', '#3B82F6', '#8B5CF6', '#F59E0B', '#EF4444'];

function colorForUser(id: string): string {
  const index = id.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0) % COLORS.length;
  return COLORS[index];
}

export type CollaborativeEditorProps = {
  nodeId: string;
  noteName: string;
  onShare: () => void;
};

/**
 * Real-time collaborative BlockNote editor. Uses a Yjs document synced over
 * SignalR (see YjsSignalRProvider) as the single source of truth for
 * concurrent edits, so multiple users editing the same note see changes
 * merge instantly and without conflicts.
 */
export function CollaborativeEditor({ nodeId, noteName, onShare }: CollaborativeEditorProps) {
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
      <EditorToolbar
        title={noteName || t('editor.untitled')}
        saveState={saveState}
        presence={presence}
        onShare={onShare}
        onExportPdf={() => containerRef.current && exportNoteAsPdf(containerRef.current, noteName || 'note')}
        onExportPng={() => containerRef.current && exportNoteAsImage(containerRef.current, noteName || 'note', 'png')}
        onExportJpg={() => containerRef.current && exportNoteAsImage(containerRef.current, noteName || 'note', 'jpeg')}
      />

      <div ref={containerRef} className="flex-1 overflow-y-auto bg-bg-base px-6 py-4">
        <BlockNoteView editor={editor} theme="light" />
      </div>
    </div>
  );
}
