const KEY = 'notesapp.returnTo';

/** Remembers where the user was heading before being sent to sign in (survives the Google redirect). */
export function rememberReturnTo(path: string): void {
  if (isSafe(path) && !path.startsWith('/login') && !path.startsWith('/auth/')) sessionStorage.setItem(KEY, path);
}

/** Returns (and forgets) the remembered destination, or null. */
export function consumeReturnTo(): string | null {
  const value = sessionStorage.getItem(KEY);
  sessionStorage.removeItem(KEY);
  return value && isSafe(value) ? value : null;
}

// Only same-site paths: never an absolute or protocol-relative URL (open-redirect safe).
function isSafe(path: string): boolean {
  return path.startsWith('/') && !path.startsWith('//') && !path.includes('\\');
}
