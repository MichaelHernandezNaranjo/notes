const KEY = 'notesapp.termsVersion';

/**
 * The Google sign-in is a full-page redirect, so the version of the Terms the user ticked on the
 * login screen is kept in sessionStorage and sent to the server together with the OAuth code.
 */
export function acceptTerms(version: string): void {
  sessionStorage.setItem(KEY, version);
}

export function getAcceptedTermsVersion(): string | null {
  return sessionStorage.getItem(KEY);
}

export function clearAcceptedTerms(): void {
  sessionStorage.removeItem(KEY);
}
