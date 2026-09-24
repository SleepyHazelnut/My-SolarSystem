/**
 * 月球角色：DOM 与时钟。
 *
 * 用法：
 *   const moon = mountMoon(document.getElementById('moon'));
 *   moon.destroy();   // 拆 ticker / 监听，并清掉注入的 SVG
 *
 * 职责划分：
 *   scene.js  图层结构（静态，2 张原图：本体 / 睡帽）
 *   anim.js   程序化正弦（纯逻辑）
 *   本文件     写回 DOM 属性、输入绑定、逐帧时钟
 *
 * 入场：形状与曲线在 `shared/intro.js`（三个角色**同一组参数**）。
 * 缩放写在 `#moon` 上，得自己补一对 translate 把支点搬回球心，
 * 否则整颗球绕画布左上角放大、被甩出去。见 apply() 里的 introTf。
 */
import gsap from 'gsap';
import { SVG_SCENE } from './scene.js';
import { CX, CY, createMoonAnim } from './anim.js';
import { clampDt } from '../../shared/clock.js';
import { INTRO, createIntro } from '../../shared/intro.js';
import { bindPointerInput } from '../../shared/input.js';

/** 入场：形状与曲线在 `shared/intro.js`，与太阳 / 地球**同一组**。
 *  `prefers-reduced-motion: reduce` 时直接跳到终态（见下面的 REDUCED）。 */
export { INTRO };

export function mountMoon(root, { intro = true } = {}) {
  if (!root) throw new Error('mountMoon: 缺少挂载容器');

  root.innerHTML = SVG_SCENE;

  /* 所有 window 级监听统一挂到它上面，destroy() 时一次清干净 */
  const ac = new AbortController();
  const anim = createMoonAnim();

  const $ = (s) => root.querySelector(s);
  const moonEl = $('#moon');
  const sceneEl = $('#moonScene');
  const bobEl = $('#moonBob');
  const capEl = $('#moonCap');
  const hitEl = $('#hit');

  const REDUCED = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
  const introFx = createIntro({ enabled: intro && !REDUCED });

  function apply(v) {
    /* 入场：只在没走完 `INTRO.dur` 期间生效，结束后 `k` 恒为 1、`dy` 恒为 0、opacity 清空 ——
       画面逐位回到没有入场时的样子（见 `shared/intro.js`）。 */
    const iv = introFx.current();
    const ik = iv.k, idy = iv.dy;
    if (iv.opacity === null) { if (sceneEl.style.opacity) sceneEl.style.opacity = ''; }
    else sceneEl.style.opacity = iv.opacity;

    /* 入场缩放叠在 #moon 上。支点要自己搬回球心 —— 与地球的 #earthBob 同一个理由。 */
    const introTf = ik === 1 ? ''
      : `translate(${CX} ${CY}) scale(${ik.toFixed(6)}) translate(${-CX} ${-CY}) `;
    moonEl.setAttribute('transform', introTf + `translate(0 ${idy.toFixed(4)})`);

    /* 本体 + 睡帽：位移 → 绕球心缩放。帽子挂在里面，所以自动跟着一起缩（帽檐不会错位）。 */
    bobEl.setAttribute('transform',
      `translate(${v.dx.toFixed(4)} ${v.dy.toFixed(4)}) ` +
      `translate(${CX} ${CY}) scale(${v.sx.toFixed(6)} ${v.sy.toFixed(6)}) translate(${-CX} ${-CY})`);

    /* 睡帽自己再晃一点：绕球心转（支点在球心，所以是「在头上晃」而不是「转帽子」）。 */
    capEl.setAttribute('transform', `rotate(${v.capRot.toFixed(4)} ${CX} ${CY})`);
  }

  /* 点击反馈**还没做**（用户 2026-10-06：「点击逻辑也是，到时候创建新的」）。 */
  bindPointerInput(hitEl, ac, {
    onEnter: () => anim.setHover(true),
    onLeave: () => anim.setHover(false),
  });

  let last = null;
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
    /** 是否播了入场（`prefers-reduced-motion: reduce` 或 `mountMoon(root, { intro: false })` 时为 false） */
    intro: introFx.playing,
    /** 探针：上一帧的完整数值快照（只读） */
    get last() { return last; },
    /** 把一组值**直接写进 DOM**（绕过动画实例）。逐帧截图脚本靠它回放 Node 侧算出的真值。 */
    applyValues(v) { apply(v); },
    destroy() {
      gsap.ticker.remove(tick);
      ac.abort();
      root.innerHTML = '';
    },
  };
}
