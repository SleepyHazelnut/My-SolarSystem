/**
 * 页面入口：把太阳挂到 #sun、地球挂到 #earth。
 */
import { mountSun } from './characters/sun/index.js';
import { mountEarth } from './characters/earth/index.js';

const root = document.getElementById('sun');
const earthRoot = document.getElementById('earth');

if (!root) {
  throw new Error('找不到 #sun 容器');
}
if (!earthRoot) {
  throw new Error('找不到 #earth 容器');
}

const sun = mountSun(root);
const earth = mountEarth(earthRoot);

// 暴露到 window：回归脚本靠它读状态
window.sun = sun;
window.earth = earth;

// 热更新时先拆干净，否则会叠出第二个 rAF 循环
if (import.meta.hot) {
  import.meta.hot.dispose(() => {
    sun.destroy();
    earth.destroy();
  });
}
