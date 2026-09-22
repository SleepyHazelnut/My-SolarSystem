# 个人主页

一组星球角色：**太阳**与**地球**。各自会呼吸、会随机眨眼、可悬停、可点击。

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
| `index.html` | 页面骨架。两个角色的 `<svg>` 分别由 JS 注入到 `#sun` / `#earth` |
| `src/main.js` | 页面入口 |
| `src/characters/sun/index.js` | 挂载与逐帧驱动：写 SVG 属性、绑定输入、视线跟随、逐帧时钟 |
| `src/characters/sun/anim.js` | 缓动函数、三段动画的关键帧、状态机与混合器、点击星光特效、眨眼计时器。纯逻辑，不碰 DOM |
| `src/characters/sun/scene.js` | 太阳的 SVG 图层结构（含星光 glow 滤镜），以及素材的导入 |
| `src/characters/earth/index.js` | 地球的挂载与逐帧驱动：写 SVG 属性、绑定输入、逐帧时钟。**不复用**太阳的状态机 |
| `src/characters/earth/anim.js` | 地球的几何落点、动画参数与每帧的数值计算（呼吸 / 摆动 / 三态眨眼 / 云雨 / 叶的冲激）。纯逻辑，不碰 DOM |
| `src/characters/earth/scene.js` | 地球的 SVG 图层结构，以及素材的导入 |
| `src/shared/` | 两个角色共用的**运动原语**：`easing.js`（三次贝塞尔 / smoothstep / easeOutQuad）、`approach.js`（指数逼近）、`impulse.js`（阻尼冲激）、`clock.js`（dt 钳制 / fps 统计）、`input.js`（指针 → hover/pressed）、`blink.js`（眨眼计时器 + 三态闭眼量） |
| `src/assets/sun/` | 身体与装饰素材，9 张 PNG（`sun_base` / `ring_outer` / `crown` / `flower` / `leaf` / `spark1~4`） |
| `src/assets/face/` | 五官（表情）素材，5 张 PNG（`cat_face` / `eye_dot` / `eye_closed` / `mouth_flat` / `mouth_round`） |
| `src/assets/earth/` | 地球素材：`earth_base`（球体，无五官）/ `eye_open`·`eye_half`·`eye_closed`（三态眼 + 嘴）/ `sprout_stem`（茎）·`sprout_leaf_l`（左叶）·`sprout_leaf_r`（右叶）/ `cloud`（云，在芽头上降雨） |
| `src/style.css` | 样式 |

## 注意

- 图层顺序在 `src/characters/sun/scene.js` 里是**倒着写**的（SVG 中后声明 = 更上层），改动前先看该文件顶部的说明。
- 角色的位置、缩放、各层不透明度由 `src/characters/sun/anim.js` 每帧写绝对值，不要在 SVG 里再叠一层静态 `transform`。
- 皇冠、向日葵的花与叶的摇摆旋转分别写在包装组 `#crownGroup` / `#flowerWrap` / `#leafWrap` 上，组内的 `<image>` 保留自己的静态定位变换。
- 四张星光与皇冠在同一个 `#crownGroup` 里（否则皇冠一转星光就脱开）。它们**平时完全不显示**，只在点击时由 `src/characters/sun/anim.js` 的特效层点亮。
- 星环的变换顺序是 `translate → scale(sx sy) → rotate → translate(-O)`：**scale 必须在 rotate 外面**，否则非等比压缩的轴会跟着环一起转。
- 星环**拆成前后两层**：`#ringBack`（画在太阳本体之前 = 沉在太阳下）与 `#ringFront`（画在发夹之后 = 浮在太阳上），
  沿**过环心的屏幕水平线**切分（`#ringClipBack` / `#ringClipFront`，每帧由 `src/characters/sun/index.js` 重写）。两半必须吃**同一份 transform 字符串**，差一个字节中间就裂一条缝。
- ⚠️ 这条切分线**只在侧转时成立**。静止时环是正圆贴在太阳外圈，切一半只会读成「太阳把环啃了一口」，
  所以 `index.js` 按侧转量 k 把它往上「停」：`seam = ring.y − (1 − k) · RING_TILT.seamPark`。
  k = 1 落在环心，k = 0 停到环外（= 整环归前半层 = 和没分层一模一样）。
  **实测：帧 0~18 与帧 91~108 新旧两版逐位相同（0 px），只有帧 19~90（k ≥ 0.76）才真的切开。**
  侧转量由 `anim.js` 的 `ringTiltK(sx, sy, s)` 从 `ring.sx` 反解 —— 不能另存一份 k（状态混合、`FX.ringTilt` 关掉、`ring.s` 的离心脉动都会改 `sx`）。
