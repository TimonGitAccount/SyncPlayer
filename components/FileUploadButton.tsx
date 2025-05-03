import React, { ChangeEventHandler, ReactNode } from "react";

interface FileUploadButtonProps {
  id: string;
  labelContent: ReactNode; // Kann Text, Icon oder beides sein
  accept: string; // z.B. "video/*", ".vtt"
  onChange: ChangeEventHandler<HTMLInputElement>;
  style?: React.CSSProperties;
  labelStyle?: React.CSSProperties; // Optional: Extra Style für das Label
}

const FileUploadButton: React.FC<FileUploadButtonProps> = ({
  id,
  labelContent,
  accept,
  onChange,
  style, // Style für den Container (falls benötigt)
  labelStyle,
}) => {
  const defaultLabelStyle: React.CSSProperties = {
    display: "inline-block",
    padding: "0.5rem 1rem",
    backgroundColor: "#555",
    borderRadius: "8px",
    cursor: "pointer",
    color: "#fff", // Standard Textfarbe
    lineHeight: 1, // Verhindert zu große Höhe durch Icons
    ...labelStyle, // Überschreibt Standard mit spezifischen Styles
  };

  return (
    <div style={style}>
      <label htmlFor={id} style={defaultLabelStyle}>
        {labelContent}
      </label>
      <input
        id={id}
        type="file"
        accept={accept}
        style={{ display: "none" }}
        onChange={onChange}
        // Wichtig: Input leeren, damit onChange auch feuert, wenn dieselbe Datei erneut gewählt wird
        onClick={(e) => ((e.target as HTMLInputElement).value = "")}
      />
    </div>
  );
};

export default FileUploadButton;