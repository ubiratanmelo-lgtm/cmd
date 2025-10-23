import express from 'express';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import QRCode from 'qrcode';
import { Client, LocalAuth } from 'whatsapp-web.js';

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors({ origin: '*', methods: ['GET','POST'], allowedHeaders: ['Content-Type','Authorization'] }));
app.use(express.json({ limit: '1mb' }));
app.use(rateLimit({ windowMs: 15*60*1000, max: 300 }));

let lastQr = null;
let state  = 'booting';
let isReady = false;

const client = new Client({
  authStrategy: new LocalAuth({ dataPath: './session' }),
  puppeteer: {
    headless: true,
    args: ['--no-sandbox','--disable-setuid-sandbox','--disable-gpu','--disable-dev-shm-usage']
  }
});

client.on('qr', async (qr) => {
  try {
    lastQr = await QRCode.toDataURL(qr);
    state = 'qr';
    isReady = false;
  } catch { lastQr = null; }
});
client.on('ready', () => { state = 'ready'; isReady = true; lastQr = null; console.log('WhatsApp READY'); });
client.on('authenticated', () => { state = 'authenticated'; });
client.on('auth_failure', (msg) => { state = 'auth_failure'; isReady = false; console.error('Auth failure:', msg); });
client.on('disconnected', (reason) => {
  state = 'disconnected'; isReady = false; console.warn('Disconnected:', reason);
  client.initialize().catch(()=>{});
});
client.initialize().catch(err => console.error('Init error:', err));

app.get('/about', async (req, res) => {
  try { res.json({ ok: true, clientInfo: client.info || null }); }
  catch { res.json({ ok: true, clientInfo: null }); }
});

app.get('/status', (req, res) => res.json({ ok: true, state, logged: !!isReady }));
app.get('/qr', (req, res) => {
  if (isReady) return res.json({ ok: true, qr: null, note: 'already_logged' });
  if (!lastQr) return res.json({ ok: false, error: 'NO_QR_AVAILABLE', state });
  res.json({ ok: true, qr: lastQr });
});

app.post('/send', async (req, res) => {
  try {
    if (!isReady) return res.status(400).json({ ok: false, error: 'NOT_LOGGED' });
    let { to, message } = req.body || {};
    to = (to || '').toString().replace(/[^\d+]/g,'');
    message = (message || '').toString() || 'Olá!';
    if (!to || to.length < 10) return res.status(400).json({ ok: false, error: 'INVALID_TO' });

    const jid = to.includes('@c.us') ? to : `${to}@c.us`;
    const msg = await client.sendMessage(jid, message);
    res.json({ ok: true, msgId: msg.id?._serialized || null });
  } catch (e) { console.error('Send error:', e); res.status(500).json({ ok: false, error: 'SEND_FAILED' }); }
});

app.post('/logout', async (req, res) => {
  try {
    await client.logout();
    isReady = false; state = 'disconnected'; lastQr = null;
    client.initialize().catch(()=>{});
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ ok: false, error: 'LOGOUT_FAILED' }); }
});

app.get('/', (req, res) => res.json({ ok: true, service: 'whatsapp-bridge', state, logged: isReady }));

app.listen(PORT, () => console.log(`Bridge UP on :${PORT}`));
