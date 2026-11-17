'use strict';
// ============================================================
// STANZ G — STAGE 4: authoritative online multiplayer server
// ------------------------------------------------------------
// Run:     node server.js [port]          (default 8080)
// Play:    open http://<this-machine's-IP>:<port> on any device
//          on the same network, pick ONLINE MULTIPLAYER, CONNECT.
// Deploy:  any Node host (Render / Railway / Fly / a VPS).
//          Behind HTTPS the client connects with wss:// automatically
//          when served from the same origin.
// ------------------------------------------------------------
// The server owns: rooms & matchmaking, team balance, player HP,
// hit resolution (rate-of-fire, range, falloff, headshots, terrain
// line-of-sight), movement speed sanity clamps, scores, the match
// timer, respawns and round resets. Clients send inputs + state;
// the server broadcasts 15 Hz world snapshots.
// ============================================================

const http = require('http');
const fs = require('fs');
const path = require('path');
const os = require('os');

function localIPs() {
  const out = [];
  const ifaces = os.networkInterfaces();
  for (const name in ifaces) {
    for (const i of ifaces[name] || []) {
      if (i.family === 'IPv4' && !i.internal) out.push(i.address);
    }
  }
  return out;
}

let WebSocketServer;
try {
  WebSocketServer = require('ws').WebSocketServer || require('ws').Server;
} catch (e) {
  console.error('Missing dependency "ws". In the server folder run:  npm install');
  process.exit(1);
}

const PORT = +(process.argv[2] || process.env.PORT || 8080);
const ROOT = path.join(__dirname, '..', 'www');   // serves the game itself (the Capacitor web root)

// ---------- static file server (game page + assets) ----------
const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png',
  '.ico': 'image/x-icon', '.md': 'text/plain; charset=utf-8',
  '.json': 'application/json',
  '.woff2': 'font/woff2', '.woff': 'font/woff', '.ttf': 'font/ttf'
};
const httpServer = http.createServer((req, res) => {
  let url = decodeURIComponent((req.url || '/').split('?')[0]);
  if (url === '/') url = '/index.html';
  const file = path.normalize(path.join(ROOT, url));
  if (!file.startsWith(ROOT) || file.includes('node_modules')) {
    res.writeHead(403); res.end('forbidden'); return;
  }
  fs.readFile(file, (err, data) => {
    if (err) { res.writeHead(404); res.end('not found'); return; }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(file).toLowerCase()] || 'application/octet-stream' });
    res.end(data);
  });
});

// ---------- game math (mirrors the client exactly) ----------
const WORLD = 210, WATER_Y = -2.4, LAKE = { x: 95, z: -80, r: 48 };
function terrainHeight(x, z) {
  let h = 0;
  h += Math.sin(x * 0.020) * Math.cos(z * 0.016) * 6.0;
  h += Math.sin(x * 0.047 + 1.3) * Math.sin(z * 0.052 - 0.7) * 2.6;
  h += Math.sin(x * 0.11 + 2.1) * Math.cos(z * 0.13) * 0.9;
  const d = Math.sqrt(x * x + z * z);
  const flat = Math.max(0, 1 - d / 62);
  h *= (1 - flat * 0.88);
  const edge = Math.max(0, (d - 140) / 70);
  h += edge * edge * 22;
  const ld = Math.sqrt((x - LAKE.x) * (x - LAKE.x) + (z - LAKE.z) * (z - LAKE.z));
  h -= Math.max(0, 1 - ld / LAKE.r) * 11;
  const rd = Math.sqrt((x - 60) * (x - 60) + (z - 80) * (z - 80));
  h += Math.max(0, 1 - rd / 34) * 9;
  return h;
}

// online loadout is fixed (SG-15 + SG-9); the server only accepts those
const WEAPONS = {
  pistol: { dmg: 24, rpm: 320, range: 80, pellets: 1 },
  ar:     { dmg: 25, rpm: 620, range: 130, pellets: 1 }
};

