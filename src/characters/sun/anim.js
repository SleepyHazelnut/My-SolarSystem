/**
 * 动画层：缓动 + 三段关键帧 + 状态机混合器 + 星光特效层 + 眨眼层 + 阻尼弹簧 / 星环侧转 / 低频漂移。
 *
 * 本文件是**手改的唯一源** —— 原先由 `_draft/gsap-demo/_perf/gen-src.mjs` 从 demo 页抽取生成，
 * 那条管线已退役。关键帧最初从 `_draft/rive/scene.rml` 搬来（帧号 / 值 / 该段缓动）。
 *
 * 只有纯逻辑、不碰 DOM：每帧返回一组绝对值，由 index.js 写进 SVG 属性。
 * 保持纯逻辑是为了多个 createMixer() 实例互不干扰，将来加星球可直接复用。
 *
 * 角度单位：`ring.rot` 是**弧度**（从 Rive 搬来），后加的 `crown.rot` / `flower.rot` /
 * `leaf.rot` 是**度**，index.js 的 apply() 里各自换算。
 * 三个装饰角度只驱动**包装组**的额外旋转 —— 各层自己的静态落点/角度/缩放在 scene.js 里。
 *
 * 与地球共用的运动原语（缓动 / 眨眼 / 冲激）在 `src/shared/`。
 */
import { cubicBezier } from '../../shared/easing.js';
import { dampedImpulse } from '../../shared/impulse.js';
import { createBlinkLayer as createBlinkTimer } from '../../shared/blink.js';

export const DEG = 180 / Math.PI;
const T = (frame) => frame / 60;          // Rive 关键帧按 60fps 折算成秒

/* Sun 节点在画板上的落点 —— **唯一一份**。scene.js 的静态 <g translate> 与 index.js
   每帧写 #sun 时的基准偏移都从这里取，不存在「改一处忘一处」。 */
export const SUN = { x: 295, y: 324 };

/* 缓动：曲线参数在本文件，算法在 `src/shared/easing.js`。这些数值只属于太阳。 */
const EASE = {
  lin: (x) => x,
  io:  cubicBezier(0.42, 0.00, 0.58, 1.00),   // ease-in-out（Rive 默认 cubic）
  io2: cubicBezier(0.30, 0.00, 0.20, 1.00),   // 更强的 ease-in-out（Clicked 的挤压段）
  ei:  cubicBezier(0.40, 0.00, 1.00, 1.00),   // 眨眼闭合
  eo:  cubicBezier(0.00, 0.00, 0.20, 1.00),   // 眨眼张开
  /* 星环「转满一圈」专用，**不能用 io2**：io2 峰值是平均速度的 2.56 倍，
     会让中段越过车轮效应临界；这条峰值只有 1.54 倍，且峰值落在正中间 u=0.50。 */
  spin: cubicBezier(0.35, 0.00, 0.65, 1.00),

  /* 进入 Clicked 的混合专用（见 FX.blendPunch）。io 在 u=0.5 处只给 0.5，
     而挤压峰值在第 8 帧、混合才走到 u≈0.51 → 最猛的一下只出一半。这条在 u=0.51 处给 0.92。 */
  punchIn: cubicBezier(0.15, 0.70, 0.30, 1.00),

  /* 呼吸两段。吸呼都用 io 会拼成对称单峰 = 钟摆，读不出「吸进去／吐出来」。
     真实呼吸不对称：吸得急、吸满停一下、呼得慢而松。
       · inhale：初速 2.8 倍，起步快然后减速接住屏息段，收尾切线接近 0。
         初速不能再大 —— 循环接缝处呼气也收在 0 速度，初速越大接缝的速度台阶越明显。
       · exhale：起步慢、中段匀速、收尾归零 = 松下来。 */
  inhale: cubicBezier(0.25, 0.70, 0.35, 1.00),
  exhale: cubicBezier(0.35, 0.08, 0.50, 1.00),
};

/* 各特效开关，全部默认开。逐个置 false 即回到改动前的行为（旧写法保留在
   `CLICK_DECOR_FALLBACK` / `RING_TILT` / `EASE.io`）。sparkGlow 实际在 index.js / scene.js 生效，
   放在这里只是让这一组有统一入口，方便一键全关做对照。 */
export const FX = {
  spring: true,      // 装饰的甩动改用二阶阻尼弹簧（不再是手写衰减关键帧）
  ringTilt: true,    // 星环 3D 侧转（ring.sx / ring.sy 分离 + 变换顺序修正）
  blendPunch: true,  // 进入 Clicked 的混合曲线改成陡峭 ease-out（冲击不被稀释）
  sparkGlow: true,   // 星光 glow 滤镜
  drift: true,       // 低频漂移（打破锁相，见 DRIFT）
  decorPhase: true,  // 向日葵相位漂移（花/叶的滞后量各自游走，见 DECOR）
};

/* 二阶阻尼弹簧：原来的手写衰减关键帧每个极值点速度都归零，读起来是「顿一下再走」。
   换成欠阻尼二阶系统的冲量响应：
       x(τ) = A · e^(−ζ·ωn·τ) · sin(ωd·τ),   τ = t − delay（帧）
       ωd = 2π/T,   ωn = ωd / √(1−ζ²)
   用 sin 而不是 cos：sin 从 0 出发、初速最大 —— 正是「被敲了一下」的样子。
   参数由 `_draft/_spring-solve.mjs` 解出，约束：首峰仍落在原帧（8 / 10 / 13）、
   首峰幅度不变（5.5 / 7.0 / 9.4 度）、到 `end` 帧衰减到 0.06 度以下。
   解出的 ζ 天然满足「越轻阻尼越小」：冠 > 花 > 叶。
   delay 承担「冲击波传到该部件的时间」：越靠外的部件被甩到得越晚。 */
export const SPRING = {
  crown:  { delay: 1.95, zeta: 0.2121, A: 7.556,  T: 28, end: 96 },
  flower: { delay: 3.84, zeta: 0.1880, A: 9.285,  T: 28, end: 100 },
  leaf:   { delay: 6.79, zeta: 0.1769, A: 12.268, T: 28, end: 106 },
};

/** 按 SPRING 参数逐帧采样成关键帧数组（帧间线性插值，60fps 下误差 < 0.01°） */
function springTrack({ delay, zeta, A, T, end }) {
  const wd = 2 * Math.PI / T;                            // 阻尼频率 ωd
  const k = zeta * wd / Math.sqrt(1 - zeta * zeta);      // ζ·ωn
  const out = [];
  for (let f = 0; f < end; f++) {
    const tau = f - delay;
    out.push([f, tau <= 0 ? 0 : dampedImpulse(tau, A, k, wd), 'lin']);
  }
  out.push([end, 0, 'lin']);   // 收尾：残余 < 0.06°，钉到 0，出口切走时不会「抖」一下
  return out;
}

