const express = require('express');
const http = require('http');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: '*' }, maxHttpBufferSize: 1e6 });
const PORT = process.env.PORT || 3000;

const MAX_CUSTOM = 12;                 // custom sounds per room
const MAX_BYTES = 2 * 1024 * 1024;     // 2 MB per custom sound
const ROOM_TTL = 30 * 60 * 1000;       // keep an empty room (and its sounds) for 30 min
const ALLOWED_MIME = /^audio\/(mpeg|mp3|wav|x-wav|wave|ogg|webm|aac|mp4|x-m4a)$/;

const cleanRoom = (r) => String(r || '').trim().toLowerCase().replace(/[^a-z0-9_-]/g, '').slice(0, 32);

// room -> { volume, sounds: Map(id -> {id,label,emoji,mime,buf}), emptySince }
const rooms = new Map();
const getRoom = (room) => {
  if (!rooms.has(room)) rooms.set(room, { volume: 100, sounds: new Map(), emptySince: null });
  return rooms.get(room);
};
const soundList = (room) =>
  [...rooms.get(room).sounds.values()].map(({ id, label, emoji }) => ({
    id, label, emoji, url: `/api/sound/${room}/${id}`,
  }));
const emitSounds = (room) => io.in(room).emit('sounds-updated', { sounds: soundList(room) });

// ---------- Built-in sounds from folder ----------
const EMOJI_MAP = {
  laugh: '😂', giggle: '🤭', haha: '🤣', lol: '🤣', applause: '👏', clap: '👏',
  horn: '📯', airhorn: '📯', trumpet: '🎺', drum: '🥁', drumroll: '🥁',
  violin: '🎻', sad: '😢', cry: '😭', cheer: '🎉', cheering: '🥳',
  fart: '💨', punch: '👊', hit: '💥', slap: '👋', bonk: '🔨', pop: '🫧',
  bell: '🔔', ding: '🛎️', coin: '🪙', wow: '😮', oof: '😵',
  bruh: '🗿', error: '❌', fail: '💀', correct: '✅', win: '🏆',
  gun: '🔫', boom: '💥', explosion: '💣', siren: '🚨', scream: '😱',
  cat: '🐱', dog: '🐶', bird: '🐦', game: '🎮', music: '🎵'
};
const DEFAULT_EMOJIS = ['🔊', '🎵', '🎶', '⚡', '✨', '🔥', '🌟', '💥', '🎯', '🎉'];

function getEmojiForName(name, idx) {
  const lower = name.toLowerCase();
  for (const [key, emo] of Object.entries(EMOJI_MAP)) {
    if (lower.includes(key)) return emo;
  }
  return DEFAULT_EMOJIS[idx % DEFAULT_EMOJIS.length];
}

function formatLabel(name) {
  return name
    .replace(/[._-]+/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase())
    .trim()
    .slice(0, 30);
}

function getFolderSounds() {
  const soundsDir = path.join(__dirname, 'public', 'sounds');
  if (!fs.existsSync(soundsDir)) return [];
  const audioExts = /\.(mp3|wav|ogg|m4a|aac|webm|flac)$/i;
  const items = fs.readdirSync(soundsDir, { withFileTypes: true });
  const sounds = [];
  let globalIdx = 0;

  for (const item of items) {
    if (item.isDirectory()) {
      const catName = item.name;
      const catDir = path.join(soundsDir, catName);
      try {
        const subFiles = fs.readdirSync(catDir).filter(f => audioExts.test(f));
        for (const f of subFiles) {
          const id = (catName + '_' + f.replace(/\.[^.]+$/, '')).slice(0, 80);
          sounds.push({
            id: id,
            category: formatLabel(catName),
            label: formatLabel(f.replace(/\.[^.]+$/, '')),
            emoji: getEmojiForName(f, globalIdx++),
            url: `/sounds/${encodeURIComponent(catName)}/${encodeURIComponent(f)}`,
            file: `/sounds/${encodeURIComponent(catName)}/${encodeURIComponent(f)}`,
          });
        }
      } catch (_) {}
    } else if (item.isFile() && audioExts.test(item.name)) {
      const f = item.name;
      const id = f.replace(/\.[^.]+$/, '').slice(0, 80);
      sounds.push({
        id: id,
        category: 'ทั่วไป',
        label: formatLabel(id),
        emoji: getEmojiForName(id, globalIdx++),
        url: `/sounds/${encodeURIComponent(f)}`,
        file: `/sounds/${encodeURIComponent(f)}`,
      });
    }
  }
  return sounds;
}

// ---------- HTTP ----------
// Dynamic sounds.js generated from public/sounds/
app.get('/js/sounds.js', (req, res) => {
  const sounds = getFolderSounds();
  res.setHeader('Content-Type', 'application/javascript; charset=utf-8');
  res.setHeader('Cache-Control', 'no-cache');
  res.send(`window.SOUNDS = ${JSON.stringify(sounds, null, 2)};`);
});