function sphereRay(o, d, cx, cy, cz, r) {
  const ox = cx - o[0], oy = cy - o[1], oz = cz - o[2];
  const tc = ox * d[0] + oy * d[1] + oz * d[2];
  if (tc < 0) return null;
  const d2 = ox * ox + oy * oy + oz * oz - tc * tc;
  if (d2 > r * r) return null;
  return tc - Math.sqrt(r * r - d2);
}
function headH(st) { return st === 2 ? 0.5 : st === 1 ? 1.1 : 1.55; }
function hitBody(o, d, p, st) {
  const hh = sphereRay(o, d, p[0], p[1] + headH(st), p[2], 0.2);
  if (hh !== null) return { t: hh, head: true };
  const bb = sphereRay(o, d, p[0], p[1] + headH(st) * 0.55, p[2], 0.5);
  if (bb !== null) return { t: bb, head: false };
  return null;
}
function terrainBlockT(o, d, maxT) {
  for (let t = 2; t < maxT; t += 2) {
    if (o[1] + d[1] * t < terrainHeight(o[0] + d[0] * t, o[2] + d[2] * t)) return t;
  }
  return null;
}
const r2 = v => Math.round(v * 100) / 100;

// ---------- rooms & players ----------
const TDM_LIMIT = 25, TDM_TIME = 480, ROOM_MAX = 8;
const SPAWN = { stanz: [-18, -12], raven: [24, 36] };
const rooms = [];
let nextRoomId = 1, nextPlayerId = 1;

function spawnPos(team) {
  const sp = SPAWN[team];
  const x = sp[0] + Math.random() * 6 - 3, z = sp[1] + Math.random() * 6 - 3;
  return [r2(x), r2(terrainHeight(x, z)), r2(z)];
}
function makeRoom() {
  const r = { id: nextRoomId++, players: new Map(), scores: { stanz: 0, raven: 0 },
              time: TDM_TIME, state: 'live', endT: 0 };
  rooms.push(r);
  return r;
}
function getRoom() {
  for (const r of rooms) if (r.players.size < ROOM_MAX) return r;
  return makeRoom();
}
function send(p, msg) { if (p.ws.readyState === 1) p.ws.send(JSON.stringify(msg)); }
function bc(room, msg, except) {
  const s = JSON.stringify(msg);
  for (const p of room.players.values())
    if (p !== except && p.ws.readyState === 1) p.ws.send(s);
}
function publicPl(p) {
  return { id: p.id, name: p.name, team: p.team, op: p.op,
           p: p.pos, yaw: p.yaw, st: p.st, mv: p.mv, w: p.w, hp: Math.ceil(p.hp) };
}

// ---------- connection handling ----------
const wss = new WebSocketServer({ server: httpServer });
wss.on('connection', ws => {
  const p = {
    id: nextPlayerId++, ws, room: null, name: '', op: 1, team: 'stanz',
    pos: [0, 0, 0], yaw: 0, st: 0, mv: 0, w: 'ar',
    hp: 100, kills: 0, deaths: 0, invuln: 3, lastShot: 0,
    lastHurt: 0, respawnT: 0, lastState: Date.now()
  };
  ws.on('message', data => {
    let m;
    try { m = JSON.parse(data); } catch (e) { return; }
    if (!m || typeof m.t !== 'string') return;
    if (m.t === 'hello' && !p.room) hello(p, m);
    else if (!p.room) return;
    else if (m.t === 'state') onState(p, m);
    else if (m.t === 'shot') onShot(p, m);
  });
  ws.on('close', () => leave(p));
  ws.on('error', () => {});
});

function hello(p, m) {
  p.name = String(m.name || '').replace(/[^\w \-\.]/g, '').trim().slice(0, 14) || ('OP-' + p.id);
  p.op = (m.op === 0 || m.op === 1 || m.op === 2 || m.op === 3) ? m.op : 1;
  const room = getRoom();
  let s = 0, r = 0;
  for (const q of room.players.values()) (q.team === 'stanz' ? s++ : r++);
  p.team = s <= r ? 'stanz' : 'raven';
  p.pos = spawnPos(p.team);
  p.hp = 100; p.invuln = 3; p.lastState = Date.now();
  room.players.set(p.id, p); p.room = room;
  send(p, {
    t: 'welcome', id: p.id, team: p.team, room: room.id, spawn: p.pos,
    scores: room.scores, time: Math.ceil(room.time),
    players: [...room.players.values()].filter(q => q !== p).map(publicPl)
  });
  bc(room, { t: 'join', pl: publicPl(p) }, p);
  log(room, `${p.name} joined (${p.team}) — ${room.players.size} in room`);
}

