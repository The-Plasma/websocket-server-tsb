1. User opens chat page
   └─▶ ConversationInitialization

2. WebSocket connects
   └─▶ clients.set(userId, ws)

3. User sends message
   └─▶ messageSent controller
        ├─ get conversation members
        ├─ get ws from clients map
        └─ ws.send()

4. Other users receive message instantly 

5. User closes chat
   └─▶ ConversationLeave

PORT=8080
JWT_SECRET=your-super-secret-jwt-key-change-this-in-production

REDIS_URL=rediss://default:ATvdAAIncDFhZWZkNzJhZjkzZDE0ZWJiOGIwZjY4ODZkZjFhN2YwMnAxMTUzMjU@sure-deer-15325.upstash.io:6379

