import jwt from "jsonwebtoken";
import crypto from "crypto";

// Shared verifier — used by both the socket.io handshake and the HTTP auth middleware below.
export function verifyJwt(token) {
  if (!token) return null;
  try {
    return jwt.verify(token, process.env.JWT_SECRET);
  } catch {
    return null;
  }
}

export function authenticateSocket(req) {
  const token = new URL(req.url, "http://localhost").searchParams.get("token");
  return verifyJwt(token);
}

// Express middleware — verifies the same user JWT the frontend already sends to
// the backend (Authorization: Bearer <token>) and attaches the decoded payload as req.user.
export function requireUserAuth(req, res, next) {
  const authHeader = req.headers?.authorization || "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7).trim() : null;

  const user = verifyJwt(token);
  if (!user) return res.status(401).json({ error: "Unauthorized" });

  req.user = user;
  next();
}

// Express middleware for server-to-server calls (backend -> WS server), e.g. message-sent.
// Checks a shared secret instead of a user JWT, since there is no end-user token in this call.
export function requireServiceAuth(req, res, next) {
  const provided = req.headers?.["x-service-secret"] || "";
  const expected = process.env.WS_SERVICE_SECRET || "";

  const providedBuf = Buffer.from(provided);
  const expectedBuf = Buffer.from(expected);
  const isValid =
    expected.length > 0 &&
    providedBuf.length === expectedBuf.length &&
    crypto.timingSafeEqual(providedBuf, expectedBuf);

  if (!isValid) return res.status(401).json({ error: "Unauthorized" });
  next();
}