function leave(p) {
  const room = p.room;
  if (!room) return;
  room.players.delete(p.id);
  p.room = null;
  bc(room, { t: 'leave', id: p.id, name: p.name });
  log(room, `${p.name} left — ${room.players.size} in room`);
  if (room.players.size === 0) {
    const i = rooms.indexOf(room);
    if (i >= 0) rooms.splice(i, 1);
  }
}

function num(v, lo, hi) { return typeof v === 'number' && isFinite(v) && v >= lo && v <= hi; }

function onState(p, m) {
  if (!Array.isArray(m.p) || m.p.length !== 3) return;
  if (!num(m.p[0], -WORLD, WORLD) || !num(m.p[1], -12, 170) || !num(m.p[2], -WORLD, WORLD)) return;
  const now = Date.now();
  const dt = Math.min(1, (now - p.lastState) / 1000);
  p.lastState = now;
  // movement sanity: clamp horizontal displacement to sprint speed + slack
  const dx = m.p[0] - p.pos[0], dz = m.p[2] - p.pos[2];
  const maxD = Math.max(1.2, 13 * dt);
  if (dx * dx + dz * dz <= maxD * maxD) p.pos = [r2(m.p[0]), r2(m.p[1]), r2(m.p[2])];
  if (num(m.yaw, -10, 10)) p.yaw = r2(m.yaw);
  if (m.st === 0 || m.st === 1 || m.st === 2) p.st = m.st;
  if (num(m.mv, 0, 2)) p.mv = r2(m.mv);
  if (m.w === 'ar' || m.w === 'pistol' || m.w === '') p.w = m.w;
}

function onShot(p, m) {
  const room = p.room;
  if (room.state !== 'live' || p.hp <= 0) return;
  const W = WEAPONS[m.w];
  if (!W) return;
  const now = Date.now();
  if (now - p.lastShot < (60000 / W.rpm) * 0.75) return;    // rate-of-fire clamp
  p.lastShot = now;
  if (!Array.isArray(m.o) || m.o.length !== 3 || !Array.isArray(m.ds)) return;
  const o = [+m.o[0], +m.o[1], +m.o[2]];
  if (!o.every(v => isFinite(v))) return;
  // the shot must come from (near) where the server believes the player is
  const ox = o[0] - p.pos[0], oy = o[1] - p.pos[1], oz = o[2] - p.pos[2];
  if (ox * ox + oz * oz > 12 || oy < -1 || oy > 2.6) return;
  const dirs = m.ds.slice(0, W.pellets);
  const ends = [];
  for (const dv of dirs) {
    if (!Array.isArray(dv) || dv.length !== 3) continue;
    let d = [+dv[0], +dv[1], +dv[2]];
    const len = Math.sqrt(d[0] * d[0] + d[1] * d[1] + d[2] * d[2]);
    if (!isFinite(len) || len < 0.5 || len > 2) continue;
    d = [d[0] / len, d[1] / len, d[2] / len];
    // nearest enemy hit
    let best = null, bt = W.range;
    for (const q of room.players.values()) {
      if (q === p || q.team === p.team || q.hp <= 0) continue;
      const ht = hitBody(o, d, q.pos, q.st);
      if (ht && ht.t < bt) { bt = ht.t; best = q; }
    }
    // terrain line-of-sight up to the hit
    const wb = terrainBlockT(o, d, bt);
    if (wb !== null) { best = null; bt = wb; }
    ends.push([r2(o[0] + d[0] * bt), r2(o[1] + d[1] * bt), r2(o[2] + d[2] * bt)]);
    if (best && best.invuln <= 0) {
      const head = hitBody(o, d, best.pos, best.st).head;
      const dmg = Math.round(W.dmg * (head ? 2.1 : 1) * (1 - Math.min(0.4, bt / W.range * 0.4)));
      send(p, { t: 'hitc', head: head });
      applyDamage(room, best, dmg, p);
    }
  }
  if (ends.length) bc(room, { t: 'shot', id: p.id, o: [r2(o[0]), r2(o[1]), r2(o[2])], e: ends, w: m.w }, p);
}

