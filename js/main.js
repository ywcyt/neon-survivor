'use strict';
/* ============ 启动 & 主循环 ============ */
(function () {
  const canvas = document.getElementById('game');
  const ctx = canvas.getContext('2d');
  let last = 0;
  let dpr = 1;

  function resize() {
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.floor(innerWidth * dpr);
    canvas.height = Math.floor(innerHeight * dpr);
    canvas.style.width = innerWidth + 'px';
    canvas.style.height = innerHeight + 'px';
    World.resize(innerWidth, innerHeight);
  }

  function frame(t) {
    requestAnimationFrame(frame);
    let rdt = (t - last) / 1000;
    last = t;
    if (!(rdt > 0) || rdt > 0.05) rdt = 0.016;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    Game.update(rdt);
    Game.render(ctx);
  }

  World.init();
  Input.init(canvas);
  UI.init();
  Game.init();
  resize();
  addEventListener('resize', resize);

  // ---- 联机大厅按钮 ----
  const bindTap = (el, fn) => {
    el.addEventListener('click', (e) => {
      e.preventDefault(); AudioSys.init(); AudioSys.resume(); AudioSys.uiClick(); fn();
    });
  };
  const serverIP = localStorage.getItem('ns_server_ip') || 'localhost';

  // 创建房间
  bindTap(document.getElementById('btn-host'), () => {
    document.getElementById('btn-host').style.display = 'none';
    document.getElementById('btn-join-show').style.display = 'none';
    const st = document.getElementById('lobby-status');
    st.textContent = '正在连接服务器…';
    if (!Net.createRoom(serverIP)) {
      st.textContent = '连接失败，请确认服务器已启动';
      document.getElementById('btn-host').style.display = '';
      document.getElementById('btn-join-show').style.display = '';
    }
  });

  // 显示加入输入框
  bindTap(document.getElementById('btn-join-show'), () => {
    document.getElementById('join-row').classList.remove('hidden');
    document.getElementById('room-input').focus();
  });

  // 加入房间
  bindTap(document.getElementById('btn-join-go'), () => {
    const code = document.getElementById('room-input').value.trim();
    if (code.length < 4) return;
    document.getElementById('join-row').classList.add('hidden');
    UI.setLobby('正在加入 ' + code.toUpperCase() + ' …');
    if (!Net.joinRoom(serverIP, code)) {
      UI.setLobby('连接失败，请确认服务器已启动');
    }
  });

  // 单人
  bindTap(document.getElementById('btn-solo'), () => {
    Net.mode = 'solo';
    Game.start();
  });

  // 主机开始按钮
  const hostStartBtn = document.createElement('button');
  hostStartBtn.className = 'btn small';
  hostStartBtn.textContent = '开始游戏';
  hostStartBtn.id = 'btn-host-start';
  hostStartBtn.style.display = 'none';
  document.querySelector('#screen-lobby .lobby-btns').appendChild(hostStartBtn);
  bindTap(hostStartBtn, () => { Game.startHost(); });

  // ---- Net 大厅回调 ----
  Net.onRoomCode = (code) => {
    document.getElementById('lobby-code-box').classList.remove('hidden');
    document.getElementById('lobby-code').textContent = code;
    UI.setLobby('等待客机加入…');
  };
  Net.onGuestJoined = () => {
    UI.setLobby('客机已加入 ✓', true);
    hostStartBtn.style.display = '';
  };
  Net.onJoined = () => {
    UI.setLobby('已加入房间 ✓', true);
  };
  Net.onError = (msg) => {
    UI.setLobby('错误: ' + msg);
    document.getElementById('btn-host').style.display = '';
    document.getElementById('btn-join-show').style.display = '';
  };
  Net.onDisconnect = () => {
    UI.setLobby('连接断开，请重试');
    document.getElementById('btn-host').style.display = '';
    document.getElementById('btn-join-show').style.display = '';
    document.getElementById('lobby-code-box').classList.add('hidden');
    hostStartBtn.style.display = 'none';
  };
  // 客机收到开始信号
  const origGameStart = Net.onGameStart;
  Net.onGameStart = (seed) => {
    if (origGameStart) origGameStart(seed);
    UI.setLobby('游戏开始！');
  };

  UI.showLobby();
  requestAnimationFrame((t) => { last = t; requestAnimationFrame(frame); });

  /* 无头冒烟测试钩子: index.html?autotest=1[&ticks=N] */
  if (location.search.includes('autotest')) {
    setTimeout(() => {
      try {
        const m = location.search.match(/ticks=(\d+)/);
        const SIM = m ? +m[1] : 14000;
        const god = !location.search.includes('mortal');
        Game.start();
        if (god) { player.maxHp = 1e9; player.hp = 1e9; }
        let ang = 0;
        Input.getMove = () => ({ x: Math.cos(ang), y: Math.sin(ang) });
        let restarted = false;
        for (let i = 0; i < SIM; i++) {
          if (i % 50 === 0) ang += U.rand(-1.6, 1.6);
          if (god && i % 240 === 0) Game.gainXP(60);
          Game.update(1 / 60);
          if (Game.state === 'levelup') UI.pickByIndex((Math.random() * 3) | 0);
          if (Game.state === 'over') {
            if (restarted) break;
            restarted = true;
            Game.start();
          }
          if (i % 120 === 0) Game.render(ctx);
        }
        Game.render(ctx);
        // 像素统计：验证画面非黑屏且色彩丰富
        const img = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
        let lit = 0, bright = 0, colored = 0;
        for (let i = 0; i < img.length; i += 40) {
          const r = img[i], g = img[i + 1], b = img[i + 2];
          const mx = Math.max(r, g, b);
          if (mx > 20) lit++;
          if (mx > 150) bright++;
          if (Math.abs(r - b) > 40 || Math.abs(g - b) > 40 || Math.abs(r - g) > 40) colored++;
        }
        const tot = img.length / 40;
        console.log('PIXELS lit=' + (lit / tot * 100).toFixed(1) + '%' +
          ' bright=' + (bright / tot * 100).toFixed(1) + '%' +
          ' colored=' + (colored / tot * 100).toFixed(1) + '%');
        console.log('AUTOTEST OK time=' + Game.time.toFixed(1) +
          ' wave=' + Game.wave + ' state=' + Game.state +
          ' kills=' + Game.kills + ' score=' + Game.score +
          ' level=' + (player ? player.level : 0) +
          ' weapons=' + (player ? player.weapons.length : 0) +
          ' enemies=' + enemies.length +
          ' restarted=' + restarted);
      } catch (err) {
        console.error('AUTOTEST FAIL: ' + err.stack);
      }
    }, 500);
  }
})();
