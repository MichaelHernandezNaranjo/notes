import { useEffect, useId, useRef, useState } from 'react';
import { useI18n } from '../../i18n/I18nProvider';
import { nodesApi, type NodeSearchResult } from '../../services/nodesApi';

const DEBOUNCE_MS = 200;

export type ExplorerSearchProps = {
  query: string;
  onQueryChange: (value: string) => void;
  onSelect: (result: NodeSearchResult) => void;
};

/** Splits `text` around the (accent/case-insensitive) match of `term` so the match can be highlighted. */
function highlight(text: string, term: string) {
  const fold = (s: string) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  const folded = fold(text);
  const idx = folded.indexOf(fold(term));
  // Folding keeps the same length for Latin text, so indexes line up with the original string.
  if (idx < 0 || folded.length !== text.length) return <>{text}</>;
  return (
    <>
      {text.slice(0, idx)}
      <mark className="rounded-sm bg-amber-200 px-0 text-neutral-900">{text.slice(idx, idx + term.length)}</mark>
      {text.slice(idx + term.length)}
    </>
  );
}

/**
 * Search box for the explorer: debounced, cancels stale requests, keyboard navigable (↑ ↓ Enter Esc)
 * and exposed to assistive tech as a combobox/listbox. Ctrl/Cmd+K focuses it.
 */
export function ExplorerSearch({ query, onQueryChange, onSelect }: ExplorerSearchProps) {
  const { t } = useI18n();
  const listId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const [results, setResults] = useState<NodeSearchResult[]>([]);
  const [status, setStatus] = useState<'idle' | 'loading' | 'done' | 'error'>('idle');
  const [active, setActive] = useState(0);
  const [attempt, setAttempt] = useState(0);

  const term = query.trim();

  // Debounced search; the previous request is aborted whenever the text changes.
  useEffect(() => {
    if (!term) {
      setResults([]);
      setStatus('idle');
      return;
    }
    setStatus('loading');
    const controller = new AbortController();
    const timer = setTimeout(() => {
      nodesApi
        .search(term, controller.signal)
        .then((data) => {
          setResults(data);
          setActive(0);
          setStatus('done');
        })
        .catch((error) => {
          if (controller.signal.aborted || (error instanceof DOMException && error.name === 'AbortError')) return;
          setStatus('error');
        });
    }, DEBOUNCE_MS);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [term, attempt]);

  // Ctrl/Cmd+K focuses the search box while the explorer is on screen.
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        inputRef.current?.focus();
        inputRef.current?.select();
      }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, []);

  const showPanel = term.length > 0;
  const optionId = (i: number) => `${listId}-opt-${i}`;

  return (
    <div className="border-b border-border-subtle bg-bg-elevated">
      <div className="relative px-3 py-2">
        <svg
          className="pointer-events-none absolute left-5 top-1/2 -translate-y-1/2 text-neutral-500"
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <circle cx="11" cy="11" r="7" />
          <path d="M21 21l-4.3-4.3" />
        </svg>
        <input
          ref={inputRef}
          type="text"
          role="combobox"
          aria-expanded={showPanel}
          aria-controls={listId}
          aria-activedescendant={showPanel && results.length > 0 ? optionId(active) : undefined}
          aria-autocomplete="list"
          aria-label={t('search.label')}
          placeholder={t('search.placeholder')}
          value={query}
          maxLength={100}
          onChange={(e) => onQueryChange(e.target.value)}
          onKeyDown={(e) => {
            e.stopPropagation();
            if (e.key === 'ArrowDown') {
              e.preventDefault();
              setActive((i) => Math.min(i + 1, Math.max(results.length - 1, 0)));
            } else if (e.key === 'ArrowUp') {
              e.preventDefault();
              setActive((i) => Math.max(i - 1, 0));
            } else if (e.key === 'Enter') {
              e.preventDefault();
              const picked = results[active];
              if (picked) onSelect(picked);
            } else if (e.key === 'Escape') {
              e.preventDefault();
              if (query) onQueryChange('');
              else inputRef.current?.blur();
            }
          }}
          className="w-full rounded-md border border-border-subtle bg-bg-base py-1.5 pl-8 pr-9 pointer-fine:pr-16 pointer-coarse:py-2.5 text-sm text-neutral-900 outline-none transition placeholder:text-neutral-500 focus:border-accent-blue focus:ring-2 focus:ring-accent-blue/20"
        />
        <div className="absolute right-5 top-1/2 flex -translate-y-1/2 items-center gap-1.5">
          {status === 'loading' && (
            <span
              className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-neutral-300 border-t-accent-blue"
              role="status"
              aria-label={t('search.searching')}
            />
          )}
          {query ? (
            <button
              type="button"
              aria-label={t('search.clear')}
              title={t('search.clear')}
              onClick={() => {
                onQueryChange('');
                inputRef.current?.focus();
              }}
              className="rounded p-0.5 pointer-coarse:p-2 text-neutral-500 hover:bg-black/10 hover:text-neutral-800"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
                <path d="M18 6L6 18M6 6l12 12" />
              </svg>
            </button>
          ) : (
            <kbd className="hidden rounded pointer-fine:inline-block border border-border-subtle bg-bg-base px-1 text-[10px] text-neutral-500">Ctrl K</kbd>
          )}
        </div>
      </div>

      {showPanel && (
        <ul id={listId} role="listbox" aria-label={t('search.results')} className="max-h-[60dvh] overflow-y-auto pb-1">
          {status === 'error' && (
            <li className="flex items-center justify-between gap-2 px-4 py-2 text-xs text-red-700" role="alert">
              <span>{t('search.error')}</span>
              <button type="button" onClick={() => setAttempt((n) => n + 1)} className="underline">
                {t('editor.retry')}
              </button>
            </li>
          )}
          {status === 'done' && results.length === 0 && (
            <li className="px-4 py-3 text-xs text-neutral-500">{t('search.noResults').replace('{query}', term)}</li>
          )}
          {results.map((r, i) => (
            <li
              key={r.id}
              id={optionId(i)}
              role="option"
              aria-selected={i === active}
              onMouseEnter={() => setActive(i)}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => onSelect(r)}
              className={`flex cursor-pointer items-start gap-2 px-4 py-1.5 pointer-coarse:min-h-12 pointer-coarse:py-2 ${i === active ? 'bg-accent-blue/10' : 'hover:bg-black/5'}`}
            >
              <span className="mt-0.5" aria-hidden="true">
                {r.type === 'Folder' ? '📁' : '📝'}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm text-neutral-900">{highlight(r.name, term)}</span>
                <span className="block truncate text-xs text-neutral-500">{r.path || t('tree.rootLocation')}</span>
              </span>
            </li>
          ))}
          {status === 'done' && results.length >= 50 && (
            <li className="px-4 py-1.5 text-xs text-neutral-500">{t('search.refine')}</li>
          )}
        </ul>
      )}
    </div>
  );
}
