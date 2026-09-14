/**
 * 太阳角色：SVG + GSAP 版。
 *
 * 用法：
 *   const sun = mountSun(document.getElementById('sun'), { debug: fn });
 *   sun.destroy();   // 拆 ticker / 监听 / 补间，并把注入的 SVG 清掉
 *
 * 职责划分：
 *   svg-scene.js  图层结构（静态，13 张原图）
 *   anim.js       关键帧 + 状态机 + 混合器（纯逻辑）
 *   本文件         写回 DOM 属性、输入绑定、视线跟随、逐帧时钟
 *
 * 三个常量与旧的 Rive 版语义完全一致：
 *   RANGE      指针离太阳中心多远算「拉满」
 *   MAX_SHIFT  瞳孔最多偏移多少（artboard 单位）
 *   SMOOTH     视线指数滤波系数，越大越跟手
 * 逐帧时钟走 gsap.ticker，视线补间走 gsap.quickTo —— 这两处是 GSAP 真正擅长的。
 */
import gsap from 'gsap';
import { SVG_SCENE } from './svg-scene.js';
import { DEG, createMixer } from './anim.js';

export function mountSun(root, { debug } = {}) {
  if (!root) throw new Error('mountSun: 缺少挂载容器');

  root.innerHTML = SVG_SCENE;

  /* 所有 window 级监听统一挂到它上面，destroy() 时一次清干净 */
  const ac = new AbortController();
  const mixer = createMixer();

  /* ============================================================
     4. 写回 DOM（每帧写绝对値，不叠乘）
        ============================================================ */
  const $ = (s) => root.querySelector(s);
  const sunEl = $('#sun');
  const ringEl = $('#ring');
  const byId = {};
  ['catFace', 'mouthRound', 'mouthFlat', 'eyeClosed', 'eyeDot'].forEach((id) => { byId[id] = $('#' + id); });

  /* [id, 节点 x, 节点 y, 旋转°, originX×1536, originY×1536] —— 全部照抄 scene.rml */
  const SPARKS = [
    ['spark1', -161.1680, -130.8686, -43.0005,  255.4982, 537.9994],
    ['spark2', -103.0073, -191.6675, -43.0005, 1095.5059, 489.9994],
    ['spark3', -117.0568, -178.3604, -43.0005,  902.0006, 491.5046],
    ['spark4', -140.3073, -155.8599, -43.0005,  578.5037, 497.4950],
  ];
  SPARKS.forEach(([id]) => { byId[id] = $('#' + id); });
  const RING_OX = 0.5146 * 1536, RING_OY = 0.5244 * 1536;

  function apply(v) {
    sunEl.setAttribute('transform',
      `translate(0 ${(v['sun.y'] - 324).toFixed(4)}) scale(${v['sun.sx'].toFixed(6)} ${v['sun.sy'].toFixed(6)})`);

    ringEl.setAttribute('transform',
      `translate(${v['ring.x'].toFixed(4)} ${v['ring.y'].toFixed(4)}) ` +
      `rotate(${(v['ring.rot'] * DEG).toFixed(4)}) scale(${v['ring.s'].toFixed(6)}) ` +
      `translate(${-RING_OX} ${-RING_OY})`);

    for (const [id, x, y, rot, ox, oy] of SPARKS) {
      const g = byId[id];
      g.setAttribute('transform',
        `translate(${x} ${y}) rotate(${rot}) scale(${v[id + '.s'].toFixed(6)}) ` +
        `translate(${-ox} ${-oy})`);
      g.setAttribute('opacity', v[id + '.op'].toFixed(4));
    }

    byId.catFace.setAttribute('opacity', v['catFace.op'].toFixed(4));
    byId.mouthRound.setAttribute('opacity', v['mouthRound.op'].toFixed(4));
    byId.mouthFlat.setAttribute('opacity', v['mouthFlat.op'].toFixed(4));
    byId.eyeClosed.setAttribute('opacity', v['eyeClosed.op'].toFixed(4));
    byId.eyeDot.setAttribute('opacity', v['eyeDot.op'].toFixed(4));
  }

  /* ============================================================
     5. 输入：enter/exit → hover，down/up → pressed（与 Rive 的四个 Listener 一致）
        up 挂 window：在太阳上按下、移出去再松手也要清掉 pressed，否则会卡在 Clicked
        ============================================================ */
  const hit = $('#hit');
  hit.addEventListener('pointerenter', () => { mixer.setHover(true); }, { signal: ac.signal });
  hit.addEventListener('pointerleave', () => { mixer.setHover(false); }, { signal: ac.signal });
  hit.addEventListener('pointerdown', (e) => {
    mixer.setPressed(true);
    hit.setPointerCapture?.(e.pointerId);
  }, { signal: ac.signal });
  window.addEventListener('pointerup', () => { mixer.setPressed(false); }, { signal: ac.signal });
  window.addEventListener('pointercancel', () => { mixer.setPressed(false); }, { signal: ac.signal });
  window.addEventListener('blur', () => {
    mixer.setPressed(false);
    tx = SUN.x; ty = SUN.y;   // 窗口失焦 → 视线目标回中位
  }, { signal: ac.signal });

  /* ============================================================
     6. 视线跟随：与旧的 Rive 版（src/sun.js）同一套（RANGE 300 / MAX_SHIFT 42 / SMOOTH 14）
        这是 GSAP 真正擅长的部分 —— 逐帧平滑补间
        ============================================================ */
  const SUN = { x: 295, y: 324 };
  const RANGE = 300, MAX_SHIFT = 42, SMOOTH = 14;

  const lookEl = $('#look');
  const lookToX = gsap.quickTo(lookEl, 'x', { duration: 0.18, ease: 'power2.out' });
  const lookToY = gsap.quickTo(lookEl, 'y', { duration: 0.18, ease: 'power2.out' });

  let tx = SUN.x, ty = SUN.y, sx = SUN.x, sy = SUN.y;
  const stage = root;

  window.addEventListener('pointermove', (e) => {
    const r = stage.getBoundingClientRect();
    if (!r.width) return;
    tx = (e.clientX - r.left) / r.width * 590;
    ty = (e.clientY - r.top) / r.height * 600;
  }, { passive: true, signal: ac.signal });

  /* ============================================================
     7. 主循环
        ============================================================ */
  let fps = 0;

  let frames = 0, fpsAt = performance.now();

  function tick(time, deltaMs) {
    const dt = Math.min(deltaMs / 1000, 0.1);

    /* 视线平滑：指数滤波，与帧率无关 */
    const k = 1 - Math.exp(-SMOOTH * dt);
    sx += (tx - sx) * k;
    sy += (ty - sy) * k;
    const dx = sx - SUN.x, dy = sy - SUN.y;
    const d = Math.hypot(dx, dy);
    let lx = 0, ly = 0;
    if (d > 0.001) {
      const s = Math.min(MAX_SHIFT, MAX_SHIFT * d / RANGE);
      lx = dx / d * s; ly = dy / d * s;
    }
    lookToX(lx); lookToY(ly);

    apply(mixer.step(dt));

    /* fps：每 500 ms 统计一次，顺手喂给 ?debug=1 的面板 */
    frames++;
    const nowMs = time * 1000;
    if (nowMs - fpsAt >= 500) {
      fps = Math.round(frames * 1000 / (nowMs - fpsAt));
      frames = 0; fpsAt = nowMs;
      debug?.({ ready: true, lx, ly, sx, sy, fps });
    }
  }
  gsap.ticker.add(tick);

  /* 首帧：立刻写一次静止姿态，别等到第一个 ticker 回调才出现 */
  apply(mixer.values);

  return {
    ready: true,
    get state() { return mixer.state; },
    get weights() { return mixer.weights; },
    get times() { return mixer.times; },
    get inputs() { return mixer.inputs; },
    get values() { return mixer.values; },
    /** 手动把视线指向画板坐标上的某点（调试用，与旧的 Rive 版一致） */
    lookAt(x, y) { tx = x; ty = y; },
    destroy() {
      gsap.ticker.remove(tick);
      ac.abort();
      gsap.killTweensOf(lookEl);
      root.innerHTML = '';
    },
  };
}
