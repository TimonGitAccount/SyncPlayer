// components/ScreenshotButton.tsx
import React from 'react';
import { FaCamera } from 'react-icons/fa';

interface ScreenshotButtonProps {
  videoRef: React.RefObject<HTMLVideoElement | null>;
  currentFile: File | null; // Das aktuelle Video-File für den Dateinamen
  onScreenshotTaken: (timestamp: string) => void; // Callback, um den Timestamp zurückzugeben
  style?: React.CSSProperties;
  className?: string;
  title?: string;
}

const ScreenshotButton: React.FC<ScreenshotButtonProps> = ({
  videoRef,
  currentFile,
  onScreenshotTaken,
  style,
  className,
  title = "Screenshot aufnehmen", // Standard-Titel
}) => {
  const takeScreenshot = () => {
    const video = videoRef.current;
    // Prüfen, ob das Video-Element verfügbar ist
    if (!video || video.readyState < 2) { // readyState >= 2 bedeutet, dass Metadaten geladen sind
        console.warn("ScreenshotButton: Video element not ready or not available.");
        alert("Video ist noch nicht bereit für einen Screenshot.");
        return;
    }
     // Prüfen ob Video Dimensionen hat (wichtig für Canvas)
     if (video.videoWidth === 0 || video.videoHeight === 0) {
        console.warn("ScreenshotButton: Video dimensions are zero.");
        alert("Video-Dimensionen sind ungültig für Screenshot.");
        return;
     }


    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;

    const ctx = canvas.getContext("2d");
    if (!ctx) {
        console.error("ScreenshotButton: Could not get canvas context.");
        alert("Fehler beim Erstellen des Screenshots (Canvas Context).");
        return;
    }

    try {
        // Zeichne das aktuelle Videobild auf den Canvas
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

        // Konvertiere Canvas zu Blob
        canvas.toBlob((blob) => {
          if (!blob) {
            console.error("ScreenshotButton: Failed to create blob from canvas.");
            alert("Fehler beim Erstellen des Screenshots (Blob).");
            return;
          }
          const url = URL.createObjectURL(blob);

          // Zeitstempel generieren
          const timestamp = new Date(video.currentTime * 1000)
            .toISOString()
            .replace(/[:.]/g, "-") // Ersetze ungültige Zeichen für Dateinamen
            .slice(0, 19); // Nur YYYY-MM-DDTHH-MM-SS

          // Dateiname generieren
          const videoName = currentFile?.name?.split(".")[0] || "screenshot";
          const filename = `${videoName}_${timestamp}.png`; // Unterstrich statt Bindestrich für bessere Lesbarkeit

          // Download-Link erstellen und klicken
          const a = document.createElement("a");
          a.href = url;
          a.download = filename;
          document.body.appendChild(a); // Füge Link zum DOM hinzu (für Firefox notwendig)
          a.click();
          document.body.removeChild(a); // Entferne Link wieder
          URL.revokeObjectURL(url); // Gib die Object URL frei

          // Callback aufrufen, um den Timestamp an die Elternkomponente zu senden
          onScreenshotTaken(timestamp);

        }, "image/png");

    } catch (error) {
        console.error("ScreenshotButton: Error during screenshot generation:", error);
        alert("Ein unerwarteter Fehler ist beim Erstellen des Screenshots aufgetreten.");
    }
  };

  // Standard-Styles für den Button/Icon-Container
  const defaultStyle: React.CSSProperties = {
    fontSize: "1.5rem",
    cursor: "pointer",
    color: "#fff",
    display: 'inline-flex', // Wichtig für korrekte Darstellung
    alignItems: 'center',
    ...style, // Erlaube Überschreiben/Ergänzen durch Props
  };

  // Button ist nur aktiv, wenn videoRef.current existiert
  const isDisabled = !videoRef.current;

  return (
    <div
      style={{...defaultStyle, cursor: isDisabled ? 'not-allowed' : 'pointer', opacity: isDisabled ? 0.5 : 1}}
      className={className}
      onClick={!isDisabled ? takeScreenshot : undefined} // Nur klicken, wenn nicht disabled
      title={isDisabled ? "Video nicht bereit" : title}
    >
      <FaCamera />
    </div>
  );
};

export default ScreenshotButton;