/**
 * 动画层：水星的动作 —— 本体呼吸 + 悬停上浮 + 按压回弹 + 随机眨眼。
 *
 * 纯逻辑、不碰 DOM，每帧返回一组绝对值，由 `index.js` 写进 SVG 属性。
 * 姿态由 `core/motions.js` 的原语经 `compose()` 叠出，新增动作在 `compose()` 追加一项。
 *
 * 素材几何：`mercury_base.png` 与 `eye_{open,half,closed}.png` 都是 1536 画布，
 * 眼图是从本体上抠出来的，两层共用同一份 `CANVAS_T`。见 `_draft/_eyes.py`。
 */
import { cubicBezier } from '../../shared/easing.js';
import { approach } from '../../shared/approach.js';
import { dampedImpulse } from '../../shared/impulse.js';
import { breath, compose, hover, press, spring } from '../../core/motions.js';
import { createBlinkLayer, eyeWeights } from '../../shared/blink.js';

/** viewBox 的左上角（局部坐标）与尺寸。
 *  由所有动作的包络取并集，再留边距。
 *  `scene.js` 的 viewBox 属性与 `main.js` 的 `registerCharacter` 都从这里取。
 *  动作幅度调大必须重算；加宽必须同步放大 `main.js` 的 `stageWidth`。 */
export const VIEW = { minX: -182, minY: -182, w: 364, h: 364 };

/* 素材画布（1536）→ 局部单位。
   0.3468：球体半径 421 px → 146.0 单位。 */
const K = 0.3468;

/* 素材画布中心。本体与三态眼都按它对齐。 */
const CANVAS_C = 768;

/** 局部原点（素材画布中心）在 viewBox 里的落点 = viewBox 中心 − 墨迹中心。
 *  水星的墨迹以画布中心为心，偏 (1.56, 1.73) 单位。 */
export const MERCURY = { x: -1.561, y: -1.734 };

/* 呼吸缩放的支点 = 球心（素材坐标 (778, 778)，球半径 ≈421）。 */
export const BODY_C = { x: K * (778 - CANVAS_C), y: K * (778 - CANVAS_C) };

/** 素材画布（1536）→ 局部单位 的公共变换。本体与三态眼都用它。 */
export const CANVAS_T = `scale(${K}) translate(-${CANVAS_C} -${CANVAS_C})`;

/* ---------- 动作参数 ---------- */

/* 呼吸（本体）：周期 3.9 s。纵向为主，横向跟四成；`lift` 是同一条正弦驱动的纵向起伏。 */
const BREATH = { dur: 3.9, amp: 0.016, lift: 3.2, wide: 0.40 };

/* 悬停：整颗上抬（负 = 上）。rate 越大越跟手。 */
const HOVER = { lift: -9, rate: 11 };

/* 按压：按住时压扁并下沉。`amp` 是纵向压缩量，横向按 `wide` 反向鼓；`rate` 越大越跟手。 */
const PRESS = { amp: 0.065, wide: 0.75, sink: 3.0, rate: 22 };

/* 松手回弹：一次冲激 + 指数衰减（`shared/impulse.js`）。
   `omega` 决定回弹快慢，`decay` 决定几下停；`dur` 之后冲激归零。
   sin 起手，所以松手那帧的形变是 0，与按住的姿态接得上。 */
const KICK = { amp: 0.10, decay: 7.0, omega: 19, dur: 1.0 };

/* 入场：`dy` 是起始下移（viewBox 单位），`delay` 是错开的秒数。 */
export const INTRO = { dur: 0.62, fromScale: 0.62, dy: 34, delay: 0 };

/* 眨眼：相位按帧对齐（5 闭 + 1 保持 + 3 睁 = 9 帧）。 */
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
 * 建一个水星的动画实例（纯计算，不碰 DOM）。
 * @param rand 随机源，注入是为了锁种子复现（探针用）；默认 Math.random。
 */
export function createMercuryAnim({ rand = Math.random } = {}) {
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

    /* 松手回弹：`dampedImpulse` 的幅值固定取 1，幅度交给 `spring()` 的 `amp`。 */
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
