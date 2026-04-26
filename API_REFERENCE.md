# API Reference

Base URLs

Development:

```text
http://localhost:5000/api
```

Production:

```text
https://best-chat-app.onrender.com/api
```

---

Protected routes require:

```http
Authorization: Bearer <JWT>
```

---

# Authentication

## POST /auth/login

Login user.

Request:

```json
{
 "username":"user1",
 "password":"password123"
}
```

Response:

```json
{
 "token":"jwt",
 "refreshToken":"refresh"
}
```

---

## POST /auth/2fa/verify

```json
{
 "token":"123456"
}
```

---

# Messages

## POST /messages/addmsg

Send message.

```json
{
 "from":"user1",
 "to":"user2",
 "message":"encrypted payload",
 "type":"text",
 "isGroupChat":false
}
```

---

## POST /messages/getmsg

Paginated history.

```json
{
 "from":"user1",
 "to":"user2",
 "cursor":"optional_message_id"
}
```

---

# Groups

## POST /groups/create

```json
{
 "name":"Dev Team",
 "members":["id1","id2"],
 "maxMembers":50
}
```

---

## POST /groups/join-via-code

```json
{
 "code":"A1B2C3D4",
 "encryptedKey":"payload"
}
```

---

# AI Services

## POST /ai/translate

```json
{
 "text":"Hello",
 "targetLang":"es"
}
```

Response:

```json
{
 "translatedText":"Hola"
}
```

---

## POST /ai/summary

Generate conversation summary.

---

## POST /ai/grammar

Grammar suggestions.

---

# Response Codes

| Code | Meaning |
|---|---|
200 | Success |
400 | Bad Request |
401 | Unauthorized |
403 | Forbidden |
404 | Not Found |
500 | Server Error |

---

Swagger:

```text
/api-docs
```