/* 手写的衰减关键帧（旧写法）—— FX.spring = false 时用它 */
const CLICK_DECOR_FALLBACK = {
  'crown.rot':  [[0, 0, 'io2'], [8, 5.5, 'io2'], [20, -6.0, 'io2'], [34, 3.2, 'io'],
                 [48, -1.4, 'io'], [62, 0.5, 'io'], [76, 0, 'lin']],
  'flower.rot': [[0, 0, 'io2'], [10, 7.0, 'io2'], [23, -8.0, 'io2'], [37, 4.2, 'io'],
                 [51, -1.8, 'io'], [65, 0.6, 'io'], [78, 0, 'lin']],
  'leaf.rot':   [[0, 0, 'io2'], [13, 9.4, 'io2'], [27, -10.8, 'io2'], [41, 5.7, 'io'],
                 [55, -2.4, 'io'], [69, 0.8, 'io'], [82, 0, 'lin']],
};
const clickDecor = (key) => (FX.spring
  ? springTrack(SPRING[key.split('.')[0]])
  : CLICK_DECOR_FALLBACK[key]);

/* 星环 3D 侧转：把 ring.s 拆成 sx / sy，在**旋转之外**再压一次 ——
   「压缩轴」固定在画面竖直方向，环内图案照转，看起来就是一枚斜着转的环。

   关键在**变换顺序**（index.js 的 apply()）：
       错： translate → rotate(rot) → scale(sx sy) → translate(−O)
       对： translate → scale(sx sy) → rotate(rot) → translate(−O)
   写成错的，非等比压缩会作用在已旋转的坐标系里，压缩轴跟着环一起转，
   看着像「总有个方向在挤它」而不是「环被斜着看」。

   幅度不能大：环外缘半径（按 PNG 内容轮廓算）199~265，太阳本体锯齿半径到 204，
   两者咬得很紧。竖向压太多，太阳上下的锯齿会从环外缘探出来。
   squash = 0.78 是折中，同时横向放大 6% 补一点面积。 */
export const RING_TILT = {
  in: 8, full: 22, out0: 82, out1: 104,   // 窗口（帧）：8 起、22 满、82 开始回、104 归零
  squash: 0.78,                            // 竖向压缩到 78%
  widen: 1.06,                             // 横向放大 6%
  /* 未侧转时把切分线「停」到环上方多远（#sun 局部单位）。环的前后分层**只在转动时**成立 ——
     静止时它是正圆贴在太阳外圈，没有深度可读，切一半反而像被太阳啃了一口；
     停到环外就等于「整环在前」= 旧行为。
     本环上缘约在环心上方 180~270 单位（随 ring.rot 摆动），所以 k ≈ 0.76 之前切分线
     一直停在环外，只有 k ≥ 0.80 起才真的切开，正好落在侧转保持窗 22~82 的两端内。
     想让它更晚才切就把 seamPark 调大（1200 → k ≥ 0.82）。 */
  seamPark: 900,
};

/** 侧转系数：把 0→1→0 的窗口做 smoothstep，再乘 Clicked 的权重（混合期自然淡入淡出） */
function ringTilt(frame, w) {
  const { in: a, full: b, out0: c, out1: d, squash, widen } = RING_TILT;
  let u;
  if (frame <= a || frame >= d) u = 0;
  else if (frame < b) u = (frame - a) / (b - a);
  else if (frame <= c) u = 1;
  else u = 1 - (frame - c) / (d - c);
  u *= w;
  const k = u * u * (3 - 2 * u);
  return { x: 1 + (widen - 1) * k, y: 1 + (squash - 1) * k };
}

/* 侧转量 k ∈ [0,1] 的**反解**，给 index.js 决定「切分线停在哪」用。
   step() 里写的是 `ring.sx = ring.s × (1 + (widen−1)·k)`，所以 k 可从 sx / s 反推。
   两条轴任取其一，优先用非退化的那条（widen 被设成 1.0 时 sx 就解不出 k）。
   必须由 sx/s 反解、不能另存一份 k —— 状态混合、FX.ringTilt 关掉、ring.s 的离心脉动
   都会改 sx，只有反解才能保证和画面对得上。 */
export function ringTiltK(sx, sy, s) {
  const r = s > 1e-6 ? s : 1e-6;
  const dx = RING_TILT.widen - 1;
  if (Math.abs(dx) > 1e-6) return Math.min(Math.max((sx / r - 1) / dx, 0), 1);
  const dy = RING_TILT.squash - 1;
  if (Math.abs(dy) > 1e-6) return Math.min(Math.max((sy / r - 1) / dy, 0), 1);
  return 0;
}

/* 低频漂移：Idle 里身体 / 星环 / 皇冠 / 花 / 叶五条轨道周期**全是 180 帧**，相位差固定，
   于是画面每 3 秒逐帧精确复现一次（锁相）。改关键帧只能换一种 3 秒循环，换不掉严格周期，
   所以单独加一层：三条**互不成整数比**的正弦（17.3 / 22.9 / 31.1 s）叠加，
   合成周期几十秒量级 → 肉眼找不到重复点。与状态机是**叠加**不是混合，逐实例持有。

   缩放的是「**偏离该状态自身起点的量**」而不是绝对值：
       out[key] = base + (out[key] - base) × (1 + depth × d)
   base = 各状态**自己轨道第 0 帧值**的加权平均（不是 REST —— 用 REST 会把 Hover 的
   上浮高度也按 ±20% 缩放）。偏差为 0 的地方（循环接缝第一帧、各状态第 0 帧）漂移天然为 0，
   所以循环接缝连续性不会被破坏。
   乘 (1 - w(Clicked))：点击期间不漂移 —— 点击的挤压包络是照帧调好的，动它会把冲击量改掉。 */
export const DRIFT = {
  periods: [17.3, 22.9, 31.1],   // 秒。两两之比都不是简单分数 → 合成周期几十秒
  phases: [0, 1.7, 3.1],
  breath: 0.20,                  // 呼吸幅度 ±20%
  decor: 0.12,                   // 装饰摆幅 ±12%
};

/** 受漂移影响的轨道（key + 调制深度）。单列出来是为了让「漂移动了哪些东西」一眼可见 */
export const DRIFT_KEYS = [
  ['sun.y', DRIFT.breath], ['sun.sx', DRIFT.breath], ['sun.sy', DRIFT.breath],
  ['crown.rot', DRIFT.decor], ['flower.rot', DRIFT.decor], ['leaf.rot', DRIFT.decor],
];

function createDriftLayer() {
  let t = 0;
  function step(dt) { t += dt; }
  /** 返回 [-1, 1] 的缓慢漂移量 */
  function value() {
    let s = 0;
    for (let i = 0; i < DRIFT.periods.length; i++) {
      s += Math.sin(t * Math.PI * 2 / DRIFT.periods[i] + DRIFT.phases[i]);
    }
    return s / DRIFT.periods.length;
  }
  return { step, value };
}

