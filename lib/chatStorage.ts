// lib/chatStorage.ts
let chatMessages: { [roomId: string]: { sender: string; message: string }[] } = {};

export const saveMessage = (roomId: string, sender: string, message: string) => {
  if (!chatMessages[roomId]) {
    chatMessages[roomId] = [];
  }
  chatMessages[roomId].push({ sender, message });
};

export const getMessages = (roomId: string) => {
  return chatMessages[roomId] || [];
};