app.get('/api/sounds', (req, res) => {
  res.json(getFolderSounds());
});

app.use(express.static(path.join(__dirname, 'public'), {
  setHeaders: (res, file) => {
    if (/\.(html|js)$/.test(file)) res.setHeader('Cache-Control', 'no-cache');
    else res.setHeader('Cache-Control', 'public, max-age=3600');
  },
}));
app.get('/', (req, res) => res.redirect('/controller'));
app.get('/controller', (req, res) => res.sendFile(path.join(__dirname, 'public', 'controller.html')));
app.get('/receiver', (req, res) => res.sendFile(path.join(__dirname, 'public', 'receiver.html')));
app.get('/healthz', (req, res) => res.send('ok')); // for uptime pings

// Upload a custom sound: POST raw audio bytes, label/emoji in query string
app.post('/api/sound/:room', express.raw({ type: '*/*', limit: MAX_BYTES }), (req, res) => {
  const room = cleanRoom(req.params.room);
  const st = rooms.get(room);
  if (!st) return res.status(404).json({ error: 'Join the room first' });
  if (!Buffer.isBuffer(req.body) || !req.body.length) return res.status(400).json({ error: 'Empty file' });
  const mime = String(req.headers['content-type'] || '').split(';')[0].trim().toLowerCase();
  if (!ALLOWED_MIME.test(mime)) return res.status(415).json({ error: 'Unsupported audio type' });
  if (st.sounds.size >= MAX_CUSTOM) return res.status(400).json({ error: `Max ${MAX_CUSTOM} custom sounds per room` });

  const id = 'c_' + crypto.randomBytes(4).toString('hex');
  const label = String(req.query.label || 'Sound').trim().slice(0, 16) || 'Sound';
  const emoji = Array.from(String(req.query.emoji || '🔊')).slice(0, 2).join('') || '🔊';
  st.sounds.set(id, { id, label, emoji, mime, buf: req.body });
  emitSounds(room);
  res.json({ ok: true, id });
});

app.get('/api/sound/:room/:id', (req, res) => {
  const st = rooms.get(cleanRoom(req.params.room));
  const s = st && st.sounds.get(req.params.id);
  if (!s) return res.sendStatus(404);
  res.set({ 'Content-Type': s.mime, 'Cache-Control': 'public, max-age=3600' }).send(s.buf);
});

app.delete('/api/sound/:room/:id', (req, res) => {
  const room = cleanRoom(req.params.room);
  const st = rooms.get(room);
  if (!st || !st.sounds.delete(req.params.id)) return res.sendStatus(404);
  emitSounds(room);
  res.json({ ok: true });
});

// ---------- Sockets ----------
async function broadcastInfo(room) {
  if (!room || !rooms.has(room)) return;
  const sockets = await io.in(room).fetchSockets();
  const receivers = sockets.filter((s) => s.data.role === 'receiver').length;
  io.in(room).emit('room-info', { receivers, controllers: sockets.length - receivers });
  rooms.get(room).emptySince = sockets.length === 0 ? Date.now() : null;
}

io.on('connection', (socket) => {
  socket.on('join-room', (payload, ack) => {
    const room = cleanRoom(payload && payload.room);
    if (!room) return ack && ack({ ok: false, error: 'Invalid room ID' });

    const oldRoom = socket.data.room;
    if (oldRoom && oldRoom !== room) { socket.leave(oldRoom); broadcastInfo(oldRoom); }

    socket.data.room = room;
    socket.data.role = payload.role === 'receiver' ? 'receiver' : 'controller';
    socket.join(room);

    const st = getRoom(room);
    st.emptySince = null;
    ack && ack({ ok: true, room, volume: st.volume, sounds: soundList(room) });
    broadcastInfo(room);
  });

  // Controller -> receivers relay
  const relay = (evt, sanitize) => {
    socket.on(evt, (payload = {}) => {
      const { room, role } = socket.data;
      if (!room || role !== 'controller' || !rooms.has(room)) return;
      const data = sanitize(payload);
      if (data === null) return;
      if (evt === 'set-volume') rooms.get(room).volume = data.value;
      socket.to(room).emit(evt, data);
    });
  };
  relay('play-sound', (p) => (typeof p.id === 'string' && p.id.length < 200 ? { id: p.id } : null));
  relay('stop-all', () => ({}));
  relay('set-volume', (p) => {
    const v = Number(p.value);
    return Number.isFinite(v) ? { value: Math.min(100, Math.max(0, v)) } : null;
  });

  socket.on('disconnect', () => broadcastInfo(socket.data.room));
});

// free memory of abandoned rooms
setInterval(() => {
  const now = Date.now();
  for (const [room, st] of rooms) if (st.emptySince && now - st.emptySince > ROOM_TTL) rooms.delete(room);
}, 5 * 60 * 1000).unref();

server.listen(PORT, () => console.log(`Soundboard running on port ${PORT}`));
