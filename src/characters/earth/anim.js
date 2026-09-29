/**
 * 动画层：地球的动作 —— 本体呼吸 + 悬停上浮 + 按压回弹 + 随机眨眼。
 *
 * 纯逻辑、不碰 DOM，每帧返回一组绝对值，由 `index.js` 写进 SVG 属性。
 * 姿态由 `core/motions.js` 的原语经 `compose()` 叠出，新增动作在 `compose()` 追加一项。
 * 与太阳同一套动作词汇，只有周期不同（地球 3.2 s，比太阳 4.3 快一点）。
 *
 * 素材几何：`earth_base.png` 与 `eye_{open,half,closed}.png` 都是 **1536 画布**，
 * 眼图是从本体上原样抠出来的，内容已在画布上的正确位置 —— 两层共用同一份 `CANVAS_T`。
 * 见 `_draft/_import-earth-moon.py`。
 */
import { cubicBezier } from '../../shared/easing.js';
import { approach } from '../../shared/approach.js';
import { dampedImpulse } from '../../shared/impulse.js';
import { breath, compose, hover, press, spring } from '../../core/motions.js';
import { createBlinkLayer, eyeWeights } from '../../shared/blink.js';

/** viewBox 的左上角（局部坐标）与尺寸。
 *  由「所有动作的包络」推出：呼吸缩放 + 悬停上浮 + 按压下沉 + 回弹过冲 + 入场过冲，
 *  逐项按最坏情况取并集。**动作幅度调大必须重算**，否则会被裁掉。
 *
 *  宽度特意比包络宽出约 12 单位/侧：按压是**横向鼓起**（`press()` 的 `wide`），
 *  鼓到最大时包络正好顶满原尺寸的 362 —— 实测按住不动扫满一个呼吸周期，
 *  左右余量只剩 1.9 / 0.0 单位（`_draft/_trio-worst.mjs`，270 个相位）。
 *  现在与太阳的 13.2 单位余量对齐。
 *  ⚠️ 加宽必须同步放大 `main.js` 的 `stageWidth`，否则屏幕上的球会变小。 */
export const VIEW = { minX: -199, minY: -187, w: 386, h: 380 };

/* 素材画布（1536）→ 局部单位。本体与三态眼共用，改这一个数不会让两层错开。
   0.30：球体半径 567 px → 170.1 单位。 */
const K = 0.30;

/* 素材画布中心。两层都按它对齐，即本体与眼睛的共同原点。 */
const CANVAS_C = 768;

/** 局部原点（素材画布中心）在 viewBox 里的落点 = **viewBox 中心 − 动作包络中心**。
 *  地球的包络本来就以画布中心为心（实测偏 (−5.75, 3.0) 单位），所以这个落点几乎是 0。
 *  ⚠️ 不是「viewBox 左上角取反」—— 那是把画布中心摆到画布右下角，整个角色会被裁掉一半。 */
export const EARTH = { x: -0.25, y: 0 };

/* 呼吸缩放的支点 = 球心（素材坐标 (749.5, 779)，实测球半径 ≈567）。
   不用画布中心 (768,768)：该点偏右上，绕它缩放会带轻微平移。 */
export const BODY_C = { x: K * (749.5 - CANVAS_C), y: K * (779 - CANVAS_C) };

/** 素材画布（1536）→ 局部单位 的公共变换。本体与三态眼**都用它**，只此一份 ——
    两层都是 1536 画布、内容都在画布上的正确位置，共用一份即天然对齐。 */
export const CANVAS_T = `scale(${K}) translate(-${CANVAS_C} -${CANVAS_C})`;

/* 呼吸（本体）：周期 3.2 s。纵向为主，横向跟四成；`lift` 是同一条正弦驱动的纵向起伏。 */
const BREATH = { dur: 3.2, amp: 0.018, lift: 2.4, wide: 0.40 };

/* 悬停：整颗上抬（负 = 上）。rate 越大越跟手。 */
const HOVER = { lift: -9, rate: 11 };

/* 按压：按住时压扁并下沉。`amp` 是纵向压缩量，横向按 `wide` 反向鼓；`rate` 越大越跟手。 */
const PRESS = { amp: 0.065, wide: 0.75, sink: 3.0, rate: 22 };

/* 松手回弹：一次冲激 + 指数衰减（`shared/impulse.js`）。
   `omega` 决定回弹快慢，`decay` 决定几下停；`dur` 之后冲激归零、不再参与合成。
   冲激值 sin 起手，所以松手那帧的形变是 0，与按住的姿态接得上。 */
const KICK = { amp: 0.10, decay: 7.0, omega: 19, dur: 1.0 };

/* 眨眼：与太阳同一套口径（`shared/blink.js` 的三段权重必须各角色一致）。 */
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
 * 建一个地球的动画实例（纯计算，不碰 DOM）。
 * @param rand 随机源，注入是为了锁种子复现（探针用）；默认 Math.random。
 */
export function createEarthAnim({ rand = Math.random } = {}) {
  const blink = createBlinkLayer({ ...BLINK, easeIn: EASE.ei, easeOut: EASE.eo, rand });

  let t = 0;            // 全局时间轴（秒）
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
