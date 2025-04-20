// lib/signalingStore.ts

type SignalData = {
    offer?: RTCSessionDescriptionInit;
    answer?: RTCSessionDescriptionInit;
    candidates: RTCIceCandidateInit[];
  };
  
  const roomStore = new Map<string, SignalData>();
  
  export function getRoom(roomId: string): SignalData {
    if (!roomStore.has(roomId)) {
      roomStore.set(roomId, { candidates: [] });
    }
    return roomStore.get(roomId)!;
  }
  
  export function clearRoom(roomId: string) {
    roomStore.delete(roomId);
  }
  