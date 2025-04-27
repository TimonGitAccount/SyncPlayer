import { useState } from "react";
import { useRouter } from "next/router";

export default function Home() {
  const [roomId, setRoomId] = useState("");
  const router = useRouter();

  const handleJoin = (role: "host" | "join") => {
    if (!roomId) return;
    router.push(`/room/${roomId}?role=${role}`);
  };

  const generateRandomKey = () => {
    const randomKey = Math.random().toString(36).substring(2, 10); // einfacher 8-Zeichen-Key
    setRoomId(randomKey);
  };

  return (
    <main style={{ padding: "2rem" }}>
      <h1>🎬 Sync Player</h1>

      <input
        type="text"
        placeholder="Raum-ID eingeben..."
        value={roomId}
        onChange={(e) => setRoomId(e.target.value)}
        style={{ padding: "0.5rem", fontSize: "1rem", marginBottom: "1rem", width: "100%", maxWidth: "300px" }}
      />

      <div style={{ display: "flex", flexWrap: "wrap", gap: "1rem", marginTop: "1rem" }}>
        <button onClick={() => handleJoin("host")} style={btnStyle}>
          👑 Raum hosten
        </button>
        <button onClick={() => handleJoin("join")} style={btnStyle}>
          🙋 Raum beitreten
        </button>
        {/* Button für zufällige Raum-ID */}
        <button onClick={generateRandomKey} style={btnStyle}>
          🎲 Zufällige Raum-ID
        </button>
      </div>
    </main>
  );
}

const btnStyle = {
  padding: "0.75rem 1.5rem",
  fontSize: "1rem",
  cursor: "pointer",
  backgroundColor: "#333",
  color: "#fff",
  border: "none",
  borderRadius: "8px",
};
