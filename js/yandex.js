// yandex.js — thin wrapper around the Yandex Games SDK with a safe fallback.
//
// The SDK is loaded via <script src="/sdk.js"> in index.html. That path only
// exists when the game is hosted on Yandex; on our nginx host or locally it 404s
// (harmless) and `window.YaGames` stays undefined. Every export below degrades to
// a no-op in that case, so the same files run on Yandex, on nginx, and from
// `python3 -m http.server` without changes.

import { setMuted } from './audio.js';

let ysdk = null;
let ready = false;

export function hasYandex() { return !!ysdk; }

// Initialize the SDK and signal that the game finished loading (hides Yandex's
// own preloader). Called once from main.js. Resolves even when the SDK is absent.
export async function initYandex() {
  if (typeof window === 'undefined' || !window.YaGames) return false;
  try {
    ysdk = await window.YaGames.init();
    ready = true;
    // Tell the platform the game is ready to be shown / interacted with.
    try { ysdk.features.LoadingAPI?.ready(); } catch (_) { /* older SDK */ }
    return true;
  } catch (e) {
    ysdk = null;
    return false;
  }
}

// Mark active gameplay (lets Yandex manage focus/ads around the session).
export function gameplayStart() { try { ysdk?.features.GameplayAPI?.start(); } catch (_) {} }
export function gameplayStop() { try { ysdk?.features.GameplayAPI?.stop(); } catch (_) {} }

// Show a rewarded video. Mutes audio while it plays and restores after.
// callbacks: { onOpen, onRewarded, onClose, onError }
export function showRewardedVideo({ onOpen, onRewarded, onClose, onError } = {}) {
  if (!ysdk) { onError && onError(); return; }
  let restored = false;
  const restore = () => { if (!restored) { restored = true; setMuted(false); } };
  try {
    ysdk.adv.showRewardedVideo({
      callbacks: {
        onOpen: () => { setMuted(true); onOpen && onOpen(); },
        onRewarded: () => { onRewarded && onRewarded(); },
        onClose: () => { restore(); onClose && onClose(); },
        onError: (err) => { restore(); onError && onError(err); },
      },
    });
  } catch (e) {
    restore();
    onError && onError(e);
  }
}

// Optional interstitial (not wired to gameplay rewards). Safe no-op without SDK.
export function showFullscreenAd(onClose) {
  if (!ysdk) { onClose && onClose(false); return; }
  try {
    ysdk.adv.showFullscreenAdv({
      callbacks: {
        onClose: (wasShown) => { onClose && onClose(wasShown); },
        onError: () => { onClose && onClose(false); },
      },
    });
  } catch (e) { onClose && onClose(false); }
}
