# WebSocket Event Reference

Snappy relies heavily on bidirectional event-driven communication using:

- Socket.io
- Redis Pub/Sub
- MongoDB Change Streams

This document defines core realtime events.

---

# Architecture Flow

```text
Client
↓ emit
Socket.io Server
↓
Redis Pub/Sub
↓
Other Server Instances
↓ emit
Recipient Clients
```

---

# Client → Server Events

Emitted by React client.

Handled by Node backend.

---

| Event | Payload | Server Action |
|---|---|---|
add-user | userId | Maps socket to user |
heartbeat | userId | Refreshes Redis TTL |
send-msg | encrypted payload | Routes message |
typing | typing payload | Broadcasts typing |
message-delivered-receipt | receipt payload | Marks delivered |
mark-as-read | read payload | Updates read status |
delete-msg | delete payload | Broadcasts deletion |

---

## add-user

Emit:

```js
socket.emit("add-user", userId);
```

Purpose:

Maps:

```text
user_sockets:{userId}
```

in Redis.

---

## heartbeat

```js
socket.emit("heartbeat", userId);
```

Refreshes presence TTL.

Used for:

- online indicators
- active sockets

---

## send-msg

Payload:

```json
{
"id":"msg1",
"from":"u1",
"to":"u2",
"msg":"encrypted_payload",
"isGroup":false,
"type":"text",
"replyTo":null
}
```

Routes encrypted payload via Redis adapter.

---

## typing

```json
{
"from":"u1",
"to":"u2",
"isTyping":true,
"username":"alice"
}
```

Broadcast typing indicators.

---

## message-delivered-receipt

Updates:

```text
delivered_to_device
```

status.

---

## mark-as-read

Updates:

```text
readBy
```

and sends blue tick updates.

---

## delete-msg

Broadcast delete event to recipients.

Removes locally rendered message.

---

# Server → Client Events

Emitted by backend.

Handled by frontend.

---

| Event | Payload | Client Action |
|---|---|---|
get-online-users | [userIds] | Presence dots |
msg-recieve | message payload | Append chat |
msg-delivery-update | delivery update | Update ticks |
msg-read-update | reader update | Blue ticks |
typing-status | typing payload | Show typing UI |
receive-reaction | reaction payload | Add reactions |

---

## get-online-users

Example:

```json
["u1","u4","u8"]
```

Hydrates online state.

---

## msg-recieve

Payload:

```json
{
"id":"m1",
"from":"u2",
"msg":"encrypted",
"type":"text"
}
```

Client:

- append chat
- update unread counts

---

## msg-delivery-update

```json
{
"messageId":"m1",
"status":"delivered"
}
```

Single tick → double ticks.

---

## msg-read-update

Updates:

Double gray → blue ticks.

---

## typing-status

Shows typing animation.

---

## receive-reaction

```json
{
"messageId":"m1",
"emoji":"🔥",
"by":"u2"
}
```

Updates reactions.

---

# Mongo Change Streams

Some events bypass direct socket handlers.

Flow:

```text
Mongo Change Stream
↓
Redis Pub/Sub
↓
Socket Emit
```

---

## Friend Requests

Triggered on:

```text
User.friendRequests
```

updates.

---

## Group Metadata

Triggers realtime updates for:

- name changes
- avatars
- rules

---

# Message Lifecycle

```text
send-msg
↓
msg-recieve
↓
message-delivered-receipt
↓
msg-delivery-update
↓
mark-as-read
↓
msg-read-update
```

---

# Reliability Guarantees

Supports:

- Reconnect recovery
- Multi-instance delivery
- Delivery receipts
- Presence sync

Powered by:

- Socket.io
- Redis Adapter
- Mongo Change Streams