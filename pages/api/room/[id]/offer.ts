// pages/api/room/[id]/offer.ts
import { NextApiRequest, NextApiResponse } from "next";
import { getRoom } from "../../../../lib/signalingStore";

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  const { id } = req.query;
  const room = getRoom(id as string);

  if (req.method === "POST") {
    room.offer = req.body.offer;
    res.status(200).end();
  } else if (req.method === "GET") {
    if (room.offer) {
      res.status(200).json({ offer: room.offer });
    } else {
      res.status(404).end();
    }
  }
}
