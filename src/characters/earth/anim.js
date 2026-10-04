/**
 * 动画层：地球的动作。
 *
 * 纯逻辑、不碰 DOM：姿态由 `core/pose.js` 的状态机给出，本文件只声明几何与呼吸参数，
 * 逐帧写进 DOM 由 `core/apply.js` 负责。
 *
 * 素材几何：`earth_base.png` 与 `eye_{open,half,closed}.png` 都是 1536 画布，
 * 眼图是从本体上原样抠出来的，两层共用同一份 `CANVAS_T`。
 */
import { createPose } from '../../core/pose.js';

/** viewBox 的左上角（局部坐标）与尺寸。由所有动作的包络取并集，再留边距。 */
export const VIEW = { minX: -199, minY: -187, w: 386, h: 380 };

/* 素材画布（1536）→ 局部单位。 */
const K = 0.30;

/* 素材画布中心。本体与三态眼都按它对齐。 */
const CANVAS_C = 768;

/* 素材球体直径（px，1536 画布）。 */
const BALL_PX = 1134;

/** 局部原点（素材画布中心）在 viewBox 里的落点 = viewBox 中心 − 动作包络中心。 */
export const ORIGIN = { x: -0.25, y: 0 };

/* 呼吸缩放的支点 = 球心（素材坐标 (749.5, 779)）。 */
export const BODY_C = { x: K * (749.5 - CANVAS_C), y: K * (779 - CANVAS_C) };

/** 球体在局部单位下的直径。`registry.js` 用它把球屏幕径换算成舞台宽。 */
export const BALL_D = K * BALL_PX;

/** 素材画布（1536）→ 局部单位 的公共变换。本体与三态眼都用它。 */
export const CANVAS_T = `scale(${K}) translate(-${CANVAS_C} -${CANVAS_C})`;

/* ---------- 动作参数 ---------- */

/* 呼吸（本体）：周期 3.2 s，纵向为主、横向跟四成。 */
const BREATH = { dur: 3.2, amp: 0.018, lift: 2.4, wide: 0.40 };

/* 悬停 / 按压 / 回弹 / 入场 / 眨眼：十颗一致，缺省值见 `core/pose.js` 与 `shared/blink.js`。 */

export function createEarthAnim(opts) {
  return createPose({ ...opts, breath: BREATH, blink: true });
}
