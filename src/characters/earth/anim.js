/**
 * 地球角色的**纯逻辑**：几何落点 + 动画参数 + 每帧数值计算。
 *
 * 只依赖 `src/shared/` 里的纯原语（缓动 / 眨眼 / 冲激 / 逼近），不引素材、不碰 DOM、不用 gsap ——
 * 所以能在 Node 里直接 `import` 做纯逻辑断言，也能给多个实例共用。
 *
 * 与太阳的分工差异：太阳的 `scene.js` 把几何数字抄成字面量，地球反过来 ——
 * **数字只在本文件出现一次**，`scene.js` 从这里 import 去搭模板。
 *
 * 素材：`星球素材/地球/` 的合成图。五官是从合成图里**抠出来**的，底图做了最近邻修补；
 * 三态眼里的「半闭 / 闭」是把眼睛纵向压缩生成的。
 * 几何（实测）：球体素材是 2048×2048 画布，球心 (960,1072)、半径 ≈664。
 *
 * 头顶小芽是**三份**素材（同一张 2048 画布导出）：茎 + 左右叶。动画口径：**茎不动**
 * （只吃静态倾角 `rot`），两片叶吃**同一份** transform —— 绕同一个圆心、同一个角度摆，
 * 所以中间永远不会裂。
 *
 * 五官是从合成图原样抠的（与 `earth_base` 逐像素对齐），所以与它**共用 `EARTH_T`** ——
 * 各写各的会在眨眼时错位。小芽、云、雨相反：都是**单独摆上去的**，坐标一律是 viewBox 坐标。
 *
 * 「开心」表情是**第三类**：素材来自 `星球素材/表情/`，但**不是整张套上去** ——
 * 按部件抠出来、逐件补角后拼回 **2048 画布**，所以它和三态眼**共用 `EARTH_T`**。
 */
import { smoothstep, easeOutQuad } from '../../shared/easing.js';
import { dampedImpulse } from '../../shared/impulse.js';
import { approach } from '../../shared/approach.js';
import { createBlinkLayer, eyeWeights } from '../../shared/blink.js';

/* 拆权重的口径在 `shared/blink.js`（太阳与地球共用同一套眼图，闭眼深度必须一致）。
   这里转出去是为了不打断既有的调用方与 `_draft/` 探针。 */
export { eyeWeights };

/* 素材几何（2048 画布，实测） */
export const SRC = { cx: 960, cy: 1072, r: 664 };

/* viewBox 落点。画面从上到下：云 → 雨 → 小芽 → 球体，所以上方要留空间给云和雨。
   宽 560 是因为云要「绕赤道转一圈」—— 440 宽时球两侧各只剩 90 px，而云宽 89.5 px，绕到侧面就卡死。 */
export const VIEW_W = 560;
export const VIEW_H = 560;
export const CX = 280;                  // 球心 x
export const CY = 410;                  // 球心 y
export const S = 260 / (SRC.r * 2);     // ≈0.1958 → 球体直径 260
export const TOP_Y = CY - SRC.r * S;    // 球体顶点 y ≈ 280（定位参照，模板里不用）

export const EARTH_T = `translate(${CX} ${CY}) scale(${S.toFixed(6)}) translate(${-SRC.cx} ${-SRC.cy})`;

/* 脸的中心（**素材坐标**）—— 表情倾斜的支点，只在本文件里换算出 `FACE_C`。
   取 `face_happy.png` 内容 bbox 中心 (1180, 1154.5)（眼 + 嘴的外接框，实测）。
   支点必须落在**脸自己身上**，倾斜才是纯转动：用球心会额外把脸平推（转 7° 推 5 px）。
   ⚠️ 不 export：外部要的是换算后的 `FACE_C`。
      （`_draft/_tilt-sweep.py` 按文本正则抠这里的数字，改格式要同步那个正则。） */
const FACE_SRC = { cx: 1180, cy: 1154.5 };
export const FACE_C = {
  x: CX + S * (FACE_SRC.cx - SRC.cx),
  y: CY + S * (FACE_SRC.cy - SRC.cy),
};

/* ---- 「开心」表情 ----
   `face_happy.png` 是**自己拼的**：眼睛 ← 微笑的 ^^ 弯月眼、嘴 ← 开心的张嘴，
   两个部件都按 `eye_open.png` 的实测中心缩放、落回 **2048 画布**。
   所以它和球体、三态眼**共用 `EARTH_T`** —— 切表情时不会「眼睛动一下」。

   ⚠️ 别改回「整张 1536 的表情素材 + 单独的 FACE_T」：那套只能把**双眼中点**对齐，
   眼距和眼高都对不上，切过去眼睛会明显地动。 */

/* 小芽：**三份**素材（同一 2048 画布导出，共用一套 translate/scale）。
   **茎不动**（只吃静态倾角 `rot`，写一次不再改）；两片叶吃**同一份** transform ——
   绕同一个圆心、同一个角度摆，所以中间永远不会裂。
   圆心是**素材坐标**，每帧的变换是 translate(-pivot) rotate(a pivot)；少了 translate(-pivot)
   就会绕画布外的远处一点转、整支被甩飞。
   pivotX/Y：两片叶的**接触点**（实测把两片叶各膨胀 3~16px 求交叠，质心稳定在 (1080,1100)）。
   rot：静态倾角（度）—— 三份都要吃，否则叶和茎在静态位就对不上。
   x/y 与 pivot **绑死**：渲染结果是 (x,y) + k·R(rot)·(p − pivot)，单独改 pivot 会让整株平移，
   换圆心时要按 (x,y) += k·R(rot)·(pivot′ − pivot) 补偿。
   layer：1 = 芽画在球体**之上**，0 = 沉到球体下面（由 DOM 顺序实现）。
   ⚠️ **x 是绝对落点，球心一动它必须跟着动**：芽长在球的**右上方**（离球心约 40% 半径）。
   加宽画布时 `CX` 220→280、这里没跟着挪 → 芽看起来跑到正中间了 → 274.833 → **334.833**
   （同理 `CLOUD.x` 284 → 344）。 */
export const SPROUT = { k: 0.045, x: 334.833, y: 272.703, pivotX: 1080, pivotY: 1100, rot: 29.5, layer: 1 };

/* 茎与两片叶的变换前缀 —— 圆心在**素材坐标**，所以要先 translate(-pivot)。
   茎只用它一次（静态），两片叶每帧都用。 */
export const SPROUT_PIVOT_T = `translate(${-SPROUT.pivotX} ${-SPROUT.pivotY}) `;

/* 云：素材 bbox 中心 ≈(1025.5,1040.5)。
   ⚠️ x 与 `SPROUT.x` 同理 —— 云要**落在芽的正上方**（雨落在芽上），所以跟着球心一起动：284 → **344**。 */
export const CLOUD = { k: 0.062, x: 344, y: 170, cx: 1025.5, cy: 1040.5 };

/* 云的运动：**绕地球转一圈** —— 一条闭合的三段路径。

       静止位 ──弧线──► 地球右边 ──圆周（走地球**前面**）──► 地球左边 ──弧线──► 静止位
                 (前)                (前)                        (后)

   图层：前两段画在球体**之上**，回程弧画在球体**之下** —— 由 DOM 顺序实现
   （`#earthCloudFront` / `#earthCloudBack`，见 scene.js）。切换点在最左点，那一刻云离球体还有 20 px，
   所以**切换本身看不见**；真正看得见「在背后」的是回程弧擦过球体左上那一小段。

   路径**闭合**：起点 = 终点 = 云的静止位，所以出门 / 回家天然无缝。
   三段接缝处**切线连续**（出门弧到环上是竖直的、回程弧离开环时也是竖直的）→ 全程没有折角。

   **快慢**由一条**从曲率解出**的速度剖面给（见 `R_REF` 那段）：弯里慢、直道快。
   时间轴 = 弧长 ÷ 速度的累计（`tau`），运行时 `u → easeDist(u)`（只管起停）→ 查 `tau` 表反查。

   回程弧**故意往地球那边鼓**：最近处离球心 128 px（球半径 130）→ 云被球体左上方轮廓挡掉一块，
   这就是「图层在背后」唯一看得见的地方。鼓得更深会挡得更多，但超过某个深度就变成
   「整朵消失、再从芽后面蹦出来」—— `RET_C2` 就是这个深度的旋钮。 */
