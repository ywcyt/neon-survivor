'use strict';
/* ============ 网络模块：WebSocket 客户端 ============ */
const Net = {
  ws: null,
  mode: 'solo',           // 'solo' | 'host' | 'guest'
  connected: false,
  roomCode: '',
  _pending: [],
  _remoteInput: null,
  _inputTick: 0,

  /** 连接到信令服务器 */
  connectToServer(ip) {
    const url = `ws://${ip}:3456`;
    try { this.ws = new WebSocket(url); } catch (e) { return false; }
    this.ws.onopen = () => {
      this.connected = true;
      console.log('Net: 已连接服务器');
      for (const m of this._pending) this.sendRaw(m);
      this._pending.length = 0;
    };
    this.ws.onmessage = (e) => {
      let msg;
      try { msg = JSON.parse(e.data); } catch (err) { return; }
      this._handle(msg);
    };
    this.ws.onclose = () => {
      this.connected = false; this.mode = 'solo';
      console.log('Net: 断开');
      if (this.onDisconnect) this.onDisconnect();
    };
    this.ws.onerror = () => {};
    return true;
  },

  /** 主机：创建房间 */
  createRoom(ip) {
    this.mode = 'host';
    this.roomCode = '';
    if (!this.connectToServer(ip)) return false;
    // 连接后发送 create
    if (this.ws && this.ws.readyState === 1) {
      this.sendRaw({ type: 'create' });
    } else {
      this._pending.push({ type: 'create' });
    }
    return true;
  },

  /** 客机：加入房间 */
  joinRoom(ip, code) {
    this.mode = 'guest';
    this.roomCode = code.toUpperCase();
    if (!this.connectToServer(ip)) return false;
    if (this.ws && this.ws.readyState === 1) {
      this.sendRaw({ type: 'join', code: this.roomCode });
    } else {
      this._pending.push({ type: 'join', code: this.roomCode });
    }
    return true;
  },

  /** 发送（自动包装） */
  send(obj) {
    this.sendRaw(obj);
  },

  sendRaw(obj) {
    if (this.ws && this.ws.readyState === 1) {
      this.ws.send(JSON.stringify(obj));
    } else {
      this._pending.push(obj);
    }
  },

  disconnect() {
    if (this.ws) this.ws.close();
    this.mode = 'solo';
    this.connected = false;
  },

  // ---------- 消息处理 ----------
  _handle(msg) {
    switch (msg.type) {
      // 房间管理
      case 'roomCode':
        this.roomCode = msg.code;
        if (this.onRoomCode) this.onRoomCode(msg.code);
        break;
      case 'joined':
        if (this.onJoined) this.onJoined();
        break;
      case 'guestJoined':
        if (this.onGuestJoined) this.onGuestJoined();
        break;
      case 'error':
        if (this.onError) this.onError(msg.msg);
        break;

      // 游戏数据
      case 'in':
        this._remoteInput = { mx: msg.mx, my: msg.my, dash: !!msg.dash };
        break;
      case 'snap':
        if (this.onSnapshot) this.onSnapshot(msg);
        break;

      // 升级同步
      case 'lvup':
        if (this.onRemoteLevelUp) this.onRemoteLevelUp(msg);
        break;
      case 'lvpick':
        if (this.onRemoteLevelPick) this.onRemoteLevelPick(msg.i);
        break;
      case 'lvdone':
        if (this.onRemoteLevelDone) this.onRemoteLevelDone();
        break;

      // 暂停同步
      case 'pause':
        if (this.onRemotePause) this.onRemotePause();
        break;
      case 'resume':
        if (this.onRemoteResume) this.onRemoteResume();
        break;

      // 控制
      case 'start':
        if (this.onGameStart) this.onGameStart(msg.seed);
        break;
      case 'over':
        if (this.onGameOver) this.onGameOver();
        break;
      case 'peerGone':
        if (this.onPeerGone) this.onPeerGone();
        break;
    }
  },

  // ---------- 回调 ----------
  onConnect: null,
  onDisconnect: null,
  onRoomCode: null,         // 主机收到房间码
  onJoined: null,           // 客机加入成功
  onGuestJoined: null,      // 主机得知客机已加入
  onError: null,            // 错误消息
  onRemoteInput: null,
  onSnapshot: null,
  onRemoteLevelUp: null,
  onRemoteLevelPick: null,
  onRemoteLevelDone: null,
  onRemotePause: null,      // 对方暂停
  onRemoteResume: null,     // 对方恢复
  onGameStart: null,
  onGameOver: null,
  onPeerGone: null,
};
