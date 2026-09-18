/**
 * 页面入口：把太阳挂到 #sun、地球挂到 #earth；
 * 加 `?debug=1` 时额外挂一个左下角调试面板。
 */
import { mountSun } from './sun.js';
import { mountEarth } from './earth.js';

const root = document.getElementById('sun');
const earthRoot = document.getElementById('earth');

if (!root) {
  throw new Error('找不到 #sun 容器');
}
if (!earthRoot) {
  throw new Error('找不到 #earth 容器');
}

const debugOn = new URLSearchParams(location.search).get('debug') === '1';

// 面板是挂上来的、不写在 index.html 里 —— 生产页面里连这段 DOM 都不存在
let panel = null;
if (debugOn) {
  panel = document.createElement('pre');
  panel.className = 'debug';
  panel.id = 'dbg';
  document.body.appendChild(panel);
}

/* 两个角色各自每 500ms 报一次状态。⚠️ 必须在这里合并渲染 ——
   两边都直接往同一个 <pre> 写的话会互相覆盖，看到的是闪烁的半份信息。 */
const st = { sun: {}, earth: {} };
const draw = () => {
  if (!panel) return;
  panel.textContent = [
    'SVG 星球 · 运行中',
    `太阳  fps ${String(st.sun.fps ?? '-').padStart(4)}   look ${(st.sun.lx ?? 0).toFixed(1)} , ${(st.sun.ly ?? 0).toFixed(1)}`,
    `地球  fps ${String(st.earth.fps ?? '-').padStart(4)}   悬停 ${(st.earth.hover ?? 0).toFixed(2)}  按压 ${(st.earth.press ?? 0).toFixed(2)}  眨眼 ${(st.earth.blink ?? 0).toFixed(2)}`,
  ].join('\n');
};

const sun = mountSun(root, {
  debug: debugOn ? (s) => { Object.assign(st.sun, s); draw(); } : undefined,
});

const earth = mountEarth(earthRoot, {
  debug: debugOn ? (s) => { Object.assign(st.earth, s); draw(); } : undefined,
});

// 暴露到 window：调试脚本靠它读状态、手动摆视线
window.sun = sun;
window.earth = earth;

// 热更新时先拆干净，否则会叠出第二个 rAF 循环
if (import.meta.hot) {
  import.meta.hot.dispose(() => {
    sun.destroy();
    earth.destroy();
    panel?.remove();
  });
}