export const ORBIT = {
  rx: 205, ry: 100,      // 环的半轴（椭圆，中心 = 球心）
  dur: 4.4,              // 绕完一圈（s）
  ease: 0.14,            // 起停各占总时长的比例（梯形速度曲线）

  /* ---- 环的「不规整」----
     一个**正椭圆**读起来就是「在跑轨道」（「绕圈太机械」）。这里加两项扰动，基函数都取 `sin³θ` ——
     它在 θ = 0 / π 上值、一阶导、二阶导全为 0 → 接缝处的位置 / 切线 / **曲率**都不动，
     上面那套 G2 匹配照旧成立，但环不再是椭圆。
     ⚠️ 别用 `sin²θ`（二阶导在端点不为 0）→ 接缝曲率会漂，速度剖面跟着漂。

       · `wobRX` / `wobRY`：半径随角度起伏。两个基分别是 `sin³θ`（关于 θ=π/2 对称）
         与 `sin³θ·cosθ`（反对称）→ 合起来能同时给出「鼓」和「偏」。
       · `ringTilt`：环平面在中途逐渐倾斜（度）—— 环底不再是正下方，整条路径左右不对称。 */
  wobRX: [0.09, 0.14],
  wobRY: [-0.10, 0.12],
  ringTilt: 14,

  /* 姿态：只在**横向速度**上给一点后仰 + 拉伸。
     不跟路径切线 —— 环是扁的，切角会从竖直一路甩到水平（±90°），云会翻跟头。
     横向速度在环的两侧恰好为 0、在底端最大，正好只在「真的在横着走」时才歪。 */
  leanMax: 8,            // 最大后仰（度）
  stretch: 0.09,         // 沿横向拉伸比例（垂直等量压扁，面积守恒）
  vRef: 400,             // 速度归一化基准（px/s）

  /* 雨量窗口：**云出门时不下雨**（雨滴落点是相对静止位算的，云跑远了还下着雨读作「雨从空气里来」）。
     两对 `[开始, 完成]`，单位是 **dur 的倍数** —— 改 dur 时窗口自动跟着走。
     两个窗口都必须落在 [0, 1] 之内：轨道一结束 `orbT` 置 −1、`rainOp` 直接取 1，
     窗口尾巴伸过 1 会让雨量在最后一帧**跳一下**。 */
  rainOut: [0.015, 0.075],
  rainIn: [0.88, 0.97],

  /* ---- 起跳弹 / 落地弹 ----

     口径：**弹跳与飞行重叠，不是排队**。

         点 ──┬──► 起跳弹（蹲 → 蹬 → 余韵在路途中晃完）
              └──► 出行 ─── 绕一圈 ─── 尾段**蓄力**（越近家压得越紧）──► 到家**立刻**弹一下就结束

     ⚠️ **弹跳不进 `dur`**：`dur` 仍是纯环绕 4.4 s（`HAPPY.swingDur` 对齐的是它）；
     起跳弹叠在飞行**头上**、蓄力叠在**尾上**、落地弹叠在**尾后** —— 总时长 = `dur + landDur`。

     · **起跳** `bounceWave` = `−e^(−ζωt)·sin(ωt)`：sin 起手（触发那帧不闪），
       首半波蹲、次半波蹬，尾巴在路途中晃完。
     · **落地** = **蓄力 + 释放**：最后 `landCharge` 秒用 smoothstep 渐进压扁；
       到家那一帧从**这个压扁量**起步弹出去，过冲一下再衰减回 0。
       ⚠️ 释放必须 **cos 起手** —— sin 起手 t=0 是 0，会与蓄力末端的压扁量断开
       （到家那帧云「啪」地弹回原尺寸）。
     ⚠️ `amp` 是**幅度不是峰值**：sin 起手的峰值 = `amp · e^(−πζ/2)`。
     ⚠️ 尾巴用 `1 − smoothstep((t/dur − 0.55)/0.45)` **收掉**：单靠阻尼衰减到 `dur` 时还留 2~3%
        （云高 ~74 px → 交接处会看到 1.5 px 的跳）。 */
  /* `popHop` / `landHop` 是**纵向位移**（px，正 = 往下）：蹲 / 蓄力为正，蹬 / 弹为负。
     ⚠️ 实际位移 = `hop × 波形值`，阻尼让首半波只剩 `e^(−πζ/2)`，所以给的值要比想看到的大一截。 */
  popAmp: 0.26, popHz: 3.5, popZeta: 0.22, popDur: 0.55, popHop: 16,
  landAmp: 0.16, landHz: 4.0, landZeta: 0.28, landDur: 0.45, landHop: 9,
  landCharge: 0.45,        // 蓄力时长（s）—— 落在 `dur` 的最后一段里，不是额外加的

  /* 静止漂移：两组**不成倍数**的周期 → 合成运动永不重复（所以不需要循环点） */
  driftX: [[9.3, 6.5], [14.7, 3.0]],   // [周期(s), 幅度(px)]
  driftY: [7.1, 3.5],
};

/* 轨道路径（闭合，采样成「时间 → 点」的表）
   ① 出门弧：三次贝塞尔。C2 在环右点**正上方** → 到环上时切线竖直；
             C1 **自由**，用来定起手方向（往右上拉，云先平移出去再俯冲）。
             ⚠️ C1 不能省成二次贝塞尔：二次的控制点要同时管起手方向和末端曲率，而末端曲率被 G2
             钉死，起手方向就变成 52° 朝下 —— 云还没移出芽的横向范围就降到芽的高度，从芽上面扎过去。
   ② 环    ：椭圆 θ 从 0 到 π（**顺时针**过底端）
   ③ 回程弧：三次贝塞尔，C1 在环左点正上方（离环时切线竖直）、C2 往球心那边拉（决定下潜多深）

   起点在球**右上**、终点在球**左上** → 环绕必须**顺时针**（经底端）：逆时针会先撞上头顶的小芽。 */
const P_HOME = { x: CLOUD.x, y: CLOUD.y };        // (344,170) 云的静止位（芽的正上方）
const P_RING_R = { x: CX + ORBIT.rx, y: CY };     // (485,410) 环最右点 = 出门弧终点
const P_RING_L = { x: CX - ORBIT.rx, y: CY };     // ( 75,410) 环最左点 = 回程弧起点
const RET_C2 = { x: 330, y: 320 };                // 回程弧的「往球那边拉」控制点（决定下潜多深）

/* ---- 接缝曲率匹配（G2）----
   速度剖面是 `w ∝ √R`（见下），接缝处 R 一断 → `w` 跳（读作「顿一下」）、横向加速度 v²/R 也跳。
   所以两条弧的**末端**控制点高度不是手挑的，是解出来的 —— 让弧的端点曲率恰好等于椭圆长轴端的
   曲率 `SEAM_R = ry²/rx`：
     · 出门弧：末端 R = 3d²/(2·Δx) → d = √(2·SEAM_R·Δx/3)，Δx = 环右点 x − C1.x
     · 回程弧：起端 R = 3d'²/(2·Δx) → d' = √(2·SEAM_R·Δx/3)，Δx = C2.x − 环左点 x
   代入 d ≈ 38.3、d' ≈ 91.1。

   ⚠️ 环被 `sin³θ` 扰动了，但**这里不用改**：`sin³θ` 在端点的二阶导也是 0
   → 接缝处曲率仍是 `ry²/rx`（差 O(ε²) ≈ 0.4%）。 */
const SEAM_R = ORBIT.ry ** 2 / ORBIT.rx;
/* 出门弧的**起手**控制点（自由量）。
   必须自由：静止位在**芽的正上方**，而环右点要往下 240 px、只往右 141 px —— 二次贝塞尔的控制点
   被 G2 钉在环右点正上方，起手切线只能是 52° 朝下，云还没移出芽的横向范围就降到芽的高度，
   从芽上面扎过去。拆成三次、C1 往右拉平 → 起手切线 ~3° 朝下，云先平移出去再俯冲，离芽最近 52.6 px。
   代价：进环前那一下减速更利。这是**有意的取舍** —— 换来的是不擦芽。 */
const ENTRY_C1 = { x: 440, y: 175 };
const ENTRY_C2 = { x: P_RING_R.x, y: CY - Math.sqrt(SEAM_R * 2 * (P_RING_R.x - ENTRY_C1.x) / 3) };
const RET_C1 = { x: P_RING_L.x, y: CY - Math.sqrt(SEAM_R * 2 * (RET_C2.x - P_RING_L.x) / 3) };

