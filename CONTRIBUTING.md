# Contributing to Snappy

Thanks for contributing to Snappy.

---

# Development Setup

## Clone

```bash
git clone https://github.com/YOUR_USERNAME/best-chat-app.git
cd best-chat-app
```

---

## Environment Variables

Copy:

```bash
client/.env.example → .env
server/.env.example → .env
```

Fill in:

- MongoDB
- Redis
- JWT secrets

---

## Run with Docker

```bash
docker-compose up --build
```

---

# Branch Strategy

Use:

## Features

```bash
feat/feature-name
```

Example:

```bash
feat/voice-memos
```

---

## Bug Fixes

```bash
fix/bug-name
```

Example:

```bash
fix/socket-reconnect
```

---

## Refactors

```bash
refactor/component-name
```

---

## Docs

```bash
docs/update-name
```

---

# Pull Requests

Before submitting:

- Tests pass
- Lint passes
- Clear PR description
- Link issues:

```bash
Fixes #123
```

- Never commit:

```bash
.env
API keys
Secrets
```

---

# Architecture Notes

## Sockets

Use Redis adapter.

Do not store connection state in memory.

---

## Encryption

Maintain zero-knowledge server model.

Never bypass client encryption flow.

---

# Coding Standards

- Follow ESLint rules
- Keep components modular
- Write reusable logic
- Add tests where possible

---

Thank you for contributing 🚀