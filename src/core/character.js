/**
 * 通用角色挂载器：注入 SVG、入场进度、指针输入、逐帧时钟、首帧、pause / resume、时间缩放、destroy、探针出口。
 *
 * 角色提供三样：
 *   scene        SVG 模板串
 *   createAnim   `({ reduced }) => { step(dt) -> 姿态, setHover?(bool), setDown?(bool) }`，纯逻辑，见各 `anim.js`
 *   setup(root, { reduced })  查元素，返回 `{ apply(v, intro) }`，把姿态写进 DOM
 * 指针回调按方法名转发：动画实例上写了 `setHover` / `setDown` 就调，没写就跳过。
 * 探针接口同理：写了 `blinkNow` 就额外暴露 `blink` / `blinkNow`。
 *
 * 可选：
 *   hit          命中区选择器，默认 `'#hit'`
 *   intro        入场形状（`dur` / `fromScale` / `dy` / `delay`），缺省项用 `shared/intro.js` 的默认值
 *
 * `mount(root, { playIntro, intro })`：`playIntro = false` 直接给终态；
 * `intro` 只覆盖传进来的那几项（`main.js` 的错开用它补 `delay`）。
 *
 * ⚠️ 首帧必须立刻按入场起始姿态写一次（`tick(0, 0)`）。
 */
import gsap from 'gsap';
import { clampDt } from '../shared/clock.js';
import { createIntro } from '../shared/intro.js';
import { bindPointerInput } from '../shared/input.js';

export function defineCharacter({ scene, createAnim, setup, hit = '#hit', intro } = {}) {
  return function mount(root, { playIntro = true, intro: introParams } = {}) {
    if (!root) throw new Error('mount: 缺少挂载容器');

    root.innerHTML = scene;

    /* 所有 window 级监听统一挂到它上面，destroy() 时一次清干净 */
    const ac = new AbortController();

    /* `matchMedia` 是 DOM 的事，判断放在这里；动画层与入场器只收结果 */
    const REDUCED = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;

    const anim = createAnim({ reduced: REDUCED });

    const hitEl = root.querySelector(hit);
    if (!hitEl) throw new Error(`mount: 找不到命中区 ${hit}`);

    const introFx = createIntro({ params: { ...intro, ...introParams }, enabled: playIntro && !REDUCED });
    const { apply } = setup(root, { reduced: REDUCED });

    let last = null;
    let lastIntro = introFx.current();
    let running = true;
    /* 时间缩放：整条时间轴（含入场）都乘它。`1` = 常速。 */
    let timeScale = 1;

    function tick(_time, deltaMs) {
      if (!running) return;
      const dt = clampDt(deltaMs) * timeScale;
      introFx.step(dt);
      lastIntro = introFx.current();
      last = anim.step(dt);
      apply(last, lastIntro);
    }
    gsap.ticker.add(tick);

    /* `pointercancel`（触屏被系统打断）与窗口失焦都要清掉按下态；`leave` 不清。 */
    const release = () => { anim.setHover?.(false); anim.setDown?.(false); };
    bindPointerInput(hitEl, ac, {
      onEnter: () => anim.setHover?.(true),
      onLeave: () => anim.setHover?.(false),
      onDown: () => anim.setDown?.(true),
      onUp: () => anim.setDown?.(false),
      onCancel: release,
      onBlur: release,
    });

    /* 首帧：立刻按入场起始姿态写一次 */
    tick(0, 0);

    const api = {
      ready: true,
      /** 是否播了入场（`prefers-reduced-motion: reduce` 或 `{ playIntro: false }` 时为 false） */
      get intro() { return introFx.playing; },
      /** 探针：上一帧的完整数值快照（只读） */
      get last() { return last; },
      /** 停掉逐帧（不在当前页的角色）。`resume()` 之前不再写 DOM。 */
      pause() { running = false; },
      resume() { running = true; },
      /** 时间缩放：`0.5` 慢放、`2` 快放、负值倒放。入场与所有动作一起受影响。 */
      setTimeScale(v) { timeScale = v; },
      get timeScale() { return timeScale; },
      destroy() {
        gsap.ticker.remove(tick);
        ac.abort();
        root.innerHTML = '';
      },
      /* 探针接口：动画实例上写了 `blinkNow` 就转发，与指针回调同一套约定。 */
      ...(anim.blinkNow ? { blinkNow: () => anim.blinkNow() } : {}),
    };

    /* ⚠️ `blink` 必须走 defineProperty —— 对象展开会把它读成定值。 */
    if (anim.blinkNow) {
      Object.defineProperty(api, 'blink', { get: () => anim.blinkValue(), enumerable: true });
    }
    return api;
  };
}
