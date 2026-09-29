/**
 * 通用角色挂载器：注入 SVG、入场进度、指针输入、逐帧时钟、首帧、destroy、探针出口。
 *
 * 角色提供三样：
 *   scene        SVG 模板串
 *   createAnim   `() => { step(dt) -> 姿态, setHover(bool) }`，纯逻辑，见各 `anim.js`
 *   setup(root)  查元素，返回 `{ apply(v, intro) }`，把姿态写进 DOM
 *
 * 可选：
 *   hit          命中区选择器，默认 `'#hit'`
 *   introDelay   入场错开的秒数
 *
 * 入场缩放的作用点由角色在 `apply` 里决定，挂载器不代劳：局部原点即角色中心的组可直接写
 * `scale(k)`；支点不在局部原点的组必须自己补 `translate(C) scale(k) translate(-C)`，
 * 否则会绕画布左上角放大。
 *
 * ⚠️ 首帧必须立刻按入场起始姿态写一次（`tick(0, 0)`）：否则会先以满尺寸、不透明画一帧，
 * 再跳回起始值。
 */
import gsap from 'gsap';
import { clampDt } from '../shared/clock.js';
import { createIntro } from '../shared/intro.js';
import { bindPointerInput } from '../shared/input.js';

export function defineCharacter({ scene, createAnim, setup, extra, hit = '#hit', introDelay = 0 }) {
  return function mount(root, { intro = true } = {}) {
    if (!root) throw new Error('mount: 缺少挂载容器');

    root.innerHTML = scene;

    /* 所有 window 级监听统一挂到它上面，destroy() 时一次清干净 */
    const ac = new AbortController();
    const anim = createAnim();

    const hitEl = root.querySelector(hit);
    if (!hitEl) throw new Error(`mount: 找不到命中区 ${hit}`);

    /* `matchMedia` 是 DOM 的事，判断放在这里；`createIntro` 只收结果 */
    const REDUCED = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
    const introFx = createIntro({ delay: introDelay, enabled: intro && !REDUCED });
    const { apply } = setup(root);

    let last = null;
    let lastIntro = introFx.current();

    function tick(time, deltaMs) {
      const dt = clampDt(deltaMs);
      introFx.step(dt);
      lastIntro = introFx.current();
      last = anim.step(dt);
      apply(last, lastIntro);
      void time;
    }
    gsap.ticker.add(tick);

    bindPointerInput(hitEl, ac, {
      onEnter: () => anim.setHover?.(true),
      onLeave: () => anim.setHover?.(false),
    });

    /* 首帧：立刻按入场的起始姿态写一次（见文件头 ⚠️） */
    tick(0, 0);

    return {
      ready: true,
      /** 是否播了入场（`prefers-reduced-motion: reduce` 或 `{ intro: false }` 时为 false） */
      get intro() { return introFx.playing; },
      /** 探针：上一帧的完整数值快照（只读） */
      get last() { return last; },
      /** 把一组值**直接写进 DOM**（绕过动画实例）。逐帧截图脚本靠它回放 Node 侧算出的真值。 */
      applyValues(v) { apply(v, lastIntro); },
      destroy() {
        gsap.ticker.remove(tick);
        ac.abort();
        root.innerHTML = '';
      },
      /* 角色自己的探针接口（太阳的 `blink` / `blinkNow` 这类），由 `extra(anim)` 追加 */
      ...(extra ? extra(anim) : {}),
    };
  };
}
