// pages/api/chat/get.ts
import { NextApiRequest, NextApiResponse } from "next";
import { getMessages } from "../../../lib/chatStorage";

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method === "GET") {
    const { roomId } = req.query;

    if (!roomId) {
      return res.status(400).json({ error: "Room ID is required" });
    }

    const messages = getMessages(roomId as string);
    res.status(200).json({ messages });
  } else {
    return res.status(405).json({ error: "Method not allowed" });
  }
}