/** 路径的控制点（**只给探针用**：算接缝曲率、画对比图）。
 *  探针要引用这里而不是自己抄一遍，否则改了 `ENTRY_C2` 而探针还按旧值报假数据。 */
export const ORBIT_CTRL = { P_HOME, P_RING_R, P_RING_L, ENTRY_C1, ENTRY_C2, RET_C1, RET_C2 };

/* 速度剖面：**从曲率解出来**（不是手调的锚点表）。
   原则：让**横向加速度 a = v²/R 沿路径大致恒定** —— 等价于 `v ∝ √R`。读作「顿挫 / 甩」的量就是 a，
   a 恒定 = 云一直在用同一个「转向力度」走，看起来是在**滑**而不是**拐**。
   好处是「弯里慢、直道快」不再手调：改 `ENTRY_C` / `RET_C2` 之后剖面自动跟着变。
   权重必须夹在 `[W_LO, W_HI]`：回程弧中段有**拐点**（R→∞），不夹会给出无限速度。
   曲率是**二阶量**，采样噪声会被放大 → 算完要平滑一遍再喂给 `tau`。
   `NARR_*` 是唯一一处**叙事增益**：回程从球后面探出来那一段压一档，慢一点才看得见它「出来」。 */
const R_REF = 150;       // 参考曲率半径（px）—— 环两端 48.8 与环底 420 的几何中项 ≈ 143
const W_LO = 0.55;       // 权重下限（最急的弯封顶）
const W_HI = 1.45;       // 权重上限（长直道封顶）
const NARR_S = [0.78, 0.99], NARR_K = 0.15;   // 叙事减速：区间 + 压多少

/* 速度权重沿**弧长**的最大变化率（每 px）。见 `ORBIT_PATH` 里「切向加速度限制」那段 ——
   单靠曲率映射会让出门弧末端「砸」一下（不对称的 V 谷）。0.008 是扫出来的甜点：
   再收紧（0.005）切向只再降 23%，横向加速度却要涨到 1.58 —— 不值。 */
const W_SLOPE = 0.008;

/** 归一化 x → [0,1] 再走 smoothstep。
 *  `shared/easing.js` 的 `smoothstep` **不做钳位**（曲线原语，不是区间映射），越界要在这里夹掉。
 *  ⚠️ 定义必须在 `ORBIT_PATH` **之前** —— 那个 IIFE 在模块加载时就执行，放后面会踩 TDZ。 */
const ramp = (a, b, x) => smoothstep(Math.min(1, Math.max(0, (x - a) / (b - a))));

/** 三角形 bump：在 [a,b] 上从 0 升到 1 再回 0（用 smoothstep 过渡） */
function bump(x, a, b) {
  const m = (a + b) / 2;
  return x <= m ? ramp(a, m, x) : 1 - ramp(m, b, x);
}

/** 收尾窗：后 45% 收到 0 —— 保证交接处**精确**归 0，不留阻尼尾巴。
 *  ⚠️ `smoothstep` **只收一个参数**，写成 `smoothstep(0.55, 1, x)` 后两个会被**静默忽略**
 *    → 得到常数 0.575 → 弹跳幅度只剩 42%（踩过）。区间映射要自己夹。 */
const tailOff = (t, dur) => 1 - smoothstep(Math.min(1, Math.max(0, (t / dur - 0.55) / 0.45)));

/** **起跳弹**波形（归一化）：`−e^(−ζωt)·sin(ωt)`
 *  sin 起手（触发那帧不闪）→ 蹲（负 = 压扁变宽）→ 蹬（正 = 拉高变窄）→ 衰减。
 *  ⚠️ 峰值**不是** 1 而是 `e^(−πζ/2)`。 */
function bounceWave(t, dur, hz, zeta) {
  if (t <= 0) return 0;
  const w = 2 * Math.PI * hz;
  return dampedImpulse(t, -1, zeta * w, w) * tailOff(t, dur);
}

/** **落地「释放」**波形（归一化）：`e^(−ζωt)·cos(ωt)`
 *  ⚠️ **cos 起手**（t = 0 值为 **1**）：要接着蓄力末端那个压扁量往下走，从 1 开始才连续；
 *  sin 起手会在到家那一帧**啪**地弹回原尺寸。
 *  1 → 0 → 过冲到 `−e^(−πζ)` → 衰减回 0 = 「弹一下就结束」。 */
function releaseWave(t, dur, hz, zeta) {
  if (t < 0) return 1;
  const w = 2 * Math.PI * hz;
  return Math.exp(-zeta * w * t) * Math.cos(w * t) * tailOff(t, dur);
}

/** 采样好的闭合路径。
 *  `xs/ys` 点、`s` 归一化弧长、`w` 速度权重（由曲率解出）、
 *  `tau` 归一化**时间**（= 弧长 ÷ 速度的累计）、`uBehind` 切到球后那一瞬的时间比例。 */
