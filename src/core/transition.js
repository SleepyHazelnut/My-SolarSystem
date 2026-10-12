/**
 * 过渡混合：把 0~1 的权重按**固定时长 + 缓动曲线**推过去。
 *
 * 与 `shared/approach.js` 的指数逼近的区别：时长明确、到点停住、曲线可选（可带过冲）。
 * 中途改目标时从当前值起手，不会跳。
 *
 * 曲线只需满足 `f(0) = 0`、`f(1) = 1` —— `shared/easing.js` 的 `cubicBezier()` 与 `easeOutBack()` 都符合。
 */
import { cubicBezier } from '../shared/easing.js';

/** 干脆的 ease-out：前段快、到点停，无过冲。按压与层权重用它。 */
export const EASE_OUT = cubicBezier(0.22, 1.00, 0.36, 1.00);

/** 缺省口径。 */
export const TRANSITION_DEFAULT = { dur: 0.22, ease: EASE_OUT };

/**
 * @param dur   过渡时长（秒）
 * @param ease  缓动曲线
 */
export function createBlend({ dur = TRANSITION_DEFAULT.dur, ease = TRANSITION_DEFAULT.ease } = {}) {
  let from = 0;
  let to = 0;
  let u = 1;

  const value = () => from + (to - from) * ease(u);

  return {
    /** 设定目标权重。与当前目标相同则不动，不会重启动画。 */
    set(target) {
      if (target === to) return;
      from = value();
      to = target;
      u = 0;
    },
    /** 直接落到目标，不播过渡（首帧 / 复位用）。 */
    jump(target) { from = target; to = target; u = 1; },
    step(dt) {
      if (u >= 1) return;
      u = Math.min(1, u + dt / dur);
      if (u >= 1) from = to;
    },
    /** 当前权重 */
    get value() { return value(); },
    /** 目标权重（不是当前值） */
    get target() { return to; },
  };
}
