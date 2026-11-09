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

export default function Minecraft() {
  const [isLoaded, setIsLoaded] = useState(false);
  const [isLocked, setIsLocked] = useState(false);
  const [lockError, setLockError] = useState(false);
  const [showHint, setShowHint] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);
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

  // Some browsers refuse pointer lock inside an iframe until the player clicks the canvas,
  // and Eaglercraft does not always ask again. Because the game is same-origin we can lock
  // the pointer onto its canvas directly from this click.
  const captureMouse = useCallback(() => {
    const iframe = iframeRef.current;
    const doc = iframe?.contentDocument;
    if (!doc) return;
    if (doc.pointerLockElement) {
      doc.exitPointerLock?.();
      return;
    }
    const canvas = doc.querySelector("canvas");
    if (!canvas) return;
    try {
      iframe.contentWindow?.focus();
      const request = canvas.requestPointerLock();
      if (request && typeof request.catch === "function") request.catch(() => {});
    } catch {
      // ignore; the hint and the new-tab fallback stay available
    }
  }, []);

  // The game swallows mouse/keyboard events inside its own document, so the desktop's
  // inactivity timer would never reset and the OS would lock itself mid-game.
  // Forward a throttled activity pulse from the game frame to the host window.
  useEffect(() => {
    if (!isLoaded) return;
    const doc = iframeRef.current?.contentDocument;
    if (!doc) return;

    let lastPulse = 0;
    const pulse = () => {
      const now = Date.now();
      if (now - lastPulse < 750) return;
      lastPulse = now;
      window.dispatchEvent(new Event("mousemove"));
    };

    const syncLock = () => {
      const locked = !!doc.pointerLockElement;
      setIsLocked(locked);
      if (locked) setLockError(false);
    };
    const onLockError = () => setLockError(true);

    ACTIVITY_EVENTS.forEach((type) => doc.addEventListener(type, pulse, { passive: true }));
    doc.addEventListener("pointerlockchange", syncLock);
    doc.addEventListener("pointerlockerror", onLockError);
    syncLock();
    const interval = window.setInterval(syncLock, 1000);

    return () => {
      ACTIVITY_EVENTS.forEach((type) => doc.removeEventListener(type, pulse));
      doc.removeEventListener("pointerlockchange", syncLock);
      doc.removeEventListener("pointerlockerror", onLockError);
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
      {isLoaded && !isLocked && showHint && (
        <div className="pointer-events-none absolute left-1/2 top-3 z-20 -translate-x-1/2 select-none">
          <div className="flex items-center gap-2 rounded-full border border-white/15 bg-black/75 px-3.5 py-1.5 text-[11px] font-medium text-white/90 shadow-lg backdrop-blur">
            <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="1.8">
              <path d="M12 3v3M12 18v3M3 12h3M18 12h3" strokeLinecap="round" />
              <rect x="7" y="7" width="10" height="10" rx="2" />
            </svg>
            {lockError
              ? "Mouse capture is blocked here — try Fullscreen or open in a new tab"
              : "Click the game to capture the mouse"}
          </div>
        </div>
      )}

      {/* Window controls: stay out of the way while the mouse is captured. */}
      <div
        className={`absolute bottom-3 right-3 z-20 flex items-center gap-2 transition-opacity duration-200 ${
          isLocked ? "pointer-events-none opacity-0" : "opacity-100"
        }`}
      >
        <button
          type="button"
          onClick={captureMouse}
          title="Lock the mouse to the game (Escape releases it)"
          className="flex items-center gap-1.5 rounded-md border border-emerald-300/40 bg-emerald-500/80 px-2.5 py-1.5 text-[11px] font-semibold text-white backdrop-blur transition-colors hover:bg-emerald-500"
        >
          <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2">
            <rect x="6" y="2.5" width="12" height="19" rx="6" />
            <path d="M12 2.5v6" strokeLinecap="round" />
          </svg>
          Capture mouse
        </button>
        <button
          type="button"
          onClick={toggleFullscreen}
          title={isFullscreen ? "Exit fullscreen" : "Play fullscreen (helps mouse capture in some browsers)"}
          className="flex items-center gap-1.5 rounded-md border border-white/15 bg-black/65 px-2.5 py-1.5 text-[11px] font-medium text-white/85 backdrop-blur transition-colors hover:bg-black/85 hover:text-white"
        >
          <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2">
            {isFullscreen ? (
              <path d="M9 3v6H3M15 21v-6h6M21 9h-6V3M3 15h6v6" strokeLinecap="round" strokeLinejoin="round" />
            ) : (
              <path d="M3 9V3h6M21 15v6h-6M15 3h6v6M9 21H3v-6" strokeLinecap="round" strokeLinejoin="round" />
            )}
          </svg>
          {isFullscreen ? "Exit fullscreen" : "Fullscreen"}
        </button>
        <button
          type="button"
          onClick={openInNewTab}
          title="Open the game in a full browser tab (always allows mouse capture)"
          className="flex items-center gap-1.5 rounded-md border border-white/15 bg-black/65 px-2.5 py-1.5 text-[11px] font-medium text-white/85 backdrop-blur transition-colors hover:bg-black/85 hover:text-white"
        >
          <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M14 3h7v7M21 3l-9 9M10 5H5a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          New tab
        </button>
      </div>
    </div>
  );
}
