import { useEffect, useRef, useState } from 'react';
import { useI18n } from '../../i18n/I18nProvider';

type InlineNameInputProps = {
  initialValue?: string;
  /** Sibling names (lower-cased) that would make the new name a duplicate. */
  takenNames: Set<string>;
  /** Called with the trimmed name; may throw/reject to show a server-side error. */
  onSubmit: (name: string) => Promise<void> | void;
  onCancel: () => void;
};

const MAX_LENGTH = 300;

/** VS Code style inline editor for creating or renaming a tree item. */
export function InlineNameInput({ initialValue = '', takenNames, onSubmit, onCancel }: InlineNameInputProps) {
  const { t } = useI18n();
  const [value, setValue] = useState(initialValue);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const doneRef = useRef(false);

  useEffect(() => {
    const input = inputRef.current;
    if (!input) return;
    input.focus();
    input.select();
  }, []);

  const validate = (raw: string): string | null => {
    const name = raw.trim();
    if (!name) return null;
    if (name.toLowerCase() !== initialValue.trim().toLowerCase() && takenNames.has(name.toLowerCase())) {
      return t('tree.nameExists');
    }
    return null;
  };

  const commit = async () => {
    if (doneRef.current) return;
    const name = value.trim();
    // Empty name (or unchanged rename) never creates/renames anything.
    if (!name || name === initialValue) {
      doneRef.current = true;
      onCancel();
      return;
    }
    const problem = validate(name);
    if (problem) {
      setError(problem);
      inputRef.current?.focus();
      return;
    }
    doneRef.current = true;
    try {
      await onSubmit(name);
    } catch (e) {
      doneRef.current = false;
      setError(e instanceof Error && e.message ? e.message : t('tree.nameExists'));
      inputRef.current?.focus();
    }
  };

  return (
    <div className="relative min-w-0 flex-1" onClick={(e) => e.stopPropagation()} onDoubleClick={(e) => e.stopPropagation()}>
      <input
        ref={inputRef}
        value={value}
        maxLength={MAX_LENGTH}
        aria-invalid={error ? true : undefined}
        onChange={(e) => {
          setValue(e.target.value);
          setError(validate(e.target.value));
        }}
        onKeyDown={(e) => {
          e.stopPropagation();
          if (e.key === 'Enter') {
            e.preventDefault();
            void commit();
          } else if (e.key === 'Escape') {
            e.preventDefault();
            doneRef.current = true;
            onCancel();
          }
        }}
        onBlur={() => void commit()}
        className={`w-full rounded-sm border bg-bg-base px-1 py-0 text-sm text-neutral-900 outline-none ${
          error ? 'border-red-500' : 'border-accent-blue'
        }`}
      />
      {error && (
        <div
          role="alert"
          className="absolute left-0 top-full z-20 mt-0.5 w-max max-w-[16rem] rounded-sm border border-red-500 bg-red-50 px-2 py-1 text-xs text-red-700 shadow"
        >
          {error}
        </div>
      )}
    </div>
  );
}
