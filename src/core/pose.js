/**
 * 姿态状态机：呼吸 + 悬停 + 按压 + 松手回弹，可选接眨眼。
 *
 * 每帧吃一次 `dt`，吐一组绝对值（单位 = viewBox）：
 *   `bodySX` / `bodySY` 本体缩放（绕球心）、`bodyDY` 纵向位移、`t` 全局时间、
 *   `kick` 松手回弹的冲激值（±1 以内，没在播时为 0）。
 * 接了眨眼再多吐 `eyes` = [睁, 半闭, 闭] 与 `blink`（闭眼量 0~1）。
 *
 * 参数只传要偏离默认值的项：`breath` 必给（各角色周期不同），
 * `hover` / `press` / `kick` 缺省用下面导出的默认值，`blink` 给 `true` 用 `shared/blink.js` 的默认口径。
 */
import { approach } from '../shared/approach.js';
import { dampedImpulse } from '../shared/impulse.js';
import { createBlinkLayer, eyeWeights } from '../shared/blink.js';
import { breath, compose, hover, press, spring } from './motions.js';

/** 悬停：整颗上抬（负 = 上）。`rate` 越大越跟手。 */
export const HOVER = { lift: -9, rate: 11 };

/** 按压：按住时压扁并下沉。`amp` 是纵向压缩量，横向按 `wide` 反向鼓。 */
export const PRESS = { amp: 0.065, wide: 0.75, sink: 3.0, rate: 22 };

/** 松手回弹：一次冲激 + 指数衰减（`shared/impulse.js`）。`amp` 即最大形变比例。 */
export const KICK = { amp: 0.10, decay: 7.0, omega: 19, dur: 1.0 };

/**
 * @param breath  呼吸参数，见 `motions.js` 的 `breath()`
 * @param hover   悬停参数，缺省 `HOVER`
 * @param press   按压参数，缺省 `PRESS`
 * @param kick    回弹参数，缺省 `KICK`
 * @param blink   `true` = 用 `shared/blink.js` 的默认口径；也可传对象覆盖其中几项；缺省不接眨眼
 * @param reduced `prefers-reduced-motion: reduce`。呼吸幅度归零，眨眼与点击反馈保留
 * @param rand    随机源，注入是为了锁种子复现（探针用）
 */
export function createPose({
  breath: breathParams,
  hover: hoverParams = HOVER,
  press: pressParams = PRESS,
  kick: kickParams = KICK,
  blink: blinkParams = null,
  reduced = false,
  rand = Math.random,
} = {}) {
  const blinkLayer = blinkParams
    ? createBlinkLayer({ ...(blinkParams === true ? {} : blinkParams), rand })
    : null;

  /* 降低动效：呼吸只留中性值。 */
  const bp = reduced ? { ...breathParams, amp: 0, lift: 0 } : breathParams;

  let t = 0;            // 全局时间轴（秒）
  let hoverW = 0;       // 悬停权重 0~1，指数逼近
  let hovered = false;
  let pressW = 0;       // 按压权重 0~1，指数逼近
  let pressed = false;
  let kickT = Infinity; // 松手后经过的时间（秒）；Infinity = 没有正在跑的冲激

  /** 推进一帧。 */
  function step(dt) {
    t += dt;
    hoverW = approach(hoverW, hovered ? 1 : 0, hoverParams.rate, dt);
    pressW = approach(pressW, pressed ? 1 : 0, pressParams.rate, dt);
    blinkLayer?.step(dt, true);

    /* 松手回弹：`dampedImpulse` 的幅值固定取 1，幅度交给 `spring()` 的 `amp`。 */
    let kickU = 0;
    if (kickT !== Infinity) {
      kickU = dampedImpulse(kickT, 1, kickParams.decay, kickParams.omega);
      kickT += dt;
      if (kickT >= kickParams.dur) kickT = Infinity;
    }

    const v = compose(
      breath(t, bp),
      hover(hoverW, hoverParams),
      press(pressW, pressParams),
      spring(kickU, kickParams),
    );

    const out = { bodySX: v.sx, bodySY: v.sy, bodyDY: v.dy, t, kick: kickU };
    if (blinkLayer) {
      const b = blinkLayer.value();
      out.eyes = eyeWeights(b);
      out.blink = b;
    }
    return out;
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
    /* 探针接口（接了眨眼层才有），由 `character.js` 按方法名转发。 */
    ...(blinkLayer ? {
      /** 立刻眨一次 */
      blinkNow() { blinkLayer.fire(); },
      /** 当前闭眼量 0~1 */
      blinkValue: blinkLayer.value,
    } : {}),
  };
}
