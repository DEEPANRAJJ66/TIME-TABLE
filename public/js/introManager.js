// Intro Video Lifecycle Manager
// Handles sub-second opening intro animation, autoplay restrictions, fallbacks, and session state.

const INTRO_SESSION_KEY = 'college_intro_seen';
const MAX_FALLBACK_TIMEOUT_MS = 850; // Guaranteed sub-second cutoff (< 1s)
const TRANSITION_DURATION_MS = 200;  // Clean fade-out reveal

let isInitialized = false;

export function initIntro() {
  if (isInitialized) return;
  isInitialized = true;

  const overlay = document.getElementById('introOverlay');
  const video = document.getElementById('introVideo');

  if (!overlay || !video) return;

  // 1. Respect prefers-reduced-motion or prior session view
  let prefersReducedMotion = false;
  try {
    prefersReducedMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  } catch (_) {}

  let hasSeenIntro = false;
  try {
    hasSeenIntro = sessionStorage.getItem(INTRO_SESSION_KEY) === 'true';
  } catch (_) {}

  if (prefersReducedMotion || hasSeenIntro) {
    dismissImmediately(overlay, video);
    return;
  }

  let dismissed = false;
  let fallbackTimer = null;

  function dismiss(instant = false) {
    if (dismissed) return;
    dismissed = true;

    if (fallbackTimer) {
      clearTimeout(fallbackTimer);
      fallbackTimer = null;
    }

    try {
      sessionStorage.setItem(INTRO_SESSION_KEY, 'true');
    } catch (_) {
      // Ignore private browsing storage quota exceptions
    }

    if (instant) {
      dismissImmediately(overlay, video);
      return;
    }

    // Graceful fade-out to reveal the main website
    overlay.classList.add('fade-out');
    setTimeout(() => {
      dismissImmediately(overlay, video);
    }, TRANSITION_DURATION_MS);
  }

  function dismissImmediately(el, vid) {
    if (vid) {
      try {
        vid.pause();
        vid.removeAttribute('src');
        vid.load();
      } catch (_) {}
    }
    if (el && el.parentNode) {
      el.remove();
    }
  }

  // 2. Event listeners on video
  video.addEventListener('ended', () => {
    dismiss(false);
  }, { once: true });

  video.addEventListener('error', () => {
    // Media error: skip instantly, do not show blank screen
    dismiss(true);
  }, { once: true });

  // Source error listener
  const sources = video.querySelectorAll('source');
  sources.forEach((src) => {
    src.addEventListener('error', () => {
      setTimeout(() => {
        if (video.networkState === HTMLMediaElement.NETWORK_NO_SOURCE) {
          dismiss(true);
        }
      }, 50);
    });
  });

  // 3. Fallback safety timer: strictly ensures intro duration is below 1 second
  fallbackTimer = setTimeout(() => {
    dismiss(false);
  }, MAX_FALLBACK_TIMEOUT_MS);

  // 4. Ensure optimal video attributes and start playback
  video.muted = true;
  video.playsInline = true;
  video.controls = false;

  const playPromise = video.play();
  if (playPromise !== undefined) {
    playPromise.catch((_err) => {
      // Autoplay blocked by browser policy: skip intro immediately, reveal website
      dismiss(true);
    });
  }
}

// Auto-run as soon as DOM is ready or interactive
if (typeof document !== 'undefined') {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initIntro);
  } else {
    initIntro();
  }
}
