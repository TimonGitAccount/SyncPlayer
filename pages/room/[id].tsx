import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/router";
import { FaCog, FaUndo, FaCamera } from "react-icons/fa";
import ChatComponent from "../../components/Chat";
import { FaComment } from "react-icons/fa6";

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

  
  const ignoreNextSeekRef = useRef(false);

  const videoRef = useRef<HTMLVideoElement | null>(null);

  const handleScreenshot = () => {
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
  
      const timestamp = new Date()
        .toISOString()
        .replace(/[:.]/g, "-")
        .slice(0, 19);
      const videoName = file?.name?.split(".")[0] || "screenshot";
      const filename = `${videoName}-${timestamp}.png`;
  
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      a.click();
      URL.revokeObjectURL(url);
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
          <label
            htmlFor="fileUpload"
            style={{
              display: "inline-block",
              padding: "0.5rem 1rem",
              backgroundColor: "#555",
              borderRadius: "8px",
              cursor: "pointer",
            }}
          >
            🎥 Video wählen
          </label>
          <input
            id="fileUpload"
            type="file"
            accept="video/*"
            style={{ display: "none" }}
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) {
                setFile(file);
                const url = URL.createObjectURL(file);
                setVideoUrl(url);

                if (dcRef.current?.readyState === "open") {
                  dcRef.current.send(JSON.stringify({ type: "file", name: file.name }));
                }
              }
            }}
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

                <div
                  style={{
                    fontSize: "1.5rem",
                    cursor: "pointer",
                    color: "#fff",
                  }}
                  onClick={handleScreenshot}
                  title="Screenshot aufnehmen"
                >
                  <FaCamera />
                </div>

              </div>
            </>
          )}

          {/* Chat-Icon in der oberen Leiste */}
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

          {remoteFileName && (
            <span style={{ fontSize: "0.9rem" }}>
              🧑‍🤝‍🧑 <strong>{remoteFileName}</strong>
            </span>
          )}
        </div>

        {/* Rechter Bereich */}
        <div style={{ display: "flex", alignItems: "center", gap: "1rem", flexWrap: "wrap" }}>
          {/* Link-Teilen Button */}
          <button
            style={{
              padding: "0.5rem 1rem",
              backgroundColor: "#0070f3",
              color: "#fff",
              border: "none",
              borderRadius: "8px",
              cursor: "pointer",
              fontSize: "0.9rem",
            }}
            onClick={() => {
              const shareUrl = `${window.location.origin}/room/${roomId}?role=join`;
              if (navigator.share) {
                navigator.share({
                  title: "Sync Player Raum",
                  text: "Trete meinem Raum bei!",
                  url: shareUrl,
                });
              } else {
                navigator.clipboard.writeText(shareUrl);
                alert("Join-Link kopiert!");
              }
            }}
          >
            🔗 Link teilen
          </button>

          {/* Verbindungsstatus */}
          <span style={{ fontSize: "0.9rem" }}>
            {isConnected ? "🟢 Verbunden" : "🔄 Verbindung wird aufgebaut..."}
          </span>
        </div>
      </div>

      {/* Neue Leiste, die sich öffnet, wenn das Einstellungssymbol geklickt wird */}
      {isSettingsOpen && (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "1rem",
            padding: "1rem 2rem",
            backgroundColor: "#222",
            color: "#fff",
            zIndex: 999, // Damit sie oberhalb des Videos bleibt
            transition: "transform 0.3s ease",
            transform: isSettingsOpen ? "translateY(0)" : "translateY(-100%)",
          }}
        >
          {/* Helligkeit */}
          <label>
            Helligkeit:
            <input
              type="range"
              min="0.5"
              max="2"
              step="0.1"
              value={brightness}
              onChange={(e) => setBrightness(parseFloat(e.target.value))}
            />
          </label>

          {/* Kontrast */}
          <label>
            Kontrast:
            <input
              type="range"
              min="0.5"
              max="2"
              step="0.1"
              value={contrast}
              onChange={(e) => setContrast(parseFloat(e.target.value))}
            />
          </label>

          {/* Sättigung */}
          <label>
            Sättigung:
            <input
              type="range"
              min="0"
              max="2"
              step="0.1"
              value={saturation}
              onChange={(e) => setSaturation(parseFloat(e.target.value))}
            />
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
            }}
            onClick={() => {
              setBrightness(1);
              setContrast(1);
              setSaturation(1);
            }}
          >
            <FaUndo />
          </button>
        </div>
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
        <div
          style={{
            flex: 1, // Video bekommt den meisten Platz
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
          }}
        >
          {videoUrl ? (
            <video
              ref={videoRef}
              src={videoUrl || undefined}
              controls
              style={{
                width: "100%",
                maxWidth: "900px",
                height: "auto",
                borderRadius: "12px",
                filter: `brightness(${brightness}) contrast(${contrast}) saturate(${saturation})`,
              }}
              onPlay={() => handleControl("play", "local")}
              onPause={() => handleControl("pause", "local")}
              onSeeked={() => {
                if (ignoreNextSeekRef.current) {
                  ignoreNextSeekRef.current = false;
                  return;
                }
                if (videoRef.current) {
                  handleControl("seek", "local", videoRef.current.currentTime);
                }
              }}
            />
          ) : (
            <p style={{ color: "#888" }}>Bitte lade eine Video-Datei hoch.</p>
          )}
        </div>

        {isChatOpen && <div style={{ display: "flex", width: "20%", overflow: "hidden" }}>
          <div style={{ flexGrow: 1, backgroundColor: "#111" }}>
            {/* Hier dein Hauptinhalt (z.B. Video) */}
          </div>

          <ChatComponent dcRef={dcRef} />
        </div>}


      </div>

    </main>

  );
}
