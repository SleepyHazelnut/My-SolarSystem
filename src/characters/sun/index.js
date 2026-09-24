/**
 * 太阳角色：DOM 与时钟。
 *
 * 用法：
 *   const sun = mountSun(document.getElementById('sun'));
 *   sun.destroy();   // 拆 ticker / 监听，并清掉注入的 SVG
 *
 * 职责划分：
 *   scene.js  图层结构（静态，5 张原图：本体 / 光圈 / 三态眼）
 *   anim.js   程序化正弦（纯逻辑，没有状态机）
 *   本文件     写回 DOM 属性、输入绑定、逐帧时钟
 *
 * 入场：形状与曲线在 `shared/intro.js`（与地球**同一组参数**）。
 * 缩放写在 `#sun` 上 —— 它的局部原点就是太阳中心，所以是原地放大，不用像地球那样搬支点。
 */
import gsap from 'gsap';
import { SVG_SCENE } from './scene.js';
import { K, createSunAnim } from './anim.js';
import { clampDt } from '../../shared/clock.js';
import { INTRO, createIntro } from '../../shared/intro.js';
import { bindPointerInput } from '../../shared/input.js';

/** 入场：形状与曲线在 `shared/intro.js`，地球用**同一组**。
 *  `prefers-reduced-motion: reduce` 时直接跳到终态（见下面的 REDUCED）。 */
export { INTRO };

export function mountSun(root, { intro = true } = {}) {
  if (!root) throw new Error('mountSun: 缺少挂载容器');

  root.innerHTML = SVG_SCENE;

  /* 所有 window 级监听统一挂到它上面，destroy() 时一次清干净 */
  const ac = new AbortController();
  const anim = createSunAnim();

  const $ = (s) => root.querySelector(s);
  const sunEl = $('#sun');
  const sceneEl = $('#scene');
  const bodyWrapEl = $('#sunBodyWrap');
  const raysEl = $('#sunRays');
  const hitEl = $('#hit');
  /* 三态眼按名字对上 —— eyeWeights() 返回 [open, half, closed]，这里不靠数组下标，
     免得将来挪了 DOM 顺序或改了权重顺序就静默错位。 */
  const eyeEls = {
    open: $('#eyeOpen'),
    half: $('#eyeHalf'),
    closed: $('#eyeClosed'),
  };

  const REDUCED = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
  const introFx = createIntro({ enabled: intro && !REDUCED });

  function apply(v) {
    /* 入场：只在没走完 `INTRO.dur` 期间生效，结束后 `k` 恒为 1、`dy` 恒为 0、opacity 清空 ——
       画面逐位回到没有入场时的样子（见 `shared/intro.js`）。 */
    const iv = introFx.current();
    const ik = iv.k, idy = iv.dy;
    if (iv.opacity === null) { if (sceneEl.style.opacity) sceneEl.style.opacity = ''; }
    else sceneEl.style.opacity = iv.opacity;

    /* 入场的缩放叠在 #sun 上（原点 = 太阳中心），上浮叠在 #sunBodyWrap 上。 */
    sunEl.setAttribute('transform', `scale(${ik.toFixed(6)})`);

    /* 本体：**只跟着悬停上浮**，缩放恒为 1 —— 呼吸已经挪到光圈上。 */
    bodyWrapEl.setAttribute('transform', `translate(0 ${(v.bodyDY + idy).toFixed(4)})`);

    /* 光圈：scale(K) → rotate(rot) → scale(rs) → translate(-768 -768)。
       rotate 夹在两次 scale 中间（写最前面会绕 viewBox 原点转，整圈花瓣飞出去）。 */
    raysEl.setAttribute('transform',
      `scale(${K}) rotate(${v.raysRot.toFixed(4)}) ` +
      `scale(${v.raysS.toFixed(6)}) translate(-768 -768)`);

    /* 眨眼：三态眼按权重切 opacity（相邻两段权重和恒为 1，所以不会闪）。 */
    const [wOpen, wHalf, wClosed] = v.eyes;
    eyeEls.open.setAttribute('opacity', wOpen.toFixed(4));
    eyeEls.half.setAttribute('opacity', wHalf.toFixed(4));
    eyeEls.closed.setAttribute('opacity', wClosed.toFixed(4));
  }

  /* 点击反馈**还没做**。所以这里不传 onDown / onUp —— 接上去时再加，别去恢复旧的关键帧表。 */
  bindPointerInput(hitEl, ac, {
    onEnter: () => anim.setHover(true),
    onLeave: () => anim.setHover(false),
  });

  let last = 0;
  function tick(time, deltaMs) {
    const dt = clampDt(deltaMs);
    introFx.step(dt);
    last = anim.step(dt);
    apply(last);
    void time;
  }
  gsap.ticker.add(tick);

  /* 首帧：立刻按入场的**起始姿态**写一次（起始缩放 + 下移 + opacity 0）。
     不写的话会先以**满尺寸、不透明**画一帧，再跳到 0.62 —— 闪一下。 */
  tick(0, 0);

  return {
    ready: true,
    /** 是否播了入场（`prefers-reduced-motion: reduce` 或 `mountSun(root, { intro: false })` 时为 false） */
    intro: introFx.playing,
    get blink() { return anim.blinkValue(); },
    /** 探针：上一帧的完整数值快照（只读） */
    get last() { return last; },
    /** 立刻眨一次 */
    blinkNow() { anim.blinkNow(); },
    /** 把一组值**直接写进 DOM**（绕过动画实例）。逐帧截图脚本靠它回放 Node 侧算出的真值 ——
        走这里而不是在脚本里重抄一遍 apply()，是为了避免变换写法两边漂移。 */
    applyValues(v) { apply(v); },
    destroy() {
      gsap.ticker.remove(tick);
      ac.abort();
      root.innerHTML = '';
    },
  };
}
