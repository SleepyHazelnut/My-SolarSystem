/**
 * 动画层：天王星的动作。
 *
 * 纯逻辑、不碰 DOM：姿态由 `core/pose.js` 的状态机给出，本文件只声明几何与呼吸参数，
 * 逐帧写进 DOM 由 `core/apply.js` 负责。
 *
 * ⚠️ 天王星**不眨眼**：五官烘在本体图上，没有三态眼层。
 *
 * 素材几何：`uranus_base.png` 是 1536 画布，本体（含光环）与五官同在一张。
 */
import { createPose } from '../../core/pose.js';

/** viewBox 的左上角（局部坐标）与尺寸。由所有动作的包络取并集，再留边距；宽度要装下光环。 */
export const VIEW = { minX: -236, minY: -192, w: 472, h: 384 };

/* 素材画布（1536）→ 局部单位。 */
const K = 0.321255;

/* 素材画布中心。本体按它对齐。 */
const CANVAS_C = 768;

/* 素材球体直径（px，1536 画布）。 */
const BALL_PX = 988;

/** 局部原点（素材画布中心）在 viewBox 里的落点。 */
export const ORIGIN = { x: 3.213, y: -2.249 };

/* 呼吸缩放的支点 = 球心（素材坐标 (758, 775)）。 */
export const BODY_C = { x: K * (758 - CANVAS_C), y: K * (775 - CANVAS_C) };

/** 球体在局部单位下的直径。`registry.js` 用它把球屏幕径换算成舞台宽。 */
export const BALL_D = K * BALL_PX;

/** 素材画布（1536）→ 局部单位 的公共变换。 */
export const CANVAS_T = `scale(${K}) translate(-${CANVAS_C} -${CANVAS_C})`;

/* ---------- 动作参数 ---------- */

/* 呼吸（本体）：周期 3.7 s，纵向为主。 */
const BREATH = { dur: 3.7, amp: 0.017, lift: 3.4, wide: 0.36, phase: 2.9 };

/* 悬停 / 按压 / 回弹 / 入场：十颗一致，缺省值见 `core/pose.js` 与 `shared/intro.js`。 */

export function createUranusAnim(opts) {
  return createPose({ ...opts, breath: BREATH });
}
