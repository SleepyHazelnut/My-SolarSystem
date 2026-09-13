/**
 * 页面入口：把太阳挂到 #sun 上；加 `?debug=1` 时额外挂一个左下角调试面板。
 */
import { mountSun } from './sun.js';

const canvas = document.getElementById('sun');

if (!canvas) {
  throw new Error('找不到 #sun canvas');
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

const sun = mountSun(canvas, {
  debug: panel
    ? (s) => {
        const status = s.error
          ? '错误  ' + s.error
          : s.ready
            ? '.riv 已加载'
            : '加载中…';
        panel.textContent = [
          status,
          `lookX ${s.lx.toFixed(2).padStart(7)}`,
          `lookY ${s.ly.toFixed(2).padStart(7)}`,
          `指针  ${s.sx.toFixed(0).padStart(4)} , ${s.sy.toFixed(0).padStart(4)}`,
          `fps   ${String(s.fps).padStart(4)}`,
        ].join('\n');
      }
    : undefined,
});

// 暴露到 window：调试脚本靠它读状态、手动摆视线
window.sun = sun;

// 热更新时先拆干净，否则会叠出第二个 rAF 循环
if (import.meta.hot) {
  import.meta.hot.dispose(() => {
    sun.destroy();
    panel?.remove();
  });
}
