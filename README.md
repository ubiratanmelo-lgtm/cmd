# whatsapp-bridge
Ponte HTTP para seu PDV em PHP falar com o WhatsApp usando whatsapp-web.js.

## Endpoints
- `GET /status`  → `{ ok, state, logged }`
- `GET /qr`      → `{ ok, qr: "data:image/png;base64,..." }` (quando não logado)
- `POST /send`   → `{ ok, msgId }` com body `{ to, message }`
- `POST /logout` → `{ ok }`
- `GET /about`   → `{ ok, clientInfo }`

## Rodar local
1. `npm i`
2. `npm start`
3. `GET http://localhost:3000/status`

Sessão persiste em `./session`.
