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
  

  // 🛡️ Falls role/roomId noch nicht da ist → automatisch reloaden
  useEffect(() => {
    const timeout = setTimeout(() => {
      if (router.isReady && !router.query.role) {
        console.warn("❗ Rolle fehlt – Seite wird neu geladen...");
        location.reload();
      }
    }, 500); // nach 0.5s prüfen

    return () => clearTimeout(timeout);
  }, [router.isReady]);

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
      const dataChannel = pc.createDataChannel("sync");
      dcRef.current = dataChannel;

      dataChannel.onopen = () => {
        dataChannel.send("Hallo vom Host");
        setIsConnected(true);
      };

      dataChannel.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data);
          if (msg.type === "file") {
            setRemoteFileName(msg.name);
          } else {
          }
          if (msg.type === "control") {
            handleControl(msg.action, "remote", msg.time);
          }     
        } catch {
        }
      };
      
      

      const createAndSendOffer = async () => {
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
      };

      createAndSendOffer();
    } else if (role === "join") {
      pc.ondatachannel = (event) => {
        const dataChannel = event.channel;
        dcRef.current = dataChannel;

        dataChannel.onopen = () => {
          dataChannel.send("Hallo vom Joiner");
          setIsConnected(true);
        };

        dataChannel.onmessage = (event) => {
            try {
              const msg = JSON.parse(event.data);
              if (msg.type === "file") {
                setRemoteFileName(msg.name);
              } else {
              }
              if (msg.type === "control") {
                handleControl(msg.action, "remote", msg.time);
              }              
              
            } catch {
            }
          };
          
          
      };

      const getOfferAndSendAnswer = async () => {
        const res = await fetch(`/api/room/${roomId}/offer`);
        if (res.status === 200 && isMounted) {
          const data = await res.json();
          const remoteDesc = new RTCSessionDescription(data.offer);

          if (pc.signalingState === "closed") {
            console.warn("🚫 PC ist geschlossen – keine Antwort möglich.");
            return;
          }

          await pc.setRemoteDescription(remoteDesc);

          const answer = await pc.createAnswer();
          await pc.setLocalDescription(answer);

          await fetch(`/api/room/${roomId}/answer`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ answer }),
          });

        }
      };

      getOfferAndSendAnswer();
    }

    // 📡 ICE candidates pollen
    const pollCandidates = async () => {
      try {
        const res = await fetch(`/api/room/${roomId}/candidates`);
        if (res.ok) {
          const data = await res.json();
          for (const c of data.candidates) {
            try {
              await pc.addIceCandidate(new RTCIceCandidate(c));
            } catch (err) {
              console.warn("ICE Candidate Fehler:", err);
            }
          }
        }
      } catch (err) {
        console.error("Fehler beim Polling:", err);
      }

      setTimeout(pollCandidates, 2000);
    };

    pollCandidates();

    return () => {
      isMounted = false;
      pc.close();
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
