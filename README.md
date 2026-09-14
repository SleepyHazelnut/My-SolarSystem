# 个人主页

太阳角色：会呼吸、眼睛跟随鼠标、可悬停、可点击。

## 运行

```bash
npm install
npm run dev
```

开发服务器地址：http://127.0.0.1:5173

带 `?debug=1` 打开会在左下角挂一个调试面板（视线偏移、指针坐标、fps）。

### 构建

```bash
npm run build      # 输出至 dist/
npm run preview    # 本地预览 dist/
```

## 结构

| 路径 | 说明 |
|---|---|
| `index.html` | 页面骨架。角色的 `<svg>` 由 JS 注入到 `#sun` |
| `src/main.js` | 页面入口 |
| `src/sun.js` | 挂载与逐帧驱动：写 SVG 属性、绑定输入、视线跟随、逐帧时钟 |
| `src/anim.js` | 缓动函数、三段动画的关键帧、状态机与混合器。纯逻辑，不碰 DOM |
| `src/svg-scene.js` | SVG 图层结构，以及素材的导入 |
| `src/assets/sun/` | 角色素材，13 张 PNG |
| `src/style.css` | 样式 |

## 注意

- 图层顺序在 `src/svg-scene.js` 里是**倒着写**的（SVG 中后声明 = 更上层），改动前先看该文件顶部的说明。
- 角色的位置、缩放、各层不透明度由 `src/anim.js` 每帧写绝对值，不要在 SVG 里再叠一层静态 `transform`。
- 视线跟随的三个参数（`RANGE` / `MAX_SHIFT` / `SMOOTH`）在 `src/sun.js` 里。
