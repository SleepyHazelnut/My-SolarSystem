/**
 * 动画层：月球的动作 —— 本体呼吸 + 悬停上浮 + 按压回弹。
 *
 * 纯逻辑、不碰 DOM，每帧返回一组绝对值，由 `index.js` 写进 SVG 属性。
 * 姿态由 `core/motions.js` 的原语经 `compose()` 叠出，与太阳 / 地球同一套动作词汇。
 *
 * ⚠️ 月球**不眨眼**：五官烘在本体图上，没有三态眼层。所以这里不接 `shared/blink.js`，
 * `step()` 也不返回 `eyes`。要加眨眼得先把眼从本体抹掉、切三态，再走抠眼流程。
 *
 * 素材几何：`moon_base.png` 是 **1536 画布**。
 * 无睡帽层；加回时用同一份 `CANVAS_T` 原位叠加。
 */
import { approach } from '../../shared/approach.js';
import { dampedImpulse } from '../../shared/impulse.js';
import { breath, compose, hover, press, spring } from '../../core/motions.js';

/** viewBox 的左上角（局部坐标）与尺寸。
 *  由所有动作的包络（呼吸 + 悬停 + 按压 + 回弹 + 入场过冲）取并集，再留边距。
 *  宽度比包络宽出约 12.5 单位/侧（按压是横向鼓起），与太阳的 13.2 单位对齐。
 *  动作幅度调大必须重算；加宽必须同步放大 `main.js` 的 `stageWidth`。 */
export const VIEW = { minX: -181.5, minY: -183, w: 362, h: 361 };

/* 素材画布（1536）→ 局部单位。
   0.30：球体半径 529 px → 158.7 单位。 */
const K = 0.30;

/* 素材画布中心。本体按它对齐。 */
const CANVAS_C = 768;

/** 局部原点（素材画布中心）在 viewBox 里的落点 = viewBox 中心 − 动作包络中心。
 *  月球的包络以画布中心为心（偏 (−0.45, −3.0) 单位），落点近似 0。 */
export const MOON = { x: -0.05, y: 0.5 };

/* 呼吸缩放的支点 = 球心（素材坐标 (767.5, 758.5)，球半径 ≈529）。 */
export const BODY_C = { x: K * (767.5 - CANVAS_C), y: K * (758.5 - CANVAS_C) };

/** 素材画布（1536）→ 局部单位 的公共变换。 */
export const CANVAS_T = `scale(${K}) translate(-${CANVAS_C} -${CANVAS_C})`;

/* 呼吸（本体）：周期 3.6 s（太阳 4.3 / 地球 3.2）。
   纵向为主，横向跟四成；`lift` 是同一条正弦驱动的纵向起伏。 */
const BREATH = { dur: 3.6, amp: 0.016, lift: 3.4, wide: 0.40 };

/* 悬停：整颗上抬（负 = 上）。rate 越大越跟手。 */
const HOVER = { lift: -9, rate: 11 };

/* 按压：按住时压扁并下沉。`amp` 是纵向压缩量，横向按 `wide` 反向鼓；`rate` 越大越跟手。 */
const PRESS = { amp: 0.065, wide: 0.75, sink: 3.0, rate: 22 };

/* 松手回弹：一次冲激 + 指数衰减（`shared/impulse.js`）。
   `omega` 决定回弹快慢，`decay` 决定几下停；`dur` 之后冲激归零。
   sin 起手，所以松手那帧的形变是 0，与按住的姿态接得上。 */
const KICK = { amp: 0.10, decay: 7.0, omega: 19, dur: 1.0 };

/**
 * 建一个月球的动画实例（纯计算，不碰 DOM）。
 */
export function createMoonAnim() {
  let t = 0;            // 全局时间轴（秒）
  let hoverW = 0;       // 悬停权重 0~1，指数逼近
  let hovered = false;
  let pressW = 0;       // 按压权重 0~1，指数逼近
  let pressed = false;
  let kickT = Infinity; // 松手后经过的时间（秒）；Infinity = 没有正在跑的冲激

  /** 推进一帧，返回该帧要写进 DOM 的一组绝对值（单位 = viewBox）：
   *  `bodySX` / `bodySY` 本体缩放（绕球心）、`bodyDY` 呼吸起伏 + 悬停上浮 + 按压下沉。 */
  function step(dt) {
    t += dt;
    hoverW = approach(hoverW, hovered ? 1 : 0, HOVER.rate, dt);
    pressW = approach(pressW, pressed ? 1 : 0, PRESS.rate, dt);

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

    return {
      bodySX: v.sx,
      bodySY: v.sy,
      bodyDY: v.dy,
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
  };
}
