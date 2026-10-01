/**
 * 入场：页面加载时的一次性镜头级效果（所有角色同一条曲线、同一组参数）。
 *
 * 它不是角色状态，所以不进 `anim.js` —— 入场叠在角色状态外面，结束后完全不参与。
 * 缩放的作用点由角色决定：局部原点即角色中心的组可直接写 `scale(k)`；
 * 支点不在局部原点的组要自己补一对 `translate(C) … translate(-C)` 把支点搬回中心，
 * 否则会绕画布左上角放大。
 *
 * 曲线用 `easing.js` 的 `easeOutBack`（末段冲过 1 再落回）。
 */
import { easeOutBack } from './easing.js';

/** 入场的形状（所有角色同一组）—— 就地改这里即可整体调参。 */
export const INTRO = {
  dur: 0.62,         // 秒
  fromScale: 0.62,   // 起始缩放（相对静止姿态）
  dy: 34,            // 起始下移（viewBox / Sun 局部单位）
};

/**
 * 入场进度器：每帧给一次 `dt`，拿回要写进 DOM 的三个量。
 *
 * @param delay   错开的秒数（多个角色并排时可读作级联）。用**负的起始进度**实现：
 *                延迟期间 `t < 0` → `easeOutBack` 返回 0 → 停在起始姿态。
 * @param enabled false = 直接是终态（`prefers-reduced-motion` / 逐帧截图脚本）。
 *                `matchMedia` 是 DOM 的事，由调用方判断后传进来。
 */
export function createIntro({ delay = 0, enabled = true } = {}) {
  let t = enabled ? -delay : INTRO.dur;

  /** 当前该写进 DOM 的三个量。
   *  `opacity === null` = 把 inline opacity **清掉**（`sceneEl.style.opacity` 退回空串）。 */
  function current() {
    const ie = easeOutBack(t / INTRO.dur);
    return {
      k: INTRO.fromScale + (1 - INTRO.fromScale) * ie,
      dy: (1 - ie) * INTRO.dy,
      opacity: ie < 1 ? ie.toFixed(3) : null,
    };
  }

  return {
    /** 推进 `dt` 秒（走完 `dur` 之后不再累加，`current()` 恒为终态） */
    step(dt) { if (t < INTRO.dur) t += dt; },
    current,
    /** 还在播？false = 已是终态 */
    get playing() { return t < INTRO.dur; },
  };
}
