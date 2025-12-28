import express from "express";
import http from "http";
import WebSocket, { WebSocketServer } from "ws";
import cors from "cors";
import dotenv from "dotenv";
import chatRoute from "./chatRoutes.js";
import { authenticateSocket } from "./auth.js";

dotenv.config();
const app = express();

const server = http.createServer(app);
const wss = new WebSocketServer({ server });

app.use(cors({ origin: "*" }));
app.use(express.json());

export const clients = new Map(); // userId -> ws
export const onlineUsers = new Set(); //userId

function broadcastOnlineUsers() {
  const payload = JSON.stringify({
    type: "ONLINE_USERS",
    payload: Array.from(onlineUsers),
  });

  for (const ws of clients.values()) {
    ws.send(payload);
  }
}

wss.on("connection", (ws, req) => {
  const user = authenticateSocket(req);
  console.log("user in wss connection--->", user);

  if (!user) {
    ws.close();
    return;
  }
  console.log(user);
  ws.userId = user.userId;
  clients.set(user.userId, ws);
  onlineUsers.add(user.userId);
  console.log(clients);

  broadcastOnlineUsers();

  ws.on("close", () => {
    clients.delete(user.userId);
    onlineUsers.delete(user.userId);
    console.log("user in wss disconnecting--->");
  });
});

app.use("/chat", chatRoute);

app.use("/", (req, res) => {
  res.send(`WebSocket Server is running on ${PORT}`);
});

const PORT = process.env.PORT || 8080;
server.listen(PORT, "0.0.0.0", () => {
  console.log("WS server running on 8080");
});
