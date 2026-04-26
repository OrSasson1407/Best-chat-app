# Troubleshooting Guide

Common setup issues and solutions.

---

# 1 Module Not Found

Symptom:

Build fails on missing jsx file.

Cause:

Trailing spaces in filename.

Fix:

```bash
mv "Twofactorsetup .jsx" TwoFactorSetup.jsx
```

---

# 2 Redis Connection Refused

Error:

```text
ECONNREFUSED 127.0.0.1:6379
```

Fix:

Docker:

```bash
docker compose up redis -d
```

Check:

```env
REDIS_URI=redis://redis:6379
```

Local:

```env
redis://127.0.0.1:6379
```

---

# 3 Double Slash 404 Errors

Bad:

```text
https://app.com//api/messages
```

Cause:

Trailing slash.

Fix:

```env
VITE_API_URL=https://best-chat-app.onrender.com
```

No trailing slash.

---

# 4 Socket Disconnect Issues

Symptoms:

- Users randomly offline
- Group sync stops

Check:

Heartbeat active.

Expected:

45-second heartbeat.

Check Redis TTL.

---

# 5 MongoDB Timeouts

Error:

```text
MongooseServerSelectionError
```

Atlas:

Whitelist:

```text
0.0.0.0/0
```

for development.

---

Local Docker:

Wait for replica init:

```bash
15 seconds
```

then restart.

---

# 6 Docker Ports Busy

Error:

```text
port already allocated
```

Find process:

```bash
lsof -i :5000
```

Kill process or change port.

---

# 7 JWT Invalid Token Errors

Check:

- JWT_SECRET
- Token expiry
- Clock drift

Ensure client refresh token flow works.

---

# 8 Socket Rooms Not Syncing

Ensure client emits:

```text
join-group
```

after reconnect.

Check Redis adapter enabled.

---

# Still Stuck?

Try:

```bash
docker compose down -v
docker compose up --build
```

Full clean rebuild.