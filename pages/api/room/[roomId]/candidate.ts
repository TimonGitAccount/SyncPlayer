// pages/api/room/[id]/candidate.ts
import { NextApiRequest, NextApiResponse } from "next";
import { getRoom } from "../../../../lib/signalingStore";

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  const { roomId } = req.query;
  const room = getRoom(roomId as string);

  if (req.method === "POST") {
    const candidate = req.body.candidate;
    if (candidate) {
      room.candidates.push(candidate);
    }
    res.status(200).end();
  }
}
