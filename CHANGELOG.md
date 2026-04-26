# Changelog

All notable changes to this project will be documented here.

Format follows:

- Keep a Changelog
- Semantic Versioning

---

# [Unreleased]

## Added

### AI Integrations

- Real-time translation
- Grammar checking
- Chat summarization

---

### Group Management

Added:

- maxMembers limits
- Group Rules
- QR invite codes
- Join-by-code flow

---

### Stories

Implemented:

```http
/api/stories
```

24-hour ephemeral updates.

---

### Security

Added:

- App Lock PIN
- E2E invite key exchange
- Enhanced auth protections

---

## Fixed

### BUG-010 Sockets

Fixed missing:

```text
join-group
```

re-emission on reconnect.

---

### BUG-011 Permissions

Fixed admin checks using proper:

```js
.some()
```

ObjectId comparisons.

---

### BUG-012 UI

Fixed:

- SidePanel array checks
- member/admin rendering crashes

---

### BUG-013 Security

Protected all story routes with:

```js
verifyToken
```

---

### BUG-014 Rendering

Fixed:

```text
[object Object]
```

reply quoting crash.

---

### BUG-015 E2E

Secure key injection for group joins.

---

### BUG-016 Build

Removed Linux-breaking trailing whitespace.

---

### BUG-017 Networking

Fixed double-slash:

```text
//api/
```

production failures.

---

# [1.0.0]

## Initial Release

Features:

- Direct messaging
- Groups
- Socket.io realtime
- Redis adapter
- JWT auth