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

const io = new Server(server, {
  cors: { origin: "*", methods: ["GET", "POST"] },
  transports: ["polling", "websocket"],
});

app.use(cors({ origin: "*" }));
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
