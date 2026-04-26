# System Architecture

This document provides a high-level overview of the Snappy architecture and explains how the platform achieves:

- Real-time communication
- Horizontal scalability
- High availability
- Zero-knowledge security
- Distributed messaging

---

# 1. High-Level System Design

Snappy follows a distributed client-server architecture.

## Core Components

## Client Layer

Technology:

- React (Vite)
- Zustand state management
- Socket.io Client
- Local E2E cryptography

Responsibilities:

- UI rendering
- Message encryption/decryption
- Real-time socket events
- Presence updates
- Local session state

---

## API / Realtime Layer

Stack:

- Node.js
- Express
- Socket.io

Responsibilities:

- REST APIs
- WebSocket transport
- Authentication
- Message routing
- Group event orchestration

---

## Data Layer

### MongoDB Replica Set

Stores:

- Users
- Messages
- Group metadata
- Stories
- Invite codes
- Encryption public keys

Used for:

- Durable persistence
- Replication
- Failover

---

## Distributed Memory Layer

Redis serves three purposes:

### 1 Socket.io Redis Adapter

Cross-instance socket event broadcasting.

---

### 2 Caching

Examples:

```text
user_sockets:{userId}
presence:{userId}
typing:{conversationId}
```

---

### 3 Distributed Rate Limiting

Protection against:

- Spam
- Abuse
- DDoS

---

# 2 High-Level Request Flow

```text
Client
 ↓
Load Balancer
 ↓
Node Server Cluster
 ↓
MongoDB + Redis
```

HTTP:

```text
Client → Express API → MongoDB
```

Realtime:

```text
Client → Socket.io → Redis Pub/Sub → Other Server Instances
```

---

# 3 Horizontal Scaling via Redis Pub/Sub

Snappy uses:

```bash
@socket.io/redis-adapter
```

## Flow

1 User A connects to Server #1

2 User B connects to Server #2

3 User A sends a message.

4 Server #1:

- Validates payload
- Stores encrypted blob in MongoDB
- Publishes socket event to Redis

5 Redis broadcasts:

```text
message:new
```

to all subscribed servers.

6 Server #2 emits event to User B.

---

## Result

Messages work even when users sit on different servers.

Supports:

- Horizontal scale
- Stateless servers
- Load balancing

---

# 4 Message Delivery Lifecycle

```text
Sent
↓
Delivered
↓
Read
```

Status acknowledgements:

- Server ACK
- Recipient ACK
- Read receipts

Triple handshake model.

---

# 5 End-to-End Encryption Model

Snappy uses zero-knowledge architecture.

Server routes encrypted payloads only.

---

## Key Generation

Client creates:

- Public Key
- Private Key

Example algorithms:

- Curve25519
- RSA
- AES-256 session keys

---

## Key Exchange

Public key:

Stored in MongoDB.

Private key:

Stored locally only.

Server cannot access it.

---

## Sending Flow

Sender:

1 Fetch recipient public key

2 Generate symmetric AES key

3 Encrypt message:

```text
Plaintext → AES Ciphertext
```

4 Encrypt AES key with recipient public key.

5 Send:

- encrypted message
- encrypted AES key

---

## Receiving Flow

Recipient:

1 Decrypt AES key

2 Decrypt message locally

Server never sees plaintext.

---

# 6 Presence System

Tracked using Redis:

```text
online
typing
last_seen
```

Heartbeat:

Every 45 seconds.

TTL expiration handles disconnect cleanup.

---

# 7 Background Workers

Heavy tasks are offloaded.

---

## Notification Worker

Uses:

- Firebase Cloud Messaging

Triggers when recipient offline.

---

## Media Worker (Planned)

Processes:

- Compression
- Thumbnails
- Upload pipeline

Storage targets:

- Cloudinary
- S3

---

# 8 Security Layers

Security controls include:

- JWT Auth
- Refresh tokens
- 2FA (TOTP)
- Distributed rate limiting
- App PIN lock
- E2E encryption

Planned:

- Device trust
- Session revocation
- Key rotation

---

# 9 Fault Tolerance

Designed for failure resilience.

## Redis Failure

Fallback:

- degraded local socket mode

---

## Mongo Failover

Replica set elections handle failover.

---

## Node Instance Crash

Stateless servers allow seamless replacement.

---

# 10 Future Architecture Roadmap

Planned upgrades:

- WebRTC calls
- Event queues (RabbitMQ/Kafka)
- Microservices split
- Kubernetes deployment
- Multi-region Redis

---

# Summary

Snappy combines:

- Distributed sockets
- Redis pub/sub
- Zero-knowledge E2E
- Horizontal scaling
- Background workers

to support secure real-time communication at scale.