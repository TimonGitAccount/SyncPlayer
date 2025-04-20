// pages/api/room/[id]/candidates.ts
import { NextApiRequest, NextApiResponse } from "next";
import { getRoom } from "../../../../lib/signalingStore";

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  const { id } = req.query;
  const room = getRoom(id as string);

  if (req.method === "GET") {
    res.status(200).json({ candidates: room.candidates });
  }
}
