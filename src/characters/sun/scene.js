/**
 * SVG 场景：太阳角色的图层结构（唯一一份）。
 *
 * 三条不能改的规则（都来自 _draft/gsap-demo/svg-sun-assets.html 的实测结论）：
 *
 * 1) 绘制顺序与 Rive 相反。Rive 是「先声明 = 最上层」，SVG 是「后声明 = 最上层」，
 *    所以这里把 scene.rml 的顺序整个倒过来写：
 *      SunBody → 五官(CatFace→MouthRound→MouthFlat→EyeClosed→EyeDot)
 *      → Clip → Ring → Crown → Spark4→3→2→1
 *    写成和 Rive 一样的话，SunBody 会跑到最顶层，把完全落在圆盘内部的五官整片盖住。
 *
 * 2) 只有「Sun 节点位置(295,324)」和「基础缩放」是静态的。
 *    y / scaleX / scaleY / 星环的 x,y,rot,sx,sy / 皇冠与发夹的 rot / 各层 opacity
 *    全部由 anim.js 每帧写绝对值，
 *    所以这里**不要**再套 sunHover / sunBreathe / sunClick 三层 —— Rive 里那三个是互斥状态，
 *    不是可以叠乘的图层。
 *    ⚠️ 皇冠与发夹的旋转写在**包装组**上（#crownGroup / #flowerWrap / #leafWrap），
 *       组内的 <image> 保留自己的静态定位变换。改位置动 image、改摇摆动 group，别混。
 *
 * 3) 皇冠和四颗星光在同一个 #crownGroup 里。星光原本是独立节点，
 *    但皇冠一旦会转，独立的星光就会「脱开」—— 它们视觉上是一体的，必须同组。
 *
 * 4) 命中区 <circle id="hit"> 故意放在 Sun 组**外面**：它不跟着呼吸上下动，
 *    否则贴边移动时 hover 会抖。半径 150 = scene.rml 里 SunHit 椭圆 300×300 的一半。
 *
 * 14 张 PNG 直接复用原设计稿：没有重绘，也没有转成矢量。
 * 2026-10-03 起按用途分两个目录 ——
 *   五官（表情）  src/assets/face/   cat_face / eye_dot / eye_closed / mouth_flat / mouth_round
 *   身体与装饰    src/assets/sun/    sun_base / ring_outer / crown / flower / leaf / spark1~4
 * 发夹的花与叶是两张独立图（2026-09-29 拆），各自钉自己内容的 bbox 中心。
 *
 * ⚠️ 下面整块是**模板字符串**（反引号包起来的）。所以在这段 HTML 的注释里
 *    **不能出现反引号**（会把字符串提前截断 → rollup 报 "Expected a semicolon"），
 *    也**不能出现裸的 `${`**（会被当插值求值）。只有 `${IMG.xxx}` 是有意为之。
 *    2026-09-30 就踩过一次：注释里写了 `clip.rot`，`npm run build` 直接挂。
 *    所以改完**必跑 `npm run build`** —— 这类问题只在构建时暴露。
 */
import cat_face from '../../assets/face/cat_face.png';
import crown from '../../assets/sun/crown.png';
import eye_closed from '../../assets/face/eye_closed.png';
import eye_dot from '../../assets/face/eye_dot.png';
import flower from '../../assets/sun/flower.png';
import leaf from '../../assets/sun/leaf.png';
import mouth_flat from '../../assets/face/mouth_flat.png';
import mouth_round from '../../assets/face/mouth_round.png';
import ring_outer from '../../assets/sun/ring_outer.png';
import spark1 from '../../assets/sun/spark1.png';
import spark2 from '../../assets/sun/spark2.png';
import spark3 from '../../assets/sun/spark3.png';
import spark4 from '../../assets/sun/spark4.png';
import sun_base from '../../assets/sun/sun_base.png';

export const IMG = { cat_face, crown, eye_closed, eye_dot, flower, leaf, mouth_flat, mouth_round, ring_outer, spark1, spark2, spark3, spark4, sun_base };

