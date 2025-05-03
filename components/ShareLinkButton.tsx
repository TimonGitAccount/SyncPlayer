// components/ShareLinkButton.tsx
import React from 'react';

interface ShareLinkButtonProps {
  roomId: string | string[] | undefined; // Der Raum-ID, der geteilt werden soll
  buttonStyle?: React.CSSProperties; // Optionale Styles für den Button
  buttonClassName?: string; // Optionale CSS-Klasse
}

const ShareLinkButton: React.FC<ShareLinkButtonProps> = ({
  roomId,
  buttonStyle,
  buttonClassName,
}) => {
  const handleShare = () => {
    // Stelle sicher, dass roomId vorhanden ist, bevor du teilst
    if (!roomId) {
        console.warn("ShareLinkButton: roomId is missing.");
        alert("Fehler: Raum-ID nicht gefunden zum Teilen.");
        return;
    }

    // Konstruiere die URL, die geteilt werden soll
    const shareUrl = `${window.location.origin}/room/${roomId}?role=join`;

    // Prüfe, ob die Web Share API verfügbar ist
    if (navigator.share) {
      navigator.share({
        title: "Sync Player Raum",
        text: "Trete meinem Sync Player Raum bei!",
        url: shareUrl,
      })
      .then(() => console.log('Link erfolgreich geteilt.'))
      .catch((error) => console.error('Fehler beim Teilen:', error));
    } else {
      // Fallback: Link in die Zwischenablage kopieren
      navigator.clipboard.writeText(shareUrl)
        .then(() => {
          alert("Join-Link wurde in die Zwischenablage kopiert!");
        })
        .catch(err => {
          console.error('Fehler beim Kopieren in die Zwischenablage:', err);
          alert("Fehler beim Kopieren des Links.");
        });
    }
  };

  // Standard-Styles, können durch Props überschrieben/ergänzt werden
  const defaultStyle: React.CSSProperties = {
    padding: '0.5rem 1rem',
    backgroundColor: '#0070f3',
    color: '#fff',
    border: 'none',
    borderRadius: '8px',
    cursor: 'pointer',
    fontSize: '0.9rem',
    display: 'inline-flex', // Damit Icon und Text gut zusammenpassen
    alignItems: 'center',
    gap: '0.5rem', // Kleiner Abstand zwischen Icon und Text
    ...buttonStyle, // Kombiniere Default mit übergebenen Styles
  };

  return (
    <button
      style={defaultStyle}
      className={buttonClassName}
      onClick={handleShare}
      // Deaktiviere den Button, wenn keine roomId vorhanden ist
      disabled={!roomId}
      title={roomId ? "Link zum Beitreten teilen oder kopieren" : "Raum-ID fehlt"}
    >
      🔗 
    </button>
  );
};

export default ShareLinkButton;