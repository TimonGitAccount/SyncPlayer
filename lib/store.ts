// lib/store.ts

import { Redis } from '@upstash/redis';

const redis = Redis.fromEnv();

type SignalData = {
  offer?: RTCSessionDescriptionInit;
  answer?: RTCSessionDescriptionInit;
  candidates: RTCIceCandidateInit[];
};

export async function getRoom(roomId: string): Promise<SignalData | null> {
  const room = await redis.get(roomId);
  
  // Wenn der Wert nicht null ist, sicherstellen, dass es ein JSON-String ist.
  if (room) {
    try {
      return typeof room === 'string' ? JSON.parse(room) : room; // Wenn es ein String ist, parsen, sonst direkt zurückgeben
    } catch (e) {
      console.error('Fehler beim Parsen des Raums:', e);
      return null;
    }
  }

  return null;
}

export async function saveRoom(roomId: string, data: SignalData): Promise<void> {
  // Speichern als JSON-String, falls es noch nicht so ist.
  await redis.set(roomId, JSON.stringify(data)); // Jetzt speichern wir die Daten sicher als JSON
}

export async function clearRoom(roomId: string): Promise<void> {
  await redis.del(roomId);
}
