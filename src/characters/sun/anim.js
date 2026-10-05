/**
 * 动画层：太阳的动作。
 *
 * 纯逻辑、不碰 DOM：姿态由 `core/pose.js` 的状态机给出，本文件只声明几何与呼吸参数，
 * 逐帧写进 DOM 由 `core/apply.js` 负责。
 *
 * 呼吸落在本体上：火焰边缘烘在本体内，本体缩放即整颗太阳的呼吸。
 *
 * 素材几何：`sun_base.png` 与 `src/assets/eye/*.png` 都是 1536 画布，且眼图从本体上原样抠出，
 * 两层共用同一份 `CANVAS_T`。
 */
import { createPose } from '../../core/pose.js';

/** viewBox 的左上角（局部坐标）与尺寸。由所有动作的包络取并集，再留边距。 */
export const VIEW = { minX: 0, minY: 0, w: 528, h: 512 };

/* 素材画布（1536）→ 局部单位。 */
const K = 0.42;

/* 素材画布中心。本体与三态眼都按它对齐。 */
const CANVAS_C = 768;

/* 素材球体直径（px，1536 画布）。 */
const BALL_PX = 696;

/** 局部原点（素材画布中心）在 viewBox 里的落点 = viewBox 中心 − 动作包络中心。 */
export const ORIGIN = { x: 268.2, y: 263.0 };

/* 呼吸缩放的支点 = 太阳球心（素材坐标 (788, 732)）。 */
export const BODY_C = { x: K * (788 - CANVAS_C), y: K * (732 - CANVAS_C) };

/** 球体在局部单位下的直径。`registry.js` 用它把球屏幕径换算成舞台宽。 */
export const BALL_D = K * BALL_PX;

/** 素材画布（1536）→ 局部单位 的公共变换。本体与三态眼都用它。 */
export const CANVAS_T = `scale(${K}) translate(-${CANVAS_C} -${CANVAS_C})`;

/* ---------- 动作参数 ---------- */

/* 呼吸（本体）：周期 4.3 s，纵向为主。幅度受火焰边缘限制。 */
const BREATH = { dur: 4.3, amp: 0.017, lift: 2.4, wide: 0.40, phase: 0.9 };

/* 悬停 / 按压 / 回弹 / 入场 / 眨眼：十颗一致，缺省值见 `core/pose.js` 与 `shared/blink.js`。 */

export function createSunAnim(opts) {
  return createPose({ ...opts, breath: BREATH, blink: true });
}