export const ORBIT_PATH = (() => {
  const xs = [], ys = [];
  const push = (x, y) => {
    const n = xs.length;
    if (n && Math.abs(xs[n - 1] - x) < 1e-9 && Math.abs(ys[n - 1] - y) < 1e-9) return;
    xs.push(x); ys.push(y);
  };
  /* ① 出门弧：P_HOME → ENTRY_C1 → ENTRY_C2 → P_RING_R（三次贝塞尔） */
  for (let i = 0; i <= 120; i++) {
    const t = i / 120, m = 1 - t;
    push(m * m * m * P_HOME.x + 3 * m * m * t * ENTRY_C1.x + 3 * m * t * t * ENTRY_C2.x + t * t * t * P_RING_R.x,
         m * m * m * P_HOME.y + 3 * m * m * t * ENTRY_C1.y + 3 * m * t * t * ENTRY_C2.y + t * t * t * P_RING_R.y);
  }
  const iEntryEnd = xs.length - 1;     // 出门弧的终点 = 环的起点
  /* ② 环：θ 0 → π（顺时针过底端）。起点与出门弧的终点重复，跳过。
        形状 = 椭圆 + 两项 `sin³θ` 扰动（半径起伏 + 平面倾斜），见 ORBIT 里那段。 */
  const tiltK = ORBIT.ringTilt * Math.PI / 180;
  for (let i = 1; i <= 180; i++) {
    const th = Math.PI * i / 180;
    const st = Math.sin(th), s3 = st * st * st;
    const wr = 1 + ORBIT.wobRX[0] * s3 + ORBIT.wobRX[1] * s3 * Math.cos(th);
    const hr = 1 + ORBIT.wobRY[0] * s3 + ORBIT.wobRY[1] * s3 * Math.cos(th);
    const ux = ORBIT.rx * wr * Math.cos(th);
    const uy = ORBIT.ry * hr * st;
    const a = tiltK * s3, ca = Math.cos(a), sa = Math.sin(a);
    push(CX + ux * ca - uy * sa, CY + ux * sa + uy * ca);
  }
  const iRingEnd = xs.length - 1;      // 环的终点 = 回程弧的起点
  /* ③ 回程弧：P_RING_L → C1 → C2 → P_HOME */
  for (let i = 1; i <= 140; i++) {
    const t = i / 140, m = 1 - t;
    push(m * m * m * P_RING_L.x + 3 * m * m * t * RET_C1.x + 3 * m * t * t * RET_C2.x + t * t * t * P_HOME.x,
         m * m * m * P_RING_L.y + 3 * m * m * t * RET_C1.y + 3 * m * t * t * RET_C2.y + t * t * t * P_HOME.y);
  }
  const n = xs.length;

  /* ---- 弧长（归一化） ---- */
  const s = [0];
  for (let i = 1; i < n; i++) {
    s.push(s[i - 1] + Math.hypot(xs[i] - xs[i - 1], ys[i] - ys[i - 1]));
  }
  const len = s[n - 1];
  for (let i = 0; i < n; i++) s[i] /= len;
  const sEntryEnd = s[iEntryEnd], sBehind = s[iRingEnd];

  /* ---- 逐点曲率：三点**外接圆**（对不等距采样也准，是折线的精确曲率） ---- */
  const kap = new Array(n).fill(0);
  for (let i = 1; i < n - 1; i++) {
    const a = Math.hypot(xs[i] - xs[i - 1], ys[i] - ys[i - 1]);
    const b = Math.hypot(xs[i + 1] - xs[i], ys[i + 1] - ys[i]);
    const c = Math.hypot(xs[i + 1] - xs[i - 1], ys[i + 1] - ys[i - 1]);
    const area = Math.abs((xs[i] - xs[i - 1]) * (ys[i + 1] - ys[i - 1])
                        - (xs[i + 1] - xs[i - 1]) * (ys[i] - ys[i - 1])) / 2;
    kap[i] = (a > 1e-9 && b > 1e-9 && c > 1e-9) ? 4 * area / (a * b * c) : 0;
  }
  kap[0] = kap[1]; kap[n - 1] = kap[n - 2];

  /* ---- 权重 = √(R / R_REF)，夹紧，再乘叙事增益 ---- */
  let w = new Array(n);
  for (let i = 0; i < n; i++) {
    const R = kap[i] > 1e-12 ? 1 / kap[i] : Infinity;
    const base = Math.min(W_HI, Math.max(W_LO, Math.sqrt(R / R_REF)));
    w[i] = base * (1 - NARR_K * bump(s[i], NARR_S[0], NARR_S[1]));
  }
  /* 平滑（曲率是二阶量，采样噪声会传进来）—— 3 点滑动平均跑两遍 */
  for (let pass = 0; pass < 2; pass++) {
    const nw = w.slice();
    for (let i = 1; i < n - 1; i++) nw[i] = (w[i - 1] + w[i] + w[i + 1]) / 3;
    w = nw;
  }

  /* ---- 切向加速度限制（双向 look-ahead）----
     为什么需要：`w` 是**逐点**从曲率算的，而三次贝塞尔端点 `dκ/ds ≠ 0`，椭圆长轴端却 `dκ/dθ = 0`
     → 速度在接缝处**砸下去**（实测减速 0.21 s，环上再升回来要 0.63 s），不对称的 V 谷 = 「顿一下」。
     做法：按**弧长**限住 `|dw/ds|`，从两端往中间扫两遍（反向管减速、正向管加速）——
     减速提前开始、加速延后结束，V 谷变成对称的缓变。
     代价：弯道附近横向加速度 `a_n = v²/R` 略增。切向的折角比横向的略高刺眼得多，这是有意的取舍。 */
  for (let pass = 0; pass < 2; pass++) {
    for (let i = n - 2; i >= 0; i--) {          // 反向：减速能力
      const cap = w[i + 1] + W_SLOPE * (s[i + 1] - s[i]) * len;
      if (w[i] > cap) w[i] = cap;
    }
    for (let i = 1; i < n; i++) {               // 正向：加速能力
      const cap = w[i - 1] + W_SLOPE * (s[i] - s[i - 1]) * len;
      if (w[i] > cap) w[i] = cap;
    }
  }
  /* look-ahead 是取 min，会在「谁在限制」的切换处留个折角 → 再抹一遍 */
  {
    const nw = w.slice();
    for (let i = 1; i < n - 1; i++) nw[i] = (w[i - 1] + w[i] + w[i + 1]) / 3;
    w = nw;
  }

  /* ---- 时间轴：tau = Σ ds / w ---- */
  const tau = [0];
  for (let i = 1; i < n; i++) {
    const ds = (s[i] - s[i - 1]) * len;
    tau.push(tau[i - 1] + ds / ((w[i] + w[i - 1]) / 2));
  }
  const tTot = tau[n - 1];
  for (let i = 0; i < n; i++) tau[i] /= tTot;

  /** 弧长比例 → 速度权重（线性插值）。探针用：拿来看「快慢」调得对不对。 */
  const speedAt = (v) => {
    if (v <= 0) return w[0];
    if (v >= 1) return w[n - 1];
    let lo = 0, hi = n - 1;
    while (hi - lo > 1) { const mid = (lo + hi) >> 1; if (s[mid] <= v) lo = mid; else hi = mid; }
    const k = (v - s[lo]) / (s[hi] - s[lo] || 1);
    return w[lo] + (w[hi] - w[lo]) * k;
  };

  return {
    xs, ys, s, w, tau, n, len,
    sEntryEnd, sBehind,        // 三段在弧长轴上的两个分界
    uBehind: tau[iRingEnd],    // 切到球后那一瞬的**时间**比例
    speedAt,                   // 探针用
  };
})();

/* ---- 松手 → 变「开心」表情（素材与落点见上面那段）----

   ⚠️ `happyT` 从**松手**那帧起算，不是按下 —— 按下只做预备，结果全在松手给出。

   时间线（秒）：
     0 ──rise──► happyW = 1                交叉淡入（三态眼 × (1−happyW)、开心图 × happyW）
     0 ──swingDur──► 左右摆                 走 `HAPPY_PATH`
     swingDur + hold ──fall──► happyW = 0   缓缓变回原表情

   `swingDur` 与云绕一圈对齐，所以「脸摆完」和「云回家」是同一帧。
   为什么要「摆」而不是直接换上：静态换脸读作「贴图变了」，摆一下才读作「它高兴了」。

   **轨迹只把粗糙做顺，不换路径**（试过一版按解析式重画，改掉了路径，作废）。
   原始数据（`_draft/motion-sketch.html` → `_user-motion.json`，68 样本 / 4.766 s）粗糙在两处：
   ① **0.8 px 台阶**（演示台显示宽度和 viewBox 不是 1:1，鼠标 clientX 又是整数 → 记录值被量化，
   相邻样本跳一格就是 230 px/s 的**假速度**，真实手速只有 10~60 px/s）；
   ② **呆滞**（4.766 s 里有 2.51 s 位移不到 1 px）。
   处理链（`_draft/_happy-fit.py`，改参数重跑即可）：掐掉前面的空等 → 末尾用 Hermite 补回原位
   （不补的话摆动一结束脸会「啪」地弹回中线）→ 240 Hz 重采样 + 高斯平滑 σ = 120 ms
   → **加性抬谷**（新速度 ≈ 原速度 + 0.80 × 平均速度）→ 缩放到 4.4 s → 等间隔取 48 点。
   ⚠️ 三个坑：σ 太小会在折返处把 Catmull-Rom 的切线**压塌**（产品爬得比手还慢）、σ 太大会削掉
   那几下 30~70 ms 的「跳」；别用「时间 / 弧长混合」去呆滞（等价于给速度封顶，谷值照样在）；
   对称高斯会把起点拉离原位，要在 3σ 内把偏差平滑地还回去。

   倾角 `rotPerPx · dx`（往哪边挪就朝哪边歪）= 「点头」。**没有这一项就只是平移，读不出点头**。
   支点用 `FACE_C`（脸心）—— 必须落在**脸自己身上**，放球心会额外把脸平推。

   整颗球跟着歪 `ballRot ≈ tiltK · happyRot`：球体与小芽绕**球心**转同一个角度，大陆、云纹一起动。
   ⚠️ 它**不是等号**，是**一阶滞后**（`ballLag`）—— 脸的倾角先出、球体慢半个身位，只读出先后。
   ⚠️ 五官**不进**那个旋转组：它自己已经有同角度的倾斜，再进组会多吃一次绕球心的弧位移，把轨迹顶偏。 */
export const HAPPY = {
  rise: 0.24,            // 表情淡入（秒）—— 用户口径「约 200~250 ms」
  swingDur: ORBIT.dur,   // 摆动时长 = 云绕一圈的时长（4.4 s）—— 两个动作同时起、同时收
  rotPerPx: 0.66,        // 倾角 / 横向位移（度每 px）—— 实测最大 13.3 px → 8.8°
  tiltK: 1,              // 整颗球跟着歪的比例（1 = 球面最终与五官同角度）
  ballLag: 0.12,         // 球面点头比表情晚跟上（秒，一阶滞后的时间常数）
  hold: 0.30,            // 摆完停一下再退（秒）
  fall: 0.95,            // 缓缓变回原表情（秒）
};

/** 「开心」动作的轨迹表：**归一化时间等间隔**的 48 个点（单位 viewBox px，y 向下为正）。
 *  来源 `_draft/_happy-fit.py`（见上面那段）。⚠️ 点数别少于 40：32 点时 Catmull-Rom 会在 V 形
 *  拐点**多压出一个假停顿**（那是插值的事，不是路径的事）。**改这张表要连注释一起改。** */
