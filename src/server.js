import express from "express";
import http from "http";
import WebSocket, { WebSocketServer } from "ws";
import cors from "cors";
import dotenv from "dotenv";
import chatRoute from "./chatRoutes.js";
import { authenticateSocket } from "./auth.js";
import redis from "./redis.js";

dotenv.config();
const app = express();

const server = http.createServer(app);
const wss = new WebSocketServer({ server });

app.use(cors({ origin: "*" }));
app.use(express.json());

export const clients = new Map(); // userId -> ws
export const onlineUsers = new Set(); //userId

setInterval(() => {
  wss.clients.forEach((ws) => {
    if (ws.readyState === WebSocket.OPEN) {
      ws.ping();
    }
  });
}, 30000);

async function broadcastOnlineUsers() {
  const users = await redis.smembers("online_users");

  const payload = JSON.stringify({
    type: "ONLINE_USERS",
    payload: users,
  });

  for (const ws of clients.values()) {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(payload);
    }
  }
}

wss.on("connection", async (ws, req) => {
  const user = authenticateSocket(req);

  if (!user) {
    ws.close();
    return;
  }

  const userId = user.userId;
  ws.userId = userId;

  // Close any existing connection for this user (tab refresh / duplicate tab)
  const existing = clients.get(userId);
  if (existing && existing.readyState === WebSocket.OPEN) {
    existing.close();
  }

  clients.set(userId, ws);
  await redis.sadd("online_users", userId);
  broadcastOnlineUsers();

  ws.on("close", async () => {
    // Only remove from online list if this is still the registered connection
    if (clients.get(userId) === ws) {
      clients.delete(userId);
      await redis.srem("online_users", userId);
      broadcastOnlineUsers(); // ← notify everyone the user went offline
    }
  });
});

app.use("/chat", chatRoute);

const PORT = process.env.PORT || 8080;
app.get("/health", (req, res) => {
  res.status(200).send("OK");
});

app.use("/", (req, res) => {
  res.send(`WebSocket Server is running on ${PORT}`);
});

server.listen(PORT, () => {
  console.log("WS server running on 8080");
});