export const SVG_SCENE = `
    <svg id="scene" viewBox="0 0 590 600" role="img"
         aria-label="会呼吸、会随机眨眼、可悬停、可点击的太阳角色">

      <!-- ============================================================
           星光 glow（2026-09-30）。三条不能踩的坑：
           ① 滤镜必须挂在**没有自己缩放**的组上。挂到 #sparkN 上会失效 ——
              那层自带 scale(0.115)，滤镜在它的**内层**坐标系里求值，
              stdDeviation=2.5 实际只有 2.5×0.115 = 0.29 屏幕像素，等于没糊。
              挂在这里（#sparkGlowGroup 无 transform）单位就是 Sun 坐标，
              1 单位 ≈ 屏幕 0.8px，stdDeviation=5 → 约 4 屏幕像素。
           ② 别用 feColorMatrix 把某个通道清零 —— 星光素材本身是暖黄白，
              清掉蓝通道会变成橙红光晕。
              ⚠️ 也**不能直接 feMerge 一份 SourceGraphic 的模糊**（第一版就是这么写的）：
              素材带深色描边，模糊等于把描边的暗色摊开一大片，在奶油底上看着是
              **一圈脏兮兮的灰褐晕**，比不加还难看。正确做法是**只取模糊后的 alpha，
              灌一个暖亮色**（feFlood + feComposite operator="in"），
              这样辉光是"亮出来"的，而不是"把周围的暗色抹开"。
           ③ filterUnits 必须写 userSpaceOnUse。默认的 objectBoundingBox 会拿
              <image> 的 1536² 元素盒当基准，滤镜区域大到离谱（还白烧性能）。
              下面这个区域按四颗星在 Sun 坐标里的实际范围（x −180~−92、
              y −208~−119）留了 ≥30 单位余量。
           ⚠️ color-interpolation-filters="sRGB" 也不能省：默认是 linearRGB，
              会把暖黄的辉光洗成灰白。
           ============================================================ -->
      <defs>
        <filter id="sparkGlow" filterUnits="userSpaceOnUse"
                x="-250" y="-280" width="220" height="220"
                color-interpolation-filters="sRGB">
          <feGaussianBlur in="SourceAlpha" stdDeviation="5" result="sparkGlowBlur"/>
          <feFlood flood-color="#FFF4B8" result="sparkGlowColor"/>
          <feComposite in="sparkGlowColor" in2="sparkGlowBlur" operator="in" result="sparkGlowHalo"/>
          <feMerge>
            <feMergeNode in="sparkGlowHalo"/>
            <feMergeNode in="sparkGlowHalo"/>
            <feMergeNode in="SourceGraphic"/>
          </feMerge>
        </filter>

        <!-- ============================================================
             星环前后分层（2026-10-01）。把环沿「过环心的屏幕水平线」切成两半：
               环远侧 → #ringBack，画在太阳本体**之前**（= 在太阳之下，被挡住）
               环近侧 → #ringFront，画在发夹**之后**（= 在太阳之上，压住太阳下缘）
             读出来才是「一个环斜着套在太阳上」，而不是「一张贴纸糊在太阳前面」。

             ⚠️ 三条硬约束，改的时候别踩：
             ① clip 必须挂在**环变换之外**的包装组上。环的变换是
                translate → scale(sx sy) → rotate(rot) → translate(−O)；
                clip 若挂到 rotate 内侧，那根切分线会跟着 ring.rot 一起转，接缝立刻歪。
             ② 两半必须共用**同一份 transform 字符串**（index.js 每帧写两遍）。
                两边差一个字节，中间就会裂出一条缝。
             ③ 切分线必须跟着环心走 —— 环心的 y 就是 ring.y（变换里的第一个 translate）。
                index.js 每帧把这两个 rect 的 y/height 重写一遍。
                ⚠️ 前后归属跟 RING_TILT.squash 的符号绑定：squash < 1 = 俯视 → 上半是远侧。
                   哪天改成 > 1 或做负向侧转，index.js 会自动把两个 rect 对调。
             ⚠️ 切分线**只在侧转时成立**（2026-10-01 修正）：静止时环是正圆贴在太阳
                外圈，没有深度可读，切一半只会读成「太阳把环啃了一口」。
                所以 index.js 按侧转量 k 把切分线往上停：k=1 落在环心，k=0 停到环外
                （= 整环归前半层 = 和没分层一模一样）。
             ⚠️ 两个 rect 的跨度必须**各自覆盖整环**：切分线会被停到 −900 附近，
                前半层只给 1000 高的话下边界就停在 106，环的下半截会被裁掉。
                所以用 SPAN = 2000。
             rect 的 y/height 只是初始值（对应 Idle 静止位、k=0、切分线停在环上方），
             运行期一律由 index.js 覆写。
             ============================================================ -->
        <clipPath id="ringClipBack" clipPathUnits="userSpaceOnUse">
          <rect id="ringClipBackRect" x="-800" y="-2000" width="1600" height="1105.7"/>
        </clipPath>
        <clipPath id="ringClipFront" clipPathUnits="userSpaceOnUse">
          <rect id="ringClipFrontRect" x="-800" y="-894.3" width="1600" height="2000"/>
        </clipPath>
      </defs>

      <!-- ============================================================
           结构：只有「Sun 节点位置」和「基础缩放」是静态的，
           其余（y / scaleX / scaleY / 环的 x,y,rot,scale / 各层 opacity）
           全部由下面的状态机混合器每帧写绝对値。
           所以这里**不需要**再套 sunHover / sunBreathe / sunClick 三层 ——
           Rive 里那三个是互斥状态，不是可以叠乘的图层。
           ============================================================ -->
      <g transform="translate(295 324)">
        <g id="sun">

          <!-- ⚠️ 绘制顺序：Rive 是「先声明 = 最上层」，SVG 恰好相反（后声明 = 最上层）。
               所以这里必须**把 scene.rml 的顺序倒过来写**。
               写成和 Rive 一样的话，SunBody 会跑到最顶层，把完全落在圆盘内部的
               五官整片盖住（皇冠/星环/发夹大部分在圆盘外，肉眼反而看不出异常）。
               scene.rml 自上而下：Spark1..4 → Crown → Ring → Clip → 五官 → SunBody
               这里自下而上（= 下面这个顺序）：SunBody → 五官 → Clip → Ring → Crown → Spark4..1
               ⚠️ 2026-10-01 起 Ring 拆成两层（#ringBack / #ringFront），
                  排在首尾：RingBack → SunBody → 五官 → Clip → RingFront → Crown → Spark4..1 -->

          <!-- 0. 星环**远侧**（2026-10-01 前后分层）。画在太阳本体之前 = 在太阳之下。
               clip 挂在包装组上（在环变换之外），见 <defs> 里 ringClipBack 的注释。
               ⚠️ 这里的 <image> 只放静态属性（尺寸），transform 由 index.js 每帧写 ——
                  和 #ringFront 里那份**必须逐字节相同**。 -->
          <g id="ringBack" clip-path="url(#ringClipBack)">
            <image id="ringImgBack" href="${IMG.ring_outer}" x="0" y="0" width="1536" height="1536" />
          </g>

          <!-- 1. 太阳本体（含短锯齿）：最底层 -->
          <image id="sunBody" href="${IMG.sun_base}" x="0" y="0" width="1536" height="1536"
                 transform="scale(0.30) translate(-768 -768)" />

          <!-- 2. 五官：Face 节点 (0,4) scale 0.30。两层嵌套，职责分开：
                 #lookNod  点击时的「上下点头」（anim.js 每帧写绝对 y）
                 #look     视线跟随（index.js 用 gsap.quickTo 补间）
               分开是为了让点头不被视线补间的 0.18s 阻尼吃掉。
               组内同样要倒着写：Rive 是 EyeDot→…→CatFace，这里 CatFace→…→EyeDot -->
          <g transform="translate(0 4) scale(0.30)">
            <g id="lookNod">
              <g id="look">
                <image id="catFace" href="${IMG.cat_face}" x="0" y="0" width="648" height="324"
                       opacity="0"
                       transform="translate(-54.6 63.5) scale(0.976) translate(-282.0744 -136.2096)" />
                <image id="mouthRound" href="${IMG.mouth_round}" x="0" y="0" width="1536" height="1536"
                       opacity="0" transform="translate(-768 -768)" />
                <image id="mouthFlat" href="${IMG.mouth_flat}" x="0" y="0" width="1536" height="1536"
                       opacity="1" transform="translate(-768 -768)" />
                <image id="eyeClosed" href="${IMG.eye_closed}" x="0" y="0" width="1536" height="1536"
                       opacity="0" transform="translate(-768 -768)" />
                <image id="eyeDot" href="${IMG.eye_dot}" x="0" y="0" width="1536" height="1536"
                       opacity="1" transform="translate(-768 -768)" />
              </g>
            </g>
          </g>

          <!-- 3. 向日葵发夹：花与叶**各自独立一层动画**（2026-09-30 拆开）。
               原来两层共用一个 #clipWrap、只有一条 clip.rot 轨道，只能整体刚性摆动 ——
               叶子看着像焊死在花上，读不出「叶子比花轻、会自己晃」。

               现在各有一层包装组、**各自的支点**（支点不同才是「分开」的关键）：
                 花：绕**自身内容中心** (65,-61.5) 转 —— 圆盘，绕中心最自然
                 叶：绕**梗根** (73,-46) 转 —— 梗根在花后面，所以叶子看着是从花背后
                     长出来再摆，而不是绕叶片中心自转
               两个支点相距 17 个单位（都在花盘背后），所以摆起来不会看出「断开」。

               组内的 <image> 保留自己的静态定位变换（落点 / 角度 / 缩放）：
               origin 各钉在**自己内容的 bbox 中心**（花的 752.5,805.5；叶的 806.5,759.5），
               再靠 translate 把该中心摆到 (x, y) —— 也就是「这一层在 Sun 坐标系里的落点」。
               花和叶各有自己的静态角度（12° / 29°），是 2026-09-29 在 _draft/sun-tuner.html 上调出来的。
               三层变换的顺序是 translate(x y) rotate(θ) scale(k) translate(-ox -oy)：
               ⚠️ rotate 必须夹在两次 translate 中间 —— 写到最前面会绕画布原点转、图形飞出去。

               z 序：叶在下、花在上（叶从花背后探出来）。改位置动 image、改摇摆动 group，别混。 -->
          <g id="leafWrap">
            <image id="clipLeaf" href="${IMG.leaf}" x="0" y="0" width="1536" height="1536"
                   transform="translate(104 -58.5) rotate(29) scale(0.074) translate(-806.5 -759.5)" />
          </g>
          <g id="flowerWrap">
            <image id="clipFlower" href="${IMG.flower}" x="0" y="0" width="1536" height="1536"
                   transform="translate(65 -61.5) rotate(12) scale(0.077) translate(-752.5 -805.5)" />
          </g>

          <!-- 4. 星环**近侧**（2026-10-01 前后分层）。画在发夹之后 = 在太阳之上，
               压住太阳的下缘 —— 与 #ringBack 合成「环斜着套住太阳」的读法。
               origin 钉在**内孔圆心**，由混合器每帧写 translate / scale / rotate。
               ⚠️ 2026-09-30 起 scale 拆成 sx / sy 且**放在 rotate 外面**（3D 侧转需要）：
                  translate → scale(sx sy) → rotate(rot) → translate(-O)
                  写成「先 rotate 再 scale」的话，压缩轴会跟着环一起转，
                  看着像"总有个方向在挤它"而不是"这个环被斜着看"。
               ⚠️ 这份 transform 与 #ringImgBack 的**逐字节相同**，由 index.js 同一个字符串写入。 -->
          <g id="ringFront" clip-path="url(#ringClipFront)">
            <image id="ringImgFront" href="${IMG.ring_outer}" x="0" y="0" width="1536" height="1536" />
          </g>

          <!-- 5~6. 皇冠 + 四颗星光，**必须包在同一组里**。
               星光原本是独立节点，但给皇冠加旋转后星光不跟着走就会「脱开」——
               它们视觉上是一体的（星光就是从皇冠迸出来的），所以用 #crownGroup
               把两者绑住，整组绕皇冠中心 (-98,-134) 转。
               组内顺序仍是「皇冠在下、星光在上」，z 序与拆分前完全一致。 -->
          <g id="crownGroup">
            <image id="crown" href="${IMG.crown}" x="0" y="0" width="1536" height="1536"
                   transform="translate(-98 -134) rotate(-33.0024) scale(0.115) translate(-768 -768)" />

            <!-- 四颗星光的 origin 各自钉在「自己的内容中心」，所以缩放绕星心、星不会飞走。
                 和 Rive 的 Spark1→4 反着来，这里 Spark4→1。
                 初始 opacity 0 —— 平时完全不显示，点击时才由 anim.js 的特效层点亮。

                 #sparkGlowGroup 是**只为 glow 滤镜存在的空壳**：它自己没有任何
                 transform，所以滤镜的 stdDeviation 单位是 Sun 坐标（见上面的 defs）。
                 关掉 glow 时 index.js 会把这个 filter 属性摘掉。 -->
            <g id="sparkGlowGroup" filter="url(#sparkGlow)">
              <g id="spark4" opacity="0">
                <image href="${IMG.spark4}" x="0" y="0" width="1536" height="1536" />
              </g>
              <g id="spark3" opacity="0">
                <image href="${IMG.spark3}" x="0" y="0" width="1536" height="1536" />
              </g>
              <g id="spark2" opacity="0">
                <image href="${IMG.spark2}" x="0" y="0" width="1536" height="1536" />
              </g>
              <g id="spark1" opacity="0">
                <image href="${IMG.spark1}" x="0" y="0" width="1536" height="1536" />
              </g>
            </g>
          </g>

        </g>
      </g>

      <!-- 命中区：照抄 scene.rml 的 SunHit —— 椭圆 300×300 放在 (301,328) → 半径 150。
           放在 Sun 组外面，所以不随呼吸移动（Rive 里也是静态的，避免贴边抖动）。 -->
      <circle id="hit" cx="301" cy="328" r="150" fill="transparent" style="pointer-events: all" />
    </svg>
`;