/* 向日葵相位漂移：花和叶挂在 Idle 那条 180 帧轨道上，峰值固定在 124 / 131 帧，
   身体 72、皇冠 112 —— 全在同一个 3 秒时钟上，且花 4.2° 与叶 5.6° 峰值只差 7 帧、
   相对角最大才 2.1°，读起来是「一整枚发夹刚性摆动」而不是「花和叶各自在晃」。

   做法是**相位调制**而不是叠加：
       out[key] = track(key, t + φ(key, t))     φ = 每条 key 自己的慢速振荡
   不能用「加一条独立振荡」——**循环接缝**：Idle 轨道每 180 帧回卷（`a.t %= dur`），
   外面加一个自由跑的振荡，第 180 帧就不再等于第 0 帧，接缝处每 3 秒会跳一下。
   相位调制没这问题：轨道本身是 dur 周期的，`track(t + φ)` 对 t 连续，
   回卷点两侧取值天然相等。

   周期不能与 3 s（Idle）、1.667 s（Hover）、17.3/22.9/31.1 s（DRIFT）成简单比。
   乘 (1 − w(Clicked))：点击的装饰甩动是照帧调好的冲击包络，相位一挪首峰就跑位。
   相位只作用在**滞后量**上，摆幅仍由轨道决定 —— 「越靠外越滞后」不会被破坏。 */
export const DECOR = {
  /* shift 单位是秒。flower ±0.30 s ≈ ±18 帧；leaf ±0.46 s ≈ ±27.6 帧 ——
     叶更轻，滞后的游走幅度也更大。 */
  'flower.rot': { periods: [7.3, 3.1], phases: [0.0, 1.9], shift: 0.30 },
  'leaf.rot':   { periods: [4.1, 9.7], phases: [1.3, 0.4], shift: 0.46 },
};

function createDecorLayer() {
  const keys = Object.keys(DECOR);
  let t = 0;
  function step(dt) { t += dt; }
  /** 每条 key 的相位偏移（秒），范围 [-shift, +shift] */
  function offsets(gain) {
    const out = {};
    for (const k of keys) {
      const d = DECOR[k];
      let s = 0;
      for (let i = 0; i < d.periods.length; i++) {
        s += Math.sin(t * Math.PI * 2 / d.periods[i] + d.phases[i]);
      }
      out[k] = (s / d.periods.length) * d.shift * gain;
    }
    return out;
  }
  return { step, offsets };
}

/* 三段动画：逐条照抄 scene.rml 的关键帧。
   每条 = [帧, 值, 该段使用的缓动]（缓动写在**段的起点**上）；'hold' = 保持起点值直到下一关键帧。 */
