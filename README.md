# 个人主页

用 Rive 实现的太阳角色：会呼吸、眼睛跟随鼠标、可点击。

Rive 工程位于 `rive/`，网页代码位于 `src/`。

> 目前仅包含这一个角色，后续内容会陆续补充。

## 运行

`rive/build/rive.riv` 为编译产物，不入版本库。克隆仓库后须先编译，否则 `npm run dev` 会启动失败。

```bash
# 1. 安装 Rive CLI。安装脚本会输出一行 export PATH=...，需加入 shell 配置
curl -fsSL https://releases.rive.app/cli/install.sh | sh

# 2. 编译角色工程
cd rive && rive . --once && cd ..

# 3. 启动开发服务器
npm install
npm run dev
```

开发服务器地址：http://127.0.0.1:5173

修改 `rive/scene.rml` 或 `rive/assets/sun/` 后，重新执行第 2 步。

### 构建

```bash
npm run build      # 输出至 dist/
npm run preview    # 本地预览 dist/
```

## 结构

| 路径 | 说明 |
|---|---|
| `index.html`、`src/` | 网页（Vite）。`src/sun.js` 接入 Rive 运行时并实现视线跟随 |
| `rive/` | Rive 工程。`rive/scene.rml` 是唯一需要手改的源文件 |
| `rive/build/rive.riv` | 编译产物，前端唯一读取的文件 |

## 注意

- 编译须使用 `rive . --once`。省略 `--once` 会常驻监听并留下多个 `.riv`。
- `rive/assets/sun/` 中的素材文件名须为 ASCII。Rive CLI 不支持中文路径，会静默视为空资源。
- `.riv` 不含脚本，本地 `--once` 的产物可直接用于网页，无需 `--publish` 签名。
