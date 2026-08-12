import express from "express";
import http from "http";
import { Server } from "socket.io";
import cors from "cors";
import dotenv from "dotenv";
import chatRoute from "./chatRoutes.js";
import { authenticateSocket } from "./auth.js";
import redis from "./redis.js";

dotenv.config();
const app = express();
const server = http.createServer(app);

// Same allowlist pattern as theSearchBridge-backend/src/server.js — keeps the
// two services' CORS policy in sync since they share the same frontend origins.
const allowedOrigins = [
  "http://localhost:3000",
  "http://127.0.0.1:3000",
  "http://localhost:3001",
  "http://127.0.0.1:3001",
  "https://the-search-bridge-frontend-developm.vercel.app",
  "https://thesearchbridge.com",
  "https://tsb.testdevurl.com",
];

if (process.env.CORS_ORIGINS) {
  const envOrigins = process.env.CORS_ORIGINS.split(",").map((o) => o.trim());
  envOrigins.forEach((origin) => {
    if (origin && !allowedOrigins.includes(origin)) {
      allowedOrigins.push(origin);
    }
  });
}

// No Origin header (server-to-server calls, e.g. the backend's message-sent
// notification) is allowed through — CORS only governs browser requests.
const corsOriginCheck = (origin, callback) => {
  if (!origin || allowedOrigins.includes(origin)) {
    callback(null, true);
  } else {
    console.warn(`[CORS Blocked] Origin: ${origin}`);
    callback(new Error("Not allowed by CORS"));
  }
};

const io = new Server(server, {
  cors: { origin: corsOriginCheck, methods: ["GET", "POST"] },
  transports: ["polling", "websocket"],
});

app.use(cors({
  origin: corsOriginCheck,
  methods: ["GET", "POST"],
  allowedHeaders: ["Content-Type", "Authorization", "X-Service-Secret"],
}));
app.use(express.json());

export const clients = new Map(); // userId -> socket

// Auth middleware — reads token from auth or query
io.use((socket, next) => {
  const token = socket.handshake.auth?.token || socket.handshake.query?.token;
  if (!token) return next(new Error("Unauthorized"));
  const req = { url: `/?token=${encodeURIComponent(token)}` };
  const user = authenticateSocket(req);
  if (!user) return next(new Error("Invalid token"));
  socket.user = user;
  next();
});

async function broadcastOnlineUsers() {
  const users = await redis.smembers("online_users");
  const payload = { type: "ONLINE_USERS", payload: users };
  for (const socket of clients.values()) {
    socket.emit("message", payload);
  }
}

io.on("connection", async (socket) => {
  const userId = socket.user.userId;
  socket.userId = userId;

  const existing = clients.get(userId);
  if (existing) existing.disconnect(true);

  clients.set(userId, socket);
  await redis.sadd("online_users", userId);
  broadcastOnlineUsers();

  // Relays typing state to whoever else currently has this conversation open —
  // reuses the same conversation:<id> Redis membership set as message delivery.
  const relayTyping = async (type, conversationId) => {
    if (!conversationId) return;
    const memberIds = await redis.smembers(`conversation:${conversationId}`);
    memberIds
      .filter((id) => id !== userId)
      .forEach((id) => {
        const target = clients.get(id);
        if (target?.connected) {
          target.emit("message", { type, payload: { conversationId, userId } });
        }
      });
  };

  socket.on("typing", ({ conversationId } = {}) => relayTyping("TYPING", conversationId));
  socket.on("stop_typing", ({ conversationId } = {}) => relayTyping("STOP_TYPING", conversationId));

  socket.on("disconnect", async () => {
    if (clients.get(userId) === socket) {
      clients.delete(userId);
      await redis.srem("online_users", userId);
      broadcastOnlineUsers();
    }
  });
});

app.use("/chat", chatRoute);

const PORT = process.env.PORT || 8080;
app.get("/health", (req, res) => res.status(200).send("OK"));
app.use("/", (req, res) => res.send(`WebSocket Server is running on ${PORT}`));

server.listen(PORT, () => console.log(`WS server running on ${PORT}`));