const DEFS = {
  /* Idle：180 帧循环。呼吸 + 眨眼 + 星尘错开闪 + 星环轻摆 */
  Idle: {
    dur: 180, loop: true,
    tracks: {
      /* 呼吸：**不对称** —— 快吸 40%（0→72）→ 屏息 15%（72→99）→ 慢呼 45%（99→180）。
         原来两段 io 拼成对称单峰 = 钟摆，改掉它是这一轮收益最大的一笔。
         sx 与 sy 从**反相**改成**同相**且 sy 摆得更多：原来是 sx +1.50% / sy −0.30%
         （横向涨纵向缩）= 果冻横向晃；卡通吸气是两个方向一起鼓、竖向更明显（膈肌下沉），
         所以 sy +1.5% > sx +1.2%。
         上浮 7.2 局部单位（≈ 身径 291px 的 2.5%）；环是 Sun 的子节点会跟着动，余量实测安全。
         循环接缝：第 0 与 180 帧都取 REST，所以低频漂移在接缝处乘的是 0。 */
      'sun.y':        [[0, 324, 'inhale'], [72, 316.8, 'hold'], [99, 316.8, 'exhale'],
                       [180, 324, 'lin']],
      'sun.sx':       [[0, 0.79, 'inhale'], [72, 0.7995, 'hold'], [99, 0.7995, 'exhale'],
                       [180, 0.79, 'lin']],
      'sun.sy':       [[0, 0.79, 'inhale'], [72, 0.80185, 'hold'], [99, 0.80185, 'exhale'],
                       [180, 0.79, 'lin']],

      /* 眨眼**不在这里** —— 见文件末尾 createBlinkLayer()。
         「随机间隔 + 偶尔连眨」没法用循环关键帧表达：循环表每 N 秒必然精确复现，
         那正是「固定 3 秒眨一次」这个机械感的来源。
         这两条只保留恒定基准值，且三个状态都要驱动 —— 否则「不驱动 = 不复位」，
         从 Hover 切回 Idle 时会残留上一状态的眼部不透明度。 */
      'eyeDot.op':    [[0, 1, 'lin'], [180, 1, 'lin']],
      'eyeClosed.op': [[0, 0, 'lin'], [180, 0, 'lin']],
      'mouthFlat.op': [[0, 1, 'lin'], [180, 1, 'lin']],
      'mouthRound.op':[[0, 0, 'lin'], [180, 0, 'lin']],
      'catFace.op':   [[0, 0, 'lin'], [180, 0, 'lin']],

      'ring.x':       [[0, 8.1, 'lin'], [180, 8.1, 'lin']],
      'ring.y':       [[0, 5.7, 'lin'], [180, 5.7, 'lin']],
      /* 待机摆动：统一成「越靠外越滞后、滞后越多的摆幅也越大」——
             冠 ±2.4° @112（滞后 24）→ 花 ±4.2° @124（36）→ 叶 ±5.6° @131（43）
             → 环 ±8.6° @135（47）
         两个方向都单调，读起来是「整棵都在被身体拖着走」。
         峰值挪到 135 后，第 0 / 180 帧正好落在过零点（0.6545）——
         首尾同值且**速度也同向**，接缝完全连续；若峰值落在非过零点，首帧会跳 3.2°。 */
      'ring.rot':     [[0, 0.6545, 'io'], [45, 0.5045, 'io'], [90, 0.6545, 'io'],
                       [135, 0.8045, 'io'], [180, 0.6545, 'lin']],
      'ring.s':       [[0, 0.37, 'lin'], [180, 0.37, 'lin']],

      /* 三个装饰的「滞后摇摆」：都比身体慢半拍跟上。
         身体在 88 帧到达最高点，皇冠极值 112（滞后 24）、花 124（36）、叶 131（43）——
         三个刻意不同步，否则会被看成"一个时钟驱动的整体"。

         花与叶是同一枚发夹，但**叶更轻**：摆幅更大（6.2 vs 3.8）且峰值更晚（+7 帧），
         才读得出"叶子自己在晃"而不是"焊在花上跟着刚性摆动"。
         两者支点也不同（花绕自身中心 65,-61.5；叶绕梗根 73,-46），见 index.js 的 FLOWER_P / LEAF_P。

         这里只是**基准摆幅**。运行时还有两层在动它：DRIFT.decor 把摆幅按 ±12% 缓慢调制；
         DECOR 相位漂移把「滞后多少」各自游走（花 ±18 帧 / 叶 ±27.6 帧）——
         所以实际峰值帧不是固定的 124 / 131。

         首尾同值且用 io（两端速度归零），循环接缝不会跳变；叶的峰后段比花短是故意的
         —— 叶回弹快，尾巴仍是 11 帧，与花一致。 */
      'crown.rot':    [[0, -1.72, 'io'], [22, -2.4, 'io'], [67, 0, 'io'],
                       [112, 2.4, 'io'], [157, 0, 'io'], [180, -1.72, 'lin']],
      'flower.rot':   [[0, -1.573, 'io'], [34, -3.8, 'io'], [79, 0, 'io'],
                       [124, 3.8, 'io'], [169, 0, 'io'], [180, -1.573, 'lin']],
      'leaf.rot':     [[0, -1.573, 'io'], [41, -6.2, 'io'], [86, 0, 'io'],
                       [131, 6.2, 'io'], [169, 0, 'io'], [180, -1.573, 'lin']],

      /* 点击才点头，平时必须是 0 —— 三个状态都要驱动这条属性，
         否则混合器会「不驱动 = 不复位」，点完一次脸就永久偏上/偏下 */
      'look.y':       [[0, 0, 'lin'], [180, 0, 'lin']],

      /* 星光不在这里 —— 它是独立的特效层，见文件末尾 createSparkLayer() */
    },
  },

  /* Hover：100 帧循环。不是「停住」—— 上浮的同时还在小幅起伏，眼睛钉住不眨、嘴换圆嘴 */
  Hover: {
    dur: 100, loop: true,
    tracks: {
      /* 呼吸（与 Idle 同一套口径）：
         上浮 6.2（原来 3.56，比 Idle 的 7.2 还平静 —— 被注意到反而放松，读反了）；
         周期 100 帧（1.67s，原 120）：被注意到 → 呼吸变浅变快 = 提起精神，
         装饰 / 星环 / 五官的帧号按 100/120 等比缩放，形状没变；
         sx 与 sy 同相（+1.2% / +1.5%），与 Idle 一致。 */
      'sun.y':        [[0, 309.78, 'inhale'], [40, 303.58, 'hold'], [55, 303.58, 'exhale'],
                       [100, 309.78, 'lin']],
      'sun.sx':       [[0, 0.8295, 'inhale'], [40, 0.83945, 'hold'], [55, 0.83945, 'exhale'],
                       [100, 0.8295, 'lin']],
      'sun.sy':       [[0, 0.8295, 'inhale'], [40, 0.84194, 'hold'], [55, 0.84194, 'exhale'],
                       [100, 0.8295, 'lin']],

      'eyeDot.op':    [[0, 1, 'lin'], [100, 1, 'lin']],
      'eyeClosed.op': [[0, 0, 'lin'], [100, 0, 'lin']],
      'mouthFlat.op': [[0, 0, 'lin'], [100, 0, 'lin']],
      'mouthRound.op':[[0, 1, 'lin'], [100, 1, 'lin']],
      'catFace.op':   [[0, 0, 'lin'], [100, 0, 'lin']],

      'ring.x':       [[0, 8.1, 'lin'], [100, 8.1, 'lin']],
      'ring.y':       [[0, 5.7, 'lin'], [100, 5.7, 'lin']],
      'ring.rot':     [[0, 0.8245, 'io'], [50, 0.9845, 'io'], [100, 0.8245, 'lin']],
      'ring.s':       [[0, 0.37, 'lin'], [100, 0.37, 'lin']],

      'crown.rot':    [[0, -1.732, 'io'], [17, -2.0, 'io'], [42, 0, 'io'],
                       [67, 2.0, 'io'], [92, 0, 'io'], [100, -1.732, 'lin']],
      'flower.rot':   [[0, 0, 'io'], [25, -3.2, 'io'], [50, 0, 'io'],
                       [75, 3.2, 'io'], [100, 0, 'lin']],
      /* 叶：同样的形状，峰值后移 5 帧、摆幅 5.2（花 3.2）—— 与 Idle 同一套「叶更轻」的口径 */
      'leaf.rot':     [[0, 0, 'io'], [30, -5.2, 'io'], [55, 0, 'io'],
                       [80, 5.2, 'io'], [100, 0, 'lin']],

      'look.y':       [[0, 0, 'lin'], [100, 0, 'lin']],
    },
  },

  /* Clicked：150 帧一次性。
     **运动段**分三档：本体 / 五官 / 点头 → 第 48 帧收（0.80s）；装饰弹簧余摆 → 96 / 100 / 106 帧；
     星环 → 第 108 帧收（1.80s）。「点击反应」的观感长度由**本体**决定 —— 本体 0.80s 回到常态，
     剩下是星环自己在转的余韵（读作"甩出去的光环还在转"，不是"反应还没完"）。
     出口切走在 1800ms（≈108 帧）。
     不能再短：星环转满一圈需要 80 帧（车轮效应的物理下限），加前摇与收尾就是 8→108；
     切在转圈中途会让 ring.rot 在混合期**倒转一整圈**。 */
  Clicked: {
    dur: 150, loop: false,
    tracks: {
      'sun.y':        [[0, 324, 'io2'], [8, 333.48, 'io2'], [20, 306.62, 'io2'],
                       [30, 326.0, 'io'], [39, 322.6, 'io'], [48, 324, 'lin']],
      'sun.sx':       [[0, 0.79, 'io2'], [8, 0.8848, 'io2'], [20, 0.7426, 'io2'],
                       [30, 0.8060, 'io'], [39, 0.7824, 'io'], [48, 0.79, 'lin']],
      'sun.sy':       [[0, 0.79, 'io2'], [8, 0.7031, 'io2'], [20, 0.8532, 'io2'],
                       [30, 0.7748, 'io'], [39, 0.7974, 'io'], [48, 0.79, 'lin']],

      /* 点击 = 整张猫脸（自带猫眼猫嘴），原版豆豆眼/嘴全部置 0 */
      'eyeDot.op':    [[0, 0, 'lin'], [48, 0, 'lin']],
      'eyeClosed.op': [[0, 0, 'lin'], [48, 0, 'lin']],
      'mouthFlat.op': [[0, 0, 'lin'], [48, 0, 'lin']],
      'mouthRound.op':[[0, 0, 'lin'], [48, 0, 'lin']],
      'catFace.op':   [[0, 1, 'lin'], [48, 1, 'lin']],

      /* 星环：先胀（0.37→0.47）→ 绕环心转满一整圈（0.6545+2π）→ 衰减余摆。
         x/y 让环心绕半径 **16** 的小圆走（原来是 6，位移只有环半径的 1.8%，
         看不出「这是个立体的东西在转」；16 是 4.7%，再大就顶到画板下边）。
         两个方向的极值点错开 10 帧（= 1/4 周期）才合成圆，不是斜线。
         振幅别乱加大：点击态环已胀到 0.47，外缘几乎顶到画板下边 ——
         开侧转后最紧的一帧余量 +14.3 画板单位（Idle / Hover 是 +75.4）。 */
      /* 偏心圆：x 的极值排在 24/44/64/84，第 94 帧正好是 1/4 周期后回到圈心 8.1；
         y 的极值排在 14/34/54/74/94（与 x 差 10 帧 = 1/4 周期，才是圆不是斜线），
         第 104 帧回到圈心 5.7。两者都在出口（108 帧）之前**已经停在圈心**，
         否则混合期会看到它"飘"回去。 */
      'ring.x':       [[0, 8.1, 'lin'], [6, 8.1, 'io'], [24, -7.9, 'io'], [44, 24.1, 'io'],
                       [64, -7.9, 'io'], [84, 24.1, 'io'], [94, 8.1, 'io'], [108, 8.1, 'lin']],
      'ring.y':       [[0, 5.7, 'lin'], [6, 5.7, 'io'], [14, 21.7, 'io'], [34, -10.3, 'io'],
                       [54, 21.7, 'io'], [74, -10.3, 'io'], [94, 21.7, 'io'], [104, 5.7, 'io'],
                       [108, 5.7, 'lin']],

      /* 转圈这一段**必须用 spin 缓动，不能用 io2**。
         判据是「每帧角位移 ≤ 火尖角距的 1/4」：环上约 20 个火尖、角距 ≈18°，
         理想线 4.5°/帧、Nyquist 9°/帧。80 帧转 360° 的平均速度正好 4.50°/帧，
         但 io2 的峰值是平均的 2.56 倍 = 11.5°/帧，超过火尖半间距 9° →
         每一帧火尖的落点离**隔壁那根**比离自己更近，眼睛建立不起帧间对应，
         中段看到的不是「在转」而是「原地乱跳」。且 io2 峰值在 u=0.24（前 1/4）→
         前 1/4 糊、后 3/4 慢爬，没有一段同时「看得清」和「在动」。
         spin 把峰值压到 0.39 角距/帧（≈7.0°/帧），且峰值落在正中，全程可追踪。
         （80 帧转一圈的物理下限是 0.25 角距/帧峰值，要达到得 123 帧，
          会超出 108 帧的归位窗口 —— 所以 0.39 是这套时序下的最优解。）

         三处配合：
         ① 转圈区间 8→88（80 帧不变），与身体的挤压（0→8 帧）**首尾相接而不是串行**。
         ② 前摇 −0.122rad(7.0°) 并挪到 0→8 帧与挤压**同时**发生（3.4° 只有火尖角距的 1/5，
            读不出蓄力）。总转角 366.9°，平均 4.59°/帧 → 峰值 0.392 角距/帧，仍在阈值内。
         ③ 收尾过冲 +0.17rad（9.7°），回弹更"甩"。
         终点必须正好回到 0.6545（净转 1 圈），否则切回 Idle 时会跳一下。
         第 88 帧用 hold：下一帧要跳回 0.6545，线性会插出 3.796rad(217°) 这个错误角度。 */
      'ring.rot':     [[0, 0.6545, 'io'], [8, 0.5325, 'spin'],
                       [88, 6.9377, 'hold'],
                       [89, 0.6545, 'lin'], [97, 0.8245, 'io2'], [104, 0.5785, 'io'],
                       [108, 0.6545, 'lin']],
      /* 离心脉动：胀缩的**峰值要与角速度峰值同相**（转圈区间 8→88，角速度峰在帧 48），
         转得最快时环最大 → 读作被甩出去的。谷压到 0.428 / 0.435，幅度大一点才看得出
         「在呼吸」而不是抖动。 */
      'ring.s':       [[0, 0.37, 'io2'], [8, 0.47, 'io'], [28, 0.428, 'io'], [48, 0.47, 'io'],
                       [68, 0.435, 'io'], [88, 0.47, 'io'], [104, 0.37, 'lin']],

      /* 冲击把三个装饰甩一下，再各自衰减回 0。轻的甩得更大、回得更慢。
         **两条实现，由 FX.spring 选**（见上面 SPRING / CLICK_DECOR_FALLBACK）：
           · 弹簧版：首峰帧与幅度跟原来一模一样（8/10/13 帧，5.5/7.0/9.4 度），
             但极值点速度不再归零 —— 是连续衰减的余摆，读作"被敲了一下在振"。
             归位帧 96/100/106（出口混合在 114 帧才开始，安全）。
           · 手写版（旧）：三段 io/io2 接出来的衰减，每个极值点都"顿"一下。 */
      'crown.rot':    clickDecor('crown.rot'),
      'flower.rot':   clickDecor('flower.rot'),
      'leaf.rot':     clickDecor('leaf.rot'),

      /* 点击时表情不跟鼠标，改成上下点头（Face 局部单位，Face 已 scale 0.30，
         所以 30 单位 ≈ 屏幕 9px）。起始点排在过渡混合期（260ms ≈ 16 帧）之后，
         否则会被 blend 稀释。峰值刻意滞后身体弹跳 ~4 帧，读作「头有重量」。
         整条压在 60 帧内 —— 本体 48 帧就收了，点头拖太久会让脸在身体站稳后还在晃。
         第 60 帧归 0：切走时 Idle/Hover 从各自第 0 帧接上，不归零会看到脸跳一下。 */
      'look.y':       [[0, 0, 'io2'], [12, 30, 'io2'], [26, -14, 'io2'], [38, 16, 'io'],
                       [50, -6, 'io'], [60, 0, 'lin']],

      /* 星光同样不在这里 —— 由特效层在进入 Clicked 时起爆 */
    },
  },
};

