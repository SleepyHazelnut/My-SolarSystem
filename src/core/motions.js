/**
 * 动作原语：呼吸 / 浮动 / 摇摆 / 抖动 / 悬停，均为纯函数。
 *
 * 每个原语吃「时间 + 参数」，吐一个 patch —— 只带它管的那几个键。一个角色的姿态 =
 * 几个 patch 经 `compose()` 叠加，新增动作只往 `compose()` 追加一项。
 *
 * 约定：
 *   · 纯函数、无状态。需要状态的（悬停权重、点击冲激）由角色维护后传入。
 *   · 中性值由 `compose()` 兜底（缩放 1 / 位移 0 / 旋转 0）。原语不要输出 0 或 1 占位 ——
 *     占位值会与别的原语相乘或相加，顶掉中性值。
 *   · 周期一律秒，旋转一律度，位移单位是 viewBox。
 *   · 返回的键名固定五个：`sx` / `sy` / `dx` / `dy` / `rot`。
 */

/** 多频正弦叠加，`drift` 与 `jitter` 的共同内核。
 *  `list` = `[[周期 s, 幅度], …]`。周期取互不成倍数的值，合成运动才长时间不重复。 */
function wobble(t, list) {
  return list.reduce((s, [period, amp]) => s + Math.sin((t / period) * Math.PI * 2) * amp, 0);
}

/** 呼吸：非等比缩放 + 纵向起伏，由同一条正弦驱动（鼓起来的同时浮起来）。
 *  `wide` 是横向相对纵向的比例，0.40 表示横向只跟四成。 */
export function breath(t, { dur, amp, lift = 0, wide = 0.40 }) {
  const ph = (t / dur) * Math.PI * 2;
  const s = Math.sin(ph) * amp;
  return { sx: 1 - s * wide, sy: 1 + s, dy: Math.sin(ph) * lift };
}

/** 浮动：低频多频正弦。横向 / 纵向各给一组 `[[周期 s, 幅度], …]`。 */
export function drift(t, { x = [], y = [] }) {
  return { dx: wobble(t, x), dy: wobble(t, y) };
}

/** 摇摆：整体来回转（度）。支点在写 transform 时由调用方给。 */
export function sway(t, { dur, amp }) {
  return { rot: Math.sin((t / dur) * Math.PI * 2) * amp };
}

/** 抖动：高频微颤。三个互不成倍数的周期（≈0.11 / 0.19 / 0.27 s），幅值递减。
 *  用确定性正弦而非随机数，以保证逐帧复现、探针可比数值。 */
const JITTER_FREQ = [[0.113, 1.0], [0.187, 0.62], [0.271, 0.41]];
export function jitter(t, { amp = 1, phase = 0 } = {}) {
  let dx = 0;
  let dy = 0;
  JITTER_FREQ.forEach(([dur, w], i) => {
    const a = (t / dur) * Math.PI * 2;
    dx += Math.sin(a + phase + i * 1.7) * w;
    dy += Math.cos(a + phase + i * 2.3) * w;
  });
  return { dx: dx * amp, dy: dy * amp };
}

/** 悬停：把 0~1 的权重换成纵向抬升（`lift` 为负 = 向上）。
 *  权重由角色用 `approach()` 逼近，进出是渐变的。 */
export function hover(w, { lift }) {
  return { dy: w * lift };
}

/** 叠加：缩放相乘（两次缩放叠起来），位移与旋转相加。
 *  未提供的键取中性值，所以只传一个 `sway()` 也能直接当完整姿态用。 */
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
