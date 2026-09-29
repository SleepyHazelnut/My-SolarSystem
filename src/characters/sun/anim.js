/**
 * 动画层：太阳的动作 —— 本体呼吸 + 悬停上浮 + 按压回弹 + 随机眨眼。
 *
 * 纯逻辑、不碰 DOM，每帧返回一组绝对值，由 `index.js` 写进 SVG 属性。
 * 姿态由 `core/motions.js` 的原语经 `compose()` 叠出，新增动作在 `compose()` 追加一项。
 *
 * 呼吸落在本体上：火焰边缘烘在本体内，本体缩放即整颗太阳的呼吸。
 *
 * 素材几何：`sun_base.png` 与 `src/assets/eye/*.png` 都是 1536 画布，且眼图从本体上原样抠出，
 * 内容已在画布上的正确位置，两层共用同一份 `CANVAS_T`。见 `_draft/_rebuild-eyes.py`。
 */
import { cubicBezier } from '../../shared/easing.js';
import { approach } from '../../shared/approach.js';
import { dampedImpulse } from '../../shared/impulse.js';
import { breath, compose, hover, press, spring } from '../../core/motions.js';
import { createBlinkLayer, eyeWeights } from '../../shared/blink.js';

/* Sun 节点在画板上的落点，唯一一份：scene.js 的静态 <g translate> 与 index.js 写 #sun 的
   基准偏移都取自这里。
   值 = viewBox 中心 − 动作包络中心，所以太阳在画布里居中。 */
export const SUN = { x: 268.2, y: 263.0 };

/* 素材画布（1536）→ 局部单位。本体与三态眼共用，改这一个数不会让两层错开。
   0.42：本体（含火焰）1055 px 高 → 443 单位。 */
const K = 0.42;

/* 素材画布中心。两层都按它对齐，即本体与眼睛的共同原点。 */
const CANVAS_C = 768;

/* 呼吸缩放的支点 = 太阳球心（素材坐标 (788, 732)，实测球半径 ≈348）。
   不用画布中心 (768,768)：该点偏左下，绕它缩放会带轻微平移。 */
export const BODY_C = { x: K * (788 - CANVAS_C), y: K * (732 - CANVAS_C) };

/** 素材画布（1536）→ 局部单位 的公共变换。本体与三态眼**都用它**，只此一份 ——
    两层都是 1536 画布、内容都在画布上的正确位置，共用一份即天然对齐，不需要对位参数。
    见 `_draft/_rebuild-eyes.py`。 */
export const CANVAS_T = `scale(${K}) translate(-${CANVAS_C} -${CANVAS_C})`;

/* 呼吸（本体）：周期 4.3 s，幅度小 —— 火焰边缘为锯齿状，胀过头会张开缝。
   纵向为主，横向跟四成；`lift` 是同一条正弦驱动的纵向起伏。 */
const BREATH = { dur: 4.3, amp: 0.018, lift: 2.4, wide: 0.40 };

/* 悬停：整颗上抬（负 = 上）。rate 越大越跟手。 */
const HOVER = { lift: -9, rate: 11 };

/* 按压：按住时压扁并下沉。`amp` 是纵向压缩量，横向按 `wide` 反向鼓；`rate` 越大越跟手。 */
const PRESS = { amp: 0.065, wide: 0.75, sink: 3.0, rate: 22 };

/* 松手回弹：一次冲激 + 指数衰减（`shared/impulse.js`）。
   `omega` 决定回弹快慢，`decay` 决定几下停；`dur` 之后冲激归零、不再参与合成。
   冲激值 sin 起手，所以松手那帧的形变是 0，与按住的姿态接得上。 */
const KICK = { amp: 0.10, decay: 7.0, omega: 19, dur: 1.0 };

/* 眨眼：相位按帧对齐（5 闭 + 1 保持 + 3 睁 = 9 帧）。
   三态眼图由 `_draft/_rebuild-eyes.py` 生成 —— 半闭 / 闭 为睁眼绕自身中心垂直压扁
   （0.5047 / 0.1682）。 */
const BLINK = {
  min: 2.5, max: 6.0,              // 两次眨眼起点到起点的间隔（秒）
  firstMin: 1.5, firstMax: 3.5,    // 首次眨眼的延迟
  double: 0.15,                    // 连眨概率
  doubleMin: 0.20, doubleMax: 0.28,
  closeF: 5, holdF: 1, openF: 3,
};

/* 眨眼的闭合 / 张开曲线。 */
const EASE = {
  ei: cubicBezier(0.40, 0.00, 1.00, 1.00),   // 闭合
  eo: cubicBezier(0.00, 0.00, 0.20, 1.00),   // 张开
};

/**
 * 建一个太阳的动画实例（纯计算，不碰 DOM）。
 * @param rand 随机源，注入是为了锁种子复现（探针用）；默认 Math.random。
 */
export function createSunAnim({ rand = Math.random } = {}) {
  const blink = createBlinkLayer({ ...BLINK, easeIn: EASE.ei, easeOut: EASE.eo, rand });

  let t = 0;            // 全局时间轴（秒）。两条正弦都从它取相位，保证连续
  let hoverW = 0;       // 悬停权重 0~1，指数逼近
  let hovered = false;
  let pressW = 0;       // 按压权重 0~1，指数逼近
  let pressed = false;
  let kickT = Infinity; // 松手后经过的时间（秒）；Infinity = 没有正在跑的冲激

  /** 推进一帧，返回该帧要写进 DOM 的一组绝对值（单位 = viewBox）：
   *  `bodySX` / `bodySY` 本体缩放（绕球心）、`bodyDY` 呼吸起伏 + 悬停上浮 + 按压下沉、
   *  `eyes` = [睁, 半闭, 闭] 三段不透明度。 */
  function step(dt) {
    t += dt;
    hoverW = approach(hoverW, hovered ? 1 : 0, HOVER.rate, dt);
    pressW = approach(pressW, pressed ? 1 : 0, PRESS.rate, dt);
    blink.step(dt, true);

    /* 松手回弹：`dampedImpulse` 的幅值固定取 1，幅度交给 `spring()` 的 `amp`，
       这样 `KICK.amp` 就是「回弹时纵向最大形变比例」，不必再乘一遍衰减系数。 */
    let kickU = 0;
    if (kickT !== Infinity) {
      kickU = dampedImpulse(kickT, 1, KICK.decay, KICK.omega);
      kickT += dt;
      if (kickT >= KICK.dur) kickT = Infinity;
    }

    const v = compose(
      breath(t, BREATH),
      hover(hoverW, HOVER),
      press(pressW, PRESS),
      spring(kickU, KICK),
    );

    const b = blink.value();
    return {
      bodySX: v.sx,
      bodySY: v.sy,
      bodyDY: v.dy,
      eyes: eyeWeights(b),
      blink: b,
      t,
    };
  }

  return {
    step,
    setHover(v) { hovered = v; },
    /** 按下 / 松手。松手起一次回弹冲激；按下时中断上一次未跑完的冲激。 */
    setDown(v) {
      if (v === pressed) return;
      pressed = v;
      kickT = v ? Infinity : 0;
    },
    /** 立刻眨一次 */
    blinkNow() { blink.fire(); },
    /** 当前闭眼量 0~1（探针用） */
    blinkValue: blink.value,
  };
}