/* 各属性的「静止值」。某个动画没驱动到的属性就不参与混合，此时沿用上一帧的值
   （对应 Rive「不驱动 = 不复位」的语义）。 */
const REST = {
  /* sun.y 的静止值 = Sun 节点的落点（否则首帧就会带一个偏移），直接引用 SUN */
  'sun.y': SUN.y, 'sun.sx': 0.79, 'sun.sy': 0.79,
  'ring.x': 8.1, 'ring.y': 5.7, 'ring.rot': 0.6545, 'ring.s': 0.37,
  /* ring.sx / ring.sy 不是混合出来的，而是每帧由 ring.s × 侧转系数算出（见 step()）。
     这里给初值，是为了首帧 apply(mixer.values) 就能拿到 0.37 / 0.37。 */
  'ring.sx': 0.37, 'ring.sy': 0.37,
  'eyeDot.op': 1, 'eyeClosed.op': 0, 'mouthFlat.op': 1, 'mouthRound.op': 0, 'catFace.op': 0,
  /* 装饰的静止角取 Idle 第 0 帧的值，这样首帧不会跳。花与叶同值 ——
     静止时两层叠在一起，差值只出现在动画里。 */
  'crown.rot': -1.72, 'flower.rot': -1.573, 'leaf.rot': -1.573,
  'look.y': 0,   // 点头的静止值：平时脸在正中
  /* 星光由特效层驱动（不属于任何状态），这里只给一个「全关」的初值。
     基准缩放必须与 scene.js 里皇冠的 scale 一致（都是 0.115）—— 星光是皇冠上迸出来的，
     两者不同步会看着「星比冠大/小一圈」。 */
  'spark1.op': 0, 'spark1.s': 0.115, 'spark1.d': 0,
  'spark2.op': 0, 'spark2.s': 0.115, 'spark2.d': 0,
  'spark3.op': 0, 'spark3.s': 0.115, 'spark3.d': 0,
  'spark4.op': 0, 'spark4.s': 0.115, 'spark4.d': 0,
};

export const STATES = ['Idle', 'Hover', 'Clicked'];

/**
 * 取某个状态某条属性的**原始关键帧**（未经状态混合）。给 `_draft/_anim-test.mjs` 用：
 * 验证「弹簧的首峰仍落在第 8 帧」必须走这条 —— 走 `mixer.values` 量不准，
 * 因为进入 Clicked 的混合期会把首峰拉低、还会把它往后挪一帧。返回 `[[帧, 值], …]`。
 */
