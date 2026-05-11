import jwt from "jsonwebtoken";

export function authenticateSocket(req) {
  try {
    const token = new URL(req.url, "http://localhost").searchParams.get("token");
    if (!token) return null;
    return jwt.verify(token, process.env.JWT_SECRET);
  } catch {
    return null;
  }
}
