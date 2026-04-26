# Security Policy

Security and privacy are core priorities of Snappy.

---

# Supported Versions

| Version | Supported |
|---------|-----------|
| v1.0.x | ✅ |
| <1.0 | ❌ |

---

# Scope

In scope:

## E2E Encryption Flaws

Anything allowing unauthorized decryption.

---

## Authentication Bypasses

- JWT flaws
- 2FA flaws
- Password vulnerabilities

---

## Session Hijacking

WebSocket or HTTP session takeover.

---

## Data Leaks

Unauthorized access to:

- Messages
- User records
- Redis channels
- Encryption keys

---

## Denial of Service

Methods to crash:

- Node server
- Redis adapter
- Socket cluster

---

# Reporting Vulnerabilities

Do NOT open public GitHub issues.

Report privately:

```text
YOUR_EMAIL@EXAMPLE.COM
```

Include:

- Description
- Impact
- Steps to reproduce
- Optional PoC

---

# Response Timeline

- Acknowledge within 48 hours
- Coordinate disclosure after patch

Thank you for helping keep Snappy secure.