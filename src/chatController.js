import redis from "./redis.js";
import { clients } from "./server.js";

export const ConversationInitialization = async (req, res) => {
  try {
    const { conversationId } = req.body;
    const userId = req.user.userId;
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
  const { conversationId } = req.body;
  const userId = req.user.userId;
  await redis.srem(`conversation:${conversationId}`, userId);
  const remaining = await redis.scard(`conversation:${conversationId}`);
  if (remaining === 0) await redis.del(`conversation:${conversationId}`);
  res.json({ success: true });
};

// Shared relay: notifies everyone else currently viewing this conversation
// (via the same Redis membership set message delivery uses), excluding the actor.
async function broadcastToConversation(conversationId, excludeUserId, type, payload) {
  const memberIds = await redis.smembers(`conversation:${conversationId}`);
  const targetIds = memberIds.filter((id) => id !== excludeUserId);

  let delivered = 0;
  targetIds.forEach((userId) => {
    const socket = clients.get(userId);
    if (socket?.connected) {
      socket.emit("message", { type, payload });
      delivered++;
    }
  });
  return delivered;
}

// Notifies whoever else currently has this conversation open that readByUserId
// just read it, so their sent messages can flip from single to double tick live.
export const conversationRead = async (req, res) => {
  const { conversationId, readByUserId, readAt } = req.body;
  const delivered = await broadcastToConversation(
    conversationId, readByUserId, "CONVERSATION_READ", { conversationId, readByUserId, readAt },
  );
  res.json({ delivered });
};

// Notifies whoever else currently has this conversation open that a message was edited.
export const messageEdited = async (req, res) => {
  const { conversationId, messageId, message, editedAt, editedByUserId } = req.body;
  const delivered = await broadcastToConversation(
    conversationId, editedByUserId, "MESSAGE_EDITED", { conversationId, messageId, message, editedAt },
  );
  res.json({ delivered });
};

// Notifies whoever else currently has this conversation open that a message was deleted.
export const messageDeleted = async (req, res) => {
  const { conversationId, messageId, deletedAt, deletedByUserId } = req.body;
  const delivered = await broadcastToConversation(
    conversationId, deletedByUserId, "MESSAGE_DELETED", { conversationId, messageId, deletedAt },
  );
  res.json({ delivered });
};
