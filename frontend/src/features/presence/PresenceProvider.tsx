import * as signalR from '@microsoft/signalr';
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { accountApi, type Announcement } from '../../services/adminApi';
import { apiUrl, endSessionBlocked, getValidAccessToken } from '../../services/apiClient';

type PresenceValue = {
  announcements: Announcement[];
  dismiss: (id: string) => Promise<void>;
};

const PresenceContext = createContext<PresenceValue | undefined>(undefined);

const PING_MS = 60_000;

/**
 * Keeps one light SignalR connection open while the app is in use. It
 *  - tells the administrators that this user is online (and keeps "last seen" fresh),
 *  - delivers announcements the moment an admin sends them,
 *  - and tells this tab to sign out right away if an admin blocks the account.
 * It also loads announcements that were sent while the user was away.
 */
export function PresenceProvider({ children }: { children: ReactNode }) {
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);

  useEffect(() => {
    let cancelled = false;
    accountApi
      .pendingAnnouncements()
      .then((list) => !cancelled && setAnnouncements(list))
      .catch(() => undefined);

    const connection = new signalR.HubConnectionBuilder()
      .withUrl(apiUrl('/hubs/presence'), { accessTokenFactory: async () => (await getValidAccessToken()) ?? '' })
      .withAutomaticReconnect()
      .configureLogging(signalR.LogLevel.None)
      .build();

    connection.on('Announcement', (a: Announcement) => {
      setAnnouncements((prev) => [a, ...prev.filter((x) => x.id !== a.id)]);
    });
    connection.on('AnnouncementRemoved', (id: string) => {
      setAnnouncements((prev) => prev.filter((x) => x.id !== id));
    });
    connection.on('Blocked', () => endSessionBlocked());

    // Closing while the negotiation is still running (React StrictMode, fast navigation) is expected: ignore it.
    connection.start().catch(() => undefined);
    const ping = setInterval(() => {
      if (connection.state === signalR.HubConnectionState.Connected) connection.invoke('Ping').catch(() => undefined);
    }, PING_MS);

    return () => {
      cancelled = true;
      clearInterval(ping);
      void connection.stop().catch(() => undefined);
    };
  }, []);

  const dismiss = useCallback(async (id: string) => {
    setAnnouncements((prev) => prev.filter((a) => a.id !== id)); // optimistic: it never comes back once dismissed
    await accountApi.dismissAnnouncement(id).catch(() => undefined);
  }, []);

  const value = useMemo(() => ({ announcements, dismiss }), [announcements, dismiss]);
  return <PresenceContext.Provider value={value}>{children}</PresenceContext.Provider>;
}

export function usePresence(): PresenceValue {
  const ctx = useContext(PresenceContext);
  if (!ctx) throw new Error('usePresence must be used within a PresenceProvider');
  return ctx;
}
