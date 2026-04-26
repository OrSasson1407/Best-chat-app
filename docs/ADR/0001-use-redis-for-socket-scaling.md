# 1. Use Redis Pub/Sub for WebSocket Scaling

Date: 2026-04-26  
Status: Accepted

---

# Context

Snappy relies heavily on Socket.io for real-time messaging.

Initially, Socket.io manages connections in local memory.

This works for a single Node.js instance.

However, once the application scales horizontally behind a load balancer:

```text
User A → Server A
User B → Server B
```

Server A cannot directly emit socket events to connections managed by Server B.

We needed a distributed broker to relay events across Node.js instances.

Requirements:

- Sub-millisecond event propagation
- Horizontal scalability
- Low operational complexity
- Presence-state support
- Compatible with Socket.io

---

# Decision

We chose:

```text
Redis Pub/Sub
```

using:

```bash
@socket.io/redis-adapter
```

Redis is used for:

## 1 Realtime Event Distribution

Cross-instance socket events.

---

## 2 Session Caching

Examples:

```text
user_sockets:{userId}
presence:{userId}
```

Fast socket lookups.

---

## 3 Distributed Rate Limiting

Protect auth and messaging endpoints.

---

# Alternatives Considered

## RabbitMQ / Apache Kafka

Pros:

- Powerful messaging systems
- Durable queues
- Huge scalability

Rejected because:

- Excess complexity
- Higher latency for ephemeral chat events
- Overkill for socket fan-out

---

## MongoDB Change Streams Only

Used elsewhere in Snappy, but rejected as primary chat broker.

Reason:

Chat traffic would place too much write pressure on Mongo.

Better for:

- profile updates
- friend requests
- slow-moving events

Not ideal for high-frequency chat delivery.

---

## In-Memory Socket State Only

Rejected.

Does not support:

- multi-node delivery
- horizontal scale
- failover

---

# Consequences

## Positive

Redis runs in memory.

Benefits:

- Near-zero latency
- Excellent socket fan-out
- Horizontal scaling support
- Simple Socket.io integration

Supports:

```text
Server A ⇄ Redis ⇄ Server B
```

cleanly.

---

## Risks / Negative

Redis introduces a potential SPOF.

If Redis fails:

Cross-server realtime delivery fails.

Possible impacts:

- Presence may degrade
- Cross-node messaging may stall

Mitigation:

- Managed Redis
- Health monitoring
- Alerts
- Future Redis replication/failover

---

# Operational Notes

Monitor:

- Redis memory usage
- Pub/Sub latency
- Connection health
- Adapter errors

Recommended metrics:

- Prometheus
- Grafana

---

# Future Revisit Triggers

Reevaluate decision if:

- Multi-region deployment added
- Message volume reaches Kafka territory
- Need durable event streams

Possible future evolution:

- Redis Streams
- Kafka
- NATS

---

# Decision Summary

Chosen:

✅ Redis Pub/Sub

Rejected:

- RabbitMQ
- Kafka
- Mongo-only approach
- In-memory only

Reason:

Best balance of:

- simplicity
- latency
- scalability
- operational fit