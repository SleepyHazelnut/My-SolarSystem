/**
 * 缓动原语。
 *
 * ⚠️ 这里只放**算法**，具体曲线的参数是各角色自己调的（见 `sun/anim.js` 的 `EASE`）——
 *    那些数值是美术口径，不该被共享层统一。
 */

/**
 * 三次贝塞尔缓动，与 CSS 的 `cubic-bezier(x1, y1, x2, y2)` 同义。
 * 返回一个 `f(u)`，`u ∈ [0,1] → [0,1]`。
 *
 * 复刻 Rive 的 CubicEaseInterpolator：牛顿迭代求 t，不收敛时二分兜底。
 */
export function cubicBezier(x1, y1, x2, y2) {
  const val = (t, a, b) => 3 * a * t * (1 - t) * (1 - t) + 3 * b * t * t * (1 - t) + t * t * t;
  const der = (t, a, b) => 3 * a * (1 - t) * (1 - t) + 6 * (b - a) * t * (1 - t) + 3 * (1 - b) * t * t;
  return (x) => {
    if (x <= 0) return 0;
    if (x >= 1) return 1;
    let t = x;
    for (let i = 0; i < 8; i++) {         // 牛顿迭代
      const d = der(t, x1, x2);
      const e = val(t, x1, x2) - x;
      if (Math.abs(e) < 1e-6) break;
      if (Math.abs(d) < 1e-6) break;
      t -= e / d;
    }
    if (!(t >= 0 && t <= 1)) {            // 不收敛 → 二分兜底
      let lo = 0, hi = 1; t = x;
      for (let i = 0; i < 24; i++) {
        if (val(t, x1, x2) < x) lo = t; else hi = t;
        t = (lo + hi) / 2;
      }
    }
    return val(t, y1, y2);
  };
}

/** smoothstep：`3u²−2u³`，两端切线为 0 的 S 形（地球眨眼的闭合段用它） */
export function smoothstep(u) {
  return u * u * (3 - 2 * u);
}

/** 二次 ease-out：`1−(1−u)²`，起步快、收尾慢（地球眨眼的张开段用它） */
export function easeOutQuad(u) {
  return 1 - (1 - u) * (1 - u);
}
