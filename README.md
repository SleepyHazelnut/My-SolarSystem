# 个人主页

太阳角色：会呼吸、会随机眨眼、可悬停、可点击。

## 运行

```bash
npm install
npm run dev
```

开发服务器地址：http://127.0.0.1:5173

带 `?debug=1` 打开会在左下角挂一个调试面板（视线偏移、指针坐标、fps）。

### 构建

```bash
npm run build      # 输出至 dist/
npm run preview    # 本地预览 dist/
```

## 结构

| 路径 | 说明 |
|---|---|
| `index.html` | 页面骨架。角色的 `<svg>` 由 JS 注入到 `#sun` |
| `src/main.js` | 页面入口 |
| `src/sun.js` | 挂载与逐帧驱动：写 SVG 属性、绑定输入、视线跟随、逐帧时钟 |
| `src/anim.js` | 缓动函数、三段动画的关键帧、状态机与混合器、点击星光特效、眨眼计时器。纯逻辑，不碰 DOM |
| `src/svg-scene.js` | SVG 图层结构（含星光 glow 滤镜），以及素材的导入 |
| `src/assets/sun/` | 角色素材，15 张 PNG（`clip.png` 是旧发夹素材，已不被引用） |
| `src/style.css` | 样式 |

## 注意

- 图层顺序在 `src/svg-scene.js` 里是**倒着写**的（SVG 中后声明 = 更上层），改动前先看该文件顶部的说明。
- 角色的位置、缩放、各层不透明度由 `src/anim.js` 每帧写绝对值，不要在 SVG 里再叠一层静态 `transform`。
- 皇冠、向日葵的花与叶的摇摆旋转分别写在包装组 `#crownGroup` / `#flowerWrap` / `#leafWrap` 上，组内的 `<image>` 保留自己的静态定位变换。
- 四张星光与皇冠在同一个 `#crownGroup` 里（否则皇冠一转星光就脱开）。它们**平时完全不显示**，只在点击时由 `src/anim.js` 的特效层点亮。
- 星环的变换顺序是 `translate → scale(sx sy) → rotate → translate(-O)`：**scale 必须在 rotate 外面**，否则非等比压缩的轴会跟着环一起转。
- 星环**拆成前后两层**：`#ringBack`（画在太阳本体之前 = 沉在太阳下）与 `#ringFront`（画在发夹之后 = 浮在太阳上），
  沿**过环心的屏幕水平线**切分（`#ringClipBack` / `#ringClipFront`，每帧由 `src/sun.js` 重写）。两半必须吃**同一份 transform 字符串**，差一个字节中间就裂一条缝。
- ⚠️ 这条切分线**只在侧转时成立**。静止时环是正圆贴在太阳外圈，切一半只会读成「太阳把环啃了一口」，
  所以 `sun.js` 按侧转量 k 把它往上「停」：`seam = ring.y − (1 − k) · RING_TILT.seamPark`。
  k = 1 落在环心，k = 0 停到环外（= 整环归前半层 = 和没分层一模一样）。
  **实测：帧 0~18 与帧 91~108 新旧两版逐位相同（0 px），只有帧 19~90（k ≥ 0.76）才真的切开。**
  侧转量由 `anim.js` 的 `ringTiltK(sx, sy, s)` 从 `ring.sx` 反解 —— 不能另存一份 k（状态混合、`FX.ringTilt` 关掉、`ring.s` 的离心脉动都会改 `sx`）。
- 视线跟随的三个参数（`RANGE` / `MAX_SHIFT` / `SMOOTH`）在 `src/sun.js` 里，开关是同一个文件的 `LOOK_FOLLOW`（**当前为 `false`**，暂时关掉，代码保留）。
- 下面六项效果的开关集中在 `src/anim.js` 的 `FX`（都默认开），逐项置 `false` 即回到旧行为：
  `spring` 装饰的甩动用二阶阻尼弹簧、`ringTilt` 星环 3D 侧转、`blendPunch` 进入点击态的混合曲线、
  `sparkGlow` 星光 glow（这一项在 `sun.js` / `svg-scene.js` 里生效）、`drift` 低频漂移（打破 3 秒锁相）、
  `decorPhase` 向日葵花与叶的相位漂移。
- `src/anim.js` 是**手改的唯一源**，没有生成管线；改动画直接改它。
