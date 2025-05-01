import React, { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { FaTimes, FaDownload, FaUndo, FaRedo, FaSyncAlt } from "react-icons/fa";

type Props = {
    image: HTMLImageElement | null;
    onClose: () => void;
    brightness?: number;
    contrast?: number;
    saturation?: number;
    title?: string;
    timestamp?: string;
};

export default function ImageEditorModal({ image, onClose, brightness, contrast, saturation, title, timestamp }: Props) {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const previewRef = useRef<HTMLCanvasElement>(null);

    const [currentBrightness, setCurrentBrightness] = useState(brightness ?? 100);
    const [currentContrast, setCurrentContrast] = useState(contrast ?? 100);
    const [currentSaturation, setCurrentSaturation] = useState(saturation ?? 100);

    const [rotation, setRotation] = useState(0);
    const [flip, setFlip] = useState(false);
    const [removeMetadata, setRemoveMetadata] = useState(false);
    const [isProcessing, setIsProcessing] = useState(false);

    useEffect(() => {
        if (!image || !previewRef.current) return;

        const ctx = previewRef.current.getContext("2d");
        if (!ctx) return;

        const draw = () => {
            const canvas = previewRef.current!;
            // Skalieren des Canvas, um das Bild proportional anzupassen
            const maxWidth = canvas.parentElement?.offsetWidth ?? 600; // Maximalbreite des Modals
            const aspectRatio = image.width / image.height;

            // Berechne die Höhe basierend auf der maximalen Breite, sodass das Seitenverhältnis beibehalten wird
            const scaledHeight = maxWidth / aspectRatio;
            
            // Stelle sicher, dass die Höhe nicht größer als die maximal zulässige Höhe des Containers wird
            if (scaledHeight > window.innerHeight * 0.8) {
                const scaledWidth = (window.innerHeight * 0.8) * aspectRatio;
                canvas.width = scaledWidth;
                canvas.height = window.innerHeight * 0.8;
            } else {
                canvas.width = maxWidth;
                canvas.height = scaledHeight;
            }

            ctx.save();
            ctx.clearRect(0, 0, canvas.width, canvas.height);

            // Transformationen anwenden
            ctx.translate(canvas.width / 2, canvas.height / 2);
            if (flip) ctx.scale(-1, 1);
            ctx.rotate((rotation * Math.PI) / 180);
            ctx.translate(-canvas.width / 2, -canvas.height / 2);

            // Filter anwenden
            ctx.filter = `brightness(${currentBrightness}%) contrast(${currentContrast}%) saturate(${currentSaturation}%)`;
            ctx.drawImage(image, 0, 0, canvas.width, canvas.height); // Skaliertes Bild zeichnen

            ctx.restore();
        };

        draw();
    }, [image, currentBrightness, currentContrast, currentSaturation, rotation, flip]);

    const resetAll = () => {
        setCurrentBrightness(100);
        setCurrentContrast(100);
        setCurrentSaturation(100);
        setRotation(0);
        setFlip(false);
    };

    const handleSave = () => {
        if (!previewRef.current) return;
        setIsProcessing(true);

        const canvas = document.createElement("canvas");
        const ctx = canvas.getContext("2d");
        if (!ctx || !image) return;

        // Rotation anpassen: Wenn das Bild um 90 Grad gedreht wird, tauschen die Breite und Höhe
        let rotatedWidth = image.width;
        let rotatedHeight = image.height;

        if (rotation === 90 || rotation === 270) {
            rotatedWidth = image.height;
            rotatedHeight = image.width;
        }

        canvas.width = rotatedWidth;
        canvas.height = rotatedHeight;

        ctx.save();

        // Zuerst das Canvas in die Mitte verschieben
        ctx.translate(rotatedWidth / 2, rotatedHeight / 2);

        // Bild spiegeln
        if (flip) ctx.scale(-1, 1);

        // Rotation anwenden
        ctx.rotate((rotation * Math.PI) / 180);

        // Die Bildkoordinaten so anpassen, dass es nicht abgeschnitten wird
        ctx.translate(-image.width / 2, -image.height / 2);

        // Filter anwenden
        ctx.filter = `brightness(${currentBrightness}%) contrast(${currentContrast}%) saturate(${currentSaturation}%)`;
        ctx.drawImage(image, 0, 0);

        ctx.restore();

        // Das bearbeitete Bild als Blob speichern
        canvas.toBlob(
            (blob) => {
                if (blob) {
                    const link = document.createElement("a");
                    // Dynamischer Dateiname basierend auf title und timestamp
                    const safeTitle = title?.replace(/[^\w\-]/g, "_") ?? "bild";
                    const safeTimestamp = timestamp?.replace(/[^\w\-]/g, "_") ?? "zeit";
                    link.download = `${safeTitle}_${safeTimestamp}_edit.png`;
                    link.href = URL.createObjectURL(blob);
                    link.click();
                    URL.revokeObjectURL(link.href);
                }
                setIsProcessing(false);
            },
            "image/png",
            1
        );
    };

    const modalContent = (
        <div style={{
            position: "fixed",
            top: 0, left: 0,
            width: "100vw", height: "100vh",
            backgroundColor: "rgba(0,0,0,0.7)",
            display: "flex", alignItems: "center", justifyContent: "center",
            zIndex: 10000
        }}>
            <div style={{
                backgroundColor: "#222",
                padding: "2rem",
                borderRadius: "12px",
                minWidth: "300px",
                maxWidth: "600px",
                color: "#fff",
                position: "relative"
            }}>
                <button onClick={onClose} disabled={isProcessing} style={{
                    position: "absolute", top: "0.5rem", right: "0.5rem",
                    background: "none", border: "none", color: "#fff",
                    fontSize: "1.2rem", cursor: isProcessing ? "not-allowed" : "pointer"
                }}>
                    <FaTimes />
                </button>

                <h2 style={{ marginBottom: "1rem" }}>🖼️ Bild bearbeiten</h2>

                <div style={{ display: "flex", justifyContent: "center", marginBottom: "1rem" }}>
                    <canvas ref={previewRef} style={{ maxWidth: "100%", height: "auto", borderRadius: "6px" }} />
                </div>

                {/* Regler */}
                {["Helligkeit", "Kontrast", "Sättigung"].map((label, idx) => {
                    const setters = [setCurrentBrightness, setCurrentContrast, setCurrentSaturation];
                    const values = [currentBrightness, currentContrast, currentSaturation];
                    return (
                        <div key={label} style={{ marginBottom: "0.75rem" }}>
                            <label>{label}: {values[idx]}%</label>
                            <input
                                type="range"
                                min={0}
                                max={200}
                                value={values[idx]}
                                onChange={(e) => setters[idx](parseInt(e.target.value))}
                                style={{ width: "100%" }}
                            />
                        </div>
                    );
                })}

                {/* Aktionen */}
                <div style={{ display: "flex", justifyContent: "space-around", margin: "1rem 0" }}>
                    <button onClick={() => setRotation((r) => (r - 90) % 360)}><FaUndo /></button>
                    <button onClick={() => setRotation((r) => (r + 90) % 360)}><FaRedo /></button>
                    <button onClick={() => setFlip((f) => !f)}><FaSyncAlt /></button>
                </div>

                <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "1rem" }}>
                    <input type="checkbox" id="removeMeta" checked={removeMetadata} onChange={(e) => setRemoveMetadata(e.target.checked)} />
                    <label htmlFor="removeMeta">Metadaten entfernen (Datenschutz & Größe)</label>
                </div>

                <div style={{ display: "flex", justifyContent: "space-between" }}>
                    <button onClick={resetAll} style={{
                        padding: "0.5rem 1rem",
                        backgroundColor: "#666", border: "none", borderRadius: "8px",
                        color: "#fff", cursor: "pointer"
                    }}>
                        Zurücksetzen
                    </button>

                    <button onClick={handleSave} disabled={isProcessing} style={{
                        padding: "0.5rem 1rem",
                        backgroundColor: "#0070f3", border: "none", borderRadius: "8px",
                        color: "#fff", fontSize: "1rem", display: "flex", alignItems: "center", gap: "0.5rem",
                        cursor: isProcessing ? "wait" : "pointer"
                    }}>
                        <FaDownload />
                        {isProcessing ? "Speichern..." : "Speichern"}
                    </button>
                </div>
            </div>
        </div>
    );

    if (typeof window === "undefined") return null;
    return createPortal(modalContent, document.body);
}
