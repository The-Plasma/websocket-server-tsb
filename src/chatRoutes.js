import express from "express";
import { ConversationInitialization, ConversationLeave, messageSent, conversationRead, messageEdited, messageDeleted } from "./chatController.js";
import { requireUserAuth, requireServiceAuth } from "./auth.js";

const chatRoute = express.Router();

chatRoute.post("/conversation-init", requireUserAuth, ConversationInitialization);
chatRoute.post("/conversation-leave", requireUserAuth, ConversationLeave);
chatRoute.post("/message-sent", requireServiceAuth, messageSent);
chatRoute.post("/conversation-read", requireServiceAuth, conversationRead);
chatRoute.post("/message-edited", requireServiceAuth, messageEdited);
chatRoute.post("/message-deleted", requireServiceAuth, messageDeleted);

export default chatRoute;