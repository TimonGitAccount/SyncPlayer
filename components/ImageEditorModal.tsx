import React, { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { FaTimes, FaDownload, FaUndo, FaRedo, FaSyncAlt, FaSpinner } from "react-icons/fa";

type Props = {
    image: HTMLImageElement | null;
    onClose: () => void;
    brightness?: number;
    contrast?: number;
    saturation?: number;
    title?: string;
    timestamp?: string;
};

export default function ImageEditorModal({
    image,
    onClose,
    brightness,
    contrast,
    saturation,
    title,
    timestamp
}: Props) {
    const previewRef = useRef<HTMLCanvasElement>(null);

    const [currentBrightness, setCurrentBrightness] = useState(brightness ?? 100);
    const [currentContrast, setCurrentContrast] = useState(contrast ?? 100);
    const [currentSaturation, setCurrentSaturation] = useState(saturation ?? 100);

    const [rotation, setRotation] = useState(0);
    const [flip, setFlip] = useState(false);
    const [isProcessing, setIsProcessing] = useState(false);

    const [adjustColors, setAdjustColors] = useState(false);
    const [redAdjust, setRedAdjust] = useState(0);
    const [greenAdjust, setGreenAdjust] = useState(0);
    const [blueAdjust, setBlueAdjust] = useState(0);

    const [edgeDetection, setEdgeDetection] = useState(false);
    const [edgeStrength, setEdgeStrength] = useState(1);

    // Neue State-Variablen für Auflösung
    const [selectedResolution, setSelectedResolution] = useState("original"); // "original", "720p", "1080p", etc.

    type Resolution = {
        width: number;
        height: number;
      };
      
      const resolutions: { [key: string]: Resolution } = {
        original: { width: 1920, height: 1080 },
        "480p": { width: 854, height: 480 },
        "720p": { width: 1280, height: 720 },
        "1080p": { width: 1920, height: 1080 },
        "1440p": { width: 2560, height: 1440 },
        "4k": { width: 3840, height: 2160 },
      };
      
    
    useEffect(() => {
        if (!image || !previewRef.current) return;

        const canvas = previewRef.current;
        const ctx = canvas.getContext("2d");
        if (!ctx) return;

        const draw = () => {

            canvas.width = image.width;
            canvas.height = image.height;

            ctx.save();
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            ctx.translate(canvas.width / 2, canvas.height / 2);
            if (flip) ctx.scale(-1, 1);
            ctx.rotate((rotation * Math.PI) / 180);
            ctx.translate(-canvas.width / 2, -canvas.height / 2);

            ctx.filter = `brightness(${currentBrightness}%) contrast(${currentContrast}%) saturate(${currentSaturation}%)`;
            ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
            ctx.restore();

            const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
            const data = imageData.data;

            if (adjustColors) {
                for (let i = 0; i < data.length; i += 4) {
                    data[i] = Math.min(255, Math.max(0, data[i] + redAdjust));
                    data[i + 1] = Math.min(255, Math.max(0, data[i + 1] + greenAdjust));
                    data[i + 2] = Math.min(255, Math.max(0, data[i + 2] + blueAdjust));
                }
            }

            if (edgeDetection) {
                const width = canvas.width;
                const height = canvas.height;
                const copy = new Uint8ClampedArray(data);
            
                const getGray = (i: number) =>
                    copy[i] * 0.299 + copy[i + 1] * 0.587 + copy[i + 2] * 0.114;
                const getPixelIndex = (x: number, y: number) => (y * width + x) * 4;
            
                for (let y = 1; y < height - 1; y++) {
                    for (let x = 1; x < width - 1; x++) {
                        const i = getPixelIndex(x, y);
            
                        const gx =
                            -getGray(getPixelIndex(x - 1, y - 1)) - 2 * getGray(getPixelIndex(x - 1, y)) - getGray(getPixelIndex(x - 1, y + 1)) +
                            getGray(getPixelIndex(x + 1, y - 1)) + 2 * getGray(getPixelIndex(x + 1, y)) + getGray(getPixelIndex(x + 1, y + 1));
            
                        const gy =
                            -getGray(getPixelIndex(x - 1, y - 1)) - 2 * getGray(getPixelIndex(x, y - 1)) - getGray(getPixelIndex(x + 1, y - 1)) +
                            getGray(getPixelIndex(x - 1, y + 1)) + 2 * getGray(getPixelIndex(x, y + 1)) + getGray(getPixelIndex(x + 1, y + 1));
            
                        const edge = Math.sqrt(gx * gx + gy * gy) * edgeStrength;
            
                        if (edge > 50) {
                            data[i] = data[i + 1] = data[i + 2] = 0; // Kante = Schwarz
                        }
                    }
                }
            }

            ctx.putImageData(imageData, 0, 0);
        };

        draw();
    }, [image, currentBrightness, currentContrast, currentSaturation, rotation, flip, adjustColors, redAdjust, greenAdjust, blueAdjust, edgeDetection, edgeStrength, selectedResolution]);

    const resetAll = () => {
        setCurrentBrightness(100);
        setCurrentContrast(100);
        setCurrentSaturation(100);
        setRotation(0);
        setFlip(false);
        setAdjustColors(false);
        setRedAdjust(0);
        setGreenAdjust(0);
        setBlueAdjust(0);
        setEdgeDetection(false);
        setEdgeStrength(1);
        setSelectedResolution("original");
    };

    const handleSave = () => {
        if (!image) return;
        setIsProcessing(true);
    
        const canvas = document.createElement("canvas");
        const ctx = canvas.getContext("2d");
        if (!ctx) return;
    
        const { width, height } = resolutions[selectedResolution] ?? resolutions.original;
    
        let outputWidth = width;
        let outputHeight = height;
        if (rotation === 90 || rotation === 270) {
            outputWidth = height;
            outputHeight = width;
        }
    
        canvas.width = outputWidth;
        canvas.height = outputHeight;
    
        ctx.save();
    
        // Bild-Mittelpunkt als Ursprung für Rotation und Flip
        ctx.translate(outputWidth / 2, outputHeight / 2);
        if (flip) ctx.scale(-1, 1);
        ctx.rotate((rotation * Math.PI) / 180);
    
        // Filter anwenden
        ctx.filter = `brightness(${currentBrightness}%) contrast(${currentContrast}%) saturate(${currentSaturation}%)`;
    
        // Bild über gesamte Zielauflösung strecken (kein Zentrieren!)
        ctx.drawImage(image, -outputWidth / 2, -outputHeight / 2, outputWidth, outputHeight);
    
        ctx.restore();
    
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const data = imageData.data;
    
        if (adjustColors) {
            for (let i = 0; i < data.length; i += 4) {
                data[i] = Math.min(255, Math.max(0, data[i] + redAdjust));
                data[i + 1] = Math.min(255, Math.max(0, data[i + 1] + greenAdjust));
                data[i + 2] = Math.min(255, Math.max(0, data[i + 2] + blueAdjust));
            }
        }
    
        if (edgeDetection) {
            const copy = new Uint8ClampedArray(data);
            const width = canvas.width;
            const height = canvas.height;
    
            const getGray = (i: number) =>
                copy[i] * 0.299 + copy[i + 1] * 0.587 + copy[i + 2] * 0.114;
            const getPixelIndex = (x: number, y: number) => (y * width + x) * 4;
    
            for (let y = 1; y < height - 1; y++) {
                for (let x = 1; x < width - 1; x++) {
                    const i = getPixelIndex(x, y);
                    const gx =
                        -getGray(getPixelIndex(x - 1, y - 1)) - 2 * getGray(getPixelIndex(x - 1, y)) - getGray(getPixelIndex(x - 1, y + 1)) +
                        getGray(getPixelIndex(x + 1, y - 1)) + 2 * getGray(getPixelIndex(x + 1, y)) + getGray(getPixelIndex(x + 1, y + 1));
                    const gy =
                        -getGray(getPixelIndex(x - 1, y - 1)) - 2 * getGray(getPixelIndex(x, y - 1)) - getGray(getPixelIndex(x + 1, y - 1)) +
                        getGray(getPixelIndex(x - 1, y + 1)) + 2 * getGray(getPixelIndex(x, y + 1)) + getGray(getPixelIndex(x + 1, y + 1));
                    const edge = Math.min(255, Math.sqrt(gx * gx + gy * gy) * edgeStrength);
    
                    data[i] = Math.max(0, data[i] - edge);
                    data[i + 1] = Math.max(0, data[i + 1] - edge);
                    data[i + 2] = Math.max(0, data[i + 2] - edge);
                }
            }
        }
    
        ctx.putImageData(imageData, 0, 0);
    
        canvas.toBlob(
            (blob) => {
                if (blob) {
                    const link = document.createElement("a");
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
            position: "fixed", top: 0, left: 0, width: "100vw", height: "100vh",
            backgroundColor: "rgba(0,0,0,0.7)", display: "flex", alignItems: "center", justifyContent: "center",
            zIndex: 10000
        }}>
            <div style={{
                backgroundColor: "#222", padding: "2rem", borderRadius: "12px",
                minWidth: "300px", maxWidth: "600px", color: "#fff", position: "relative"
            }}>
                <button onClick={onClose} disabled={isProcessing} style={{
                    position: "absolute", top: "0.5rem", right: "0.5rem",
                    background: "none", border: "none", color: "#fff", fontSize: "1.2rem",
                    cursor: isProcessing ? "not-allowed" : "pointer"
                }}>
                    <FaTimes />
                </button>

                <h2 style={{ marginBottom: "1rem" }}>🖼️ Bild bearbeiten</h2>

                <div style={{ display: "flex", justifyContent: "center", marginBottom: "1rem" }}>
                    <canvas ref={previewRef} style={{ maxWidth: "100%", height: "auto", borderRadius: "6px" }} />
                </div>

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

                <div style={{ display: "flex", justifyContent: "space-around", margin: "1rem 0" }}>
                    <button onClick={() => setRotation((r) => (r - 90) % 360)}><FaUndo /></button>
                    <button onClick={() => setRotation((r) => (r + 90) % 360)}><FaRedo /></button>
                    <button onClick={() => setFlip((f) => !f)}><FaSyncAlt /></button>
                </div>

                <div style={{ marginBottom: "1rem" }}>
                    <input type="checkbox" id="adjustColors" checked={adjustColors} onChange={(e) => setAdjustColors(e.target.checked)} />
                    <label htmlFor="adjustColors"> Farben anpassen</label>
                    {adjustColors && (
                        <>
                            <div>
                                <label>Rot: {redAdjust}</label>
                                <input type="range" min={-255} max={255} value={redAdjust} onChange={(e) => setRedAdjust(parseInt(e.target.value))} style={{ width: "100%" }} />
                            </div>
                            <div>
                                <label>Grün: {greenAdjust}</label>
                                <input type="range" min={-255} max={255} value={greenAdjust} onChange={(e) => setGreenAdjust(parseInt(e.target.value))} style={{ width: "100%" }} />
                            </div>
                            <div>
                                <label>Blau: {blueAdjust}</label>
                                <input type="range" min={-255} max={255} value={blueAdjust} onChange={(e) => setBlueAdjust(parseInt(e.target.value))} style={{ width: "100%" }} />
                            </div>
                        </>
                    )}
                </div>

                <div style={{ marginBottom: "1rem" }}>
                    <input type="checkbox" id="edgeDetection" checked={edgeDetection} onChange={(e) => setEdgeDetection(e.target.checked)} />
                    <label htmlFor="edgeDetection"> Kantenerkennung</label>
                    {edgeDetection && (
                        <div>
                            <label>Stärke: {edgeStrength}</label>
                            <input type="range" min={0} max={10} step={0.05} value={edgeStrength} onChange={(e) => setEdgeStrength(parseFloat(e.target.value))} style={{ width: "100%" }} />
                        </div>
                    )}
                </div>

                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
                    <div style={{ display: "flex", alignItems: "center", flex: 1 }}>
                        <label style={{ marginRight: "0.5rem" }}>Auflösung:</label>
                        <select
                        id="resolution"
                        value={selectedResolution}
                        onChange={(e) => setSelectedResolution(e.target.value)}
                        style={{
                            padding: "0.5rem",
                            fontSize: "1rem",
                            borderRadius: "4px",
                            color: "#333", // Dunklere Schriftfarbe
                            backgroundColor: "#fff", // Weißer Hintergrund für bessere Sichtbarkeit
                            flex: 1, // Nimmt den verfügbaren Platz ein
                            height: "3rem", // Gleiche Höhe wie der Speicherbutton
                        }}
                        >
                        <option value="original">Original</option>
                        <option value="480p">480p</option>
                        <option value="720p">720p</option>
                        <option value="1080p">1080p</option>
                        <option value="2k">2k</option>
                        <option value="4k">4k</option>
                        </select>
                    </div>

                    <div style={{ display: "flex", alignItems: "center", marginLeft: "1rem" }}>
                        {/* Reset Button */}
                        <button
                        onClick={resetAll}
                        style={{
                            backgroundColor: "#f44336", // Rote Farbe für den Reset
                            color: "#fff",
                            border: "none",
                            borderRadius: "50%",
                            padding: "0.75rem",
                            cursor: "pointer",
                            height: "3rem",
                            width: "3rem",
                            display: "flex",
                            justifyContent: "center",
                            alignItems: "center",
                            marginRight: "1rem", // Abstand zum Speichern-Button
                        }}
                        >
                        <FaRedo />
                        </button>

                        {/* Save Button */}
                        <button
                        onClick={handleSave}
                        disabled={isProcessing}
                        style={{
                            padding: "0.75rem",
                            backgroundColor: "#007bff",
                            color: "#fff",
                            border: "none",
                            borderRadius: "4px",
                            cursor: isProcessing ? "not-allowed" : "pointer",
                            height: "3rem",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                        }}
                        >
                        {isProcessing ? <FaSpinner style={{ animation: "spin 1s infinite linear" }} /> : <FaDownload />}
                        </button>
                    </div>
                    </div>


            </div>
        </div>
    );

    return createPortal(modalContent, document.body);
}