export const HAPPY_PATH = {
  dx: [
    0, -1.07, -2.27, -3.42, -4.36, -5.05, -5.65, -6.31, -7.06, -7.71, -7.98, -7.63, -6.78,
    -5.54, -4.05, -2.45, -0.83, 0.66, 1.82, 2.3, 2.39, 2.49, 2.91, 3.66, 4.75, 6.07,
    7.45, 8.75, 9.99, 11.18, 12.22, 12.94, 13.27, 13.05, 12.36, 11.51, 10.48, 9.43, 8.48,
    7.81, 7.19, 6.39, 5.43, 4.38, 3.25, 2.05, 0.91, 0,
  ],
  dy: [
    0, -1.55, -3.33, -4.99, -6.24, -6.78, -6.3, -5.22, -3.94, -2.92, -3.17, -4.02, -5.11,
    -6.42, -7.74, -8.82, -9.5, -9.75, -9.47, -8.44, -7.14, -6.24, -7.4, -9.08, -10.93, -12.62,
    -13.87, -14.54, -14.68, -14.28, -13.31, -11.99, -10.74, -10.01, -10, -10.1, -10.41, -10.9, -11.21,
    -10.54, -9.14, -7.3, -5.33, -3.56, -2.15, -1.12, -0.42, 0,
  ],
};

/** Catmull-Rom 查表：归一化时间 τ ∈ [0,1] → 表上的点（写进复用对象，跑在 rAF 里）。
 *  表**等间隔**，用均匀参数化即可。端点靠**镜像外推**补两个虚拟点（不补的话首尾两段退化成直线）。 */
const happyPt = { x: 0, y: 0 };
function happyAt(tau) {
  const { dx, dy } = HAPPY_PATH;
  const n = dx.length;
  if (tau <= 0) { happyPt.x = dx[0]; happyPt.y = dy[0]; return happyPt; }
  if (tau >= 1) { happyPt.x = dx[n - 1]; happyPt.y = dy[n - 1]; return happyPt; }
  const u = tau * (n - 1);
  const i = Math.min(n - 2, Math.floor(u));
  const s = u - i, s2 = s * s, s3 = s2 * s;
  /* 越界只可能差一格（i ≥ 0 且 i + 2 ≤ n），所以只处理 −1 与 n 两种 */
  const a = (j) => (j < 0 ? 2 * dx[0] - dx[1] : j > n - 1 ? 2 * dx[n - 1] - dx[n - 2] : dx[j]);
  const b = (j) => (j < 0 ? 2 * dy[0] - dy[1] : j > n - 1 ? 2 * dy[n - 1] - dy[n - 2] : dy[j]);
  const p0 = a(i - 1), p1 = a(i), p2 = a(i + 1), p3 = a(i + 2);
  const q0 = b(i - 1), q1 = b(i), q2 = b(i + 1), q3 = b(i + 2);
  happyPt.x = 0.5 * (2 * p1 + (-p0 + p2) * s + (2 * p0 - 5 * p1 + 4 * p2 - p3) * s2
                   + (-p0 + 3 * p1 - 3 * p2 + p3) * s3);
  happyPt.y = 0.5 * (2 * q1 + (-q0 + q2) * s + (2 * q0 - 5 * q1 + 4 * q2 - q3) * s2
                   + (-q0 + 3 * q1 - 3 * q2 + q3) * s3);
  return happyPt;
}

/** 梯形速度曲线的**解析积分**：归一化时间 u ∈ [0,1] → 已走过的弧长比例。
    前 `e` 段加速到 1、后 `e` 段减速回 0、中间匀速 —— 速度连续，两端为 0。
    归一化分母是 (1 − e)：∫smoothstep = 1/2，所以总面积 = e/2 + (1−2e) + e/2 = 1 − e。 */
function easeDist(u, e = ORBIT.ease) {
  if (u <= 0) return 0;
  if (u >= 1) return 1;
  if (u < e) { const x = u / e; return e * (x * x * x - x * x * x * x / 2) / (1 - e); }
  if (u <= 1 - e) return (e / 2 + (u - e)) / (1 - e);
  const x = (1 - u) / e;
  return 1 - e * (x * x * x - x * x * x * x / 2) / (1 - e);
}

/** 归一化**时间** u ∈ [0,1] → 路径上的点（查 `tau` 表，表里已经含速度剖面）。
 *  写进复用对象，避免每帧新建（跑在 rAF 里）。
 *  查的是 `tau`（时间）不是 `s`（弧长）—— 用 s 查就等于匀速，速度剖面白给。 */
const orbitPt = { x: 0, y: 0, s: 0 };
function orbitAt(u) {
  const { xs, ys, s, tau, n } = ORBIT_PATH;
  if (u <= 0) { orbitPt.x = xs[0]; orbitPt.y = ys[0]; orbitPt.s = s[0]; return orbitPt; }
  if (u >= 1) { orbitPt.x = xs[n - 1]; orbitPt.y = ys[n - 1]; orbitPt.s = s[n - 1]; return orbitPt; }
  let lo = 0, hi = n - 1;
  while (hi - lo > 1) { const mid = (lo + hi) >> 1; if (tau[mid] <= u) lo = mid; else hi = mid; }
  const t = (u - tau[lo]) / (tau[hi] - tau[lo] || 1);
  orbitPt.x = xs[lo] + (xs[hi] - xs[lo]) * t;
  orbitPt.y = ys[lo] + (ys[hi] - ys[lo]) * t;
  orbitPt.s = s[lo] + (s[hi] - s[lo]) * t;
  return orbitPt;
}

/* 雨：纯 SVG 小水滴（不需要额外素材）。落点**相对云中心**算 —— 云会横向漂移，雨要跟着一起挪。
   ⚠️ 给的是**相对地球**的 viewBox 坐标，而 `#earthRain` 挂在 `#earthBreath` **外面** ——
   所以纵向落点不会被呼吸乘一遍、也不会被点击压扁。改 DOM 层级时要连这里一起看。 */
export const RAIN = {
  count: 5,
  halfW: 42,                     // 落点相对云中心的横向半宽
  yTop: 147, yBottom: 299,
  speed: 0.46,                   // 每秒走完的比例
};

/* 水滴形状：尖端朝上、底部圆（下落的雨滴）。原点在形状重心附近，
   所以每帧只要 translate(落点) scale(大小) 即可。 */
export const DROP_D = 'M0 -3.6 C1.55 -1.5 2 -0.3 2 0.7 A2 2 0 0 1 -2 0.7 C-2 -0.3 -1.55 -1.5 0 -3.6 Z';

/* 参数 */
export const EARTH = {
  /* 呼吸：不对称（吸快呼慢），悬停时周期变短 */
  breathDur: 3.2,
  breathS: 0.010,
  bobAmp: 3.4,
  hoverBreath: 0.72,

  /* 整体摆动：球体轻微左右倾 + 上下浮动，周期**刻意不成倍数**，避免几秒后锁相。 */
  swayRot: 1.35,        // ±1.35°
  swayDur: 4.6,

  /* 小芽：两片叶绕**同一圆心**整体摆，且跟着地球的摆动走（同周期、略滞后）——
     这样才读得出「芽是长在球上的」。幅度比球体大，呼应「越靠外摆得越多」。 */
  sproutSway: 4.2,
  sproutLag: 0.35,      // 相位滞后（秒）：芽比球体晚一点跟上

  /* 云：只留呼吸缩放（跟地球同周期）。**漂移与轨道路径在 ORBIT 里**。 */
  cloudBreath: 0.05,

  /* 悬停 / 按压：**按下只做预备，结果放在松手**（见 index.js 的 bindPointerInput）。 */
  hoverLift: -9,
  pressSquash: 0.86,       // 压到位时的纵向比例
  pressWiden: 1.09,        // 压到位时的横向比例
  pressRate: 20,           // 按压逼近速率（1/s）：90 ms 到 84%、140 ms 到 94%

  /* 松手回弹：一次冲激 + 指数衰减，叠加在挤压上（正 = **拉高变瘦**，与压扁反号）。
     ⚠️ 幅度要和压扁量**同量级**才有「弹」：松手那一刻球还压着 14%，冲激得先补回来再冲过头。
     给 0.05 的话净过冲只有 0.4%，等于没弹（踩过）。
     `ζ = 0.45` 时第二下只剩第一下的 `e^(−πζ) ≈ 24%` —— 「弹一下、一下收住」。 */
  reboundAmp: 0.12,        // 幅度（相对尺寸）
  reboundHz: 2.8,          // 频率（Hz）
  reboundZeta: 0.45,       // 阻尼比
  reboundDur: 0.80,        // 总时长（秒）

  /* 松手时两片叶的甩动：一次冲激 + 指数衰减。
     ⚠️ 比球体回弹**晚 `whipDelay` 起摆**（球先弹、叶再跟）。
     ⚠️ 频率别给高：4.6 Hz / ζ0.16 是「高频抖好几下」，嫌突兀；2.1 Hz / ζ0.42 是「一次有收尾的轻弹」。 */
  whipAmp: 6.0,        // 冲激幅度（度）
  whipHz: 2.1,         // 振荡频率
  whipZeta: 0.42,      // 阻尼比
  whipDur: 1.25,       // 冲激总时长（秒）
  whipDelay: 0.12,     // 起摆延迟（秒），比球体回弹晚

  /* 眨眼 */
  blinkMin: 2.5, blinkMax: 6.0,
  blinkFirstMin: 1.4, blinkFirstMax: 3.2,
  blinkCloseF: 5, blinkHoldF: 1, blinkOpenF: 3,
};

