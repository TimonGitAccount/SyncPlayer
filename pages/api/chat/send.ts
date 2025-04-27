// pages/api/chat/send.ts
import { NextApiRequest, NextApiResponse } from "next";
import { saveMessage } from "../../../lib/chatStorage";

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method === "POST") {
    const { roomId, sender, message } = req.body;

    if (!roomId || !sender || !message) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    // Speichern der Nachricht im temporären Speicher
    saveMessage(roomId, sender, message);
    res.status(200).json({ success: true });
  } else {
    return res.status(405).json({ error: "Method not allowed" });
  }
}