- 视线跟随的三个参数（`RANGE` / `MAX_SHIFT` / `SMOOTH`）在 `src/characters/sun/index.js` 里，开关是同一个文件的 `LOOK_FOLLOW`（**当前为 `false`**，暂时关掉，代码保留）。
- 下面六项效果的开关集中在 `src/characters/sun/anim.js` 的 `FX`（都默认开），逐项置 `false` 即回到旧行为：
  `spring` 装饰的甩动用二阶阻尼弹簧、`ringTilt` 星环 3D 侧转、`blendPunch` 进入点击态的混合曲线、
  `sparkGlow` 星光 glow（这一项在 `index.js` / `scene.js` 里生效）、`drift` 低频漂移（打破 3 秒锁相）、
  `decorPhase` 向日葵花与叶的相位漂移。
- `src/characters/sun/anim.js` 是**手改的唯一源**，没有生成管线；改动画直接改它。
- 地球（`src/characters/earth/`，三层同太阳：`index.js` / `anim.js` / `scene.js`）的**动画内容是独立的一套** ——
  它不吃太阳的关键帧与状态机，而是程序化正弦。但两边**共用 `src/shared/` 的运动原语**（缓动 / 眨眼计时器 /
  指数逼近 / 阻尼冲激 / 时钟 / 输入接线），这些原语是纯函数、参数由调用方给，所以共享不改变各自的数值。
  ⚠️ 共享的 `blink.js` 与 `impulse.js` 只统一**结构**，不统一**语义**：太阳的冲激用阻尼频率 `ωd` 振荡、
  `ζ·ωn` 衰减，地球用同一个 `ω` 既振荡又衰减，两边的 `ω` / `decay` 口径不同，别按名字直接对调参数。
  它的五官是从合成图 `星球素材/地球/地球.png` 里
  **抠出来**的（底图做过最近邻修补），「半闭 / 闭」两个眼态由眼睛纵向压缩生成。
  ⚠️ 三态眼与球体共用同一个变换 `EARTH_T` —— 各写各的会在眨眼时错位；
  小芽则相反，它是**单独摆上去的**，`SPROUT` 里的 x/y 是 viewBox 坐标（不是素材坐标）。
  小芽是**三份**（`sprout_stem` 茎 / `sprout_leaf_l` 左叶 / `sprout_leaf_r` 右叶，同一画布导出）：
  **茎不动**（只吃静态倾角 `rot`，写一次就不再改），**只有两片叶摆** ——
  两份叶吃**同一份 transform**（绕**同一个圆心**、同一个角度），所以中间永远不会裂出空隙。
  圆心取两片叶的**接触点** `(1080,1100)`（素材坐标），每帧的变换是
  `translate(-pivot) rotate(a pivot)` —— 少了前半截就会绕画布外的远处一点转、整支被甩飞。
  ⚠️ `x/y` 与 `pivot` 绑死：渲染结果是 `(x,y) + k·R(rot)·(p − pivot)`，单独改 pivot 会让整株平移，
  换圆心要按 `(x,y) += k·R(rot)·(pivot′ − pivot)` 补偿（调参页有「圆心移到茎顶」按钮做这件事）。
  芽排在球体**之后**（= 画在球体之上，`SPROUT.layer` 可切），且整个 `#earthBreath` 一起呼吸、
  `#earthBob` 一起浮动，所以芽和球是「绑在一起」的。
  云和雨放在 `#earthBob ⊃ #earthBreath ⊃ #earthSky` 里，**和地球绑定** ——
  地球浮动 / 左右摆 / 呼吸 / 被点击压扁时，云和雨都跟着一起走（云只是在这个基础上再叠自己的上下漂移）。
  调试页：`_draft/earth-tuner.html`（含「叶的摆角」预览滑块，可停在极限位看叶和茎接不接得上）。
  雨滴是纯 SVG 生成（没有素材）：水滴形 `path`，从云底落到芽顶，大小 / 速度 / 相位各自随机。
  ⚠️ 雨的组排在云**之前**（画在云下面）—— 起点落在云体内部，靠云挡住上半程才读得成「从云里落下来」。
  点击：地球纵向 ×0.86、横向 ×1.09；**两片叶额外被甩一下**（`EARTH.whipAmp / whipHz / whipZeta / whipDur`，
  一次冲激 + 指数衰减，sin 起手）；云因为绑在地球上，跟着一起吃这个压扁。
