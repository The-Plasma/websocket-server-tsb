import redis from "./redis.js";
import { clients } from "./server.js";

export const ConversationInitialization = async (req, res) => {
  try {
    const { conversationId, userId } = req.body;
    await redis.sadd(`conversation:${conversationId}`, userId);
    return res.json({ success: true });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false });
  }
};

export const messageSent = async (req, res) => {
  const { conversationId, message, recipientIds } = req.body;

  let targetIds = recipientIds;
  if (!targetIds?.length) {
    targetIds = await redis.smembers(`conversation:${conversationId}`);
  }

  if (!targetIds?.length) return res.json({ delivered: 0 });

  const customMessage = { ...message, group_id: conversationId };
  let delivered = 0;

  targetIds.forEach((userId) => {
    const socket = clients.get(userId);
    if (socket?.connected) {
      socket.emit("message", { type: "NEW_MESSAGE", payload: customMessage });
      delivered++;
    }
  });

  res.json({ delivered });
};

export const ConversationLeave = async (req, res) => {
  const { conversationId, userId } = req.body;
  await redis.srem(`conversation:${conversationId}`, userId);
  const remaining = await redis.scard(`conversation:${conversationId}`);
  if (remaining === 0) await redis.del(`conversation:${conversationId}`);
  res.json({ success: true });
};
