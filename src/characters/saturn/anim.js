/**
 * 动画层：土星的动作。
 *
 * 纯逻辑、不碰 DOM：姿态由 `core/pose.js` 的状态机给出，本文件只声明几何与呼吸参数，
 * 逐帧写进 DOM 由 `core/apply.js` 负责。
 *
 * ⚠️ 土星**不眨眼**：五官烘在本体图上，没有三态眼层。
 *
 * 素材几何：`saturn_base.png`（本体）与 `saturn_ring.png`（光环）都是 1536 画布，
 * 共用同一份 `CANVAS_T` —— 光环前后两层与本体天然对位，没有额外对位参数。
 * 呼吸写在 `#saturnBodyWrap` 上，前后两层都是它的子节点，一起缩。
 */
import { createPose } from '../../core/pose.js';

/** viewBox 的左上角（局部坐标）与尺寸。由所有动作的包络取并集，再留边距；宽度要装下光环。 */
export const VIEW = { minX: -252, minY: -186, w: 504, h: 372 };

/* 素材画布（1536）→ 局部单位。 */
const K = 0.326543;

/* 素材画布中心。本体与光环都按它对齐。 */
const CANVAS_C = 768;

/* 素材球体直径（px，1536 画布）。 */
const BALL_PX = 972;

/** 局部原点（素材画布中心）在 viewBox 里的落点。 */
export const ORIGIN = { x: -1.306, y: -4.572 };

/* 呼吸缩放的支点 = 球心（素材坐标 (772, 782)）。 */
export const BODY_C = { x: K * (772 - CANVAS_C), y: K * (782 - CANVAS_C) };

/** 球体在局部单位下的直径。`registry.js` 用它把球屏幕径换算成舞台宽。 */
export const BALL_D = K * BALL_PX;

/** 素材画布（1536）→ 局部单位 的公共变换。本体与光环两层都用它。 */
export const CANVAS_T = `scale(${K}) translate(-${CANVAS_C} -${CANVAS_C})`;

/** 光环前后层的分界直线（局部坐标）：y = SEAM_B − SEAM_M · x。
 *  过球心、斜率 = 光环长轴（素材坐标 (127, 1089) → (1467, 466)）。
 *  `scene.js` 的 clipPath 用它切出「近侧」那一半。 */
export const SEAM_B = 5.159;
export const SEAM_M = 0.4649;

/* ---------- 动作参数 ---------- */

/* 呼吸（本体）：周期 4.5 s，纵向为主。 */
const BREATH = { dur: 4.5, amp: 0.014, lift: 3.0, wide: 0.44, phase: 5.9 };

/* 悬停 / 按压 / 回弹 / 入场：十颗一致，缺省值见 `core/pose.js` 与 `shared/intro.js`。 */

export function createSaturnAnim(opts) {
  return createPose({ ...opts, breath: BREATH });
}
