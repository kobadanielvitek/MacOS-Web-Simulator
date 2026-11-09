import React, { useState } from "react";

// Eaglercraft is a self-contained HTML build (public/games/eaglercraft.html).
// It is loaded in an iframe so it behaves exactly like opening the file directly,
// while living inside a regular macOS-style window.
export default function Minecraft() {
  const [isLoaded, setIsLoaded] = useState(false);
  const gameUrl = `${import.meta.env.BASE_URL}games/eaglercraft.html`;
  const iconUrl = `${import.meta.env.BASE_URL}icons/minecraft.svg`;

  return (
    <div className="relative flex-1 w-full h-full bg-black overflow-hidden">
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
        title="Minecraft (Eaglercraft)"
        src={gameUrl}
        onLoad={() => setIsLoaded(true)}
        className="w-full h-full border-0 bg-black"
        allow="fullscreen; autoplay; gamepad; clipboard-write; cross-origin-isolated"
        allowFullScreen
      />
    </div>
  );
}
