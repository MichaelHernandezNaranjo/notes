import '@blocknote/core/fonts/inter.css';
import { yXmlFragmentToBlocks } from '@blocknote/core/yjs';
import { BlockNoteView } from '@blocknote/mantine';
import '@blocknote/mantine/style.css';
import { useCreateBlockNote } from '@blocknote/react';
import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import * as Y from 'yjs';
import { useI18n } from '../../i18n/I18nProvider';
import { publicApi, type PublicShare, type PublicTreeNode } from '../../services/permissionsApi';

const FILE_URL = /\/api\/files\/([0-9a-fA-F-]{36})/;

function base64ToBytes(value: string): Uint8Array {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

/** Read-only rendering of one shared note: the stored Yjs state is converted to blocks; no connection is opened. */
function PublicNoteView({ token, nodeId }: { token: string; nodeId: string }) {
  const { t } = useI18n();
  const [state, setState] = useState<'loading' | 'ready' | 'error'>('loading');
  const [title, setTitle] = useState('');

  const editor = useCreateBlockNote({
    // Images are served by the anonymous endpoint of this same link (no credentials involved).
    resolveFileUrl: async (url: string) => {
      const match = FILE_URL.exec(url);
      return match ? publicApi.fileUrl(token, match[1]) : url;
    },
  });

  useEffect(() => {
    let cancelled = false;
    publicApi
      .node(token, nodeId)
      .then((node) => {
        if (cancelled) return;
        const doc = new Y.Doc();
        if (node.state) Y.applyUpdate(doc, base64ToBytes(node.state));
        const blocks = yXmlFragmentToBlocks(editor, doc.getXmlFragment('blocknote'));
        if (blocks.length > 0) editor.replaceBlocks(editor.document, blocks);
        setTitle(node.name);
        setState('ready');
      })
      .catch(() => !cancelled && setState('error'));
    return () => {
      cancelled = true;
    };
  }, [token, nodeId, editor]);

  if (state === 'error') {
    return <p role="alert" className="p-6 text-sm text-neutral-700">{t('sharing.viewLoadError')}</p>;
  }

  return (
    <div className="mx-auto max-w-3xl px-3 py-5 sm:px-6">
      {state === 'loading' ? (
        <div role="status" aria-label={t('sharing.viewLoading')} className="animate-pulse space-y-4 pt-2">
          <div className="h-8 w-2/5 rounded bg-neutral-200" />
          <div className="h-4 w-full rounded bg-neutral-200" />
          <div className="h-4 w-4/5 rounded bg-neutral-200" />
        </div>
      ) : (
        <h1 className="mb-3 px-[54px] text-2xl font-semibold text-neutral-900">{title}</h1>
      )}
      <div className={state === 'ready' ? '' : 'hidden'}>
        <BlockNoteView editor={editor} theme="light" editable={false} />
      </div>
    </div>
  );
}

type TreeProps = { nodes: PublicTreeNode[]; parentId: string | null; depth: number; activeId: string | undefined; onOpen: (id: string) => void };

function PublicTree({ nodes, parentId, depth, activeId, onOpen }: TreeProps) {
  const [closed, setClosed] = useState<Set<string>>(new Set());
  const children = nodes.filter((n) => n.parentId === parentId);
  return (
    <ul role={depth === 0 ? 'tree' : 'group'} className="space-y-0.5">
      {children.map((node) => {
        const isFolder = node.type === 'Folder';
        const open = !closed.has(node.id);
        return (
          <li key={node.id} role="treeitem" aria-expanded={isFolder ? open : undefined} aria-selected={activeId === node.id}>
            <button
              type="button"
              style={{ paddingLeft: 8 + depth * 14 }}
              onClick={() => (isFolder ? setClosed((s) => { const c = new Set(s); if (c.has(node.id)) c.delete(node.id); else c.add(node.id); return c; }) : onOpen(node.id))}
              className={`flex min-h-9 w-full items-center gap-1.5 rounded-md py-1 pr-2 text-left text-sm hover:bg-black/5 focus-visible:outline-2 focus-visible:outline-accent-blue ${activeId === node.id ? 'bg-accent-blue/10 font-medium text-accent-blue' : 'text-neutral-800'}`}
            >
              <span aria-hidden="true">{isFolder ? (open ? '📂' : '📁') : '📝'}</span>
              <span className="truncate">{node.name}</span>
            </button>
            {isFolder && open && <PublicTree nodes={nodes} parentId={node.id} depth={depth + 1} activeId={activeId} onOpen={onOpen} />}
          </li>
        );
      })}
    </ul>
  );
}

/** Anonymous, read-only viewer of a public link (a note, or a whole folder with navigation). */
export function PublicSharePage() {
  const { token, nodeId } = useParams<{ token: string; nodeId?: string }>();
  const { t, language, setLanguage } = useI18n();
  const navigate = useNavigate();
  const [share, setShare] = useState<PublicShare | null>(null);
  const [status, setStatus] = useState<'loading' | 'ready' | 'unavailable'>('loading');
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    publicApi
      .get(token)
      .then((data) => {
        if (cancelled) return;
        setShare(data);
        setStatus('ready');
        document.title = `${data.name} · Notes`;
      })
      .catch(() => !cancelled && setStatus('unavailable'));
    // Links are private: never let the browser index or leak them.
    const meta = document.createElement('meta');
    meta.name = 'robots';
    meta.content = 'noindex, nofollow';
    document.head.appendChild(meta);
    return () => {
      cancelled = true;
      meta.remove();
    };
  }, [token]);

  const activeId = useMemo(() => {
    if (!share) return undefined;
    if (nodeId && share.tree.some((n) => n.id === nodeId && n.type === 'Note')) return nodeId;
    return share.type === 'Note' ? share.nodeId : undefined;
  }, [share, nodeId]);

  const isFolder = share?.type === 'Folder';
  const noteCount = share?.tree.filter((n) => n.type === 'Note').length ?? 0;
  const open = (id: string) => {
    setMenuOpen(false);
    navigate(`/s/${token}/${id}`);
  };

  if (status === 'unavailable') {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 px-6 text-center" role="alert">
        <span className="text-4xl" aria-hidden="true">🔗</span>
        <h1 className="text-lg font-semibold text-neutral-900">{t('sharing.viewNotFoundTitle')}</h1>
        <p className="max-w-sm text-sm text-neutral-600">{t('sharing.viewNotFoundText')}</p>
        <Link to="/login" className="rounded-md bg-accent-blue px-4 py-2 text-sm font-medium text-white hover:bg-accent-blue-dark">
          {t('sharing.viewSignIn')}
        </Link>
      </div>
    );
  }

  return (
    <div className="flex h-full min-h-0 flex-col bg-bg-base">
      <header className="flex h-12 shrink-0 items-center justify-between gap-3 border-b border-border-subtle bg-bg-elevated px-3 sm:px-4">
        <div className="flex min-w-0 items-center gap-2">
          {isFolder && (
            <button
              type="button"
              aria-label={t('sharing.viewFolderContent')}
              aria-expanded={menuOpen}
              onClick={() => setMenuOpen((v) => !v)}
              className="touch-target rounded-md px-2 py-1 text-lg hover:bg-black/5 md:hidden"
            >
              ☰
            </button>
          )}
          <span className="truncate text-sm font-semibold text-neutral-900">{share?.name ?? t('sharing.viewLoading')}</span>
          <span className="shrink-0 rounded-full bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-800">{t('sharing.viewReadOnly')}</span>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <button
            type="button"
            onClick={() => setLanguage(language === 'es' ? 'en' : 'es')}
            className="touch-target rounded-md border border-border-subtle px-2 py-1 text-xs hover:bg-black/5"
          >
            {language === 'es' ? 'EN' : 'ES'}
          </button>
          <Link to="/login" className="touch-target flex items-center rounded-md bg-accent-blue px-3 py-1.5 text-sm font-medium text-white hover:bg-accent-blue-dark">
            {t('sharing.viewSignIn')}
          </Link>
        </div>
      </header>

      {status === 'loading' ? (
        <p role="status" className="p-6 text-sm text-neutral-500">{t('sharing.viewLoading')}</p>
      ) : (
        <div className="relative flex min-h-0 flex-1">
          {isFolder && share && (
            <nav
              aria-label={t('sharing.viewFolderContent')}
              className={`absolute inset-y-0 left-0 z-20 w-72 max-w-[85%] overflow-y-auto border-r border-border-subtle bg-bg-elevated p-2 shadow-lg md:static md:block md:shadow-none ${menuOpen ? 'block' : 'hidden'}`}
            >
              <PublicTree nodes={share.tree} parentId={null} depth={0} activeId={activeId} onOpen={open} />
            </nav>
          )}
          <main className="min-h-0 min-w-0 flex-1 overflow-y-auto">
            {token && activeId ? (
              <PublicNoteView key={activeId} token={token} nodeId={activeId} />
            ) : (
              <p className="p-6 text-sm text-neutral-500">{noteCount === 0 ? t('sharing.viewEmptyFolder') : t('sharing.viewPick')}</p>
            )}
          </main>
        </div>
      )}
    </div>
  );
}
