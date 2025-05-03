// components/VideoSettingsBar.tsx
import React from "react";
import { FaUndo } from "react-icons/fa";

// Definiere die Props, die diese Komponente benötigt
interface VideoSettingsBarProps {
  brightness: number;
  contrast: number;
  saturation: number;
  onBrightnessChange: (value: number) => void;
  onContrastChange: (value: number) => void;
  onSaturationChange: (value: number) => void;
  onReset: () => void;
  // Optional: isOpen prop, falls die Komponente ihre Sichtbarkeit selbst steuern soll
  // isOpen: boolean;
}

const VideoSettingsBar: React.FC<VideoSettingsBarProps> = ({
  brightness,
  contrast,
  saturation,
  onBrightnessChange,
  onContrastChange,
  onSaturationChange,
  onReset,
}) => {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: "1rem",
        padding: "1rem 2rem",
        backgroundColor: "#222", // Gleicher Hintergrund wie die Hauptleiste
        color: "#fff",
        zIndex: 999, // Unter der Hauptleiste, aber über dem Video
        // Die Transition und Transform Logik bleibt im Parent,
        // da dieser entscheidet, *ob* die Leiste gerendert wird.
      }}
    >
      {/* Helligkeit */}
      <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
        Helligkeit:
        <input
          type="range"
          min="0.5"
          max="2"
          step="0.1"
          value={brightness}
          onChange={(e) => onBrightnessChange(parseFloat(e.target.value))}
          style={{ cursor: 'pointer' }}
        />
        <span style={{ minWidth: '30px', textAlign: 'right'}}>{brightness.toFixed(1)}</span>
      </label>

      {/* Kontrast */}
      <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
        Kontrast:
        <input
          type="range"
          min="0.5"
          max="2"
          step="0.1"
          value={contrast}
          onChange={(e) => onContrastChange(parseFloat(e.target.value))}
           style={{ cursor: 'pointer' }}
        />
         <span style={{ minWidth: '30px', textAlign: 'right'}}>{contrast.toFixed(1)}</span>
      </label>

      {/* Sättigung */}
      <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
        Sättigung:
        <input
          type="range"
          min="0"
          max="2"
          step="0.1"
          value={saturation}
          onChange={(e) => onSaturationChange(parseFloat(e.target.value))}
           style={{ cursor: 'pointer' }}
        />
         <span style={{ minWidth: '30px', textAlign: 'right'}}>{saturation.toFixed(1)}</span>
      </label>

      {/* Reset Knopf */}
      <button
        style={{
          padding: "0.5rem 1rem",
          backgroundColor: "#333",
          color: "#fff",
          border: "none",
          borderRadius: "5px",
          cursor: "pointer",
          display: 'flex',
          alignItems: 'center'
        }}
        onClick={onReset}
        title="Einstellungen zurücksetzen"
      >
        <FaUndo />
      </button>
    </div>
  );
};

export default VideoSettingsBar;