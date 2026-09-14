/**
 * 动画层：缓动函数 + 三段关键帧定义 + 状态机混合器。
 *
 * 关键帧逐条照抄 _draft/rive/scene.rml（帧号 / 值 / 该段缓动），
 * 已用 CDP 探针把环外缘半径对到 0.17% 误差。
 *
 * 这里只有纯逻辑，不碰 DOM：每帧返回一组绝对值，由 sun.js 写进 SVG 属性。
 * 保持「纯逻辑」是为了以后加星球时可以直接复用（多个 createMixer() 互不干扰）。
 */

export const DEG = 180 / Math.PI;
const T = (frame) => frame / 60;          // Rive 关键帧按 60fps 折算成秒

/* ============================================================
   1. 缓动：复刻 Rive 的 CubicEaseInterpolator
   ============================================================ */
function cubicBezier(x1, y1, x2, y2) {
  const val = (t, a, b) => 3 * a * t * (1 - t) * (1 - t) + 3 * b * t * t * (1 - t) + t * t * t;
  const der = (t, a, b) => 3 * a * (1 - t) * (1 - t) + 6 * (b - a) * t * (1 - t) + 3 * (1 - b) * t * t;
  return (x) => {
    if (x <= 0) return 0;
    if (x >= 1) return 1;
    let t = x;
    for (let i = 0; i < 8; i++) {         // 牛顿迭代
      const d = der(t, x1, x2);
      const e = val(t, x1, x2) - x;
      if (Math.abs(e) < 1e-6) break;
      if (Math.abs(d) < 1e-6) break;
      t -= e / d;
    }
    if (!(t >= 0 && t <= 1)) {            // 不收敛 → 二分兜底
      let lo = 0, hi = 1; t = x;
      for (let i = 0; i < 24; i++) {
        if (val(t, x1, x2) < x) lo = t; else hi = t;
        t = (lo + hi) / 2;
      }
    }
    return val(t, y1, y2);
  };
}

const EASE = {
  lin: (x) => x,
  io:  cubicBezier(0.42, 0.00, 0.58, 1.00),   // ease-in-out（Rive 默认 cubic）
  io2: cubicBezier(0.30, 0.00, 0.20, 1.00),   // 更强的 ease-in-out（Clicked 的挤压段）
  ei:  cubicBezier(0.40, 0.00, 1.00, 1.00),   // 眨眼闭合
  eo:  cubicBezier(0.00, 0.00, 0.20, 1.00),   // 眨眼张开
};

/* ============================================================
   2. 三段动画：逐条照抄 scene.rml 的关键帧
      每条 = [帧, 值, 该段使用的缓动]（缓动写在「段的起点」上）
      'hold' = 保持起点值直到下一个关键帧
      ============================================================ */
