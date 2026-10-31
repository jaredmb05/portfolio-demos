// The iPad's connection status (production iPad v1.26, D44). Opening the app, coming back on screen and Reconnect each start
// a wait for the database's first answer: "Connecting…" for CONNECT_GRACE_MS, then "Offline". Pure: the caller passes the
// browser's online flag, whether the database has answered, whether the listener failed, and the time.

export const CONNECT_GRACE_MS = 15 * 1000;   // "Connecting…" this long without an answer, then "Offline"
export const WAKE_RECONNECT_MS = 30 * 1000;   // back on screen after at least this long away: reconnect at once

// 'connecting' | 'offline' | 'live', and whether the Offline banner offers Reconnect. Reconnect needs a network (without one
// there's nothing to retry) and no listener error (a listener that errored isn't revived by turning the network off and on).
export function connectionStatus({ online, connected, failed, since, now = Date.now() }) {
  if (online && !connected && !failed && now - since < CONNECT_GRACE_MS) return { state: 'connecting', reconnect: false };
  if (!online || !connected) return { state: 'offline', reconnect: online && !failed };
  return { state: 'live', reconnect: false };
}

// Back on screen (locked, or in another app): reconnect when it was away at least WAKE_RECONNECT_MS. A quick look at another
// app keeps its connection. hiddenAt is 0 when the app wasn't seen going away.
export const reconnectOnReturn = (hiddenAt, now = Date.now()) => !!hiddenAt && now - hiddenAt >= WAKE_RECONNECT_MS;
