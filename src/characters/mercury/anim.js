/**
 * 动画层：水星的动作。
 *
 * 纯逻辑、不碰 DOM：姿态由 `core/pose.js` 的状态机给出，本文件只声明几何与呼吸参数，
 * 逐帧写进 DOM 由 `core/apply.js` 负责。
 *
 * 素材几何：`mercury_base.png` 是 1536 画布，五官烘死（不眨眼）；
 * 装饰 `deco_fan.png` / `deco_sunglasses.png` 同画布，落点见下面的 `DECO`。
 */
import { createPose } from '../../core/pose.js';

/** viewBox 的左上角（局部坐标）与尺寸。由所有动作的包络取并集，再留边距。 */
export const VIEW = { minX: -170, minY: -198, w: 340, h: 376 };

/* 素材画布（1536）→ 局部单位。 */
const K = 0.2847;

/* 素材画布中心。本体与装饰都按它对齐。 */
const CANVAS_C = 768;

/* 素材球体直径（px，1536 画布）。 */
const BALL_PX = 1026;

/** 局部原点（素材画布中心）在 viewBox 里的落点。 */
export const ORIGIN = { x: 2.761, y: -5.953 };

/* 呼吸缩放的支点 = 球心（素材坐标 (765, 795)）。 */
export const BODY_C = { x: K * (765 - CANVAS_C), y: K * (795 - CANVAS_C) };

/** 球体在局部单位下的直径。`registry.js` 用它把球屏幕径换算成舞台宽。 */
export const BALL_D = K * BALL_PX;

/** 素材画布（1536）→ 局部单位 的公共变换。本体与装饰都用它。 */
export const CANVAS_T = `scale(${K}) translate(-${CANVAS_C} -${CANVAS_C})`;

/* ---------- 装饰 ---------- */

/** 装饰落点：`x` / `y` 是素材画布中心在画布坐标里的位置，`k` 绕自身中心缩放，`rot` 绕自身中心转（度）。
 *  `layer` 是相对本体的层级，`back` 压在本体下、`front` 浮在本体上。 */
export const DECO = {
  fan: { x: 329.1, y: 1071.8, k: 0.302, rot: 0, layer: 'front' },
  sunglasses: { x: 803.2, y: 422.2, k: 0.573, rot: 9, layer: 'front' },
};

/* ---------- 动作参数 ---------- */

/* 呼吸（本体）：周期 3.9 s，纵向为主。 */
const BREATH = { dur: 3.9, amp: 0.014, lift: 3.2, wide: 0.46, phase: 2.4 };

/* 悬停 / 按压 / 回弹 / 入场：十颗一致，缺省值见 `core/pose.js` 与 `shared/intro.js`。 */

export function createMercuryAnim(opts) {
  return createPose({ ...opts, breath: BREATH });
}
