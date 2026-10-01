/**
 * 动作原语：呼吸 / 悬停 / 按压 / 回弹，均为纯函数。
 *
 * 每个原语吃「时间 + 参数」，吐一个 patch —— 只带它管的那几个键。一个角色的姿态 =
 * 几个 patch 经 `compose()` 叠加，新增动作只往 `compose()` 追加一项。
 *
 * 约定：
 *   · 纯函数、无状态。需要状态的（悬停权重、按压权重、点击冲激）由角色维护后传入。
 *   · 中性值由 `compose()` 兜底（缩放 1 / 位移 0 / 旋转 0）。原语不要输出 0 或 1 占位 ——
 *     占位值会与别的原语相乘或相加，顶掉中性值。
 *   · 周期一律秒，旋转一律度，位移单位是 viewBox。
 *   · 返回的键名固定五个：`sx` / `sy` / `dx` / `dy` / `rot`。
 */

/** 呼吸：非等比缩放 + 纵向起伏，由同一条正弦驱动（鼓起来的同时浮起来）。
 *  `wide` 是横向相对纵向的比例，0.40 表示横向只跟四成。 */
export function breath(t, { dur, amp, lift = 0, wide = 0.40 }) {
  const ph = (t / dur) * Math.PI * 2;
  const s = Math.sin(ph) * amp;
  return { sx: 1 - s * wide, sy: 1 + s, dy: Math.sin(ph) * lift };
}

/** 悬停：把 0~1 的权重换成纵向抬升（`lift` 为负 = 向上）。
 *  权重由角色用 `approach()` 逼近，进出是渐变的。 */
export function hover(w, { lift }) {
  return { dy: w * lift };
}

/** 按压：把 0~1 的权重换成压扁 + 下沉。纵向压缩 `amp`，横向按 `wide` 反向鼓，
 *  `sink` 是同时下沉的量。 */
export function press(w, { amp, wide = 0.75, sink = 0 }) {
  return { sx: 1 + w * amp * wide, sy: 1 - w * amp, dy: w * sink };
}

/** 回弹：把冲激值（±1 以内）换成压扁 / 拉长的往复，纵向主导、横向反向且按 `wide` 减半。
 *  冲激值由 `shared/impulse.js` 的 `dampedImpulse()` 给。 */
export function spring(u, { amp, wide = 0.55 }) {
  return { sx: 1 - u * amp * wide, sy: 1 + u * amp };
}

/** 叠加：缩放相乘（两次缩放叠起来），位移与旋转相加。
 *  未提供的键取中性值，所以只传一个 `hover()` 也能直接当完整姿态用。 */
export function compose(...patches) {
  const out = { sx: 1, sy: 1, dx: 0, dy: 0, rot: 0 };
  for (const p of patches) {
    if (p.sx !== undefined) out.sx *= p.sx;
    if (p.sy !== undefined) out.sy *= p.sy;
    if (p.dx !== undefined) out.dx += p.dx;
    if (p.dy !== undefined) out.dy += p.dy;
    if (p.rot !== undefined) out.rot += p.rot;
  }
  return out;
}
