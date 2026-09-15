import * as signalR from '@microsoft/signalr';
import * as Y from 'yjs';
import { Awareness, applyAwarenessUpdate, encodeAwarenessUpdate } from 'y-protocols/awareness';
import { getAccessToken } from '../../services/apiClient';

export type PresenceUser = { connectionId: string; name: string };

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
  private readonly presence = new Map<string, string>();

  /** True once `disconnect()` has been requested; guards against completing a stale `connect()`. */
  private disposed = false;
  /** Tracks the in-flight connect() call so disconnect() can await it before tearing down. */
  private connectPromise: Promise<void> | null = null;

  constructor(nodeId: string, doc: Y.Doc) {
    this.nodeId = nodeId;
    this.doc = doc;
    this.awareness = new Awareness(doc);

    this.doc.on('update', (update: Uint8Array, origin: unknown) => {
      if (origin === this) return; // avoid echoing updates we just received
      this.safeInvoke('SendYjsUpdate', this.nodeId, update);
    });

    this.awareness.on('update', ({ added, updated, removed }: { added: number[]; updated: number[]; removed: number[] }) => {
      const changed = [...added, ...updated, ...removed];
      const update = encodeAwarenessUpdate(this.awareness, changed);
      this.safeInvoke('SendAwarenessUpdate', this.nodeId, update);
    });
  }

  onPresenceUpdate(callback: (users: PresenceUser[]) => void) {
    this.onPresenceChange = callback;
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

  async connect(): Promise<void> {
    this.disposed = false;
    const promise = this.connectInternal();
    this.connectPromise = promise;
    return promise;
  }

  private async connectInternal(): Promise<void> {
    const connection = new signalR.HubConnectionBuilder()
      .withUrl('/hubs/collaborative-note', { accessTokenFactory: () => getAccessToken() ?? '' })
      .withAutomaticReconnect()
      .build();

    connection.on('SyncState', (_nodeId: string, state: number[] | null) => {
      if (state && state.length > 0) {
        Y.applyUpdate(this.doc, new Uint8Array(state), this);
      }
    });

    connection.on('ReceiveYjsUpdate', (_nodeId: string, update: number[]) => {
      Y.applyUpdate(this.doc, new Uint8Array(update), this);
    });

    connection.on('ReceiveAwarenessUpdate', (_nodeId: string, update: number[]) => {
      applyAwarenessUpdate(this.awareness, new Uint8Array(update), this);
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

  async disconnect(): Promise<void> {
    this.disposed = true;

    // Wait for any in-flight connect() to settle first so we don't stop a
    // connection object mid-negotiation or leak an open one afterward.
    if (this.connectPromise) {
      await this.connectPromise.catch(() => undefined);
      this.connectPromise = null;
    }

    const connection = this.connection;
    if (!connection) return;

    if (connection.state === signalR.HubConnectionState.Connected) {
      await connection.invoke('LeaveNote', this.nodeId).catch(() => undefined);
    }
    await connection.stop().catch(() => undefined);

    if (this.connection === connection) this.connection = null;
  }
}