const DEFS = {
  /* Idle：180 帧循环。呼吸 + 眨眼 + 星尘错开闪 + 星环轻摆 */
  Idle: {
    dur: 180, loop: true,
    tracks: {
      'sun.y':        [[0, 324, 'io'], [88, 317.5, 'io'], [180, 324, 'lin']],
      'sun.sx':       [[0, 0.79, 'io'], [74, 0.80185, 'io'], [180, 0.79, 'lin']],
      'sun.sy':       [[0, 0.79, 'io'], [100, 0.78763, 'io'], [180, 0.79, 'lin']],

      'eyeDot.op':    [[0, 1, 'lin'], [162, 1, 'ei'], [168, 0, 'lin'], [171, 0, 'eo'], [180, 1, 'lin']],
      'eyeClosed.op': [[0, 0, 'lin'], [162, 0, 'ei'], [168, 1, 'lin'], [171, 1, 'eo'], [180, 0, 'lin']],
      'mouthFlat.op': [[0, 1, 'lin'], [180, 1, 'lin']],
      'mouthRound.op':[[0, 0, 'lin'], [180, 0, 'lin']],
      'catFace.op':   [[0, 0, 'lin'], [180, 0, 'lin']],

      'ring.x':       [[0, 8.1, 'lin'], [180, 8.1, 'lin']],
      'ring.y':       [[0, 5.7, 'lin'], [180, 5.7, 'lin']],
      'ring.rot':     [[0, 0.6545, 'io'], [45, 0.8045, 'io'], [90, 0.6545, 'io'],
                       [135, 0.5045, 'io'], [180, 0.6545, 'lin']],
      'ring.s':       [[0, 0.37, 'lin'], [180, 0.37, 'lin']],

      'spark1.op':    [[0, 1, 'lin'], [84, 1, 'io'], [90, 0.45, 'lin'], [102, 1, 'lin']],
      'spark2.op':    [[0, 1, 'lin'], [54, 1, 'io'], [60, 0.55, 'lin'], [72, 1, 'lin']],
      'spark3.op':    [[0, 1, 'lin'], [114, 1, 'io'], [120, 0.5, 'lin'], [132, 1, 'lin']],
      'spark4.op':    [[0, 1, 'lin'], [24, 1, 'io'], [30, 0.6, 'lin'], [42, 1, 'lin']],
    },
  },

  /* Hover：120 帧循环。注意它不是「停住」—— 上浮的同时还在小幅起伏，
     眼睛钉住不眨、星尘钉 1、嘴换圆嘴 */
  Hover: {
    dur: 120, loop: true,
    tracks: {
      'sun.y':        [[0, 309.78, 'io'], [60, 306.225, 'io'], [120, 309.78, 'lin']],
      'sun.sx':       [[0, 0.8295, 'io'], [60, 0.83898, 'io'], [120, 0.8295, 'lin']],
      'sun.sy':       [[0, 0.8295, 'io'], [60, 0.82555, 'io'], [120, 0.8295, 'lin']],

      'eyeDot.op':    [[0, 1, 'lin'], [120, 1, 'lin']],
      'eyeClosed.op': [[0, 0, 'lin'], [120, 0, 'lin']],
      'mouthFlat.op': [[0, 0, 'lin'], [120, 0, 'lin']],
      'mouthRound.op':[[0, 1, 'lin'], [120, 1, 'lin']],
      'catFace.op':   [[0, 0, 'lin'], [120, 0, 'lin']],

      'ring.x':       [[0, 8.1, 'lin'], [120, 8.1, 'lin']],
      'ring.y':       [[0, 5.7, 'lin'], [120, 5.7, 'lin']],
      'ring.rot':     [[0, 0.8245, 'io'], [60, 0.9845, 'io'], [120, 0.8245, 'lin']],
      'ring.s':       [[0, 0.37, 'lin'], [120, 0.37, 'lin']],

      'spark1.op':    [[0, 1, 'lin'], [120, 1, 'lin']],
      'spark2.op':    [[0, 1, 'lin'], [120, 1, 'lin']],
      'spark3.op':    [[0, 1, 'lin'], [120, 1, 'lin']],
      'spark4.op':    [[0, 1, 'lin'], [120, 1, 'lin']],
    },
  },

  /* Clicked：150 帧一次性。运动到第 114 帧就归位，出口 exitTime 1900ms(≈114 帧) 到点切走 */
  Clicked: {
    dur: 150, loop: false,
    tracks: {
      'sun.y':        [[0, 324, 'io2'], [8, 333.48, 'io2'], [20, 306.62, 'io2'],
                       [34, 326.37, 'io'], [46, 322.42, 'io'], [72, 324, 'lin']],
      'sun.sx':       [[0, 0.79, 'io2'], [8, 0.8848, 'io2'], [20, 0.7426, 'io2'],
                       [34, 0.8058, 'io'], [46, 0.7821, 'io'], [72, 0.79, 'lin']],
      'sun.sy':       [[0, 0.79, 'io2'], [8, 0.7031, 'io2'], [20, 0.8532, 'io2'],
                       [34, 0.7742, 'io'], [46, 0.7979, 'io'], [72, 0.79, 'lin']],

      /* 点击 = 整张猫脸（自带猫眼猫嘴），原版豆豆眼/嘴全部置 0 */
      'eyeDot.op':    [[0, 0, 'lin'], [72, 0, 'lin']],
      'eyeClosed.op': [[0, 0, 'lin'], [72, 0, 'lin']],
      'mouthFlat.op': [[0, 0, 'lin'], [72, 0, 'lin']],
      'mouthRound.op':[[0, 0, 'lin'], [72, 0, 'lin']],
      'catFace.op':   [[0, 1, 'lin'], [72, 1, 'lin']],

      /* 星环：先胀（0.37→0.47）→ 绕环心转满一整圈（0.6545+2π）→ 衰减余摆。
         x/y 让环心绕半径 6 的小圆走，两个方向的极值点错开 10 帧（=1/4 周期） */
      'ring.x':       [[0, 8.1, 'lin'], [8, 8.1, 'io'], [28, 2.1, 'io'], [48, 14.1, 'io'],
                       [68, 2.1, 'io'], [88, 14.1, 'io'], [114, 8.1, 'lin']],
      'ring.y':       [[0, 5.7, 'lin'], [8, 5.7, 'io'], [18, 11.7, 'io'], [38, -0.3, 'io'],
                       [58, 11.7, 'io'], [78, -0.3, 'io'], [98, 11.7, 'io'], [114, 5.7, 'lin']],
      /* 第 88 帧用 hold：下一帧要跳回 0.6545，线性会插出 3.796rad(217°) 这个错误角度 */
      'ring.rot':     [[0, 0.6545, 'io2'], [8, 0.6545, 'io2'], [88, 6.9377, 'hold'],
                       [89, 0.6545, 'lin'], [99, 0.7545, 'io2'], [107, 0.6165, 'io'],
                       [114, 0.6545, 'lin']],
      'ring.s':       [[0, 0.37, 'io2'], [8, 0.47, 'io'], [30, 0.445, 'io'], [52, 0.47, 'io'],
                       [72, 0.452, 'io'], [88, 0.47, 'io'], [104, 0.37, 'lin']],

      /* 四颗星尘错开闪：闪点 22/46/76/96 帧，明暗与幅度各不同。
         scale 必须自己回到基准 0.10 —— 切走后 Idle/Hover 不驱动它 */
      'spark1.op':    [[0, 1, 'lin'], [16, 1, 'io'], [22, 0.30, 'lin'], [34, 1, 'lin']],
      'spark1.s':     [[0, 0.10, 'lin'], [16, 0.10, 'io'], [22, 0.153, 'lin'], [34, 0.10, 'lin']],
      'spark2.op':    [[0, 1, 'lin'], [40, 1, 'io'], [46, 0.50, 'lin'], [58, 1, 'lin']],
      'spark2.s':     [[0, 0.10, 'lin'], [40, 0.10, 'io'], [46, 0.140, 'lin'], [58, 0.10, 'lin']],
      'spark3.op':    [[0, 1, 'lin'], [70, 1, 'io'], [76, 0.35, 'lin'], [88, 1, 'lin']],
      'spark3.s':     [[0, 0.10, 'lin'], [70, 0.10, 'io'], [76, 0.167, 'lin'], [88, 0.10, 'lin']],
      'spark4.op':    [[0, 1, 'lin'], [88, 1, 'io'], [96, 0.45, 'lin'], [108, 1, 'lin']],
      'spark4.s':     [[0, 0.10, 'lin'], [88, 0.10, 'io'], [96, 0.147, 'lin'], [108, 0.10, 'lin']],
    },
  },
};