export function rawTrack(state, key) {
  const t = DEFS[state]?.tracks?.[key];
  return t ? t.map((k) => [k[0], k[1]]) : null;
}

/* 星光特效层：皇冠那 4 颗星光**不属于任何状态动画** —— 平时不显示，点击时四颗错开起爆、
   不规则闪烁一阵再自己收掉。

   为什么不写成关键帧：**「不规则」没法用循环关键帧表达**，循环表每 N 秒必然精确复现，
   那正是原先「每 3 秒规律闪一下」这个节拍器的来源。所以用两个不成倍数的正弦叠加造闪烁，
   再用随机数决定起爆延迟与持续时长，让每次点击都不一样。

   仍是纯逻辑（只用 Math.random，不碰 DOM），与混合器是「叠加」：step() 算完混合结果后，
   由本层直接覆写 sparkN.op / sparkN.s。 */
export const SPARK_IDS = ['spark1', 'spark2', 'spark3', 'spark4'];
const SPARK_BASE_S = 0.115;                   // 星光的基准缩放（= 皇冠的 scale，两者必须一致）
const SPARK_RISE = 0.12;                      // 包络的上升段占比

/* 径向迸射的最大位移（Sun 局部单位）。原来星光只在**原地**放大 + 闪烁，
   读起来是「四颗星闪了一下」；它是从皇冠迸出来的，应该有「溅出去」的方向感。
   位移方向 = 星心 − 皇冠中心 (−98,−134)，在 index.js 里按各颗的位置烘成单位向量。
   16 单位 ≈ 屏幕 12.6px（星光在 #crownGroup ⊂ #sun 里，还要再乘 0.79）。
   别再往上加：星光外缘最紧的一颗离画板边的余量不大，太远会看出「脱开皇冠」。
   收尾不退到 0 而是留 30%（见 write()）：星是"飞出去然后暗掉"。 */
const SPARK_PUSH = 16;

/* 「依次点亮」的**空间顺序**：按各颗绕皇冠中心 (-98,-134) 的极角排 ——
   逆时针一圈是 1→4→3→2；按数组原序 1→2→3→4 会左右横跳，不成"流"。 */
const SPARK_CHASE = ['spark1', 'spark4', 'spark3', 'spark2'];
const SPARK_RANK = {};
SPARK_CHASE.forEach((id, i) => { SPARK_RANK[id] = i; });
const SPARK_STAGGER = 0.07;                   // 依次点亮的间隔（秒）→ 四颗铺开 0.21s

/* 包络：前 SPARK_RISE 线性亮起，之后按幂 1.6 收掉。
   峰值**恰好归一化到 1** —— 这样「峰值不透明度」只由闪烁项决定，不会被包络形状偷偷压低。
   （原来用 min(1,u*8)*(1-u)^1.6，峰值只有 0.676，再乘一个均值 0.5 的闪烁项，
   结果平均不到 0.35 —— 比常驻的 op=1 还暗，肉眼根本看不见。） */
function sparkEnvelope(u) {
  return u < SPARK_RISE
    ? u / SPARK_RISE
    : Math.pow(1 - (u - SPARK_RISE) / (1 - SPARK_RISE), 1.6);
}

function createSparkLayer() {
  const st = SPARK_IDS.map(() => ({
    delay: 0, life: -1, dur: 0, seed: 0, f1: 0, f2: 0,
  }));

  /** 起爆：按 SPARK_CHASE 依次点亮，但时长 / 初相 / 频率仍各自随机 */
  function fire() {
    const t0 = Math.random() * 0.10;            // 整体起爆时刻仍留随机，不然每次点击一模一样
    st.forEach((s, i) => {
      /* 依次点亮 = 按空间顺序排队，而不是四颗各自随机（那样看着像"同时闪"）。
         仍加 ±0.04s 抖动 —— 完全等间隔会退化成节拍器。 */
      s.delay = t0 + SPARK_RANK[SPARK_IDS[i]] * SPARK_STAGGER + Math.random() * 0.04;
      s.dur   = 1.0 + Math.random() * 1.0;      // 各自亮 1.0~2.0s
      s.life  = 0;
      s.seed  = Math.random() * Math.PI * 2;
      s.f1    = 3 + Math.random() * 3;          // 3~6 Hz
      s.f2    = 7 + Math.random() * 4;          // 7~11 Hz，与 f1 不成倍数（都在 30 Hz 以下，不欠采样）
    });
  }

  /** 每帧把 sparkN.op / sparkN.s 直接写进 out（覆写混合结果） */
  function write(dt, out) {
    for (let i = 0; i < st.length; i++) {
      const s = st[i], id = SPARK_IDS[i];
      let op = 0, sc = SPARK_BASE_S, rad = 0;

      if (s.life >= 0) {
        s.life += dt;
        const t = s.life - s.delay;
        const span = s.dur - s.delay;
        if (t >= span) {
          s.life = -1;                              // 收工，之后一直是 0
        } else if (t >= 0) {
          const u = t / span;
          const env = sparkEnvelope(u);
          /* 两个不成倍数的正弦叠加 → 看上去「不规则」，但仍是纯函数，不需要随机数表。
             振幅 0.55±0.45，所以中途会明显暗一下。 */
          const a = Math.sin(s.seed + u * s.f1 * Math.PI * 2);
          const b = Math.sin(s.seed * 2.3 + u * s.f2 * Math.PI * 2);
          const flick = 0.55 + 0.30 * a + 0.15 * b;                 // 0.10 ~ 1.00
          op = Math.max(0, Math.min(1, env * flick));
          sc = SPARK_BASE_S * (1 + 1.6 * env);                      // 0.115 → 0.299
          /* 径向迸射跟着包络往外推，收尾留 30% 不退回原点 ——
             读起来是「溅出去然后在远处暗掉」，不是「弹出去又被吸回来」。 */
          rad = SPARK_PUSH * (0.30 + 0.70 * env);                   // 0 → 16
        }
      }

      out[id + '.op'] = op;
      out[id + '.s'] = sc;
      out[id + '.d'] = rad;
    }
  }

  return { fire, write };
}

/* 眨眼层：从 Idle 关键帧里搬出来，因为「固定 3 秒眨一次」是机械感的来源 ——
   循环关键帧每 N 秒必然精确复现，**没法表达随机间隔**。所以交给一个**每个混合器实例
   各自持有**的计时器，按随机间隔触发。仍是纯逻辑，与混合器是「叠加」：
   step() 算完加权平均后由本层覆写眼部不透明度。

   用 min/max 叠加而不是直接赋值，是为了让**混合期**也正确：
     eyeClosed.op = max(混合值, 闭眼量)   —— Clicked 里混合值是 0，不会被顶起来
     eyeDot.op    = min(混合值, 1-闭眼量)
   再乘一个 (1 - w(Clicked))：点击时整张猫脸盖住五官，闭眼图不该浮在猫脸上。

   两个闸门（都只拦「发起新眨眼」，已经在眨的那次照常播完）：
     · 悬停时默认不发起新眨眼（BLINK.inHover = false）
     · 点击时闭眼量乘 (1 - w(Clicked)) */
