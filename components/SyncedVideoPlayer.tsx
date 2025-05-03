import React, { forwardRef, RefObject, MutableRefObject } from "react";

interface SyncedVideoPlayerProps {
  src: string | null;
  brightness: number;
  contrast: number;
  saturation: number;
  onPlay: () => void;
  onPause: () => void;
  onSeeked: (currentTime: number) => void;
  ignoreNextSeekRef: MutableRefObject<boolean>; // Ref für Seek-Logik
}

// forwardRef wird benötigt, um das videoRef von außen an das <video> Element durchzureichen
const SyncedVideoPlayer = forwardRef<HTMLVideoElement, SyncedVideoPlayerProps>(
  (
    {
      src,
      brightness,
      contrast,
      saturation,
      onPlay,
      onPause,
      onSeeked,
      ignoreNextSeekRef,
    },
    ref // Das ref wird hier als zweites Argument empfangen
  ) => {
    const handleSeeked = (event: React.SyntheticEvent<HTMLVideoElement>) => {
      if (ignoreNextSeekRef.current) {
        ignoreNextSeekRef.current = false;
        return;
      }
      const videoElement = event.currentTarget;
      if (videoElement) {
        onSeeked(videoElement.currentTime);
      }
    };

    return (
      <div
        style={{
          flex: 1,
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          width: '100%', // Container soll volle Breite nutzen
        }}
      >
        {src ? (
          <video
            ref={ref} // Das weitergeleitete ref wird hier an das video-Element übergeben
            src={src || undefined}
            controls
            style={{
              width: "100%", // Nimmt Breite des Containers an
              maxWidth: "900px", // Max Breite beibehalten
              height: "auto",
              borderRadius: "12px",
              filter: `brightness(${brightness}) contrast(${contrast}) saturate(${saturation})`,
            }}
            onPlay={onPlay}
            onPause={onPause}
            onSeeked={handleSeeked} // Verwende den lokalen Handler
          />
        ) : (
          <p style={{ color: "#888" }}>Bitte lade eine Video-Datei hoch.</p>
        )}
      </div>
    );
  }
);

SyncedVideoPlayer.displayName = "SyncedVideoPlayer"; // Hilfreich für DevTools

export default SyncedVideoPlayer;