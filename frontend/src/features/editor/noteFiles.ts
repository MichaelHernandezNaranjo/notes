import { apiFetch, apiUrl } from '../../services/apiClient';

export const MAX_IMAGE_BYTES = 10 * 1024 * 1024;
const ALLOWED_TYPES = ['image/png', 'image/jpeg', 'image/gif', 'image/webp'];

export class UploadError extends Error {}

/**
 * Uploads an image for a note and returns its stable, API-relative URL (`/api/files/{id}`).
 * The relative URL is what gets stored in the document, so it survives domain changes.
 */
export async function uploadNoteImage(nodeId: string, file: File): Promise<string> {
  if (!ALLOWED_TYPES.includes(file.type)) throw new UploadError('Unsupported image type. Allowed: PNG, JPEG, GIF, WebP.');
  if (file.size > MAX_IMAGE_BYTES) throw new UploadError('The image exceeds the 10 MB limit.');

  const form = new FormData();
  form.append('file', file);
  const response = await apiFetch(`/api/nodes/${nodeId}/files`, { method: 'POST', body: form });
  if (!response.ok) {
    let message = 'The image could not be uploaded.';
    try {
      const body = (await response.json()) as { error?: string };
      if (body.error) message = body.error;
    } catch {
      /* keep default message */
    }
    throw new UploadError(message);
  }
  const { url } = (await response.json()) as { url: string };
  return url;
}

/**
 * `<img>` tags cannot send the JWT, so stored `/api/files/...` URLs are fetched with the
 * Authorization header and exposed as same-origin blob: URLs (also what export needs, no CORS issue).
 */
export function createFileResolver() {
  const cache = new Map<string, Promise<string>>();

  const resolve = (url: string): Promise<string> => {
    const path = url.startsWith(apiUrl('/api/files/')) ? url.slice(apiUrl('').length) : url;
    if (!path.startsWith('/api/files/')) return Promise.resolve(url); // external image: leave as is

    let pending = cache.get(path);
    if (!pending) {
      pending = apiFetch(path).then(async (response) => {
        if (!response.ok) throw new Error(`Image request failed (${response.status})`);
        return URL.createObjectURL(await response.blob());
      });
      pending.catch(() => cache.delete(path)); // allow retry after a failure
      cache.set(path, pending);
    }
    return pending;
  };

  const dispose = () => {
    cache.forEach((p) => void p.then((u) => URL.revokeObjectURL(u)).catch(() => undefined));
    cache.clear();
  };

  return { resolve, dispose };
}