export const BLINK = {
  /* 间隔一律是「两次眨眼**起点**到起点」的口径，不是「眨完之后的停顿」——
     内部会减掉 dur，所以写在这里的数就是眼睛两次闭上之间的真实间隔。 */
  min: 2.5, max: 6.0,              // 常规间隔区间（秒）—— 有变化才不会变成节拍器
  double: 0.15,                    // 连眨概率
  doubleMin: 0.20, doubleMax: 0.28,// 连眨的间隔（≈ 眨完停 ~0.1s 再眨 = 连眨两下）
  firstMin: 1.5, firstMax: 3.5,    // 首次眨眼的延迟（比常规间隔短，别让首屏等太久）

  /* 单次眨眼的相位，**按帧对齐**（不是按比例）。
     用「时长 × 百分比」分相位会让采样点错开「完全闭合」那一帧 ——
     实测闭眼量峰值只到 0.883、豆豆眼残留 0.117，也就是**眼睛从来没真正闭上**。
     5 帧闭合（ei）+ 1 帧完全闭合 + 3 帧张开（eo）= 9 帧 = 0.15s。 */
  closeF: 5, holdF: 1, openF: 3,

  /* 眨眼时身体微沉：真人闭眼那一下头会轻轻沉一点，加上它眨眼就从「眼睛图层换了个
     透明度」变成「整个人动了一下」。
     单位是 **sun.y**（Sun 局部单位，还要乘 0.79）→ 1.6 ≈ 屏幕 1.26px，必须小：
     点头（look.y）峰值是 30 单位 ≈ 9px，sink 到它的零头就够，再大会被读成「每隔几秒点一下头」。
     叠在 **sun.y** 而不是 look.y 上 —— look.y 有回归断言「Idle 跑 6 秒恒为 0」，
     挂上去会红；而且整颗头沉比脸单独沉更像眨眼。
     b 已经乘过 open = 1 − w(Clicked)，所以点击（整张猫脸）时不会沉。 */
  sink: 1.6,

  /* 悬停时眨不眨。**默认不眨** —— Hover 轨道里 eyeDot 钉 1、eyeClosed 钉 0，
     注释写的是「眼睛钉住不眨」。想改成「悬停也眨」把它置 true 即可。 */
  inHover: false,
};
BLINK.dur = (BLINK.closeF + BLINK.holdF + BLINK.openF) / 60;

/**
 * 太阳这边的眨眼层 = **共享时序**（`src/shared/blink.js`）+ **太阳专属的写回**。
 * 写回这层不能进共享：它知道太阳有三个眼层（eyeDot / eyeClosed 交叉淡入），
 * 还要往 `sun.y` 叠一层微沉。曲线参数也留在本文件（`EASE.ei` / `EASE.eo`）。
 */
function createBlinkLayer() {
  const blink = createBlinkTimer({
    ...BLINK,
    easeIn: EASE.ei,       // 闭合 5 帧
    easeOut: EASE.eo,      // 张开 3 帧
  });

  /**
   * 每帧把闭眼量叠到 out 上。
   * @param open   1 - w(Clicked)：点击时整张猫脸盖住五官，闭眼图不该浮在猫脸上
   * @param active 是否允许**发起**新的眨眼（已经在眨的那次不受影响，会正常播完）
   */  function write(dt, out, open, active) {
    blink.step(dt, active);
    const b = blink.value() * open;
    if (b <= 0) return;
    out['eyeClosed.op'] = Math.max(out['eyeClosed.op'], b);
    out['eyeDot.op'] = Math.min(out['eyeDot.op'], 1 - b);
    /* 微沉：见 BLINK.sink。直接 += 而不是赋值 —— 它是叠在呼吸上的，不能覆盖掉。 */
    if (BLINK.sink) out['sun.y'] += b * BLINK.sink;
  }

  return { step: blink.step, value: blink.value, fire: blink.fire, write };
}

/**
 * 状态机 + 混合器。三个动画各有一个播放头，按权重加权平均后输出一组绝对值。
 * 输入用 setHover / setPressed 推进；出口条件与 scene.rml 的 State Machine 1 逐条对应：
 *   Idle    → pressed ? Clicked : hover ? Hover
 *   Hover   → pressed ? Clicked : !hover ? Idle
 *   Clicked → !pressed && t >= 1.8s ? (hover ? Hover : Idle)
 *             ↑ 两个出口都要求 pressed != true，所以按住期间不会退出 Clicked
 * 权重切换不是「切一下就跳」：记下起止权重，在 blendMs 内按 ease-in-out 插值 —— 即交叉混合。
 */
