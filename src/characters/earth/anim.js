/**
 * 地球角色的**纯逻辑**：几何落点 + 动画参数 + 每帧的数值计算。
 *
 * 这一层**只依赖 `src/shared/` 里的纯原语**（缓动 / 眨眼 / 冲激 / 逼近），
 * 不引素材、不碰 DOM、不用 gsap —— 所以它照旧能在 Node 里直接 `import` 做纯逻辑断言，
 * 也能给多个实例共用。
 *
 * ⚠️ 与太阳的一处分工差异：太阳的 `scene.js` 把几何数字**抄成字面量**（皇冠 `scale`、4 颗星光坐标），
 *    同一件事写在两个文件里，得靠 `_draft/_verify-handoff.mjs` 复核有没有漂移。
 *    地球反过来 —— **数字只在本文件出现一次**，`scene.js` 从这里 import 去搭模板，
 *    所以不存在「改了一处忘了另一处」这类隐患。
 *
 * 素材来源：`星球素材/地球/` 的合成图。五官（两只眼 + 嘴）是从合成图里**抠出来**的，
 * 底图做了最近邻修补；三态眼里的「半闭 / 闭」是把眼睛纵向压缩生成的。
 *
 * 几何（全部实测）：
 *   球体素材是 2048×2048 的画布，球心 (960,1072)、半径 ≈664（逐行/逐列扫描得到）。
 *
 * 头顶小芽是**三份**素材（用户 2026-10-03 自己拆的，都是同一张 2048 画布导出）：
 *   sprout_stem = 茎，sprout_leaf_l = 左叶，sprout_leaf_r = 右叶。
 *   三份叠回去与原图 `星球素材/地球/小芽.png` 只差切缝上的抗锯齿像素（0.027%）。
 *   动画口径：**茎不动**（只吃静态倾角 `rot`），两片叶吃**同一份** transform ——
 *   绕**同一个圆心**、同一个角度摆动，所以两片叶中间永远不会裂出空隙。
 *
 * ⚠️ 五官图层是从合成图原样抠的（与 `earth_base` 逐像素对齐），所以它和 `earth_base`
 *    **共用同一套变换**（`EARTH_T`）—— 各写各的会在眨眼时错位。小芽、云、雨则相反：
 *    都是**单独摆上去的**，坐标一律是 viewBox 坐标（不是素材坐标）。
 */
import { smoothstep, easeOutQuad } from '../../shared/easing.js';
import { dampedImpulse } from '../../shared/impulse.js';
import { approach } from '../../shared/approach.js';
import { createBlinkLayer } from '../../shared/blink.js';

/* ---------- 素材几何（2048 画布，实测） ---------- */
export const SRC = { cx: 960, cy: 1072, r: 664 };

/* ---------- viewBox 落点 ----------
   画面从上到下：云 → 雨 → 小芽 → 球体。所以上方要留出空间给云和雨。
   ⚠️ 2026-10-04 第八轮：宽 440 → **560**（球心 220 → 280）。
      原因是云要「绕赤道转一圈」—— 横向要有地方让它从球两侧绕过去。
      440 宽时球两侧各只剩 90 px，而云宽 89.5 px，绕到侧面就卡死了。 */
export const VIEW_W = 560;
export const VIEW_H = 560;
export const CX = 280;                  // 球心 x
export const CY = 410;                  // 球心 y
export const S = 260 / (SRC.r * 2);     // ≈0.1958 → 球体直径 260
export const TOP_Y = CY - SRC.r * S;    // 球体顶点 y ≈ 280（定位参照，模板里不用）

export const EARTH_T = `translate(${CX} ${CY}) scale(${S.toFixed(6)}) translate(${-SRC.cx} ${-SRC.cy})`;

/* 小芽：**三份**素材（同一 2048 画布导出，所以共用一套 translate/scale）
     sprout_stem = 茎 / sprout_leaf_l = 左叶 / sprout_leaf_r = 右叶
   ⚠️ 动画口径（用户定的）：**茎不动** —— 只吃静态倾角 `rot`，一次写完就不再改；
      两片叶吃**同一份** transform —— 绕**同一个圆心**、同一个角度摆，
      所以两片叶中间永远不会裂出空隙。
   ⚠️ 圆心是**素材坐标**，每帧的变换是 translate(-pivot) rotate(a pivot)；
      少了 translate(-pivot) 就会绕画布外的远处一点转、整支被甩飞。
   pivotX/Y：两片叶的**接触点**（用户口径「两个中间就是圆心」）。
     实测：左叶 bbox (431,710)-(1111,1268)、右叶 (1060,559)-(1583,1183)，
     把两片叶各膨胀 3~16px 求交叠，质心稳定在 (1080,1100)。
   rot：静态倾角（度）—— 三份都要吃，否则叶和茎在静态位就对不上。
   ⚠️ x/y 与 pivot 是**绑死**的：渲染结果是 (x,y) + k·R(rot)·(p − pivot)，
      单独改 pivot 会让整株平移。换圆心时按 (x,y) += k·R(rot)·(pivot′ − pivot) 补偿
      （调参页的「圆心移到茎顶」按钮就是干这个的）。
   layer：1 = 芽画在球体**之上**，0 = 沉到球体下面（由 DOM 顺序实现）。 */
