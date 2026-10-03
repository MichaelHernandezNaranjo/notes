import * as signalR from '@microsoft/signalr';
import * as Y from 'yjs';
import { Awareness, applyAwarenessUpdate, encodeAwarenessUpdate } from 'y-protocols/awareness';
import { apiUrl, getValidAccessToken } from '../../services/apiClient';

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
  private readonly presence = new Map<string, string>();

  /** True once `disconnect()` has been requested; guards against completing a stale `connect()`. */
  private disposed = false;
  /** Latest requested intent; the serialized queue below only honors it. */
  private wanted = false;
  private queue: Promise<void> = Promise.resolve();
  /** True once the server state was applied; snapshots are never sent before, to avoid overwriting stored content with an empty doc. */
  private synced = false;
  private snapshotTimer: ReturnType<typeof setTimeout> | null = null;
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
    if (!this.synced) return;
    if (this.snapshotTimer) clearTimeout(this.snapshotTimer);
    this.snapshotTimer = setTimeout(() => this.flushSnapshot(), SNAPSHOT_DEBOUNCE_MS);
  }

  private flushSnapshot() {
    if (this.snapshotTimer) {
      clearTimeout(this.snapshotTimer);
      this.snapshotTimer = null;
    }
    if (!this.synced) return;
    this.safeInvoke('SaveSnapshot', this.nodeId, toBase64(Y.encodeStateAsUpdate(this.doc)));
  }

  onPresenceUpdate(callback: (users: PresenceUser[]) => void) {
    this.onPresenceChange = callback;
  }

  /** Fires once the server state has been applied (note content is ready). */
  onSynced(callback: () => void) {
    this.onSyncedChange = callback;
  }

  get isSynced(): boolean {
    return this.synced;
  }

  /** Only invokes a hub method when the connection is actually established; swallows expected races silently. */
  private safeInvoke(method: string, ...args: unknown[]): void {
    if (this.connection?.state !== signalR.HubConnectionState.Connected) return;
    this.connection.invoke(method, ...args).catch((error) => {
      // Ignore errors caused by the connection dropping mid-flight (teardown races);
      // anything else is logged for visibility.
      if (this.disposed) return;
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
    if (this.snapshotTimer) {
      clearTimeout(this.snapshotTimer);
      this.snapshotTimer = null;
    }
    if (this.synced && connection.state === signalR.HubConnectionState.Connected) {
      if (!this.readOnly) {
        await connection
          .invoke('SaveSnapshot', this.nodeId, toBase64(Y.encodeStateAsUpdate(this.doc)))
          .catch(() => undefined);
      }
      await connection.invoke('LeaveNote', this.nodeId).catch(() => undefined);
    }
    await connection.stop().catch(() => undefined);

    if (this.connection === connection) this.connection = null;
    this.synced = false;
  }
}
