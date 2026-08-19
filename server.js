'use strict';
/* ============ NEON SURVIVOR · LAN 房间码服务器 ============ */
const { WebSocketServer } = require('ws');

const PORT = parseInt(process.env.PORT || '3456');
const MAX_MSG = 65536;               // 单条消息上限（字节），防恶意洪泛
const wss = new WebSocketServer({ port: PORT, maxPayload: MAX_MSG });

console.log(`⚡ Neon Survivor LAN → ws://localhost:${PORT}`);

// 心跳：清理网络异常但未触发 close 的死连接（浏览器会自动回 pong）
const heartbeat = setInterval(() => {
  for (const ws of wss.clients) {
    if (ws.isAlive === false) { ws.terminate(); continue; }
    ws.isAlive = false;
    ws.ping();
  }
}, 30000);
wss.on('close', () => clearInterval(heartbeat));

// 房间管理
const rooms = new Map();  // code → { host, guest }
const peers = new Map();  // ws → { code, role }

function genCode() {
  const CH = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let s = '';
  for (let i = 0; i < 4; i++) s += CH[(Math.random() * CH.length) | 0];
  return rooms.has(s) ? genCode() : s;
}

function send(ws, obj) {
  if (ws.readyState === 1) ws.send(JSON.stringify(obj));
}

function relay(ws, msg) {
  const pinfo = peers.get(ws);
  if (!pinfo) return;
  const room = rooms.get(pinfo.code);
  if (!room) return;
  const other = pinfo.role === 'host' ? room.guest : room.host;
  if (other && other.readyState === 1) send(other, msg);
}

function cleanup(ws) {
  const pinfo = peers.get(ws);
  if (!pinfo) return;
  const room = rooms.get(pinfo.code);
  if (room) {
    const other = pinfo.role === 'host' ? room.guest : room.host;
    if (other && other.readyState === 1) {
      send(other, { type: 'peerGone' });
    }
    rooms.delete(pinfo.code);
  }
  peers.delete(ws);
}

wss.on('connection', (ws, req) => {
  const ip = req.socket.remoteAddress;
  console.log(`  ✓ 连接: ${ip}  (${wss.clients.size} 在线)`);

  ws.isAlive = true;
  ws.on('pong', () => { ws.isAlive = true; });

  ws.on('message', (raw) => {
    if (raw.length > MAX_MSG) { ws.terminate(); return; }   // 超限直接断开
    let msg;
    try { msg = JSON.parse(raw.toString()); } catch (e) { return; }

    switch (msg.type) {
      case 'create': {
        const code = genCode();
        rooms.set(code, { host: ws, guest: null });
        peers.set(ws, { code, role: 'host' });
        send(ws, { type: 'roomCode', code });
        console.log(`  🏠 房间 ${code} 创建 (${ip})`);
        break;
      }
      case 'join': {
        const code = (msg.code || '').toUpperCase();
        const room = rooms.get(code);
        if (!room) { send(ws, { type: 'error', msg: '房间不存在' }); break; }
        if (room.guest) { send(ws, { type: 'error', msg: '房间已满' }); break; }
        room.guest = ws;
        peers.set(ws, { code, role: 'guest' });
        send(ws, { type: 'joined' });
        send(room.host, { type: 'guestJoined' });
        console.log(`  👥 客机加入房间 ${code}`);
        break;
      }
      default:
        // 转发给房间内另一方
        relay(ws, msg);
    }
  });

  ws.on('close', () => {
    const pinfo = peers.get(ws);
    console.log(`  ✗ 断开: ${pinfo ? pinfo.role : '?'} (剩余 ${wss.clients.size - 1})`);
    cleanup(ws);
  });

  ws.on('error', () => {});
});

console.log('  等待玩家连接...');
