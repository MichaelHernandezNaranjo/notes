import * as signalR from '@microsoft/signalr';
import * as Y from 'yjs';
import { Awareness, applyAwarenessUpdate, encodeAwarenessUpdate } from 'y-protocols/awareness';
import { apiFetch, apiUrl, endSessionBlocked, getValidAccessToken } from '../../services/apiClient';

export type SaveState = 'saved' | 'saving' | 'unsaved';

export type PresenceUser = { connectionId: string; name: string };

// SignalR's JSON protocol serializes byte[] as base64 strings, so binary
// payloads must be encoded/decoded explicitly (a Uint8Array would otherwise
// be serialized as an object and fail to bind to byte[] on the server).
function toBase64(bytes: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < bytes.length; i += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  }
  return btoa(binary);
}

function fromBase64(value: string | number[] | null | undefined): Uint8Array {
  if (!value) return new Uint8Array();
  if (Array.isArray(value)) return new Uint8Array(value);
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

const SNAPSHOT_DEBOUNCE_MS = 1000;

/**
 * Bridges a Yjs document (used by BlockNote for CRDT-based collaborative
 * editing) with an ASP.NET Core SignalR connection instead of the usual
 * y-webrtc/y-websocket providers. All binary Yjs updates and awareness
 * (presence/cursor) payloads are transported through the
 * `CollaborativeNoteHub` hub methods.
 *
 * `connect()`/`disconnect()` are serialized and idempotent so that rapid
 * mount/unmount cycles (React StrictMode in development, or fast navigation
 * between notes) never leave the connection in an inconsistent state or
 * throw on a stale in-flight negotiation.
 */
export class YjsSignalRProvider {
  public readonly doc: Y.Doc;
  public readonly awareness: Awareness;
  private connection: signalR.HubConnection | null = null;
  private readonly nodeId: string;
  private onPresenceChange: ((users: PresenceUser[]) => void) | null = null;
  private onSyncedChange: (() => void) | null = null;
  private onQuotaChange: (() => void) | null = null;
  private onAccessChange: ((access: string | null) => void) | null = null;
  private readonly presence = new Map<string, string>();

  /** True once `disconnect()` has been requested; guards against completing a stale `connect()`. */
  private disposed = false;
  /** Latest requested intent; the serialized queue below only honors it. */
  private wanted = false;
  private queue: Promise<void> = Promise.resolve();
  /** True once the server state was applied; snapshots are never sent before, to avoid overwriting stored content with an empty doc. */
  private synced = false;
  private snapshotTimer: ReturnType<typeof setTimeout> | null = null;
  private retryTimer: ReturnType<typeof setTimeout> | null = null;
  private retryDelay = 2000;
  private saving: Promise<void> | null = null;
  private saveAgain = false;
  /** Local edits that the server has not acknowledged yet. */
  private dirty = false;
  private saveState: SaveState = 'saved';
  private onSaveStateChange: ((state: SaveState) => void) | null = null;
  private onSizeChange: ((sizeBytes: number, maxBytes: number) => void) | null = null;
  private onTooLargeChange: ((maxBytes: number) => void) | null = null;
  /** When true (e.g. note in trash) no edits or snapshots are sent to the server. */
  public readOnly = false;

  constructor(nodeId: string, doc: Y.Doc) {
    this.nodeId = nodeId;
    this.doc = doc;
    this.awareness = new Awareness(doc);

    this.doc.on('update', (update: Uint8Array, origin: unknown) => {
      if (origin === this || this.readOnly) return; // avoid echoing updates we just received
      this.safeInvoke('SendYjsUpdate', this.nodeId, toBase64(update));
      this.scheduleSnapshot();
    });

    this.awareness.on('update', ({ added, updated, removed }: { added: number[]; updated: number[]; removed: number[] }) => {
      const changed = [...added, ...updated, ...removed];
      const update = encodeAwarenessUpdate(this.awareness, changed);
      this.safeInvoke('SendAwarenessUpdate', this.nodeId, toBase64(update));
    });
  }

  /** Persists the full document state (debounced) so the server never has to merge deltas. */
  private scheduleSnapshot() {
    this.dirty = true;
    if (!this.synced) return;
    this.setSaveState('saving');
    if (this.snapshotTimer) clearTimeout(this.snapshotTimer);
    this.snapshotTimer = setTimeout(() => void this.flushSnapshot(), SNAPSHOT_DEBOUNCE_MS);
  }

  private setSaveState(state: SaveState) {
    if (this.saveState === state) return;
    this.saveState = state;
    this.onSaveStateChange?.(state);
  }

  /** True while edits exist that the server does not have yet. */
  get hasUnsavedChanges(): boolean {
    return this.dirty;
  }

  /**
   * Sends the full state over HTTP (not the WebSocket: a big note would exceed the message limit and drop the connection).
   * One request at a time; failures keep the note marked as unsaved and retry with backoff, so the UI never claims "saved" falsely.
   */
  private flushSnapshot(): Promise<void> {
    if (this.snapshotTimer) {
      clearTimeout(this.snapshotTimer);
      this.snapshotTimer = null;
    }
    if (this.retryTimer) {
      clearTimeout(this.retryTimer);
      this.retryTimer = null;
    }
    if (!this.synced || this.readOnly || !this.dirty) return Promise.resolve();
    if (this.saving) {
      this.saveAgain = true;
      return this.saving;
    }

    this.saving = (async () => {
      do {
        this.saveAgain = false;
        this.dirty = false;
        const state = Y.encodeStateAsUpdate(this.doc);
        this.setSaveState('saving');
        try {
          const response = await apiFetch(`/api/nodes/${this.nodeId}/content`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/octet-stream' },
            body: state as unknown as BodyInit,
          });
          if (response.ok) {
            const result = (await response.json()) as { sizeBytes: number; maxBytes: number };
            this.retryDelay = 2000;
            this.onSizeChange?.(result.sizeBytes, result.maxBytes);
            if (!this.dirty) this.setSaveState('saved');
            continue;
          }
          const body = (await response.json().catch(() => null)) as { code?: string; maxBytes?: number } | null;
          this.dirty = true;
          this.setSaveState('unsaved');
          if (response.status === 413 && body?.code === 'note_too_large') {
            this.onTooLargeChange?.(body.maxBytes ?? 0);
          } else if (response.status === 413) {
            this.onQuotaChange?.();
          } else if (response.status === 403 && body?.code !== 'account_blocked') {
            this.onAccessChange?.('Read');
          } else if (response.status >= 500 || response.status === 408 || response.status === 429) {
            this.scheduleRetry();
          }
          // Other client errors (limit, quota, access) are not retried by themselves: the next edit tries again.
        } catch {
          // Network failure: keep the changes and try again.
          this.dirty = true;
          this.setSaveState('unsaved');
          this.scheduleRetry();
        }
      } while (this.saveAgain && !this.disposed);
    })().finally(() => {
      this.saving = null;
    });
    return this.saving;
  }

  private scheduleRetry() {
    if (this.disposed || this.retryTimer) return;
    this.retryTimer = setTimeout(() => {
      this.retryTimer = null;
      void this.flushSnapshot();
    }, this.retryDelay);
    this.retryDelay = Math.min(this.retryDelay * 2, 30000);
  }

  /** Fires when the save state changes: saved / saving / unsaved (server unreachable or refused). */
  onSaveState(callback: (state: SaveState) => void) {
    this.onSaveStateChange = callback;
  }

  /** Fires with the stored size after each successful save. */
  onSize(callback: (sizeBytes: number, maxBytes: number) => void) {
    this.onSizeChange = callback;
  }

  /** Fires when the server refuses to save because the note is over the per-note size limit. */
  onNoteTooLarge(callback: (maxBytes: number) => void) {
    this.onTooLargeChange = callback;
  }

  onPresenceUpdate(callback: (users: PresenceUser[]) => void) {
    this.onPresenceChange = callback;
  }

  /** Fires once the server state has been applied (note content is ready). */
  onSynced(callback: () => void) {
    this.onSyncedChange = callback;
  }

  /** Fires when the server refuses to save because the note owner is over their storage limit. */
  onQuotaExceeded(callback: () => void) {
    this.onQuotaChange = callback;
  }

  get isSynced(): boolean {
    return this.synced;
  }

  /** Fires when the user's access level changes live: 'Owner' | 'Edit' | 'Read', or null when access was lost. */
  onAccessChanged(callback: (access: string | null) => void) {
    this.onAccessChange = callback;
  }

  /** Only invokes a hub method when the connection is actually established; swallows expected races silently. */
  private safeInvoke(method: string, ...args: unknown[]): void {
    if (this.connection?.state !== signalR.HubConnectionState.Connected) return;
    this.connection.invoke(method, ...args).catch((error) => {
      // Ignore errors caused by the connection dropping mid-flight (teardown races);
      // anything else is logged for visibility.
      if (this.disposed) return;
      const message = String((error as Error)?.message ?? '');
      // The note's owner reached their storage limit: the edit is kept locally but not saved. Tell the user.
      if (message.includes('quota_exceeded')) {
        this.onQuotaChange?.();
        return;
      }
      if (message.includes('account_blocked')) {
        endSessionBlocked();
        return;
      }
      // Lost the right to edit (or to see the note) since the last check: the server also pushes AccessChanged.
      if (message.includes('read_only')) {
        this.onAccessChange?.('Read');
        return;
      }
      if (message.includes('no_access')) {
        this.onAccessChange?.(null);
        return;
      }
      console.error(`[YjsSignalRProvider] Failed to invoke ${method}:`, error);
    });
  }

  /**
   * connect()/disconnect() calls are executed strictly one after another and
   * only the latest requested intent (`wanted`) wins. This makes React
   * StrictMode's mount -> unmount -> mount cycle end with exactly one live
   * connection instead of stopping the wrong one.
   */
  connect(): Promise<void> {
    this.wanted = true;
    this.disposed = false;
    const run = this.queue.then(() => this.doConnect());
    this.queue = run.catch(() => undefined);
    return run;
  }

  disconnect(): Promise<void> {
    this.wanted = false;
    this.disposed = true;
    const run = this.queue.then(() => this.doDisconnect());
    this.queue = run.catch(() => undefined);
    return run;
  }

  private async doConnect(): Promise<void> {
    if (!this.wanted || this.connection) return;
    await this.connectInternal();
  }

  private async connectInternal(): Promise<void> {
    const connection = new signalR.HubConnectionBuilder()
      .withUrl(apiUrl('/hubs/collaborative-note'), { accessTokenFactory: async () => (await getValidAccessToken()) ?? '' })
      .withAutomaticReconnect()
      .build();

    connection.on('SyncState', (_nodeId: string, state: string | null) => {
      const bytes = fromBase64(state);
      if (bytes.length > 0) {
        Y.applyUpdate(this.doc, bytes, this);
      }
      this.synced = true;
      this.onSyncedChange?.();
    });

    connection.on('ReceiveYjsUpdate', (_nodeId: string, update: string) => {
      Y.applyUpdate(this.doc, fromBase64(update), this);
    });

    connection.on('ReceiveAwarenessUpdate', (_nodeId: string, update: string) => {
      applyAwarenessUpdate(this.awareness, fromBase64(update), this);
    });

    connection.on('UserJoined', (_nodeId: string, connectionId: string, name: string) => {
      this.presence.set(connectionId, name ?? 'Anon');
      this.emitPresence();
    });

    connection.on('UserLeft', (_nodeId: string, connectionId: string) => {
      this.presence.delete(connectionId);
      this.emitPresence();
    });

    // The owner changed this user's permission (or revoked it) while the note is open.
    connection.on('AccessChanged', (_nodeId: string, access: string | null) => {
      this.onAccessChange?.(access);
    });

    // After a dropped connection the server forgot our group membership: join again (the state merges through Yjs).
    connection.onreconnected(() => {
      connection.invoke('JoinNote', this.nodeId).catch((error) => {
        if (String((error as Error)?.message ?? '').includes('no_access')) this.onAccessChange?.(null);
      });
    });

    this.connection = connection;

    try {
      await connection.start();

      if (this.disposed) {
        // disconnect() was requested while we were still negotiating; stop
        // immediately instead of joining the note group.
        await connection.stop().catch(() => undefined);
        if (this.connection === connection) this.connection = null;
        return;
      }

      await connection.invoke('JoinNote', this.nodeId);
    } catch (error) {
      if (this.disposed) return; // expected: negotiation aborted by a concurrent disconnect()
      if (String((error as Error)?.message ?? '').includes('no_access')) {
        this.onAccessChange?.(null); // the owner revoked (or never granted) access: let the UI show the "no access" screen
        return;
      }
      console.error('[YjsSignalRProvider] Failed to connect:', error);
      throw error;
    }
  }

  private emitPresence() {
    this.onPresenceChange?.(
      Array.from(this.presence.entries()).map(([connectionId, name]) => ({ connectionId, name })),
    );
  }

  private async doDisconnect(): Promise<void> {
    // A newer connect() was requested after this disconnect (StrictMode remount): keep the connection.
    if (this.wanted) return;

    const connection = this.connection;
    if (!connection) return;

    // Persist pending edits (awaited) before tearing the connection down.
    await this.flushSnapshot();
    if (this.synced && connection.state === signalR.HubConnectionState.Connected) {
      await connection.invoke('LeaveNote', this.nodeId).catch(() => undefined);
    }
    await connection.stop().catch(() => undefined);

    if (this.connection === connection) this.connection = null;
    this.synced = false;
  }
}