export const SPROUT = { k: 0.045, x: 274.833, y: 272.703, pivotX: 1080, pivotY: 1100, rot: 29.5, layer: 1 };

/* 茎与两片叶的变换前缀 —— 圆心在**素材坐标**，所以要先 translate(-pivot)。
   茎只用它一次（静态），两片叶每帧都用。 */
export const SPROUT_PIVOT_T = `translate(${-SPROUT.pivotX} ${-SPROUT.pivotY}) `;

/* 云：素材 bbox 中心 ≈(1025.5,1040.5) */
export const CLOUD = { k: 0.062, x: 284, y: 170, cx: 1025.5, cy: 1040.5 };

/* ============================================================
   云的运动：**绕地球转一圈**（2026-10-04 第九轮重做）
   ------------------------------------------------------------
   沿革（免得下次再来回摇）：
     第七轮「点击 → 沿 ∞ 飞一圈」—— 7 个机制（双素材 / 远近换层 / 切向朝向 /
       切向拉伸 / duang / 拖影 / 交叉淡出），每个都得先学一遍，合起来读作机械。已删。
     第八轮「点击 → 起一阵风」—— 二阶阻尼振子，运动有可解释的原因，但云只是
       **横着被吹出去再弹回来**，戏份很短。参数与标定工具见 `_draft/_cloud-*.mjs`。
     第九轮（用户口径）回到「绕一圈」，但这次是**一条闭合的三段路径**，不是曲线秀：

         静止位 ──弧线──► 地球右边 ──圆周（走地球**前面**）──► 地球左边 ──弧线──► 静止位
                    (前)                  (前)                          (后)

   ⚠️ 图层：前两段画在球体**之上**，回程弧画在球体**之下** —— 由 DOM 顺序实现
      （`#earthCloudFront` / `#earthCloudBack`，见 scene.js）。切换点在最左点，
      那一刻云的右边缘（x ≈ 129.8）离球体左边缘（x = 150）还有 20 px，
      所以**切换本身看不见**；真正看得见「在背后」的地方是回程弧擦过球体左上那一小段。

   ⚠️ 路径**闭合**：起点 = 终点 = 云的静止位，所以「出门 / 回家」天然无缝，
      不存在「归位那一下」。三段接缝处**切线连续**（进场弧到环上是竖直的、
      回程弧离开环时也是竖直的）→ 全程没有折角。

   ⚠️ **快慢**由一条速度剖面给（见 `speedAnchors`）：弯前减速、直道加速、回程再慢一档。
      时间轴 = 弧长 ÷ 速度的累计（`tau`），运行时 `u → easeDist(u)`（只管起停）→ 查 `tau` 表反查。
      所以三段不是匀速走完的，「绕一圈」有它自己的节奏。

   ⚠️ 回程弧**故意往地球那边鼓**：最近处离球心 128 px（球半径 130）→ 云会被球体的
      左上方轮廓**挡掉一块**，这就是「图层在背后」唯一看得见的地方。
      鼓得更深会挡得更多，但超过某个深度就变成「整朵消失、再从芽后面蹦出来」——
      `RET_C2` 就是这个深度的旋钮（`_draft/_orbit-return.png` 是对比图）。
   ============================================================ */