/** 一次眨眼的总时长（秒）：闭 5 帧 + 保持 1 帧 + 睁 3 帧。
 *  和 `shared/blink.js` 内部算的 `dur` 是同一个式子，改帧数时两处自动一致。 */
export const BLINK_DUR = (EARTH.blinkCloseF + EARTH.blinkHoldF + EARTH.blinkOpenF) / 60;

/**
 * 建一个地球的动画实例（**纯计算，不碰 DOM**）。
 *
 * 有状态的部分全在这里：悬停 / 按压权重、叶子的冲激时钟、眨眼计时器、每颗雨滴随机的
 * 落点 / 大小 / 速度 / 相位。所以同一份参数能跑多个实例，互不干扰。
 * 地球**没有状态机**（全是程序化正弦，不是关键帧表），所以不搬太阳那套「状态互斥 + 混合器」。
 *
 * @param rand 随机源（默认 Math.random）。测试时塞一个确定性 PRNG 就能复现同一帧。
 */
export function createEarthAnim({ rand = Math.random } = {}) {
  /* 雨滴：每颗有自己的落点 / 大小 / 速度 / 相位。记的是**相对云中心**的横向偏移，
     这样云横向漂移时整片雨跟着挪，不会「云走了雨还留在原地」。 */
  const drops = [];
  for (let i = 0; i < RAIN.count; i++) {
    drops.push({
      dx: -RAIN.halfW + rand() * RAIN.halfW * 2,
      phase: rand(),
      sc: 0.90 + rand() * 0.40,          // 大小不齐，免得像排队的点
      wob: 0.5 + rand() * 1.1,           // 横向微摆幅度
      speed: RAIN.speed * (0.82 + rand() * 0.36),
    });
  }
  /* 每帧复用的输出槽（不每帧新建对象 —— 这个循环跑在 rAF 里） */
  const frame = drops.map(() => ({ x: 0, y: 0, sx: 0, sy: 0, op: 0 }));

  /* 交互状态（权重向目标逼近，不用 snap） */
  let hoverW = 0, pressW = 0;
  /* 松手回弹的冲激时钟：<0 = 没在弹 */
  let reboundT = -1;
  /* 球面点头的**滞后**值（见 step 里那段）：一阶跟随 happyRot，不直接等号 */
  let ballRotW = 0;
  /* 叶子甩动的冲激时钟：<0 = 没在甩。⚠️ 从 0 起算，`whipDelay` 之内不出位移 */
  let whipT = -1;
  /* 云的轨道（见 ORBIT）。`orbT` = 动作时钟，**`null` = 停在家**，否则从 `0` 走到
     `ORBIT.dur + ORBIT.landDur`。⚠️ 起跳弹 / 蓄力都**叠在 `dur` 里面**，不是额外占一段时间。
     `prevDX` / `prevDY` = 上一帧的**轨道位移**，用来差分出速度
     （不拿含漂移的总位移差分 —— 那样静止位会一直有 ~40 px/s 假速度）。 */
  let orbT = null;
  let prevDX = 0, prevDY = 0;
  /* 「开心」表情：`happyT` = 时钟（<0 = 没在播）；`happyP` = 淡入淡出**进度**（自己积分，见 step()）。 */
  let happyT = -1;
  let happyP = 0;

  /* 眨眼计时器（逐实例）。时序走 `src/shared/blink.js`；曲线用地球自己的两条（smoothstep 闭合 /
     二次 ease-out 张开，和太阳那两条贝塞尔不是一个形状，所以显式传进去）。
     地球**悬停时也照常眨**，所以 step 的 active 恒为 true。 */
  const blink = createBlinkLayer({
    closeF: EARTH.blinkCloseF, holdF: EARTH.blinkHoldF, openF: EARTH.blinkOpenF,
    min: EARTH.blinkMin, max: EARTH.blinkMax,
    firstMin: EARTH.blinkFirstMin, firstMax: EARTH.blinkFirstMax,
    easeIn: smoothstep, easeOut: easeOutQuad,
    rand,
  });

  let t = 0;
  /* 呼吸相位**累加器**（0~1 循环）。见 step() 里「相位必须累加」那段 ——
     不能写成 `(t % dur) / dur`：`dur` 被 hoverW 连续调制，用绝对 t 取模会在悬停过渡期整圈乱跳。 */
  let breathPh = 0;

  /**
   * 推进一帧，返回这一帧要写进 DOM 的**全部数值**（本函数不碰 DOM）。
   * `drops` 是复用的数组，调用方要立刻写进属性、不要跨帧存着。
   */
  function step(dt, { hovered = false, pressed = false } = {}) {
    t += dt;

    /* 权重逼近（与帧率无关）。`pressRate` 高 → 按下去 ~90 ms 就读满「轻微压缩」，
       所以按下的预备感是**独立的一拍**，不会拖到松手之后。 */
    hoverW = approach(hoverW, hovered ? 1 : 0, 10, dt);
    pressW = approach(pressW, pressed ? 1 : 0, EARTH.pressRate, dt);

    /* 呼吸：悬停时周期变短（读起来是「兴奋了一点」）。
       ⚠️ **相位必须累加**，不能写 `ph = (t % dur) / dur`：`dur` 被 hoverW **连续调制**，
       用绝对时间取模时 `dur` 每变一点就可能整圈重来 → `wave` 在悬停过渡期高频乱跳
       （`wave` 同时喂呼吸缩放与上下浮动，所以球会一边抖一边脉动）。页面开得越久越明显。 */
    const dur = EARTH.breathDur * (1 - (1 - EARTH.hoverBreath) * hoverW);
    breathPh += dt / dur;
    breathPh -= Math.floor(breathPh);
    const ph = breathPh;
    /* 不对称：吸快、呼慢（和太阳同一套读法） */
    const wave = ph < 0.42 ? Math.sin((ph / 0.42) * Math.PI / 2) : Math.cos(((ph - 0.42) / 0.58) * Math.PI / 2);
    const bs = EARTH.breathS * wave;

    /* 按压 + 松手回弹。挤压与拉伸**反号**：压下去矮胖、弹回来高瘦。
       回弹是**额外**叠上去的（`pressW` 自己还在按 `pressRate` 往回走）—— 两个叠加才读得出
       「先被压住、再弹一下站住」。 */
    let rebound = 0;
    if (reboundT >= 0) {
      reboundT += dt;
      const rw = 2 * Math.PI * EARTH.reboundHz;
      rebound = dampedImpulse(reboundT, EARTH.reboundAmp, EARTH.reboundZeta * rw, rw);
      if (reboundT >= EARTH.reboundDur) reboundT = -1;
    }
    const sq = 1 - (1 - EARTH.pressSquash) * pressW + rebound;
    const wd = 1 + (EARTH.pressWiden - 1) * pressW - rebound;

    /* 整体摆动：和呼吸**不同周期**，故意不成倍数 */
    const sway = Math.sin((t / EARTH.swayDur) * Math.PI * 2) * EARTH.swayRot;

    const bobY = -EARTH.bobAmp * wave + EARTH.hoverLift * hoverW;

    /* 松手甩动：一次冲激 + 指数衰减（叶子被震一下）。
       地球这里用**同一个 ω 既做衰减又做振荡**，和太阳那边的阻尼振子不是一套语义 —— 见 impulse.js。
       ⚠️ `whipDelay` 之内**不出位移**（时钟照走），所以叶子比球体回弹晚起摆；
       结束点也要跟着往后挪，否则会把尾巴切掉一半。 */
    let whip = 0;
    if (whipT >= 0) {
      whipT += dt;
      const a = whipT - EARTH.whipDelay;
      if (a > 0) {
        const w = 2 * Math.PI * EARTH.whipHz;
        whip = dampedImpulse(a, EARTH.whipAmp, EARTH.whipZeta * w, w);
      }
      if (whipT >= EARTH.whipDelay + EARTH.whipDur) whipT = -1;
    }

    /* 云：**点一下 → 弹（与出行同帧起跑）→ 绕地球一圈 → 尾段蓄力 → 到家立刻弹一下就结束**。
       时钟 `orbT` 从 `0` 走到 `dur + landDur`：

         [0, dur)               绕一圈。`uPath = easeDist(orbT / dur)`；
                                头 `popDur` 上叠**起跳弹**，尾 `landCharge` 上叠**蓄力**
         [dur, dur + landDur)   到家那一帧立刻释放：从蓄力末端的压扁量起步，过冲一下再衰减回 0

       两个参数各管一件事，**别混**：`easeDist(u)` = 起停（两端速度为 0 → 静止位不歪、不拉伸）、
       `tau` 表 = 快慢（弯里慢、直道快）。`orbitAt` 收的是**时间**比例，所以喂 `easeDist` 的结果。
       ⚠️ 到家之后 `uPath` 取 **0 不是 1**：路径闭合 → 两点位移都是 0，但 `behind` 判的是
       `uPath > uBehind` —— 取 1 会把释放那一下画在球体**后面**。
       ⚠️ 起跳弹与蓄力**不会撞车**：`popDur`(0.55) 远小于 `dur − landCharge`(3.95)。 */
    let orbitU = 0, uPath = 0, bounce = 0, bounceDY = 0;
    if (orbT !== null) {
      orbT += dt;
      if (orbT < ORBIT.dur) {
        orbitU = orbT / ORBIT.dur;
        uPath = easeDist(orbitU);
        /* 起跳弹：**与出行同帧起跑**。飞行的起停缓动本身就慢（ease 0.14 × 4.4 s ≈ 0.62 s 才加速完），
           所以蹲 / 蹬那两下恰好落在「还看得见它在家门口」的那段里，读作「点-弹-走」。 */
        const bw = bounceWave(orbT, ORBIT.popDur, ORBIT.popHz, ORBIT.popZeta);
        /* 蓄力：最后 `landCharge` 秒用 smoothstep 渐进压扁（0 → −1，负 = 压扁变宽）。 */
        const cw = -ramp(ORBIT.dur - ORBIT.landCharge, ORBIT.dur, orbT);
        bounce = ORBIT.popAmp * bw + ORBIT.landAmp * cw;
        bounceDY = -(ORBIT.popHop * bw + ORBIT.landHop * cw);
      } else {
        /* 释放段没有「轨道进度」可言，`orbitU` 钉在 1 —— 它是**进度**语义
           （0 = 还在家，1 = 一圈已走完），不是弧长位置。探针拿 `orbitU > 0` 当「这一趟还没收工」。 */
        orbitU = 1;
        /* 释放：从蓄力末端那个压扁量**起步**（cos 起手 → t=0 值为 1，与 `cw = −1` 接得上）。 */
        const rw = releaseWave(orbT - ORBIT.dur, ORBIT.landDur, ORBIT.landHz, ORBIT.landZeta);
        bounce = -ORBIT.landAmp * rw;
        bounceDY = ORBIT.landHop * rw;
        if (orbT >= ORBIT.dur + ORBIT.landDur) orbT = null;
      }
    }
    const pt = orbitAt(uPath);
    /* ⚠️ `orbitS` 与 `orbitU` **不是同一把尺**：前者是闭合路径上的**弧长位置**（到家后回 0，
       因为路径首尾同点），后者是时间**进度**。所以释放段会出现「`orbitU` = 1 而 `orbitS` = 0」。
       探针分段 / 反查曲率用 `orbitS`，判「在不在飞」用 `orbitU`。 */
    const orbitS = pt.s;                 // 弧长比例（探针用它分段，不参与运动）
    const orbDX = pt.x - CLOUD.x;
    const orbDY = pt.y - CLOUD.y;
    /* 回程段（环的左端之后）走**球体下层** —— 由 index.js 切 #earthCloudBack / Front。
       判据用**时间**比例 `uBehind`（不是弧长 `sBehind`）—— `uPath` 就在时间轴上。 */
    const behind = uPath > ORBIT_PATH.uBehind;

    /* 速度：由**轨道位移**差分。两端为 0 → 静止位恒为 0，所以「不动的时候不歪、不拉伸」还成立。
       dt 可能被 clampDt 钳到 0.1 s（切标签页回来），除下去会得到假的大速度。 */
    const invDt = dt > 1e-3 ? 1 / dt : 0;
    const cloudVX = (orbDX - prevDX) * invDt;
    const cloudVY = (orbDY - prevDY) * invDt;
    prevDX = orbDX; prevDY = orbDY;

    /* 小芽的叶：**茎不动**，只有两片叶摆。两份叶吃**同一份**角度 —— 绕同一个圆心、同一个角度，
       所以中间永不裂。静态倾角 rot 和摆动叠加后再一起绕圆心（不是各转各的）。点击时再叠 whip。 */
    const leafA = SPROUT.rot +
      Math.sin(((t - EARTH.sproutLag) / EARTH.swayDur) * Math.PI * 2) * EARTH.sproutSway +
      whip;

    /* 云的位置与形变：位置 = **静止漂移(t) + 轨道位移(t)**。
       漂移是两组**不成倍数**的周期 → 合成运动永不重复；轨道位移两端都是 0
       → 出门 / 回家都**恰好**落在漂移当时该在的位置上。 */
    const driftXX = ORBIT.driftX
      .reduce((s, [p, a]) => s + Math.sin((t / p) * Math.PI * 2) * a, 0);
    const driftYY = Math.sin((t / ORBIT.driftY[0]) * Math.PI * 2) * ORBIT.driftY[1];
    const cloudX = CLOUD.x + driftXX + orbDX;
    const cloudY = CLOUD.y + driftYY + orbDY + bounceDY;
    /* 雨只跟**静止位 + 漂移**，不跟轨道位移 —— 否则云绕到球那边，雨也跟着横移。 */
    const rainX = CLOUD.x + driftXX;

    /* 倾角：**后仰**（顶部朝来路）—— 按**横向**速度归一化。不跟路径切线：环是扁的，
       切角会从竖直甩到水平（±90°），云会翻跟头。横向速度在环的两侧恰好为 0、底端最大，
       所以只在「真的在横着走」时才歪。 */
    const cloudRot = -ORBIT.leanMax * Math.max(-1, Math.min(1, cloudVX / ORBIT.vRef));
    /* 拉伸：沿**横向**拉长、垂直方向等量压扁（面积守恒）。同理由横向速度定强度。 */
    const stretchN = Math.min(1, Math.abs(cloudVX) / ORBIT.vRef);
    const cloudStretch = 1 + ORBIT.stretch * stretchN;
    const cloudS = CLOUD.k * (1 + EARTH.cloudBreath * wave);
    /* 弹跳的挤压：**纵向**缩放 `1 + bounce`（正 = 拉高变窄），横向等量反号 → 面积守恒。
       与 `cloudStretch` 是**两件事**，叠在一起（飞行中同时被拉扁 + 起跳时被压扁）。 */
    const cloudBounce = 1 + bounce;

    /* 雨量：**云出门时不下雨** —— 雨滴落点是相对静止位算的，云跑远了还下着雨读作「雨从空气里来」。
       窗口按 `dur` 的倍数给，改 dur 自动跟着走。两段 ramp 直接相减即可：
       `1 − 收雨 + 复雨` 在 o1~i0 之间恒为 0、在 i1 之后恒为 1。
       ⚠️ 窗口只在「真的在飞」那段（`orbT ∈ [0, dur)`）生效：到家后的释放段云已经回家，雨该照下。 */
    let rainOp = 1;
    if (orbT !== null && orbT >= 0 && orbT < ORBIT.dur) {
      const [o0, o1] = ORBIT.rainOut;
      const [i0, i1] = ORBIT.rainIn;
      rainOp = 1 - ramp(o0 * ORBIT.dur, o1 * ORBIT.dur, orbT)
                 + ramp(i0 * ORBIT.dur, i1 * ORBIT.dur, orbT);
    }

    /* 点击变「开心」：交叉淡入 + 左右摆 + 缓缓退回（时间线见 HAPPY 那段）。

       淡入淡出**积分** `happyP`（进度 0~1，线性推进），输出前过一遍 `smoothstep` ——
       不写成 `ramp(0, rise, happyT)` 那种「时间的闭式」：闭式的进度只由时钟决定，
       淡出中途再点一次就只能把时钟归零 → `happyW` 从当前值**瞬间掉到 0**（脸闪一下原表情）。
       积分的进度可以停在任意位置往回走，接着爬就行。
       摆动仍用闭式，但 `triggerHappy` 在**摆动还没走完时直接不打断** —— 归零会让位移跳回中线。 */
    let happyDX = 0, happyDY = 0, happyRot = 0;
    if (happyT >= 0) {
      happyT += dt;
      const outStart = HAPPY.swingDur + HAPPY.hold;
      const dir = happyT < outStart ? 1 : -1;
      const span = dir > 0 ? HAPPY.rise : HAPPY.fall;
      happyP = Math.max(0, Math.min(1, happyP + dir * dt / span));

      if (happyT < HAPPY.swingDur) {
        /* 轨迹直接查 `HAPPY_PATH`（用户演的轨迹做顺，见 HAPPY 那段）——
           τ = 0 起手、τ = 1 回到原位，所以到点不会跳。 */
        const pt = happyAt(happyT / HAPPY.swingDur);
        happyDX = pt.x;
        happyDY = pt.y;
        /* 往哪边挪就朝哪边歪 = 「点头」 */
        happyRot = HAPPY.rotPerPx * pt.x;
      }
      if (happyT >= outStart + HAPPY.fall) happyT = -1;
    }

    /* 球面点头：**比表情晚跟上** —— 一阶滞后跟随，所以脸的倾角先出、球体的倾角慢半个身位。
       直接等号（`ballRot = happyRot · tiltK`）读起来是整块一起转，缺这层先后关系。
       ⚠️ 指数逼近**永远到不了 0**，所以低于阈值时吸附归零：不吸附的话结尾会留一个
       1e-4 量级的残余，「结尾精确归 0」那条判据会红（而那个残余本身看不见）。 */
    ballRotW = approach(ballRotW, happyRot * HAPPY.tiltK, 1 / HAPPY.ballLag, dt);
    if (Math.abs(ballRotW) < 0.01) ballRotW = 0;
    const ballRot = ballRotW;
    const happyW = smoothstep(happyP);

    /* 雨：每颗从云底落到芽顶，头尾各 15% 淡入淡出；下落时纵向拉长、横向略收。
       ⚠️ 这些是**相对地球**的 viewBox 坐标；`#earthRain` 不在呼吸组里，
       所以「雨不呼吸」是靠 **DOM 层级**实现的，这里不用做任何补偿。 */
    for (let i = 0; i < drops.length; i++) {
      const d = drops[i];
      const p = (t * d.speed + d.phase) % 1;
      const o = frame[i];
      o.x = rainX + d.dx + Math.sin((t * 1.6 + d.phase * 6.28) * Math.PI * 2) * d.wob;
      o.y = RAIN.yTop + p * (RAIN.yBottom - RAIN.yTop);
      o.sx = d.sc * (1 - 0.12 * p);
      o.sy = d.sc * (1 + 0.30 * p);
      const a = p < 0.15 ? p / 0.15 : p > 0.85 ? (1 - p) / 0.15 : 1;
      o.op = a * 0.85 * rainOp;
    }

    /* 眨眼：时序推进交给共享层。地球**悬停时也照常眨眼** —— 它没有「被注意到就屏住」的叙事，
       一直眨反而更活。所以 active 恒为 true。 */
    blink.step(dt, true);

    return {
      bobY, sway,
      breathSX: (1 + bs) * wd,
      breathSY: (1 + bs * 1.35) * sq,
      leafA,
      /* 云：位置 + 倾角 + 沿横向的非等比拉伸。
         拉伸是**横向**的，所以 index.js 里 `scale(sx sy)` 要放在 `rotate` 之后 ——
         缩放轴跟着倾角走，读起来才是「被拉扁」而不是「被压扁」。 */
      cloudX, cloudY,
      cloudRot, cloudSX: cloudS * cloudStretch / cloudBounce, cloudSY: cloudS * cloudBounce / cloudStretch,
      /* 云的图层：true = 走球体**下层**（回程弧那一段）→ index.js 切两个 <image> 的显示 */
      behind,
      drops: frame,
      /* 表情：`happyW` = 开心图的权重（三态眼按 (1−happyW) 淡出）、
         `happyDX` / `happyDY` = 整层脸的偏移（viewBox 坐标，走 `HAPPY_PATH`）、
         `happyRot` = 整层脸的倾角（度，正 = 顺时针）—— 都写在外层组 `#earthFace` 上，支点 `FACE_C`。
         `ballRot` = **整颗球**（球体 + 小芽）跟着歪的角度，绕球心，比 `happyRot` **晚半个身位**。
         五官**不吃**这一项（它自己已经有同角度的 `happyRot`，再吃一次会把轨迹顶偏）。 */
      happyW, happyDX, happyDY, happyRot, ballRot,
      /* 探针用（DOM 不需要）：按下 / 回弹 / 叶甩三个通道的瞬时值，
         用来核「按下只预备、松手才给结果、叶子晚一点起摆」这套先后关系。
         `pressW` = 按压权重、`rebound` = 回弹形变（正 = 拉高变瘦）、`whip` = 叶子的甩动角（不含静态倾角）。 */
      pressW, rebound, whip,
      eyes: eyeWeights(blink.value()),
      blink: blink.value(),
      /* 探针用（DOM 不需要）：轨道进度、弧长比例、云速与雨量系数。
         `orbDX/orbDY` 是**纯轨道位移**（不含静止漂移）—— 探针靠它把「真的出门了」和
         「只是在家门口漂」分开，`cloudX - CLOUD.x` 分不开这两件事。
         `orbT` = 动作时钟（`null` = 停在家）、`bounce` = 弹跳的纵向缩放增量。 */
      orbitU, orbitS, orbDX, orbDY, cloudVX, cloudVY, rainOp, orbT, bounce, bounceDY,
    };
  }

  return {
    step,
    drops,
    /** 松手 → 球体回弹。四个 `trigger*` 一起调才是完整的一次释放。 */
    triggerRelease() { reboundT = 0; },
    /** 松手 → 叶子轻弹（真正的位移要等 `whipDelay` 之后才出） */
    triggerWhip() { whipT = 0; },
    /** 松手 → 变「开心」表情（见 HAPPY）。
        和 `triggerOrbit` 不同，这里**允许打断**：淡出中途再点就接着爬回去（进度是积分的，不会闪）。
        唯一的例外是**摆动还没走完时直接返回** —— 摆动是闭式，时钟归零会让位移跳回中线。 */
    triggerHappy() {
      if (happyT >= 0 && happyT < HAPPY.swingDur) return;
      happyT = 0;
    },
    /** 松手 → 云起跳：**弹与出行同帧起跑**，沿闭合路径绕地球一圈，到家那一帧立刻弹一下就结束。
        **动作过程中忽略新的点击**（不是防抖窗口）：路径从静止位起跑，中途重入会让云**瞬移**回起点。
        等它自己走完（`dur + landDur` ≈ 4.85 s）就又能点了。
        被忽略的那次点击仍有 `triggerWhip` 的叶子反馈，不会「点了没反应」。 */
    triggerOrbit() {
      if (orbT !== null) return;
      prevDX = 0; prevDY = 0;
      orbT = 0;
    },
    /** 立刻眨一次 */
    blinkNow() { blink.fire(); },
    blinkValue: blink.value,
    get hoverW() { return hoverW; },
    get pressW() { return pressW; },
  };
}
