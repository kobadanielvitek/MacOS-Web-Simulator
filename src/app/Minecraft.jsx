import React, { useCallback, useEffect, useRef, useState } from "react";

// Eaglercraft is a self-contained HTML build (public/games/eaglercraft.html).
// It is loaded in an iframe so it behaves exactly like opening the file directly,
// while living inside a regular macOS-style window.
// https://eaglercraft.com

const ACTIVITY_EVENTS = [
  "mousedown",
  "mousemove",
  "pointerdown",
  "pointermove",
  "keydown",
  "wheel",
  "touchstart",
];

// The game is same-origin, so its canvas can be locked from here as well.
function lockPointer(doc) {
  const canvas = doc?.querySelector("canvas");
  if (!canvas) return false;
  try {
    doc.defaultView?.focus();
    const request = canvas.requestPointerLock();
    if (request && typeof request.catch === "function") request.catch(() => {});
    return true;
  } catch {
    return false;
  }
}

export default function Minecraft() {
  const [isLoaded, setIsLoaded] = useState(false);
  const [isLocked, setIsLocked] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showPrompt, setShowPrompt] = useState(false);
  const [showHint, setShowHint] = useState(true);
  const iframeRef = useRef(null);
  const containerRef = useRef(null);

  const gamePath = `${import.meta.env.BASE_URL}games/eaglercraft.html`;
  const iconUrl = `${import.meta.env.BASE_URL}icons/minecraft.svg`;

  const openInNewTab = useCallback(() => {
    const url = new URL(gamePath, window.location.href).href;
    window.open(url, "_blank", "noopener,noreferrer");
  }, [gamePath]);

  const toggleFullscreen = useCallback(async () => {
    const node = containerRef.current;
    if (!node) return;
    try {
      if (document.fullscreenElement) {
        await document.exitFullscreen();
      } else {
        await node.requestFullscreen();
      }
    } catch {
      // fullscreen can be rejected (permissions, iOS); the game stays usable in the window
    }
  }, []);

  const captureMouse = useCallback(() => {
    const doc = iframeRef.current?.contentDocument;
    if (!doc) return;
    if (doc.pointerLockElement) {
      doc.exitPointerLock?.();
      return;
    }
    lockPointer(doc);
    // keep the prompt open until the lock really happens
    setTimeout(() => {
      if (!doc.pointerLockElement) setShowPrompt(true);
    }, 500);
  }, []);

  useEffect(() => {
    if (!isLoaded) return;
    const iframe = iframeRef.current;
    const doc = iframe?.contentDocument;
    if (!doc) return;

    let lastPulse = 0;
    // The game swallows mouse/keyboard events inside its own document, so the desktop's
    // inactivity timer would never reset and the OS would lock itself mid-game.
    const pulse = () => {
      const now = Date.now();
      if (now - lastPulse < 750) return;
      lastPulse = now;
      window.dispatchEvent(new Event("mousemove"));
    };

    // Eaglercraft asks for the pointer when a world is opened. If the browser denies it
    // (popup/gesture rules, some embedded browsers), the game keeps running with a loose
    // cursor. Arm a one-shot rescue: the next click inside the game locks the pointer.
    let rescueUntil = 0;
    const armRescue = () => {
      rescueUntil = Date.now() + 15000;
      setShowPrompt(true);
    };

    const syncLock = () => {
      const locked = !!doc.pointerLockElement;
      setIsLocked(locked);
      if (locked) {
        rescueUntil = 0;
        setShowPrompt(false);
      }
    };

    const onMouseDown = () => {
      if (!rescueUntil || Date.now() > rescueUntil) return;
      rescueUntil = 0;
      window.setTimeout(() => {
        if (!doc.pointerLockElement) lockPointer(doc);
      }, 300);
    };

    ACTIVITY_EVENTS.forEach((type) => doc.addEventListener(type, pulse, { passive: true }));
    doc.addEventListener("pointerlockchange", syncLock);
    doc.addEventListener("pointerlockerror", armRescue);
    doc.addEventListener("mousedown", onMouseDown, true);
    syncLock();
    const interval = window.setInterval(syncLock, 1000);

    return () => {
      ACTIVITY_EVENTS.forEach((type) => doc.removeEventListener(type, pulse));
      doc.removeEventListener("pointerlockchange", syncLock);
      doc.removeEventListener("pointerlockerror", armRescue);
      doc.removeEventListener("mousedown", onMouseDown, true);
      window.clearInterval(interval);
    };
  }, [isLoaded]);

  useEffect(() => {
    const onFullscreenChange = () => setIsFullscreen(document.fullscreenElement === containerRef.current);
    document.addEventListener("fullscreenchange", onFullscreenChange);
    return () => document.removeEventListener("fullscreenchange", onFullscreenChange);
  }, []);

  // Show the "click to capture the mouse" hint on load and whenever the mouse is released.
  useEffect(() => {
    if (!isLoaded) return;
    if (isLocked) {
      setShowHint(false);
      return;
    }
    setShowHint(true);
    const timer = window.setTimeout(() => setShowHint(false), 7000);
    return () => window.clearTimeout(timer);
  }, [isLoaded, isLocked]);

  const iconButtonClass =
    "flex h-8 w-8 items-center justify-center rounded-md border border-white/15 bg-black/60 text-white/80 backdrop-blur transition-colors hover:bg-black/85 hover:text-white";

  return (
    <div ref={containerRef} className="relative flex-1 w-full h-full bg-black overflow-hidden">
      {!isLoaded && (
        <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-4 bg-[#0b0b0b] text-white">
          <img src={iconUrl} alt="" className="w-20 h-20 animate-pulse drop-shadow-2xl" />
          <div className="flex items-center gap-2 text-sm text-white/80">
            <span className="w-2 h-2 rounded-full bg-green-400 animate-ping" />
            Loading Minecraft…
          </div>
          <p className="text-[11px] text-white/40">
            Eaglercraft · the first launch can take a few seconds
          </p>
        </div>
      )}

      <iframe
        ref={iframeRef}
        title="Minecraft (Eaglercraft)"
        src={gamePath}
        onLoad={() => setIsLoaded(true)}
        className="w-full h-full border-0 bg-black"
        allow="fullscreen; autoplay; gamepad; clipboard-write"
      />

      {/* Non-blocking hint: the game only grabs the mouse once you click inside its canvas. */}
      {isLoaded && !isLocked && !showPrompt && showHint && (
        <div className="pointer-events-none absolute left-1/2 top-3 z-20 -translate-x-1/2 select-none">
          <div className="flex items-center gap-2 rounded-full border border-white/15 bg-black/75 px-3.5 py-1.5 text-[11px] font-medium text-white/90 shadow-lg backdrop-blur">
            <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="1.8">
              <path d="M12 3v3M12 18v3M3 12h3M18 12h3" strokeLinecap="round" />
              <rect x="7" y="7" width="10" height="10" rx="2" />
            </svg>
            Click the game to capture the mouse
          </div>
        </div>
      )}

      {/* Shown when the browser refused Eaglercraft's own pointer-lock request. */}
      {isLoaded && !isLocked && showPrompt && (
        <div className="pointer-events-none absolute inset-0 z-30 flex items-center justify-center p-4">
          <div className="pointer-events-none flex w-[300px] flex-col items-center gap-3 rounded-xl border border-white/15 bg-black/85 px-5 py-4 text-center shadow-2xl backdrop-blur-md">
            <p className="text-sm font-semibold text-white">Mouse is not captured</p>
            <p className="text-[11px] leading-relaxed text-white/60">
              Click below (or anywhere in the game) to lock the mouse. If that does not work,
              use fullscreen or open the game in a new tab.
            </p>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={captureMouse}
                className="pointer-events-auto rounded-md bg-emerald-500 px-3 py-1.5 text-[11px] font-semibold text-white transition-colors hover:bg-emerald-400"
              >
                Capture mouse
              </button>
              <button
                type="button"
                onClick={() => setShowPrompt(false)}
                className="pointer-events-auto rounded-md border border-white/15 px-3 py-1.5 text-[11px] font-medium text-white/70 transition-colors hover:bg-white/10 hover:text-white"
              >
                Dismiss
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Window controls: stay out of the way while the mouse is captured. */}
      <div
        className={`absolute bottom-3 right-3 z-20 flex items-center gap-1.5 transition-opacity duration-200 ${
          isLocked ? "pointer-events-none opacity-0" : "opacity-100"
        }`}
      >
        <button
          type="button"
          onClick={captureMouse}
          title="Lock the mouse to the game (Esc releases it)"
          aria-label="Capture mouse"
          className={`${iconButtonClass} border-emerald-300/40 bg-emerald-500/80 text-white hover:bg-emerald-500`}
        >
          <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
            <rect x="6" y="2.5" width="12" height="19" rx="6" />
            <path d="M12 2.5v6" strokeLinecap="round" />
          </svg>
        </button>
        <button
          type="button"
          onClick={toggleFullscreen}
          title={isFullscreen ? "Exit fullscreen" : "Play fullscreen (helps mouse capture in some browsers)"}
          aria-label={isFullscreen ? "Exit fullscreen" : "Fullscreen"}
          className={iconButtonClass}
        >
          <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
            {isFullscreen ? (
              <path d="M9 3v6H3M15 21v-6h6M21 9h-6V3M3 15h6v6" strokeLinecap="round" strokeLinejoin="round" />
            ) : (
              <path d="M3 9V3h6M21 15v6h-6M15 3h6v6M9 21H3v-6" strokeLinecap="round" strokeLinejoin="round" />
            )}
          </svg>
        </button>
        <button
          type="button"
          onClick={openInNewTab}
          title="Open the game in a full browser tab (always allows mouse capture)"
          aria-label="Open in a new tab"
          className={iconButtonClass}
        >
          <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M14 3h7v7M21 3l-9 9M10 5H5a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
      </div>
    </div>
  );
}
