// The iPad's connection status (production iPad v1.26, D44): "Connecting…" while the database hasn't answered yet, "Offline"
// only with no network, after a listener error or 15 seconds without an answer; Reconnect when it can help; reconnecting on
// coming back on screen after 30 seconds or more away.
import { describe, expect, it } from 'vitest';
import { CONNECT_GRACE_MS, WAKE_RECONNECT_MS, connectionStatus, reconnectOnReturn } from '../../apps/shared/connection.js';

const NOW = new Date('2026-10-06T14:10:00').getTime();
const sec = s => s * 1000;
// Online, no answer yet, no error, the wait started `ago` ms before NOW
const ask = (extra = {}, ago = 0) => connectionStatus({ online: true, connected: false, failed: false, since: NOW - ago, now: NOW, ...extra });

describe('what the header says while the iPad waits for the database', () => {
  it('just opened, with a network and no answer yet: Connecting… (not Offline)', () => {
    expect(ask()).toEqual({ state: 'connecting', reconnect: false });
  });
  it('14.9 seconds without an answer: still Connecting…', () => {
    expect(ask({}, sec(14.9)).state).toBe('connecting');
  });
  it('15 seconds without an answer: Offline, with Reconnect', () => {
    expect(ask({}, CONNECT_GRACE_MS)).toEqual({ state: 'offline', reconnect: true });
  });
  it('the database has answered: live, whenever the wait started', () => {
    expect(ask({ connected: true })).toEqual({ state: 'live', reconnect: false });
    expect(ask({ connected: true }, sec(600)).state).toBe('live');
  });
  it('no network: Offline at once, without Reconnect (nothing to retry)', () => {
    expect(ask({ online: false })).toEqual({ state: 'offline', reconnect: false });
    expect(ask({ online: false }, sec(60))).toEqual({ state: 'offline', reconnect: false });
  });
  it('no network, even with an earlier answer: Offline without Reconnect', () => {
    expect(ask({ online: false, connected: true })).toEqual({ state: 'offline', reconnect: false });
  });
  it('the showsheet listener failed: Offline at once, without Reconnect (it would not revive the listener)', () => {
    expect(ask({ failed: true })).toEqual({ state: 'offline', reconnect: false });
    expect(ask({ failed: true }, sec(60))).toEqual({ state: 'offline', reconnect: false });
  });
  it('a wait that starts again (back on screen, Reconnect, back online) gives another 15 seconds of Connecting…', () => {
    expect(ask({}, sec(20)).state).toBe('offline');
    expect(ask({}, sec(1)).state).toBe('connecting');
  });
});

describe('reconnecting when the app comes back on screen', () => {
  it('away 31 seconds (locked, or in another app): reconnect', () => {
    expect(reconnectOnReturn(NOW - sec(31), NOW)).toBe(true);
  });
  it('away exactly 30 seconds: reconnect', () => {
    expect(reconnectOnReturn(NOW - WAKE_RECONNECT_MS, NOW)).toBe(true);
  });
  it('a quick look at another app (5 seconds): no reconnect, the connection is kept', () => {
    expect(reconnectOnReturn(NOW - sec(5), NOW)).toBe(false);
    expect(reconnectOnReturn(NOW - sec(29.9), NOW)).toBe(false);
  });
  it('never seen going away: no reconnect', () => {
    expect(reconnectOnReturn(0, NOW)).toBe(false);
  });
});