/* 各属性的「静止值」。某个动画没驱动到的属性就不参与混合，
   此时沿用上一帧的值（对应 Rive「不驱动 = 不复位」的语义）。 */
const REST = {
  'sun.y': 324, 'sun.sx': 0.79, 'sun.sy': 0.79,
  'ring.x': 8.1, 'ring.y': 5.7, 'ring.rot': 0.6545, 'ring.s': 0.37,
  'eyeDot.op': 1, 'eyeClosed.op': 0, 'mouthFlat.op': 1, 'mouthRound.op': 0, 'catFace.op': 0,
  'spark1.op': 1, 'spark1.s': 0.10,
  'spark2.op': 1, 'spark2.s': 0.10,
  'spark3.op': 1, 'spark3.s': 0.10,
  'spark4.op': 1, 'spark4.s': 0.10,
};

export const STATES = ['Idle', 'Hover', 'Clicked'];

/**
 * 状态机 + 混合器。三个动画各有一个播放头，按权重加权平均后输出一组绝对值。
 * 这是 Rive 内置的 AnimationState + 混合层，GSAP 没有对应概念，所以手写。
 *
 * 输入用 setHover / setPressed 推进来；出口条件与 scene.rml 的 State Machine 1 逐条对应：
 *   Idle    → pressed ? Clicked : hover ? Hover
 *   Hover   → pressed ? Clicked : !hover ? Idle
 *   Clicked → !pressed && t >= 1.9s ? (hover ? Hover : Idle)
 *             ↑ 两个出口都要求 pressed != true，所以按住期间不会退出 Clicked
 *
 * 权重切换不是「切一下就跳」：记下起止权重，在 blendMs 内按 ease-in-out 插值 —— 即交叉混合。
 */
export function createMixer() {
  const anims = {};

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

  function sample(a, key) {
    const f = a.tracks[key];
    const tf = a.t * 60;                        // 秒 → 帧
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

  /* 状态切换：不是「切一下就跳」，而是记下起止权重，在 duration 内插值 —— 即交叉混合 */
  function setState(name, blendMs) {
    if (name === current) return;
    const w0 = {}, w1 = {};
    for (const n of STATES) { w0[n] = anims[n].w; w1[n] = n === name ? 1 : 0; }
    blend = { w0, w1, dur: Math.max(blendMs / 1000, 1e-4), t: 0 };
    anims[name].t = 0;                          // 进入状态即从头播
    current = name;
  }

  /* 状态机：与 scene.rml 的 State Machine 1 逐条对应 */
  function evaluate() {
    if (current === 'Clicked') {
      /* 两个出口都要求 pressed != true，且 exitTime 1900ms 已到。
         声明顺序里「回 Hover」在前，所以 hover 时优先走它 */
      if (!pressed && anims.Clicked.t >= 1.9) {
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
      const e = EASE.io(u);
      for (const n of STATES) {
        anims[n].w = blend.w0[n] + (blend.w1[n] - blend.w0[n]) * e;
      }
      if (u >= 1) blend = null;
    }

    const out = {};
    for (const key of ALL_KEYS) {
      let sum = 0, w = 0;
      for (const n of STATES) {
        const a = anims[n];
        if (a.w <= 0 || !a.has.has(key)) continue;      // 没驱动这条属性的动画不参与归一
        sum += a.w * sample(a, key);
        w += a.w;
      }
      out[key] = w > 0 ? sum / w : cur[key];
    }
    cur = out;
    return out;
  }

  return {
    setHover(v) { hover = v; },
    setPressed(v) { pressed = v; },
    step,
    sample,
    get state() { return current; },
    get weights() { return STATES.map((n) => [n, anims[n].w]); },
    get times() { return STATES.map((n) => [n, anims[n].t]); },
    get inputs() { return { hover, pressed }; },
    get values() { return Object.assign({}, cur); },
  };
}
