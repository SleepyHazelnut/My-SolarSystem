# 个人主页

两个以原生 SVG 绘制、逐帧驱动动画的星球角色：太阳与地球。

## 简介

页面不使用前端框架。角色的每个图层都是 SVG 图元或位图素材（`<image>`），
动画由 JavaScript 逐帧写入 SVG 属性实现，不依赖 CSS 动画。

两个角色均具备待机呼吸、随机眨眼、悬停反馈与点击反馈。太阳的动画由关键帧与
三段状态机（Idle / Hover / Clicked）驱动，地球的动画为程序化正弦叠加。

## 环境要求

Node.js `^20.19.0` 或 `>=22.12.0`，npm。

## 快速开始

```bash
npm install
npm run dev
```

开发服务器监听 `http://127.0.0.1:5173`。

## 构建

```bash
npm run build      # 产物输出至 dist/
npm run preview    # 本地预览 dist/
```

## 目录结构

```
index.html                    页面骨架
vite.config.js                构建配置
src/
├── main.js                   入口：挂载角色、初始化调试面板
├── style.css                 页面样式
├── characters/
│   ├── sun/                  太阳角色
│   │   ├── scene.js          SVG 图层结构
│   │   ├── anim.js           动画逻辑
│   │   └── index.js          挂载与逐帧驱动
│   └── earth/                地球角色，文件划分同上
├── shared/                   两个角色共用的运动原语
│   ├── easing.js             缓动曲线
│   ├── approach.js           指数逼近
│   ├── impulse.js            阻尼冲激
│   ├── clock.js              帧间隔钳制与帧率统计
│   ├── input.js              指针输入
│   └── blink.js              眨眼计时
└── assets/
    ├── sun/                  太阳：身体与装饰
    ├── face/                 五官（表情）
    └── earth/                地球：球体、五官、小芽、云
```

每个角色均分为三层：`scene.js` 定义 SVG 结构，`anim.js` 计算每帧数值，
`index.js` 负责 DOM 写入与时钟。`anim.js` 为纯逻辑、不访问 DOM，可在 Node 中直接引入并断言。

## 技术栈

| 项 | 说明 |
|---|---|
| 构建 | Vite 7 |
| 动画 | GSAP 3（逐帧时钟与视线补间） |
| 图形 | 原生 SVG + 位图素材 |
| 框架 | 无 |