export function createMixer() {
  const anims = {};
  const sparks = createSparkLayer();
  const blinks = createBlinkLayer();      // 每个实例各自持有时序 → 多个角色不会同步眨眼
  const drift = createDriftLayer();       // 低频漂移（⑤），同样逐实例
  const decor = createDecorLayer();       // 向日葵相位漂移（⑥），逐实例 → 多个角色不会同步

  for (const name of STATES) {
    const d = DEFS[name];
    anims[name] = {
      dur: T(d.dur),
      loop: d.loop,
      tracks: d.tracks,
      has: new Set(Object.keys(d.tracks)),
      w: name === 'Idle' ? 1 : 0,
      t: 0,
    };
  }

  const ALL_KEYS = [...new Set(STATES.flatMap((n) => [...anims[n].has]))];

  /* tOff 是**相位偏移**（秒），由装饰层给花/叶用。只有循环态需要回卷 ——
     非循环态（Clicked）的 tOff 恒为 0（层那边乘了 1 − w(Clicked)）。
     轨道是 dur 周期的且首尾同值同速，所以回卷点不会引入跳变。 */
  function sample(a, key, tOff = 0) {
    const f = a.tracks[key];
    let t = a.t;
    if (tOff) t = a.loop ? ((t + tOff) % a.dur + a.dur) % a.dur : t;
    const tf = t * 60;                          // 秒 → 帧
    const n = f.length;
    if (tf <= f[0][0]) return f[0][1];
    if (tf >= f[n - 1][0]) return f[n - 1][1];
    let i = 0;
    while (i < n - 1 && f[i + 1][0] <= tf) i++;
    const p = f[i], q = f[i + 1];
    if (p[2] === 'hold') return p[1];
    const u = (tf - p[0]) / (q[0] - p[0]);
    return p[1] + (q[1] - p[1]) * (p[2] === 'lin' ? u : EASE[p[2]](u));
  }

  let cur = Object.assign({}, REST);
  let current = 'Idle';
  let hover = false;
  let pressed = false;
  let blend = null;

  /* 状态切换：不是「切一下就跳」，而是记下起止权重，在 duration 内插值 —— 即交叉混合。
     混合曲线按**目标状态**选：进入 Clicked 用陡峭的 punchIn，其余保持 io。 */
  function setState(name, blendMs) {
    if (name === current) return;
    const w0 = {}, w1 = {};
    for (const n of STATES) { w0[n] = anims[n].w; w1[n] = n === name ? 1 : 0; }
    blend = {
      w0, w1, dur: Math.max(blendMs / 1000, 1e-4), t: 0,
      ease: (name === 'Clicked' && FX.blendPunch) ? EASE.punchIn : EASE.io,
    };
    /* 播放头**只在进入 Clicked 时**归零。
       Idle 与 Hover 是同一个呼吸的两档，若每次切换都 `t = 0`，鼠标反复进出太阳时
       呼吸会被一次次掐断重来（看着一顿一顿）。改成按相位接续：`t % dur`，
       呼吸波形不断，只换幅度与周期。Clicked 是一次性动作，仍必须从第 0 帧起。 */
    if (name === 'Clicked') anims[name].t = 0;
    else anims[name].t = anims[current].t % anims[name].dur;

    /* 转场眨眼：Idle → Hover 时眨一下，读起来是「注意到你了」。
       只在**从 Idle 进来**时眨 —— 从 Clicked 回 Hover 不该再补一下。
       它不受 BLINK.inHover 影响：那条只拦「悬停期间发起新眨眼」。 */
    if (name === 'Hover' && current === 'Idle') blinks.fire();

    if (name === 'Clicked') sparks.fire();      // 只有点击才放星光
    current = name;
  }

  /* 状态机：与 scene.rml 的 State Machine 1 逐条对应 */
  function evaluate() {
    if (current === 'Clicked') {
      /* 两个出口都要求 pressed != true，且出口时间已到。
         声明顺序里「回 Hover」在前，所以 hover 时优先走它。
         出口时间 1800ms：星环的转圈 + 收尾正好在第 108 帧（=1.80s）走完，
         环心也已在第 104 帧回到圈心，所以切走时没有任何一条轨道还在半路。
         不能再短：切在转圈中途，ring.rot 会在混合期从 ~6rad 插值回 0.65rad —— 那是倒着转一整圈。 */
      if (!pressed && anims.Clicked.t >= 1.8) {
        if (hover) setState('Hover', 240); else setState('Idle', 380);
      }
    } else if (current === 'Idle') {
      if (pressed) setState('Clicked', 260);            // 这条声明在前，优先
      else if (hover) setState('Hover', 180);
    } else {                                            // Hover
      if (pressed) setState('Clicked', 260);
      else if (!hover) setState('Idle', 180);
    }
  }

  function step(dt) {
    drift.step(dt);                             // 低频漂移的时间轴与状态无关，独立走
    decor.step(dt);                             // 向日葵相位漂移同理

    for (const n of STATES) {
      const a = anims[n];
      if (a.w <= 0) continue;
      a.t += dt;
      if (a.loop) a.t %= a.dur;
      else if (a.t > a.dur) a.t = a.dur;
    }

    evaluate();

    if (blend) {
      blend.t += dt;
      const u = Math.min(blend.t / blend.dur, 1);
      const e = blend.ease(u);
      for (const n of STATES) {
        anims[n].w = blend.w0[n] + (blend.w1[n] - blend.w0[n]) * e;
      }
      if (u >= 1) blend = null;
    }

    /* 向日葵相位偏移：花/叶各自游走，避免「一整枚发夹刚性摆动」。
       先算一次给两条 key 用 —— 别在下面的 ALL_KEYS 循环里逐 key 算。 */
    const decorOff = (FX.decorPhase && anims.Clicked.w < 1)
      ? decor.offsets(1 - anims.Clicked.w)
      : null;

    const out = {};
    for (const key of ALL_KEYS) {
      const tOff = decorOff ? (decorOff[key] || 0) : 0;
      let sum = 0, w = 0;
      for (const n of STATES) {
        const a = anims[n];
        if (a.w <= 0 || !a.has.has(key)) continue;      // 没驱动这条属性的动画不参与归一
        sum += a.w * sample(a, key, tOff);
        w += a.w;
      }
      out[key] = w > 0 ? sum / w : cur[key];
    }

    /* 低频漂移：把「偏离静止值的量」按 ±depth 缩放，见 DRIFT 的注释。
       必须在混合**之后**做 —— 这样三个状态各自的幅度都会被同一个系数调制，
       混合期不会出现两条轨道幅度不一致导致的额外抖动。 */
    if (FX.drift) {
      const d = drift.value() * (1 - anims.Clicked.w);   // 点击期间不漂移
      for (const [key, depth] of DRIFT_KEYS) {
        /* 基准取「各状态**自己轨道**的第 0 帧值」的加权平均，**不是 REST**。
           用 REST 会错在 Hover：它是上浮态，`out - REST` 里混着 14.2 单位的「上浮高度」，
           一起按 ±20% 缩放就等于在改悬停高度。取各状态自己的起点，漂移就只作用在
           「这个状态自身的振荡幅度」上。Idle 的轨道起点恰好等于 REST，所以行为一致。 */
        let base = 0, ws = 0;
        for (const n of STATES) {
          const w = anims[n].w, tr = DEFS[n].tracks[key];
          if (w <= 0 || !tr) continue;
          base += w * tr[0][1]; ws += w;
        }
        if (ws <= 0) continue;
        base /= ws;
        out[key] = base + (out[key] - base) * (1 + depth * d);
      }
    }

    /* 星环 3D 侧转：不是混合出来的，而是在混合结果上再乘一个「倾斜系数」。
       用 ring.s 作基准而不是另写一条轨道 —— 离心脉动照旧，侧转只在它上面叠一个方向性的压缩。
       乘 Clicked 的权重：混合期侧转跟着淡入淡出，不会在切进去的瞬间"啪"地压扁。 */
    const tilt = FX.ringTilt
      ? ringTilt(anims.Clicked.t * 60, anims.Clicked.w)
      : { x: 1, y: 1 };
    out['ring.sx'] = out['ring.s'] * tilt.x;
    out['ring.sy'] = out['ring.s'] * tilt.y;

    /* 星光特效层：不参与加权混合，直接覆写 sparkN.op / sparkN.s。
       它不随状态权重淡出 —— 点击后自己走完整个包络再收掉。 */
    sparks.write(dt, out);

    /* 眨眼层：同样不参与混合，用 min/max 叠到眼部不透明度上。
       open   = 1 - w(Clicked)：点击时整张猫脸盖住五官，闭眼图不该浮在猫脸上
       active = 是否允许发起新眨眼（悬停默认不眨，见 BLINK.inHover） */
    blinks.write(dt, out, 1 - anims.Clicked.w,
      BLINK.inHover || anims.Hover.w < 0.5);

    cur = out;
    return out;
  }

  return {
    setHover(v) { hover = v; },
    setPressed(v) { pressed = v; },
    step,
    sample,
    /** 某个状态的当前权重（0~1）。index.js 用它把「点击时视线回中」做成连续过渡 */
    weight(name) { return anims[name] ? anims[name].w : 0; },
    get state() { return current; },
    get weights() { return STATES.map((n) => [n, anims[n].w]); },
    get times() { return STATES.map((n) => [n, anims[n].t]); },
    get inputs() { return { hover, pressed }; },
    get values() { return Object.assign({}, cur); },
  };
}
