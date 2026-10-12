/**
 * 过渡混合：把 0~1 的权重按**固定时长 + 缓动曲线**推过去。
 *
 * 曲线只需满足 `f(0) = 0`、`f(1) = 1` —— `shared/easing.js` 的 `cubicBezier()` 与 `easeOutBack()` 都符合。
 */
import { cubicBezier } from '../shared/easing.js';

/** 干脆的 ease-out：前段快、到点停，无过冲。按压与层权重用它。 */
export const EASE_OUT = cubicBezier(0.22, 1.00, 0.36, 1.00);

/** 缺省口径。 */
export const TRANSITION_DEFAULT = { dur: 0.22, ease: EASE_OUT };

/**
 * @param dur   缺省过渡时长（秒）
 * @param ease  缺省缓动曲线
 */
export function createBlend({ dur: baseDur = TRANSITION_DEFAULT.dur, ease: baseEase = TRANSITION_DEFAULT.ease } = {}) {
  let from = 0;
  let to = 0;
  let u = 1;
  let dur = baseDur;
  let ease = baseEase;

  const value = () => from + (to - from) * ease(u);

  return {
    /** 设定目标权重。与当前目标相同则不动，不会重启动画。
     *  `params` 给这一趟单独的时长与曲线，缺省用构造时那份。 */
    set(target, params) {
      if (target === to) return;
      from = value();
      to = target;
      u = 0;
      dur = params?.dur ?? baseDur;
      ease = params?.ease ?? baseEase;
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
