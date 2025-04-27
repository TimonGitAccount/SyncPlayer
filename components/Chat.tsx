import { useEffect, useRef, useState } from "react";
import { useRouter } from 'next/router';

interface MessageObject {
    name: string;
    text: string;
}

export default function ChatComponent({ dcRef }: { dcRef: React.RefObject<RTCDataChannel | null> }) {
    const router = useRouter();
    const { id: roomId, role } = router.query;

    const [message, setMessage] = useState("");
    const [messages, setMessages] = useState<MessageObject[]>([]); // Messages als Array von Objekten speichern

    const messagesEndRef = useRef<HTMLDivElement>(null);
    const isSendingMessage = useRef(false); // useRef für den Sende-Flag, um Race Conditions zu vermeiden

    const getNameWithEmoji = (role: string) => {
        const emoji = role === 'host' ? '👑' : '🙋';
        const name = role === 'host' ? 'Host' : 'Joiner';
        const nameColor = role === 'host' ? 'red' : 'blue';

        return `${emoji} <span style="color:${nameColor}">${name}</span>`;
    };

    // Nachricht an den Server senden
    const sendMessageToAPI = async (messageObject: MessageObject) => {
        try {
            const response = await fetch(`/api/chat/send`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    roomId,
                    sender: messageObject.name,
                    message: messageObject.text,
                }),
            });
            if (!response.ok) {
                console.error("Fehler beim Senden der Nachricht an die API");
            }
        } catch (error) {
            console.error("Fehler beim Senden der Nachricht:", error);
        }
    };

    // Nachricht im lokalen Zustand hinzufügen
    const sendMessage = async () => {
        if (message.trim() && dcRef.current?.readyState === "open" && !isSendingMessage.current) {
            isSendingMessage.current = true;
            const name = getNameWithEmoji(role as string);
            const messageObject: MessageObject = {
                name: name,
                text: message.trim()
            };

            // Nachricht lokal hinzufügen
            setMessages((prev) => [...prev, messageObject]);

            // Nachricht an den Data Channel senden
            try {
                dcRef.current.send(JSON.stringify(messageObject));
                await sendMessageToAPI(messageObject); // Nachricht über die API senden
                setMessage(""); // Eingabefeld leeren
            } catch (error) {
                console.error("Fehler beim Senden der Nachricht:", error);
            } finally {
                isSendingMessage.current = false;
            }
        }
    };

    // Nachricht vom Data Channel empfangen
    const handleReceivedMessage = (event: MessageEvent) => {
        try {
            const decodedMessage: MessageObject = JSON.parse(event.data);
            setMessages((prev) => [...prev, decodedMessage]);
        } catch (error) {
            console.error("Fehler beim Verarbeiten der empfangenen Nachricht:", error);
        }
    };

    // Beim Drücken der Enter-Taste Nachricht senden
    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            sendMessage();
        }
    };

    // Laden der Nachrichten vom Server
    const fetchMessages = async () => {
        try {
            const response = await fetch(`/api/chat/get?roomId=${roomId}`);
            if (response.ok) {
                const data = await response.json();
                setMessages(data.messages || []);
            } else {
                console.error("Fehler beim Abrufen der Nachrichten");
            }
        } catch (error) {
            console.error("Fehler beim Abrufen der Nachrichten:", error);
        }
    };

    useEffect(() => {
        const dc = dcRef.current;
        if (dc) {
            dc.onmessage = handleReceivedMessage;
            dc.onopen = () => {
                console.log("Data channel is open in ChatComponent");
            };
            dc.onclose = () => {
                console.log("Data channel is closed in ChatComponent");
            };
            dc.onerror = (error) => {
                console.error("Data channel error in ChatComponent:", error);
            };
        }

        return () => {
            if (dc) {
                dc.onmessage = null;
                dc.onopen = null;
                dc.onclose = null;
                dc.onerror = null;
            }
        };
    }, [dcRef]);

    useEffect(() => {
        // Nachrichten beim Laden des Chats abrufen
        if (roomId) {
            fetchMessages();
        }
    }, [roomId]);

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [messages]);

    return (
        <div style={{ padding: "1rem", backgroundColor: "#181818", borderRadius: "8px", flex: "1", maxHeight: "100%" }}>
            <h3 style={{ fontSize: "1.2rem", marginBottom: "0.5rem", color: "#fff", textAlign: "center" }}>
                Chat
            </h3>

            <div
                style={{
                    height: "700px",
                    overflowY: "auto",
                    padding: "0.75rem",
                    backgroundColor: "#1a1a1a",
                    borderRadius: "8px",
                    wordWrap: "break-word",
                    display: "flex",
                    flexDirection: "column",
                }}
            >
                {messages.map((msg, index) => (
                    <p key={index} style={{ margin: "0.5rem 0", fontSize: "1rem", color: "#ddd" }}>
                        <span dangerouslySetInnerHTML={{ __html: msg.name + ": " }} />
                        {msg.text}
                    </p>
                ))}
                <div ref={messagesEndRef} />
            </div>

            <div style={{ display: "flex", gap: "0.5rem", marginTop: "1rem" }}>
                <textarea
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder="Nachricht eingeben..."
                    rows={3}
                    style={{
                        flex: "1",
                        padding: "0.75rem",
                        fontSize: "1rem",
                        borderRadius: "6px",
                        border: "1px solid #444",
                        backgroundColor: "#333",
                        color: "#fff",
                        outline: "none",
                        resize: "none",
                    }}
                />
                <button
                    onClick={sendMessage}
                    style={{
                        padding: "0.75rem 1.2rem",
                        backgroundColor: "#0070f3",
                        color: "#fff",
                        fontSize: "1rem",
                        borderRadius: "6px",
                        border: "none",
                        cursor: "pointer",
                    }}
                >
                    Senden
                </button>
            </div>
        </div>
    );
}
