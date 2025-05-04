import { useEffect, useRef, useState } from "react";
import { useRouter } from 'next/router';
import { FaPaperPlane } from "react-icons/fa";

interface MessageObject {
    name: string;
    text: string;
}

export default function ChatComponent({ dcRef }: { dcRef: React.RefObject<RTCDataChannel | null> }) {
    const router = useRouter();
    const { id: roomId, role } = router.query;

    const [message, setMessage] = useState("");
    const [messages, setMessages] = useState<MessageObject[]>([]);
    const [isTTSMode, setIsTTSMode] = useState(false);
    const [isAnimaleseMode, setIsAnimaleseMode] = useState(true);

    const messagesEndRef = useRef<HTMLDivElement>(null);
    const isSendingMessage = useRef(false);
    const isTTSModeRef = useRef(false);
    const isAnimaleseModeRef = useRef(false);

    useEffect(() => {
        isTTSModeRef.current = isTTSMode;
    }, [isTTSMode]);

    useEffect(() => {
        isAnimaleseModeRef.current = isAnimaleseMode;
    }, [isAnimaleseMode]);

    const getNameWithEmoji = (role: string) => {
        const emoji = role === 'host' ? '👑' : '🙋';
        const name = role === 'host' ? 'Host' : 'Joiner';
        const nameColor = role === 'host' ? 'red' : 'blue';
        return `${emoji} <span style="color:${nameColor}">${name}</span>`;
    };

    const sendMessageToAPI = async (messageObject: MessageObject) => {
        try {
            const response = await fetch(`/api/chat/send`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    roomId,
                    sender: messageObject.name,
                    message: messageObject.text,
                }),
            });
            if (!response.ok) console.error("Fehler beim Senden der Nachricht an die API");
        } catch (error) {
            console.error("Fehler beim Senden der Nachricht:", error);
        }
    };

    const sendMessage = async () => {
        if (message.trim() && dcRef.current?.readyState === "open" && !isSendingMessage.current) {
            isSendingMessage.current = true;
            const name = getNameWithEmoji(role as string);
            const messageObject: MessageObject = { name, text: message.trim() };

            setMessages((prev) => [...prev, messageObject]);

            try {
                dcRef.current.send(JSON.stringify(messageObject));
                await sendMessageToAPI(messageObject);
                setMessage("");
            } catch (error) {
                console.error("Fehler beim Senden der Nachricht:", error);
            } finally {
                isSendingMessage.current = false;
            }
        }
    };

    const handleReceivedMessage = (event: MessageEvent) => {
        try {
            const decodedMessage: MessageObject = JSON.parse(event.data);
            console.log("Nachricht empfangen:", decodedMessage);
            setMessages((prev) => [...prev, decodedMessage]);

            if (isTTSModeRef.current) {
                console.log("TTS ist aktiv, Nachricht wird vorgelesen:", decodedMessage.text);
                readMessageAloud(decodedMessage.text);
            } else {
                console.log("TTS ist deaktiviert");
            }
        } catch (error) {
            console.error("Fehler beim Verarbeiten der empfangenen Nachricht:", error);
        }
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            sendMessage();
        }
    };

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

    const convertToAnimalese = (text: string) => {
        return text
            .split("")
            .map(char => {
                if (/[a-zA-Z]/.test(char)) {
                    return char + " ";
                } else if (char === " ") {
                    return ".";
                } else {
                    return "";
                }
            })
            .join("");
    };

    

    const readMessageAloud = (messageText: string) => {
        if (typeof window === "undefined" || !window.speechSynthesis) {
            console.warn("SpeechSynthesis wird nicht unterstützt.");
            return;
        }

        const utterance = new SpeechSynthesisUtterance(
            isAnimaleseModeRef.current ? convertToAnimalese(messageText) : messageText
        );

        utterance.lang = "en-US";
        utterance.rate = isAnimaleseModeRef.current ? 12 : 1.25;
        utterance.pitch = isAnimaleseModeRef.current ? -12 : 1;
        utterance.volume = 1;

        const voices = speechSynthesis.getVoices();
        if (voices.length > 0) {
            utterance.voice = voices.find(v => v.lang.startsWith("de")) || voices[0];
            window.speechSynthesis.speak(utterance);
        } else {
            window.speechSynthesis.onvoiceschanged = () => {
                const loadedVoices = speechSynthesis.getVoices();
                utterance.voice = loadedVoices.find(v => v.lang.startsWith("de")) || loadedVoices[0];
                window.speechSynthesis.speak(utterance);
            };
        }
    };

    const toggleTTSMode = () => {
        setIsTTSMode(prev => !prev);
        console.log("TTS-Modus umgeschaltet:", !isTTSMode);
    };

    const toggleVoiceStyle = () => {
        setIsAnimaleseMode(prev => !prev);
        console.log("Vorlese-Stil umgeschaltet auf:", !isAnimaleseMode ? "Animalese" : "Normal");
    };

    useEffect(() => {
        const dc = dcRef.current;
        if (dc) {
            dc.onmessage = handleReceivedMessage;
            dc.onopen = () => console.log("Data channel is open in ChatComponent");
            dc.onclose = () => console.log("Data channel is closed in ChatComponent");
            dc.onerror = (error) => console.error("Data channel error:", error);
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
        if (roomId) fetchMessages();
    }, [roomId]);

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [messages]);

    return (
        <div style={{
            display: "flex", flexDirection: "column", height: "100%", padding: "1rem",
            backgroundColor: "#181818", borderRadius: "8px", flex: 1, boxSizing: "border-box", width: "100%"
        }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <h3 style={{ fontSize: "1.2rem", color: "#fff", margin: 0 }}>Chat</h3>
                <div style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
                    <button
                        onClick={toggleVoiceStyle}
                        title="Stil wechseln"
                        style={{
                            background: "none", border: "none", cursor: "pointer",
                            color: "#fff", fontSize: "1.5rem"
                        }}
                    >
                        {isAnimaleseMode ? "🐵" : "🗣️"}
                    </button>
                    <button
                        onClick={toggleTTSMode}
                        title="TTS umschalten"
                        style={{
                            background: "none", border: "none", cursor: "pointer",
                            color: "#fff", fontSize: "1.5rem"
                        }}
                    >
                        {isTTSMode ? "🔊" : "🔇"}
                    </button>
                </div>
            </div>

            <div style={{
                flex: 1, minHeight: "150px", maxHeight: "50vh", overflowY: "auto",
                padding: "0.75rem", backgroundColor: "#1a1a1a", borderRadius: "8px",
                marginTop: "0.75rem", wordWrap: "break-word", display: "flex", flexDirection: "column"
            }}>
                {messages.map((msg, index) => (
                    <p key={index} style={{ margin: "0.5rem 0", fontSize: "1rem", color: "#ddd" }}>
                        <span dangerouslySetInnerHTML={{ __html: msg.name + ": " }} />
                        {msg.text}
                    </p>
                ))}
                <div ref={messagesEndRef} />
            </div>

            <div style={{ display: "flex", gap: "0.5rem", marginTop: "0.75rem", width: "100%" }}>
                <textarea
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder="Nachricht"
                    rows={2}
                    style={{
                        flex: 1, padding: "0.75rem", fontSize: "1rem", borderRadius: "6px",
                        border: "1px solid #444", backgroundColor: "#333", color: "#fff",
                        outline: "none", resize: "none", width: "100%"
                    }}
                />
                <button
                    onClick={sendMessage}
                    style={{
                        padding: "0 1rem", backgroundColor: "#0070f3", color: "#fff", fontSize: "1rem",
                        borderRadius: "6px", border: "none", cursor: "pointer", display: "flex",
                        alignItems: "center", justifyContent: "center", whiteSpace: "nowrap"
                    }}
                >
                    <FaPaperPlane />
                </button>
            </div>
        </div>
    );
}
