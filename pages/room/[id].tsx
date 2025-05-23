import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/router";
import { FaCog, FaEdit } from "react-icons/fa";
import ChatComponent from "../../components/Chat";
import { FaComment } from "react-icons/fa6";
import ImageEditorModal from "@/components/ImageEditorModal";
import VideoSettingsBar from "@/components/VideoSettingsBar";
import FileUploadButton from "@/components/FileUploadButton";
import SyncedVideoPlayer from "@/components/SyncedVideoPlayer";
import ShareLinkButton from "@/components/ShareLinkButton";
import ScreenshotButton from "@/components/ScreenshotButton";

const STUN_SERVER = { urls: "stun:stun.l.google.com:19302" };

export default function RoomPage() {
  const router = useRouter();
  const { id: roomId, role } = router.query;

  const pcRef = useRef<RTCPeerConnection | null>(null);
  const dcRef = useRef<RTCDataChannel | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [remoteFileName, setRemoteFileName] = useState<string | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false); // Steuert die Sichtbarkeit der Einstellungen
  const [isChatOpen, setIsChatOpen] = useState(false); // Steuert die Sichtbarkeit des Chats
  const [brightness, setBrightness] = useState(1); // Helligkeit
  const [contrast, setContrast] = useState(1); // Kontrast
  const [saturation, setSaturation] = useState(1); // Sättigung
  const [showEditor, setShowEditor] = useState(false);
  const [timestamp, setTimestamp] = useState<string | null>(null);
  const [subtitleFile, setSubtitleFile] = useState<File | null>(null);


  const screenshotRef = useRef<HTMLImageElement | null>(null);
  const ignoreNextSeekRef = useRef(false);
  const videoRef = useRef<HTMLVideoElement | null>(null);

  // Funktion für den Reset-Button (kann auch direkt inline übergeben werden)
  const handleSettingsReset = () => {
    setBrightness(1);
    setContrast(1);
    setSaturation(1);
  };

  // Funktion zum Hinzufügen von Untertiteln
  const handleSubtitleUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSubtitleFile(file);

      // Erstelle eine URL für die Untertitel-Datei
      const url = URL.createObjectURL(file);

      if (videoRef.current) {
        const track = document.createElement("track");
        track.kind = "subtitles"; // Art des Tracks (Untertitel)
        track.label = "Deutsch"; // Die Sprache des Tracks
        track.srclang = "de"; // Sprache (deutsch hier als Beispiel)
        track.src = url; // Setze die URL der Untertitel-Datei
        videoRef.current.appendChild(track); // Füge den Track dem Video hinzu
      }
    }
  };

  const handleScreenshotEdit = () => {
    const video = videoRef.current;
    if (!video) return;
  
    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
  
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
  
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
  
    canvas.toBlob((blob) => {
      if (!blob) return;
      const url = URL.createObjectURL(blob);
  
      const img = new Image();
      img.onload = () => {
        screenshotRef.current = img;
        setShowEditor(true);
  
        // Speichern des Timestamps beim Bearbeiten des Screenshots
        setTimestamp(new Date(video.currentTime * 1000).toISOString());
      };
      img.src = url;
    }, "image/png");
  };
  

  const handleControl = (
    action: "play" | "pause" | "seek",
    origin: "local" | "remote",
    time?: number
  ) => {
    const video = videoRef.current;
    if (!video) return;
  
    if (origin === "local") {
      if (dcRef.current?.readyState === "open") {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const msg: any = { type: "control", action };
        if (action === "seek") msg.time = time ?? video.currentTime;
        dcRef.current.send(JSON.stringify(msg));
      }
    }
  
    // Aktion lokal ausführen
    switch (action) {
      case "play":
        video.play();
        break;
      case "pause":
        video.pause();
        break;
      case "seek":
        if (typeof time === "number") {
          ignoreNextSeekRef.current = true; // Unterdrücke nächstes onSeeked
          video.currentTime = time;
        }
        break;
          
      default:
        console.warn("Unbekannte Aktion:", action);
    }
  };

  const handleLocalPlay = () => handleControl("play", "local");
  const handleLocalPause = () => handleControl("pause", "local");
  const handleLocalSeek = (currentTime: number) => handleControl("seek", "local", currentTime);

  async function createAndSendOffer(pc: RTCPeerConnection, roomId: string | string[]) {
    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);
  
    await fetch(`/api/room/${roomId}/offer`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ offer }),
    });
  
    const pollAnswer = async () => {
      const res = await fetch(`/api/room/${roomId}/answer`);
      if (res.status === 200) {
        const data = await res.json();
        const remoteDesc = new RTCSessionDescription(data.answer);
        if (pc.signalingState !== "closed") {
          await pc.setRemoteDescription(remoteDesc);
        }
      } else {
        setTimeout(pollAnswer, 1000);
      }
    };
  
    pollAnswer();
  }
  

  async function getOfferAndSendAnswer(
    pc: RTCPeerConnection,
    roomId: string | string[],
    isMounted: boolean
  ) {
    const res = await fetch(`/api/room/${roomId}/offer`);
    if (res.status !== 200 || !isMounted) return;
  
    const data = await res.json();
    const remoteDesc = new RTCSessionDescription(data.offer);
  
    if (pc.signalingState === "closed") return;
  
    await pc.setRemoteDescription(remoteDesc);
    const answer = await pc.createAnswer();
    await pc.setLocalDescription(answer);
  
    await fetch(`/api/room/${roomId}/answer`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ answer }),
    });
  }

  const handleVideoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setFile(file);
      // Vorherige URL freigeben, falls vorhanden, um Speicherlecks zu vermeiden
      if (videoUrl) {
        URL.revokeObjectURL(videoUrl);
      }
      const url = URL.createObjectURL(file);
      setVideoUrl(url);

      // Vorhandene Subtitles entfernen, da sie zum alten Video gehörten
      if (videoRef.current) {
           const existingTracks = videoRef.current.querySelectorAll('track');
           existingTracks.forEach(track => videoRef.current?.removeChild(track));
           setSubtitleFile(null); // State auch zurücksetzen
      }


      if (dcRef.current?.readyState === "open") {
        dcRef.current.send(JSON.stringify({ type: "file", name: file.name }));
      }
    }
  };

  async function pollCandidates(pc: RTCPeerConnection, roomId: string | string[]) {
    if (!pc) return;
  
    try {
      const res = await fetch(`/api/room/${roomId}/candidates`);
      if (res.ok) {
        const { candidates } = await res.json();
        for (const c of candidates) {
          try {
            await pc.addIceCandidate(new RTCIceCandidate(c));
          } catch (err) {
            console.warn("Fehler bei ICE-Kandidat:", err);
          }
        }
      }
    } catch (err) {
      console.error("Polling-Fehler:", err);
    }
  
    setTimeout(() => pollCandidates(pc, roomId), 2000);
  }
  

  function handleMessage(event: MessageEvent) {
    try {
      const msg = JSON.parse(event.data);
      if (msg.type === "file") {
        setRemoteFileName(msg.name);
      } else if (msg.type === "control") {
        handleControl(msg.action, "remote", msg.time);
      }
    } catch (err) {
      console.warn("Ungültige Nachricht:", err);
    }
  }
  
  

  // 📌 1. Effekt: Verbindung aufbauen
    useEffect(() => {
        if (!router.isReady || !roomId || !role) return;
    
        const pc = new RTCPeerConnection({ iceServers: [STUN_SERVER] });
        pcRef.current = pc;
    
        let isMounted = true;
    
        pc.onicecandidate = async (event) => {
        if (event.candidate) {
            await fetch(`/api/room/${roomId}/candidate`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ candidate: event.candidate }),
            });
        }
        };
    
        if (role === "host") {
        const dc = pc.createDataChannel("sync");
        dcRef.current = dc;
    
        dc.onopen = () => {
            setIsConnected(true);
            dc.send("Hallo vom Host");
        };
    
        dc.onmessage = handleMessage;
        createAndSendOffer(pc, roomId);
        }
    
        if (role === "join") {
        pc.ondatachannel = (event) => {
            const dc = event.channel;
            dcRef.current = dc;
    
            dc.onopen = () => {
            setIsConnected(true);
            dc.send("Hallo vom Joiner");
            };
    
            dc.onmessage = handleMessage;
        };
    
        getOfferAndSendAnswer(pc, roomId, isMounted);
        }
    
        pollCandidates(pc, roomId);
    
        return () => {
            isMounted = false;
            if (pcRef.current) {
              pcRef.current.close();
              pcRef.current = null;
            }
            dcRef.current = null;
          };
          
    }, [router.isReady, roomId, role]);
    

  return (
    <main style={{ padding: "0", margin: "0" }}>
      {/* Menüleiste */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "1rem 2rem",
          backgroundColor: "#222",
          color: "#fff",
          position: "sticky",
          top: 0,
          zIndex: 1000,
          flexWrap: "wrap", // für mobile/responsive fallback
          gap: "1rem",
        }}
      >
        {/* Linker Bereich */}
        <div style={{ display: "flex", alignItems: "center", gap: "1rem", flexWrap: "wrap" }}>
          {/* Rolle */}
          <span style={{ fontSize: "0.9rem" }}>
            {role === "host" ? "👑 Host" : "🙋 Joiner"}
          </span>

          {/* Video-Datei wählen */}
          <FileUploadButton
            id="fileUpload"
            labelContent="🎥"
            accept="video/*"
            onChange={handleVideoUpload}
          />

          {/* Untertitel-Datei wählen */}
          <FileUploadButton
            id="subtitleUpload"
            labelContent="📜"
            accept=".vtt"
            onChange={handleSubtitleUpload}
          />

          {/* Dateinamen anzeigen und Einstellungen */}
          {file && (
            <>
              <div style={{ display: "flex", alignItems: "center", gap: "1rem", flexWrap: "wrap" }}>
                {/* Dateiname anzeigen */}
                <span style={{ fontSize: "0.9rem" }}>
                  📁 <strong>{file.name}</strong>
                </span>

                {/* Einstellungs-Symbol, nur wenn eine Datei vorhanden ist */}
                <div
                  style={{
                    fontSize: "1.5rem",
                    cursor: "pointer",
                    color: "#fff",
                    marginLeft: "1rem", // Ein bisschen Abstand vom Dateinamen
                  }}
                  onClick={() => setIsSettingsOpen(!isSettingsOpen)}
                >
                  <FaCog />
                </div>

                <ScreenshotButton
                    videoRef={videoRef}
                    currentFile={file}
                    onScreenshotTaken={setTimestamp} // setTimestamp kann direkt als Callback übergeben werden
                />

                {/* Editor öffnen */}
                <div
                  style={{ fontSize: "1.5rem", cursor: "pointer", color: "#fff" }}
                  onClick={handleScreenshotEdit}
                  title="Screenshot bearbeiten"
                >
                  <FaEdit />
                </div>

              </div>
            </>
          )}

          {/* Chat-Icon in der oberen Leiste */}
          { isConnected && (
            <div
              style={{
                fontSize: "1.5rem",
                cursor: "pointer",
                color: "#fff",
              }}
              onClick={() => setIsChatOpen(!isChatOpen)} // Toggle Chat-Visibility
            >
              <FaComment />
            </div>
          )

          }

          {remoteFileName && (
            <span style={{ fontSize: "0.9rem" }}>
              🧑‍🤝‍🧑 <strong>{remoteFileName}</strong>
            </span>
          )}
        </div>

        {/* Rechter Bereich */}
        <div style={{ display: "flex", alignItems: "center", gap: "1rem", flexWrap: "wrap" }}>
          <ShareLinkButton roomId={roomId} />

          {/* Verbindungsstatus */}
          <span style={{ fontSize: "0.9rem" }}>
            {isConnected ? "🟢 Verbunden" : "🔄 Verbindet..."}
          </span>
        </div>
      </div>

      {/* Neue Leiste, die sich öffnet, wenn das Einstellungssymbol geklickt wird */}
      {isSettingsOpen && (
        <VideoSettingsBar
          brightness={brightness}
          contrast={contrast}
          saturation={saturation}
          onBrightnessChange={setBrightness} // Direkte Übergabe der State Setter
          onContrastChange={setContrast}
          onSaturationChange={setSaturation}
          onReset={handleSettingsReset}     // Übergabe der Reset-Funktion
        />
      )}

      {/* Neuer Bereich: Video + Chat nebeneinander */}
      <div
        style={{
          display: "flex",
          flexDirection: "row",
          justifyContent: "center",
          alignItems: "flex-start",
          padding: "2rem",
          gap: "2rem",
          minHeight: "calc(100vh - 80px)",
          backgroundColor: "#111",
        }}
      >
        <SyncedVideoPlayer
          ref={videoRef} // videoRef wird an die Komponente übergeben
          src={videoUrl}
          brightness={brightness}
          contrast={contrast}
          saturation={saturation}
          onPlay={handleLocalPlay}   // Übergabe der Wrapper-Funktionen
          onPause={handleLocalPause}
          onSeeked={handleLocalSeek}
          ignoreNextSeekRef={ignoreNextSeekRef} // Übergabe des Refs
        />

        {isChatOpen && <div style={{ display: "flex", width: "20%", overflow: "hidden" }}>
          <ChatComponent dcRef={dcRef} />
        </div>}

      </div>

      {showEditor && screenshotRef.current && (
        <ImageEditorModal
          image={screenshotRef.current}
          onClose={() => setShowEditor(false)}
          brightness={brightness * 100} // Hier stellen wir den Wert als Prozentsatz ein (0-200%)
          contrast={contrast * 100} // Hier stellen wir den Wert als Prozentsatz ein (0-200%)
          saturation={saturation * 100} // Hier stellen wir den Wert als Prozentsatz ein (0-200%)
          title={file?.name || "Screenshot"} // Den Titel des Bildes (Dateiname)
          timestamp={timestamp ?? undefined}
        />
      )}
    </main>
  );
}
