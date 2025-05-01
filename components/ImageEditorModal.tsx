import React, { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { FaTimes, FaDownload } from "react-icons/fa";
import * as tf from "@tensorflow/tfjs"; // Import TensorFlow.js

const useTfProdMode = () => {
    useEffect(() => {
        let isMounted = true;
        tf.ready().then(() => {
            if (isMounted) {
                tf.enableProdMode();
                console.log("TensorFlow.js Production Mode aktiviert.");
            }
        });
        return () => { isMounted = false; };
    }, []);
};

type Resolution =
    | { label: string; width: number; height: number }
    | { label: "Auto"; width: "auto"; height: "auto" };

const resolutions: Resolution[] = [
    { label: "Auto", width: "auto", height: "auto" },
    { label: "854 x 480 (480p)", width: 854, height: 480 },
    { label: "1280 x 720 (720p)", width: 1280, height: 720 },
    { label: "1920 x 1080 (1080p)", width: 1920, height: 1080 },
    { label: "2560 x 1440 (2K)", width: 2560, height: 1440 },
    { label: "3840 x 2160 (4K)", width: 3840, height: 2160 },
];

type Props = {
    image: HTMLImageElement | null;
    onClose: () => void;
};

// Funktion zum Upscaling des Bildes mit upscalerjs
const createWebWorker = (image: HTMLImageElement | null, scale: number, width: number, height: number) => {
    return new Promise<HTMLImageElement | null>((resolve, reject) => {
        const worker = new Worker(new URL('src/worker/imageUpscalerWorker.js', import.meta.url), { type: 'module' });

        worker.onmessage = (event) => {
            if (event.data.success) {
                const img = new Image();
                img.src = event.data.upscaledImageData;
                img.onload = () => resolve(img);
            } else {
                reject(new Error(event.data.error));
            }
        };

        worker.onerror = (error) => {
            reject(new Error(`Worker-Fehler: ${error.message} (${error.filename}:${error.lineno})`));
            console.error('Worker-Fehler:', error); // Zusätzliches Logging
        };

        // Bilddaten und Parameter an den Worker senden
        const imageData = image ? image.src : null;
        worker.postMessage({ imageData, scale, width, height });
    });
};

export default function ImageEditorModal({ image, onClose }: Props) {
    const [selectedResolution, setSelectedResolution] = useState<Resolution>(resolutions[0]);
    const [useUpscaling, setUseUpscaling] = useState(false);
    const [isProcessing, setIsProcessing] = useState(false);
    const [upscalingStatus, setUpscalingStatus] = useState<string | null>(null);
    const [upscaleFactor, setUpscaleFactor] = useState<number>(4); // Standard-Skalierungsfaktor

    useTfProdMode();

    const handleSave = async () => {
        if (!image || isProcessing) return;

        setIsProcessing(true);
        let imageToDraw: HTMLImageElement | HTMLCanvasElement = image;

        if (useUpscaling) {
            setUpscalingStatus("Upscaling läuft...");
            try {
                // Worker mit Scale und gewählter Auflösung aufrufen
                imageToDraw = await createWebWorker(image, upscaleFactor, selectedResolution.width, selectedResolution.height);
                if (imageToDraw) {
                    setUpscalingStatus("Upscaling abgeschlossen.");
                } else {
                    setUpscalingStatus("Upscaling fehlgeschlagen.");
                }
            } catch (error) {
                setUpscalingStatus("Fehler beim Upscaling.");
                imageToDraw = image;
            }
        }

        // Das Bild auf die endgültige Auflösung skalieren und speichern
        const canvas = document.createElement("canvas");
        const { width, height } = selectedResolution;
        canvas.width = width === "auto" ? imageToDraw.width : width;
        canvas.height = height === "auto" ? imageToDraw.height : height;

        const ctx = canvas.getContext("2d");
        if (!ctx) {
            alert("Fehler: Konnte keinen Canvas-Kontext erhalten.");
            setIsProcessing(false);
            setUpscalingStatus(null);
            return;
        }

        ctx.imageSmoothingQuality = "high";
        ctx.drawImage(imageToDraw, 0, 0, canvas.width, canvas.height);

        try {
            const link = document.createElement("a");
            const filenameSuffix = useUpscaling ? '_upscaled' : '';
            link.download = `screenshot_${canvas.width}x${canvas.height}${filenameSuffix}.png`;
            link.href = canvas.toDataURL("image/png");
            link.click();
        } catch (error) {
            console.error("Fehler beim Erstellen des Download-Links:", error);
            alert(`Fehler beim Speichern des Bildes: ${error instanceof Error ? error.message : String(error)}`);
        } finally {
            canvas.width = 0;
            canvas.height = 0;
            setIsProcessing(false);
            setUpscalingStatus(null);
        }
    };

    const modalContent = (
        <div style={{ position: "fixed", top: 0, left: 0, width: "100vw", height: "100vh", backgroundColor: "rgba(0,0,0,0.7)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 10000 }}>
            <div style={{ backgroundColor: "#222", padding: "2rem", borderRadius: "12px", minWidth: "300px", maxWidth: "500px", color: "#fff", position: "relative" }}>
                <button onClick={onClose} disabled={isProcessing} style={{ position: "absolute", top: "0.5rem", right: "0.5rem", background: "none", border: "none", color: "#fff", fontSize: "1.2rem", cursor: isProcessing ? "not-allowed" : "pointer" }}>
                    <FaTimes />
                </button>

                <h2 style={{ marginBottom: "1rem" }}>🖼️ Screenshot bearbeiten</h2>

                {image && (
                    <div style={{ width: '100%', marginBottom: '1rem', display: 'flex', justifyContent: 'center' }}>
                        <img src={image?.src} alt="Vorschau" style={{ width: '100%', maxWidth: '100%', height: 'auto', borderRadius: '6px', objectFit: 'contain' }} />
                    </div>
                )}

                {upscalingStatus && (
                    <div style={{ margin: "1rem 0", padding: "0.5rem", backgroundColor: "#444", borderRadius: "4px", textAlign: "center" }}>
                        {upscalingStatus}
                    </div>
                )}

                <label style={{ display: "block", marginBottom: "1rem" }}>
                    Zielauflösung:
                    <select disabled={isProcessing} style={{ width: "100%", padding: "0.5rem", borderRadius: "6px", marginTop: "0.5rem", backgroundColor: "#333", color: "#fff", cursor: isProcessing ? 'not-allowed' : 'default' }} value={selectedResolution.label} onChange={(e) => { const selected = resolutions.find((r) => r.label === e.target.value); if (selected) setSelectedResolution(selected); }}>
                        {resolutions.map((r) => (<option key={r.label} value={r.label}>{r.label}</option>))}
                    </select>
                </label>

                <label style={{ display: "block", marginBottom: "1rem" }}>
                    <input disabled={isProcessing} type="checkbox" checked={useUpscaling} onChange={(e) => setUseUpscaling(e.target.checked)} style={{ marginRight: "0.5rem", cursor: isProcessing ? 'not-allowed' : 'pointer' }} />
                    AI Upscaling aktivieren
                </label>

                {useUpscaling && (
                    <>
                        <label style={{ display: "block", marginBottom: "1rem" }}>
                            Skalierungsfaktor:
                            <select disabled={isProcessing} value={upscaleFactor} onChange={(e) => setUpscaleFactor(Number(e.target.value))} style={{ width: "100%", padding: "0.5rem", borderRadius: "6px", marginTop: "0.5rem", backgroundColor: "#333", color: "#fff" }}>
                                <option value={2}>2x</option>
                                <option value={3}>3x</option>
                                <option value={4}>4x</option>
                                <option value={8}>8x</option>
                            </select>
                        </label>
                    </>
                )}

                <button onClick={handleSave} disabled={isProcessing || !image} style={{ padding: "0.5rem 1rem", backgroundColor: isProcessing ? "#555" : "#0070f3", border: "none", borderRadius: "8px", color: "#fff", fontSize: "1rem", cursor: isProcessing ? "wait" : "pointer", display: "flex", alignItems: "center", gap: "0.5rem", marginTop: "1rem" }}>
                    {isProcessing ? 'Verarbeite...' : <><FaDownload /> Speichern</>}
                </button>
            </div>
        </div>
    );

    if (typeof window === "undefined") return null;
    return createPortal(modalContent, document.body);
}
