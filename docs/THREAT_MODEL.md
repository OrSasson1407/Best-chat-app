# Snappy Threat Model

This document outlines the security threat model for Snappy using a STRIDE-inspired approach.

Focus:

- Threat identification
- Attack vectors
- Mitigations

---

# 1 System Boundaries & Trust Levels

## Untrusted

- Client browsers
- User devices
- Public internet

Assume hostile.

---

## Semi-Trusted

Third-party integrations:

- OpenAI
- Cloudinary

Scoped trust only.

---

## Trusted

Core infrastructure:

- Node API Gateway
- MongoDB Atlas
- Upstash Redis

Protected infrastructure boundary.

---

# 2 Threat Analysis

---

# Threat A  
## Man-in-the-Middle & Server-Side Snooping

Attack Vector:

- Traffic interception
- Malicious DB access
- Server operator curiosity

---

## Mitigation

End-to-End Encryption.

Uses:

- AES-256-GCM
- RSA / Curve25519

Flow:

```text
Message → Encrypted Client Side
Server stores ciphertext only
```

Server cannot decrypt.

Zero-knowledge model.

---

# Threat B  
## Account Takeover / Credential Stuffing

Attack Vector:

- Brute force
- Leaked passwords
- Automated login attacks

---

## Mitigations

Redis distributed rate limiting.

Protected endpoint:

```text
/api/auth/login
```

---

### Two-Factor Authentication

Supports:

TOTP

Even stolen passwords alone insufficient.

---

# Threat C  
## WebSocket Session Hijacking

Attack Vector:

Forged socket sessions.

Stolen cookies.

Socket impersonation.

---

## Mitigations

Socket handshake requires JWT:

```js
auth: {
 token: jwt
}
```

Server verifies before joining rooms.

Unauthorized sockets rejected.

---

# Threat D  
## Cross-Site Scripting via Chat Payloads

Attack Vector:

Malicious chat messages containing JavaScript.

---

## Mitigations

React escapes rendered strings.

Backend protections:

- Joi validation
- express-mongo-sanitize
- Input filtering

Payloads sanitized before persistence.

---

# Threat E  
## Channel / Group Privilege Escalation

Attack Vector:

User attempts unauthorized:

- kick member
- delete messages
- modify channels

---

## Mitigations

Server-side authorization checks only.

Never trust client role claims.

Backend verifies:

```text
currentUser._id
```

against group roles.

Actions rejected if unauthorized.

---

# Threat F  
## Token Theft

Attack Vector

Compromised JWT reuse.

---

## Mitigations

- Short token expiry
- Refresh token rotation
- Session revocation (planned)

---

# Threat G  
## Denial of Service

Attack Vector

Spam or flood attacks.

---

## Mitigations

- Redis rate limits
- Request throttling
- Socket event limits
- Payload size restrictions

---

# 3 STRIDE Mapping

| Threat | STRIDE Category |
|---|---|
Spoofing | Session hijack |
Tampering | Payload manipulation |
Repudiation | Audit logging |
Information Disclosure | Message privacy |
DoS | Flooding |
Elevation of Privilege | Group escalation |

---

# 4 Residual Risks

Known risks:

- Redis outage
- Browser XSS extensions
- Compromised endpoints
- User device compromise

No system can reduce risk to zero.

Goal:

Reduce acceptable risk.

---

# 5 Security Controls Summary

Implemented:

✅ E2E encryption  
✅ JWT auth  
✅ 2FA  
✅ Rate limiting  
✅ Input sanitization  
✅ Role authorization  
✅ Redis isolation

Planned:

- Key rotation
- Device trust
- Session anomaly detection

---

# 6 Security Review Cadence

Review threat model:

- Major architecture changes
- New integrations
- Every release cycle

Threat model is living documentation.