export const ORBIT = {
  rx: 205, ry: 100,      // 环的半轴（椭圆，中心 = 球心）
  dur: 4.4,              // 绕完一圈（s）
  ease: 0.14,            // 起停各占总时长的比例（梯形速度曲线）

  /* 五官跟随：云走开时整张脸（眼 + 嘴是**同一张图**，只能整层平移）朝它偏一点 ——
     用户 2026-10-04 第九轮口径「大一点点」= 8 px。归一化用的是**相对静止位的位移**
     （不含静止漂移）→ 静止位恒为 0，不会「脸一直歪着」。 */
  eyeMax: 8,             // 最大位移（px）
  eyeDown: 0.55,         // 纵向分量 / 横向分量（云下潜时眼睛也往下看一点）

  /* 姿态：只在**横向速度**上给一点后仰 + 拉伸。
     ⚠️ 不跟路径切线 —— 环是扁的，切角会从竖直一路甩到水平（±90°），云会翻跟头。
        横向速度在环的两侧恰好为 0、在底端最大，正好只在「真的在横着走」时才歪。 */
  leanMax: 8,            // 最大后仰（度）
  stretch: 0.09,         // 沿横向拉伸比例（垂直等量压扁，面积守恒）
  vRef: 400,             // 速度归一化基准（px/s）

  /* 雨量窗口：**云出门时不下雨**。雨滴落点是相对**静止位**算的，
     云跑到 200 px 外还下着雨，读作「雨从空气里来」。云回来时雨也跟着回来。
     两对 `[开始, 完成]`，单位是 **dur 的倍数** —— 改 dur 时窗口自动跟着走。
     ⚠️ 两个窗口都必须落在 [0, 1] 之内：轨道一结束 `orbT` 就置 −1、`rainOp` 直接取 1，
        窗口尾巴伸过 1 会让雨量在最后一帧**跳一下**（旧值 rainIn 1.02 就踩了这个坑）。 */
  rainOut: [0.015, 0.075],
  rainIn: [0.88, 0.97],

  /* 静止漂移：两组**不成倍数**的周期 → 合成运动永不重复（所以不需要循环点） */
  driftX: [[9.3, 6.5], [14.7, 3.0]],   // [周期(s), 幅度(px)]
  driftY: [7.1, 3.5],
};

/* ---------- 轨道路径（闭合，采样成「时间 → 点」的表） ----------
   ① 进场弧：二次贝塞尔，控制点在环右点的**正上方** → 到环上时切线竖直
             ⚠️ 控制点的高度同时决定**接缝处的曲率**：椭圆长轴端的曲率半径只有
                ry²/rx ≈ 49 px（扁环的两个侧端就是两个急弯）。控制点放得越高、
                进场弧末端越平 —— 放在 (485,170) 时末端是 573 px，接缝处曲率
                **突变 11.7 倍**，全速冲进去读作「甩」。取 (485, CY−100) = 99.5 px，
                突变降到 2 倍；代价是离位方向从水平变成向下 35°（更像「扑出去」）。
   ② 环    ：椭圆 θ 从 0 到 π（**顺时针**过底端）
   ③ 回程弧：三次贝塞尔，C1 在环左点正上方（离环时切线竖直，末端曲率 58.8 px ——
             和环的 48.8 本来就接近，所以左边接缝不用调）、
             C2 往球心那边拉（决定下潜多深 → 决定被挡掉多少）

   ⚠️ 起点在球**右上**、终点在球**左上** → 环绕必须**顺时针**（经底端）：
      逆时针会先撞上头顶的小芽。 */
const P_HOME = { x: CLOUD.x, y: CLOUD.y };        // (284,170) 云的静止位
const P_RING_R = { x: CX + ORBIT.rx, y: CY };     // (485,410) 环最右点 = 进场弧终点
const P_RING_L = { x: CX - ORBIT.rx, y: CY };     // ( 75,410) 环最左点 = 回程弧起点
const RET_C2 = { x: 330, y: 320 };                // 回程弧的「往球那边拉」控制点（决定下潜多深）

/* ---- 接缝曲率匹配（G2）----
   ⚠️ 为什么必须匹配：速度剖面是 `w ∝ √R`（见下），接缝处 R 一断，
      ① `w` 跟着跳 → 速度有个折角（读作「顿一下」）
      ② 横向加速度 a = v²/R 也跳。
   ⚠️ 所以两条弧的控制点高度**不是手挑的，是解出来的** ——
      让弧的端点曲率恰好等于椭圆长轴端的曲率 `SEAM_R = ry²/rx`（扁环的两个侧端）。
        · 进场弧（二次贝塞尔，控制点在环右点正上方 d）：末端 R = 2d²/dx
          → d = √(SEAM_R·dx/2)，dx = 静止位到环右点的水平距离
        · 回程弧（三次贝塞尔，C1 在环左点正上方 d'）：起端 R = 3d'²/(2·Δx)
          → d' = √(2·SEAM_R·Δx/3)，Δx = C2.x − 环左点 x
      代入 d ≈ 70.0、d' ≈ 91.1。（手挑 100/100 时接缝处 R 从 99.5 掉到 48.8。） */
