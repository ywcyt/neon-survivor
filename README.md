# NEON SURVIVOR · 霓虹幸存者

Geometry Wars 式霓虹视觉 × 吸血鬼幸存者玩法的**太空生存射击游戏**。
纯原生 Web 技术（HTML5 Canvas + CSS + JavaScript），零依赖、零构建，双击即玩。

## 运行方式

直接用浏览器打开 `index.html` 即可（推荐 Chrome / Edge / Firefox）。

也可以起一个本地服务器：

```bash
cd neon-survivor
python3 -m http.server 8000
# 浏览器访问 http://localhost:8000
```

### 局域网联机

```bash
# 1. 启动 WebSocket 信令服务器
node server.js

# 2. 打开 index.html（主机 & 客机用同一地址）
# 3. 主机点击「创建房间」→ 获取 4 位房间码
# 4. 客机输入房间码「加入房间」
# 5. 主机点击「开始游戏」
```

默认服务器地址为 `localhost`，如需跨设备联机，在浏览器控制台设置：
```js
localStorage.setItem('ns_server_ip', '192.168.x.x')
```

## 玩法

- 你是虚空竞技场中的一艘霓虹战机，敌人会一波波涌来，**武器全自动索敌开火**；
- 击杀敌人掉落经验宝石，升级时**三选一**强化：新武器 / 武器升级 / 被动加成；
- 每 30 秒一波，敌人越来越强；**每 5 波刷新 Boss「虚空哨兵」**（弹幕、扇形射击、冲撞、召唤四种攻击模式，低血量狂暴）；
- 连续击杀积累**连击倍率**，分数更高；精英怪（金环）掉落**回复胶囊**与**清屏核弹**；
- 活得越久，分数越高。最高纪录保存在本地。
- 支持**局域网双人合作**：主机控制 P1（青色），客机控制 P2（品红），同屏协作。

## 操作

| 按键 | 功能 |
|---|---|
| `W A S D` / 方向键 | 移动 |
| `Space` / `Shift` | 相位冲刺（短暂无敌） |
| `P` / `Esc` | 暂停 |
| `M` | 静音 |
| `1 / 2 / 3` | 快速选择升级卡片 |

支持**触屏**：左半屏虚拟摇杆移动，右下角冲刺按钮。

## 武器库

| 武器 | 说明 |
|---|---|
| 脉冲机炮 | 自动索敌的散射弹幕，可升级弹头数与穿透 |
| 离子环刃 | 环绕机体的近战护刃 |
| 脉冲新星 | 周期性 AOE 冲击波 + 击退 |
| 追猎飞弹 | 追踪 + 爆炸溅射 |
| 湮灭光矛 | 旋转激光持续切割 |

另有 8 种被动强化（伤害/攻速/移速/护甲/回复/磁场/经验/暴击）。

## 技术说明

- **美术**：全程序化生成 —— 视差星空、动态星云、霓虹网格、加法混合辉光粒子、屏幕震动、子弹时间、伤害数字等；
- **音频**：WebAudio 程序化合成 —— 所有音效与背景音乐（低音+琶音+延迟回声）均为实时合成，无任何音频文件；
- **联机**：WebSocket 信令服务器 + 主机权威快照同步，支持局域网双人合作；
- **性能**：空间哈希碰撞检测、预渲染辉光贴图、环形缓冲区、数值键哈希、粒子上限控制，可稳定支撑 200+ 敌人同屏；
- **字体**：[Orbitron](https://fonts.google.com/specimen/Orbitron) 与 [Rajdhani](https://fonts.google.com/specimen/Rajdhani)（SIL Open Font License，已本地化存放于 `assets/fonts/`）。

## 冒烟测试

附带无头浏览器自动化测试钩子：

```bash
google-chrome --headless=new --disable-gpu --mute-audio --enable-logging=stderr \
  --virtual-time-budget=40000 "file://$PWD/index.html?autotest=1"
# 输出 AUTOTEST OK ... 即通过
```

## 作者

- **原作者**：[LikrFG](bilibili)
- **更新者**：[ywcyt](https://github.com/ywcyt)
