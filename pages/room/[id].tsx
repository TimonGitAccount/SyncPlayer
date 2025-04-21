import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/router";

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
  
  const ignoreNextSeekRef = useRef(false);

  const videoRef = useRef<HTMLVideoElement | null>(null);

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
    <main style={{ padding: "2rem" }}>
        <h1>📡 Raum: {roomId}</h1>
        <p>Rolle: {role === "host" ? "👑 Host" : "🙋 Joiner"}</p>
        <p>Status: {isConnected ? "🟢 Verbunden" : "🔄 Verbindung wird aufgebaut..."}</p>

        <div style={{ marginTop: "2rem" }}>
            <label>
            🎥 Video-Datei wählen:
            <input
                type="file"
                accept="video/*"
                onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) {
                      setFile(file);
                      const url = URL.createObjectURL(file);
                      setVideoUrl(url);
                  
                      // 📡 Dateinamen an anderen senden
                      if (dcRef.current?.readyState === "open") {
                        dcRef.current.send(JSON.stringify({ type: "file", name: file.name }));
                      }
                    }
                  }}
                  
            />
            </label>
        </div>

        {file && (
            <div style={{ marginTop: "1rem" }}>
              {file && <p>📁 Deine Datei: <strong>{file.name}</strong></p>}
              {remoteFileName && <p>🧑‍🤝‍🧑 Andere Person: <strong>{remoteFileName}</strong></p>}
            </div>
          
        )}

        {videoUrl && (
            <video
            ref={videoRef}
            src={videoUrl || undefined}
            controls
            style={{ width: "100%", maxWidth: "800px", marginTop: "1rem" }}
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
          
          
        )}
        </main>

  );
}