const SEAM_R = ORBIT.ry ** 2 / ORBIT.rx;
const ENTRY_C = { x: P_RING_R.x, y: CY - Math.sqrt(SEAM_R * (P_RING_R.x - P_HOME.x) / 2) };
const RET_C1 = { x: P_RING_L.x, y: CY - Math.sqrt(SEAM_R * 2 * (RET_C2.x - P_RING_L.x) / 3) };

/** 云在回程里最深能下潜到球心下方多少 px —— 眼睛跟随的纵向归一化基准 */
const DIP_Y = CY + ORBIT.ry - P_HOME.y;

/** 路径的控制点（**只给探针用**：算接缝曲率、画对比图）。
 *  ⚠️ 这些数字的唯一来源是本文件 —— 探针要引用而不是自己抄一遍，
 *     否则改了 `ENTRY_C` 而探针还按旧值报「跳变 11.7×」那种假数据。 */
export const ORBIT_CTRL = { P_HOME, P_RING_R, P_RING_L, ENTRY_C, RET_C1, RET_C2 };

/* ---------- 速度剖面：**从曲率解出来**（不是手调的锚点表） ----------
   ⚠️ 原则：让**横向加速度 a = v²/R 沿路径大致恒定** —— 等价于 `v ∝ √R`。
      为什么是它：读作「顿挫 / 甩」的量就是 a（曲率大 + 速度快才顶不住），
      a 恒定 = 云一直在用同一个「转向力度」走，看起来就是在**滑**而不是**拐**。
      好处是「弯里慢、直道快」不再是手调的：改 `ENTRY_C` / `RET_C2` 之后
      速度剖面自动跟着变，不会留下「路径改了、节奏还是旧的」这种半新半旧状态。
   ⚠️ 权重必须夹在 `[W_LO, W_HI]`：回程弧中段有**拐点**（R→∞），
      不夹会给出无限速度；夹了以后那一小段 a 会掉下去（拐点附近本来也是直线）。
   ⚠️ 曲率是**二阶量**，采样噪声会被放大 → 算完要平滑一遍再喂给 `tau`。
   `NARR_*` 是唯一一处**叙事增益**（偏离上面的原则）：回程从球后面探出来那一段压一档，
   慢一点才看得见它「从球背后出来」。除此之外全交给曲率。 */
const R_REF = 150;       // 参考曲率半径（px）—— 环两端 48.8 与环底 420 的几何中项 ≈ 143
const W_LO = 0.55;       // 权重下限（最急的弯封顶）
const W_HI = 1.45;       // 权重上限（长直道封顶）
const NARR_S = [0.78, 0.99], NARR_K = 0.15;   // 叙事减速：区间 + 压多少

/** 归一化 x → [0,1] 再走 smoothstep。
 *  ⚠️ `shared/easing.js` 的 `smoothstep` **不做钳位**（它是曲线原语，不是区间映射），
 *     所以越界要在这里夹掉。
 *  ⚠️ 定义必须在本文件的 `ORBIT_PATH` **之前** —— 那个 IIFE 在模块加载时就执行，
 *     放到后面会踩 TDZ（`Cannot access 'ramp' before initialization`）。 */
const ramp = (a, b, x) => smoothstep(Math.min(1, Math.max(0, (x - a) / (b - a))));

