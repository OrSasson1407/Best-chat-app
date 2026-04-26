# Privacy Policy & Data Handling

Snappy is built with a privacy-first mindset.

Transparency in how data is handled is a core principle.

---

# End-to-End Encryption (E2E)

Snappy uses a zero-knowledge encrypted messaging model.

---

## The Server is Blind

The server stores:

- Encrypted ciphertexts
- Routing metadata

The server cannot read:

- Plaintext messages
- Private keys
- Decrypted conversations

---

## Key Storage

Public Keys:

Shared via server for key exchange.

Private Keys:

Remain on user device only.

Stored locally:

```text
localStorage
```

Never transmitted.

---

# Data We Store

To operate the service, we securely store:

---

## 1 Account Information

- Username
- Hashed passwords (bcrypt)
- Optional profile image

Passwords are never stored in plaintext.

---

## 2 Metadata

We may store:

- Group memberships
- Read receipts
- Last seen
- Chat folders
- Message timestamps

---

## 3 Encrypted Payloads

Stored:

- Encrypted message strings
- Encrypted media links

Not readable by server.

---

# Third-Party Integrations

---

## OpenAI

Only used when explicitly triggered by user for:

- Translation
- Grammar
- Summaries

Relevant message content may be securely sent for processing.

AI features are opt-in.

---

## Cloudinary

Used for:

- User avatars
- Group icons
- Media storage

---

# Telemetry & Tracking

Snappy does NOT include:

- Hidden tracking pixels
- Advertising SDKs
- Google Analytics
- Meta Pixel

No behavioral tracking.

---

## Operational Metrics Only

Limited server telemetry may include:

- Performance metrics
- Error logs
- Uptime monitoring

Via:

- Prometheus
- Grafana

Used only for reliability.

---

# Data Selling

We do not:

- Sell user data
- Share conversations with advertisers
- Profile users for ad targeting

Never.

---

# Security Controls

Security protections include:

- TLS encryption
- bcrypt hashing
- JWT authentication
- 2FA support
- Rate limiting
- E2E encryption

---

# Open Source Transparency

Because Snappy is open source:

Security design can be reviewed publicly.

See:

- SECURITY.md
- ARCHITECTURE.md

---

Questions:

privacy@example.com