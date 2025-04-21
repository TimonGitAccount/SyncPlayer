// pages/api/room/[id]/answer.ts
import { NextApiRequest, NextApiResponse } from "next";
import { getRoom } from "../../../../lib/signalingStore";

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  const { roomId } = req.query;
  const room = getRoom(roomId as string);

  if (req.method === "POST") {
    room.answer = req.body.answer;
    res.status(200).end();
  } else if (req.method === "GET") {
    if (room.answer) {
      res.status(200).json({ answer: room.answer });
    } else {
      res.status(404).end();
    }
  }
}