function applyDamage(room, victim, dmg, attacker) {
  victim.hp -= dmg;
  victim.lastHurt = Date.now();
  if (victim.hp <= 0) {
    victim.hp = 0;
    victim.deaths++; victim.respawnT = 4;
    attacker.kills++;
    room.scores[attacker.team]++;
    bc(room, { t: 'kill', k: attacker.id, kn: attacker.name, v: victim.id, vn: victim.name });
    send(victim, { t: 'die', by: attacker.name, kp: attacker.pos });
    log(room, `${attacker.name} ▸ ${victim.name}  (${room.scores.stanz}–${room.scores.raven})`);
    checkEnd(room);
  }
}

function checkEnd(room) {
  if (room.state !== 'live') return;
  if (room.scores.stanz >= TDM_LIMIT || room.scores.raven >= TDM_LIMIT) {
    endRound(room, room.scores.stanz >= TDM_LIMIT ? 'stanz' : 'raven');
  }
}
function endRound(room, winner) {
  room.state = 'end'; room.endT = 8;
  bc(room, { t: 'end', winner: winner, scores: room.scores });
  log(room, `round over — ${winner.toUpperCase()} wins ${room.scores.stanz}–${room.scores.raven}`);
}
function resetRound(room) {
  room.scores = { stanz: 0, raven: 0 };
  room.time = TDM_TIME; room.state = 'live';
  for (const p of room.players.values()) {
    p.pos = spawnPos(p.team);
    p.hp = 100; p.invuln = 3; p.respawnT = 0;
    send(p, { t: 'reset', p: p.pos, time: TDM_TIME });
  }
  log(room, 'new round');
}

// ---------- 15 Hz simulation & snapshots ----------
const TICK = 1 / 15;
setInterval(() => {
  const now = Date.now();
  for (const room of rooms) {
    if (room.state === 'live') {
      room.time -= TICK;
      if (room.time <= 0) {
        endRound(room, room.scores.stanz > room.scores.raven ? 'stanz'
               : room.scores.raven > room.scores.stanz ? 'raven' : 'draw');
      }
    } else {
      room.endT -= TICK;
      if (room.endT <= 0) resetRound(room);
    }
    const pl = [];
    for (const p of room.players.values()) {
      if (p.invuln > 0) p.invuln -= TICK;
      if (p.hp <= 0 && room.state === 'live') {
        p.respawnT -= TICK;
        if (p.respawnT <= 0) {
          p.pos = spawnPos(p.team);
          p.hp = 100; p.invuln = 2.5;
          send(p, { t: 'respawn', p: p.pos });
        }
      } else if (p.hp > 0 && p.hp < 100 && now - p.lastHurt > 5000) {
        p.hp = Math.min(100, p.hp + 3.5 * TICK);   // same regen as single-player
      }
      pl.push([p.id, p.pos[0], p.pos[1], p.pos[2], p.yaw, p.st, p.mv, p.w, Math.ceil(p.hp)]);
    }
    if (pl.length) {
      bc(room, { t: 'snap', time: Math.max(0, Math.ceil(room.time)),
                 sc: room.scores, pl: pl });
    }
  }
}, Math.round(TICK * 1000));

function log(room, msg) {
  console.log(`[${new Date().toISOString().slice(11, 19)}] [room ${room.id}] ${msg}`);
}

httpServer.listen(PORT, () => {
  const ips = localIPs();
  console.log('==============================================');
  console.log('  STANZ G — online multiplayer server  v0.6.1');
  console.log(`  Game + matchmaking on port ${PORT}`);
  console.log(`  This PC:        http://localhost:${PORT}`);
  if (ips.length) {
    console.log('  -----------------------------------------');
    console.log('  Give THIS to everyone else on your Wi-Fi:');
    ips.forEach(ip => console.log(`     ${ip}:${PORT}`));
    console.log('  They type it into ONLINE MULTIPLAYER as:');
    ips.forEach(ip => console.log(`     ws://${ip}:${PORT}`));
  } else {
    console.log('  Could not detect a LAN address — check this PC is on Wi-Fi.');
  }
  console.log('  -----------------------------------------');
  console.log('  Mode:   SERVER TDM — first to 25, 8:00 rounds');
  console.log('  Leave this window open for as long as the match runs.');
  console.log('==============================================');
});
