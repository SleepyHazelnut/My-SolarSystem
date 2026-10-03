/**
 * 动画层：土星的动作 —— 本体呼吸 + 悬停上浮 + 按压回弹。
 *
 * 纯逻辑、不碰 DOM，每帧返回一组绝对值，由 `index.js` 写进 SVG 属性。
 * 姿态由 `core/motions.js` 的原语经 `compose()` 叠出，与其余角色同一套动作词汇。
 *
 * ⚠️ 土星**不眨眼**：五官烘在本体图上，没有三态眼层。所以这里不接 `shared/blink.js`，
 * `step()` 也不返回 `eyes`。
 *
 * 素材几何：`saturn_base.png`（本体）与 `saturn_ring.png`（光环）都是 **1536 画布**，
 * 共用同一份 `CANVAS_T` —— 光环前后两层与本体天然对位，没有额外对位参数。
 * 呼吸写在 `#saturnBodyWrap` 上，前后两层都是它的子节点，一起缩。
 */
import { approach } from '../../shared/approach.js';
import { dampedImpulse } from '../../shared/impulse.js';
import { breath, compose, hover, press, spring } from '../../core/motions.js';

/** viewBox 的左上角（局部坐标）与尺寸。
 *  由所有动作的包络（呼吸 + 悬停 + 按压 + 回弹 + 入场过冲）取并集，再留边距。
 *  viewBox 以球心为心；宽度要装下光环。动作幅度调大必须重算。 */
export const VIEW = { minX: -252, minY: -186, w: 504, h: 372 };

/* 素材画布（1536）→ 局部单位。
   0.326543：球体直径 972 px → 317.4 单位。 */
const K = 0.326543;

/* 素材画布中心。本体与光环都按它对齐。 */
const CANVAS_C = 768;

/** 局部原点（素材画布中心）在 viewBox 里的落点。 */
export const SATURN = { x: -1.306, y: -4.572 };

/* 呼吸缩放的支点 = 球心（素材坐标 (772, 782)，球半径 ≈486）。 */
export const BODY_C = { x: K * (772 - CANVAS_C), y: K * (782 - CANVAS_C) };

/** 素材画布（1536）→ 局部单位 的公共变换。本体与光环两层都用它。 */
export const CANVAS_T = `scale(${K}) translate(-${CANVAS_C} -${CANVAS_C})`;

/** 光环前后层的分界直线（局部坐标）：y = SEAM_B − SEAM_M · x。
 *  过球心、斜率 = 光环长轴（素材坐标 (127, 1089) → (1467, 466)）。
 *  `scene.js` 的 clipPath 用它切出「近侧」那一半。 */
export const SEAM_B = 5.159;
export const SEAM_M = 0.4649;

/* ---------- 动作参数 ---------- */

/* 呼吸（本体）：周期 4.5 s。纵向为主，横向跟四成；`lift` 是同一条正弦驱动的纵向起伏。 */
const BREATH = { dur: 4.5, amp: 0.016, lift: 3.0, wide: 0.40 };

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

/**
 * 建一个土星的动画实例（纯计算，不碰 DOM）。
 */
export function createSaturnAnim() {
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