/** 三角形 bump：在 [a,b] 上从 0 升到 1 再回 0（用 smoothstep 过渡） */
function bump(x, a, b) {
  const m = (a + b) / 2;
  return x <= m ? ramp(a, m, x) : 1 - ramp(m, b, x);
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
  /* ① 进场弧：P_HOME → ENTRY_C → P_RING_R */
  for (let i = 0; i <= 120; i++) {
    const t = i / 120, m = 1 - t;
    push(m * m * P_HOME.x + 2 * m * t * ENTRY_C.x + t * t * P_RING_R.x,
         m * m * P_HOME.y + 2 * m * t * ENTRY_C.y + t * t * P_RING_R.y);
  }
  const iEntryEnd = xs.length - 1;     // 进场弧的终点 = 环的起点
  /* ② 环：θ 0 → π（顺时针过底端）。起点与进场弧的终点重复，跳过 */
  for (let i = 1; i <= 180; i++) {
    const th = Math.PI * i / 180;
    push(CX + ORBIT.rx * Math.cos(th), CY + ORBIT.ry * Math.sin(th));
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

/** 梯形速度曲线的**解析积分**：归一化时间 u ∈ [0,1] → 已走过的弧长比例。
    前 `e` 段用 smoothstep 从 0 加速到 1、后 `e` 段减速回 0、中间匀速 ——
    速度连续（没有 jerk），两端为 0（起手 / 收尾都不突兀）。
    ⚠️ 归一化分母是 (1 − e)：∫smoothstep = 1/2，所以总面积 = e/2 + (1−2e) + e/2 = 1 − e。 */
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
 *  ⚠️ 查的是 `tau`（时间）不是 `s`（弧长）—— 用 s 查就等于匀速，速度剖面白给。 */
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

/* 雨：纯 SVG 小水滴（不需要额外素材）。
   ⚠️ 落点**相对云中心**算，不写死 viewBox 坐标 —— 云会横向漂移，雨要跟着一起挪。 */
export const RAIN = {
  count: 5,
  halfW: 42,                     // 落点相对云中心的横向半宽
  yTop: 147, yBottom: 299,
  speed: 0.46,                   // 每秒走完的比例
};

/* 水滴形状：尖端朝上、底部圆（下落的雨滴）。原点在形状重心附近，
   所以每帧只要 translate(落点) scale(大小) 即可。 */
export const DROP_D = 'M0 -3.6 C1.55 -1.5 2 -0.3 2 0.7 A2 2 0 0 1 -2 0.7 C-2 -0.3 -1.55 -1.5 0 -3.6 Z';

/* ============================================================
   参数
   ============================================================ */
export const EARTH = {
  /* 呼吸：不对称（吸快呼慢），悬停时周期变短 */
  breathDur: 3.2,
  breathS: 0.010,
  bobAmp: 3.4,
  hoverBreath: 0.72,

  /* 整体摆动（2026-10-03 加，对标太阳「被拖着走」的读法）：
     球体轻微左右倾 + 上下浮动，周期**刻意不成倍数**，避免几秒后锁相。 */
  swayRot: 1.35,        // ±1.35°
  swayDur: 4.6,

  /* 小芽：两片叶绕**同一圆心**整体摆，且跟着地球的摆动走（同周期、略滞后）——
     这样才读得出「芽是长在球上的」而不是各动各的。
     幅度比球体大（4.2 vs 1.35），呼应太阳那套「越靠外摆得越多」。 */
  sproutSway: 4.2,
  sproutLag: 0.35,      // 相位滞后（秒）：芽比球体晚一点跟上

  /* 云：只留呼吸缩放（跟地球同周期）。**漂移与轨道路径在 ORBIT 里**，不在这儿。 */
  cloudBreath: 0.05,

  /* 悬停 / 点击 */
  hoverLift: -9,
  pressSquash: 0.86,
  pressWiden: 1.09,

  /* 点击时两片叶的甩动：一次冲激 + 指数衰减（和太阳那边「装饰被震一下」同一读法）。
     叶子在 #earthBreath 里已经跟着地球一起吃压扁了，这一层是**额外**的甩动 ——
     地球压下去的同时叶子被震得抖两下，读起来才有「软的」感觉。 */
  whipAmp: 7.5,        // 冲激幅度（度）
  whipHz: 4.6,         // 振荡频率
  whipZeta: 0.16,      // 阻尼比
  whipDur: 1.1,        // 冲激总时长（秒）

  /* 眨眼 */
  blinkMin: 2.5, blinkMax: 6.0,
  blinkFirstMin: 1.4, blinkFirstMax: 3.2,
  blinkCloseF: 5, blinkHoldF: 1, blinkOpenF: 3,
};

/** 一次眨眼的总时长（秒）：闭 5 帧 + 保持 1 帧 + 睁 3 帧。
    ⚠️ 和 `shared/blink.js` 内部算的 `dur` 是同一个式子，改帧数时两处自动一致。 */
export const BLINK_DUR = (EARTH.blinkCloseF + EARTH.blinkHoldF + EARTH.blinkOpenF) / 60;

/** 把闭眼量 b(0~1) 拆成 睁/半闭/闭 三段不透明度（相邻两段权重和恒为 1） */
export function eyeWeights(b) {
  return [
    Math.max(0, 1 - 2 * b),                 // open
    Math.max(0, 1 - Math.abs(2 * b - 1)),   // half
    Math.max(0, 2 * b - 1),                 // closed
  ];
}

/**
 * 建一个地球的动画实例（**纯计算，不碰 DOM**）。
 *
 * 有状态的部分全在这里：悬停 / 按压权重、叶子的冲激时钟、眨眼计时器、
 * 以及每颗雨滴随机的落点 / 大小 / 速度 / 相位。所以同一份参数能跑多个实例，互不干扰。
 *
 * ⚠️ 地球**没有状态机** —— 呼吸 / 摆动 / 眨眼 / 云雨都是程序化正弦，不是关键帧表，
 *    所以这里不搬太阳那套「状态互斥 + 混合器」，只按时间推进。
 *
 * @param rand 随机源（默认 Math.random）。测试时塞一个确定性 PRNG 就能复现同一帧。
 */
export function createEarthAnim({ rand = Math.random } = {}) {
  /* ---------- 雨滴：每颗有自己的落点 / 大小 / 速度 / 相位 ----------
     记的是**相对云中心**的横向偏移，这样云横向漂移时整片雨跟着挪，
     不会「云走了雨还留在原地」。 */
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

  /* ---------- 交互状态（权重向目标逼近，不用 snap） ---------- */
  let hoverW = 0, pressW = 0;
  /* 叶子甩动的冲激时钟：<0 = 没在甩 */
  let whipT = -1;
  /* ---------- 云的轨道（见 ORBIT） ----------
     `orbT` = 轨道时钟（<0 = 停在家）；`prevDX` / `prevDY` = 上一帧的**轨道位移**，
     用来差分出速度（不拿含漂移的总位移差分 —— 那样静止位会一直有 ~40 px/s 的假速度）。 */
  let orbT = -1;
  let prevDX = 0, prevDY = 0;

  /* ---------- 眨眼计时器（逐实例） ----------
     时序走 `src/shared/blink.js`；曲线用地球自己的两条 ——
     smoothstep 闭合 / 二次 ease-out 张开，和太阳那两条贝塞尔不是一个形状，所以显式传进去。
     ⚠️ 地球**悬停时也照常眨**（太阳那边是钉住不眨），所以 step 的 active 恒为 true。 */
  const blink = createBlinkLayer({
    closeF: EARTH.blinkCloseF, holdF: EARTH.blinkHoldF, openF: EARTH.blinkOpenF,
    min: EARTH.blinkMin, max: EARTH.blinkMax,
    firstMin: EARTH.blinkFirstMin, firstMax: EARTH.blinkFirstMax,
    easeIn: smoothstep, easeOut: easeOutQuad,
    rand,
  });

  let t = 0;

  /**
   * 推进一帧，返回这一帧要写进 DOM 的**全部数值**（本函数不碰 DOM）。
   * ⚠️ `drops` 是复用的数组，调用方要立刻写进属性、不要跨帧存着。
   */
  function step(dt, { hovered = false, pressed = false } = {}) {
    t += dt;

    /* 权重逼近（与帧率无关） */
    hoverW = approach(hoverW, hovered ? 1 : 0, 10, dt);
    pressW = approach(pressW, pressed ? 1 : 0, 10, dt);

    /* 呼吸：悬停时周期变短（读起来是「兴奋了一点」） */
    const dur = EARTH.breathDur * (1 - (1 - EARTH.hoverBreath) * hoverW);
    const ph = (t % dur) / dur;
    /* 不对称：吸快、呼慢（和太阳同一套读法） */
    const wave = ph < 0.42 ? Math.sin((ph / 0.42) * Math.PI / 2) : Math.cos(((ph - 0.42) / 0.58) * Math.PI / 2);
    const bs = EARTH.breathS * wave;

    /* 点击挤压：按下时压扁拉宽，松开回弹 */
    const sq = 1 - (1 - EARTH.pressSquash) * pressW;
    const wd = 1 + (EARTH.pressWiden - 1) * pressW;

    /* 整体摆动：和呼吸**不同周期**，故意不成倍数 */
    const sway = Math.sin((t / EARTH.swayDur) * Math.PI * 2) * EARTH.swayRot;

    const bobY = -EARTH.bobAmp * wave + EARTH.hoverLift * hoverW;

    /* 点击甩动：一次冲激 + 指数衰减（叶子被震一下）。
       ⚠️ 地球这里用**同一个 ω 既做衰减又做振荡**（调参时就是这么定的），
          和太阳那边的阻尼振子不是一套语义 —— 见 `shared/impulse.js` 的说明。
       sin 起手（从 0 开始）—— 起手是 cos 的话第一帧就有位移，会「闪一下」。 */
    let whip = 0;
    if (whipT >= 0) {
      whipT += dt;
      const w = 2 * Math.PI * EARTH.whipHz;
      whip = dampedImpulse(whipT, EARTH.whipAmp, EARTH.whipZeta * w, w);
      if (whipT >= EARTH.whipDur) whipT = -1;
    }

    /* ---------- 云：沿闭合路径绕地球一圈（见 ORBIT） ----------
       时钟推进 → 归一化时间 u → `easeDist` → `orbitAt` 查 `tau` 表 → 路径上的点。
       起点 = 终点 = 静止位，所以「出门 / 回家」天然无缝。
       ⚠️ 两个参数各管一件事，**别混**：
          · `easeDist(u)` = 起停（两端速度为 0 → 静止位不歪、不拉伸）
          · `tau` 表      = 快慢（弯里慢、直道快）
          `orbitAt` 收的是**时间**比例，所以喂 `easeDist` 的结果正是想要的；
          若直接喂原始 `u`，`tau` 表就白给了（退化成匀速）。
       ⚠️ `orbT` 走完就置回 −1：位移归 0，而路径闭合（起点 = 终点）→ 不会跳。 */
    let orbitU = 0, uPath = 0;
    if (orbT >= 0) {
      orbT += dt;
      if (orbT >= ORBIT.dur) orbT = -1;
      else { orbitU = orbT / ORBIT.dur; uPath = easeDist(orbitU); }
    }
    const pt = orbitAt(uPath);
    const orbitS = pt.s;                 // 弧长比例（探针用它分段，不参与运动）
    const orbDX = pt.x - CLOUD.x;
    const orbDY = pt.y - CLOUD.y;
    /* 回程段（环的左端之后）走**球体下层** —— 由 index.js 切 #earthCloudBack / Front。
       ⚠️ 判据用**时间**比例 `uBehind`（不是弧长 `sBehind`）—— `uPath` 就在时间轴上；
          两者其实等价（`tau` 对 `s` 单调），但用同轴的量不容易写错。 */
    const behind = uPath > ORBIT_PATH.uBehind;

    /* 速度：由**轨道位移**差分。两端为 0（easeDist 两端速度为 0）→ 静止位恒为 0，
       所以「不动的时候不歪、不拉伸」这条性质还成立。
       ⚠️ dt 可能被 clampDt 钳到 0.1 s（切标签页回来），除下去会得到假的大速度。 */
    const invDt = dt > 1e-3 ? 1 / dt : 0;
    const cloudVX = (orbDX - prevDX) * invDt;
    const cloudVY = (orbDY - prevDY) * invDt;
    prevDX = orbDX; prevDY = orbDY;

    /* 小芽的叶：**茎不动**，只有两片叶摆。
       两份叶吃**同一份**角度 —— 绕同一个圆心、同一个角度，所以中间永不裂。
       静态倾角 rot 和摆动叠加后再一起绕圆心（不是各转各的）。
       ⚠️ 相位比球体滞后 sproutLag —— 和球体「一起触发、慢半拍跟上」。
       点击时再叠加 whip（被震一下）。 */
    const leafA = SPROUT.rot +
      Math.sin(((t - EARTH.sproutLag) / EARTH.swayDur) * Math.PI * 2) * EARTH.sproutSway +
      whip;

    /* ---------- 云的位置与形变 ----------
       位置 = **静止漂移(t) + 轨道位移(t)**。
       ⚠️ 漂移是两组**不成倍数**的周期 → 合成运动永不重复（所以「循环方式」= 没有循环）；
          轨道位移两端都是 0 → 出门 / 回家都**恰好**落在漂移当时该在的位置上。 */
    const driftXX = ORBIT.driftX
      .reduce((s, [p, a]) => s + Math.sin((t / p) * Math.PI * 2) * a, 0);
    const driftYY = Math.sin((t / ORBIT.driftY[0]) * Math.PI * 2) * ORBIT.driftY[1];
    const cloudX = CLOUD.x + driftXX + orbDX;
    const cloudY = CLOUD.y + driftYY + orbDY;
    /* 雨只跟**静止位 + 漂移**，不跟轨道位移 —— 否则云绕到球那边，雨也跟着横移。 */
    const rainX = CLOUD.x + driftXX;

    /* 倾角：**后仰**（顶部朝来路）—— 按**横向**速度归一化。
       ⚠️ 不跟路径切线：环是扁的，切角会从竖直甩到水平（±90°），云会翻跟头。
          横向速度在环的两侧恰好为 0、在底端最大，所以只在「真的在横着走」时才歪。 */
    const cloudRot = -ORBIT.leanMax * Math.max(-1, Math.min(1, cloudVX / ORBIT.vRef));
    /* 拉伸：沿**横向**拉长、垂直方向等量压扁（面积守恒）。同理由横向速度定强度。 */
    const stretchN = Math.min(1, Math.abs(cloudVX) / ORBIT.vRef);
    const cloudStretch = 1 + ORBIT.stretch * stretchN;
    const cloudS = CLOUD.k * (1 + EARTH.cloudBreath * wave);

    /* 雨量：**云出门时不下雨**。雨滴落点是相对静止位算的 —— 云跑到 200 px 外
       还下着雨，读作「雨从空气里来」。云回来时雨也跟着回来。
       窗口按 `dur` 的倍数给（见 ORBIT.rainOut / rainIn），改 dur 自动跟着走。
       ⚠️ 两段 ramp 直接相减即可：`1 − 收雨 + 复雨` 在 o1~i0 之间恒为 0、在 i1 之后恒为 1。 */
    let rainOp = 1;
    if (orbT >= 0) {
      const [o0, o1] = ORBIT.rainOut;
      const [i0, i1] = ORBIT.rainIn;
      rainOp = 1 - ramp(o0 * ORBIT.dur, o1 * ORBIT.dur, orbT)
                 + ramp(i0 * ORBIT.dur, i1 * ORBIT.dur, orbT);
    }

    /* 五官跟随：云走开时整张脸（眼 + 嘴是一张图，只能**整层平移**）朝它偏一点。
       归一化基准是**轨道位移**（不含静止漂移）→ 静止位恒为 0，不会「脸一直歪着」。 */
    const followX = Math.max(-1, Math.min(1, orbDX / ORBIT.rx));
    const followY = Math.max(-1, Math.min(1, orbDY / DIP_Y));
    const eyeDX = ORBIT.eyeMax * followX;
    const eyeDY = ORBIT.eyeMax * ORBIT.eyeDown * followY;

    /* 雨：每颗从云底落到芽顶，头尾各 15% 淡入淡出。
       下落时纵向拉长、横向略收 —— 读作「越落越快」，比匀速的点有生气。
       ⚠️ 第八轮那套「顺风倾斜」随风一起删了：没有风，雨就竖直落。 */
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

    /* 眨眼：时序推进交给共享层。
       地球和太阳不同：**悬停时也照常眨眼**（太阳那边是钉住不眨）——
       它没有「被注意到就屏住」的叙事，一直眨反而更活。所以 active 恒为 true。 */
    blink.step(dt, true);

    return {
      bobY, sway,
      breathSX: (1 + bs) * wd,
      breathSY: (1 + bs * 1.35) * sq,
      leafA,
      /* 云：位置 + 倾角 + 沿横向的非等比拉伸。
         ⚠️ 拉伸是**横向**的，所以 index.js 里 `scale(sx sy)` 要放在 `rotate` 之后 ——
            缩放轴跟着倾角走，读起来才是「被拉扁」而不是「被压扁」。 */
      cloudX, cloudY,
      cloudRot, cloudSX: cloudS * cloudStretch, cloudSY: cloudS / cloudStretch,
      /* 云的图层：true = 走球体**下层**（回程弧那一段）→ index.js 切两个 <image> 的显示 */
      behind,
      drops: frame,
      /* 五官整层平移（viewBox 坐标，最多 eyeMax px）—— index.js 写在外层包装组上 */
      eyeDX, eyeDY,
      eyes: eyeWeights(blink.value()),
      blink: blink.value(),
      /* 探针 / 调试用（DOM 不需要）：轨道进度、弧长比例、云速与雨量系数。
         `orbDX/orbDY` 是**纯轨道位移**（不含静止漂移）—— 探针要靠它把「真的出门了」
         和「只是在家门口漂」分开，`cloudX - CLOUD.x` 分不开这两件事。 */
      orbitU, orbitS, orbDX, orbDY, cloudVX, cloudVY, rainOp,
    };
  }

  return {
    step,
    drops,
    /** 点下去 → 叶子被震一下（把冲激时钟归零） */
    triggerWhip() { whipT = 0; },
    /** 点下去 → 云出门，沿闭合路径绕地球一圈。
        ⚠️ **绕的过程中忽略新的点击**（不是设一个防抖窗口）：路径从静止位起跑，
           中途重入会让云**瞬移**回起点。等它自己走完（`dur` = 4.4 s）就又能点了。
           被忽略的那次点击仍有 `triggerWhip` 的叶子反馈，不会「点了没反应」。 */
    triggerOrbit() {
      if (orbT >= 0) return;
      prevDX = 0; prevDY = 0;
      orbT = 0;
    },
    /** 调试：立刻眨一次 */
    blinkNow() { blink.fire(); },
    blinkValue: blink.value,
    get hoverW() { return hoverW; },
    get pressW() { return pressW; },
  };
}
