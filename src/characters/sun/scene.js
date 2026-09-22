/**
 * SVG 场景：太阳角色的图层结构（唯一一份）。
 *
 * 1) 绘制顺序与 Rive 相反（SVG 后声明 = 最上层），所以按 scene.rml 倒着写：
 *    SunBody → 五官(CatFace→MouthRound→MouthFlat→EyeClosed→EyeDot) → Clip → Ring → Crown → Spark4→3→2→1
 *    写成 Rive 的顺序，SunBody 会跑到最顶层，把完全落在圆盘内的五官整片盖住。
 *
 * 2) 只有「Sun 节点落点 SUN」(见 anim.js) 与「基础缩放」是静态的。y / scaleX / scaleY /
 *    环的 x,y,rot,sx,sy / 皇冠与发夹的 rot / 各层 opacity 全部由 anim.js 每帧写绝对值，
 *    所以不要再套 sunHover / sunBreathe / sunClick 三层 —— 那三个是互斥状态，不是可叠乘的图层。
 *    皇冠与发夹的旋转写在**包装组**上（#crownGroup / #flowerWrap / #leafWrap），
 *    组内的 <image> 保留自己的静态定位变换：改位置动 image、改摇摆动 group。
 *
 * 3) 皇冠与四颗星光同属 #crownGroup —— 星光独立就会在皇冠旋转时「脱开」。
 *
 * 4) 命中区 <circle id="hit"> 故意放在 Sun 组**外面**：不跟着呼吸上下动，否则贴边移动时 hover 会抖。
 *
 * 素材 14 张 PNG 复用原设计稿，未重绘、未转矢量：五官在 `src/assets/face/`，身体与装饰在 `src/assets/sun/`。
 *
 * 下面整块是**模板字符串**：注释里不能出现反引号（会提前截断 → rollup 报 "Expected a semicolon"），
 * 也不能出现裸的 ${（会被当插值求值），只有 ${IMG.xxx} 是有意为之。
 * 改完**必跑 `npm run build`** —— 这类问题只在构建时暴露。
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

import { SUN } from './anim.js';

export const IMG = { cat_face, crown, eye_closed, eye_dot, flower, leaf, mouth_flat, mouth_round, ring_outer, spark1, spark2, spark3, spark4, sun_base };

export const SVG_SCENE = `
    <svg id="scene" viewBox="0 0 590 600" role="img"
         aria-label="会呼吸、会随机眨眼、可悬停、可点击的太阳角色">

      <!-- 星光 glow。三条约束：
           ① 滤镜必须挂在**没有自己缩放**的组上 —— 挂到 #sparkN（自带 scale 0.115）会在它的
              内层坐标系里求值，stdDeviation 5 实际只有 0.58 屏幕像素，等于没糊。
           ② 只取模糊后的 alpha 灌暖亮色。直接 feMerge 一份 SourceGraphic 的模糊，会把素材的
              深色描边摊成一圈灰褐晕，在奶油底上比不加更难看。
           ③ filterUnits 必须写 userSpaceOnUse（默认 objectBoundingBox 会拿 1536² 元素盒当基准），
              color-interpolation-filters 必须写 sRGB（默认 linearRGB 会把暖黄洗成灰白）。
           下面这个区域按四颗星在 Sun 坐标里的实际范围（x −180~−92、y −208~−119）留了 ≥30 单位余量。 -->
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

        <!-- 星环前后分层：沿「过环心的屏幕水平线」切成两半 ——
             远侧 → #ringBack，画在本体之前（在太阳之下，被挡住）
             近侧 → #ringFront，画在发夹之后（在太阳之上，压住太阳下缘）
             合起来才是「环斜着套在太阳上」，而不是「一张贴纸糊在太阳前面」。

             三条硬约束：
             ① clip 必须挂在**环变换之外**的包装组上 —— 环的变换是
                translate → scale(sx sy) → rotate(rot) → translate(−O)，clip 挂到 rotate 内侧
                切分线会跟着 ring.rot 一起转，接缝立刻歪。
             ② 两半共用**同一份 transform 字符串**（index.js 每帧写两遍），差一个字节就裂一条缝。
             ③ 两个 rect 的跨度必须**各自覆盖整环**：切分线会被停到 −900 附近，
                前半层只给 1000 高的话下边界停在 106，环的下半截会被裁掉 —— 所以用 SPAN = 2000。

             切分线**只在侧转时成立**：静止时环是正圆贴在太阳外圈、没有深度可读，
             切一半只会读成「太阳把环啃了一口」。index.js 按侧转量 k 把它往上停：
             k=1 落在环心，k=0 停到环外（= 整环归前半层 = 与没分层逐位相同）。
             前后归属跟 RING_TILT.squash 的符号绑定（squash < 1 = 俯视 → 上半是远侧）；
             改成 > 1 或负向侧转时 index.js 会自动对调两个 rect。
             下面 rect 的 y/height 只是 Idle 静止位的初始值，运行期一律由 index.js 覆写。 -->
        <clipPath id="ringClipBack" clipPathUnits="userSpaceOnUse">
          <rect id="ringClipBackRect" x="-800" y="-2000" width="1600" height="1105.7"/>
        </clipPath>
        <clipPath id="ringClipFront" clipPathUnits="userSpaceOnUse">
          <rect id="ringClipFrontRect" x="-800" y="-894.3" width="1600" height="2000"/>
        </clipPath>
      </defs>

      <!-- 只有「Sun 节点位置」和「基础缩放」是静态的；y / scaleX / scaleY / 环的变换 /
           各层 opacity 由混合器每帧写绝对值，所以这里不再套状态层（那三个是互斥状态）。 -->
      <g transform="translate(${SUN.x} ${SUN.y})">
        <g id="sun">

          <!-- 绘制顺序必须把 scene.rml 倒过来写（SVG 后声明 = 最上层）。
               scene.rml 自上而下：Spark1..4 → Crown → Ring → Clip → 五官 → SunBody
               这里自下而上：RingBack → SunBody → 五官 → Clip → RingFront → Crown → Spark4..1 -->

          <!-- 0. 星环**远侧**：画在本体之前 = 在太阳之下。clip 挂在包装组上（见 defs）。
               transform 由 index.js 每帧写，与 #ringImgFront 那份必须逐字节相同。 -->
          <g id="ringBack" clip-path="url(#ringClipBack)">
            <image id="ringImgBack" href="${IMG.ring_outer}" x="0" y="0" width="1536" height="1536" />
          </g>

          <!-- 1. 太阳本体（含短锯齿）：最底层 -->
          <image id="sunBody" href="${IMG.sun_base}" x="0" y="0" width="1536" height="1536"
                 transform="scale(0.30) translate(-768 -768)" />

          <!-- 2. 五官：Face 节点 (0,4) scale 0.30。两层嵌套各司其职 ——
                 #lookNod 点击点头（anim.js 每帧写绝对 y），#look 视线跟随（gsap.quickTo 补间）；
                 分开是为了让点头不被补间的 0.18s 阻尼吃掉。
                 组内同样倒着写：Rive 是 EyeDot→…→CatFace，这里 CatFace→…→EyeDot。 -->
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

          <!-- 3. 向日葵发夹：花与叶各一层包装组、**各自的支点** —— 支点不同才是「分开」的关键。
                 花绕自身内容中心 (65,-61.5)（圆盘绕中心最自然），叶绕梗根 (73,-46)
                 （梗根在花后面，叶子看着是从花背后长出来再摆）。两支点相距 17 单位且都在花盘背后，
                 所以摆起来看不出断开。z 序：叶在下、花在上。
                 组内 <image> 保留静态定位变换 —— origin 各钉自己内容的 bbox 中心
                 （花 752.5,805.5 / 叶 806.5,759.5），translate 把该中心摆到落点。
                 顺序 translate(x y) rotate(θ) scale(k) translate(-ox -oy)：
                 rotate 必须夹在两次 translate 中间，写到最前面会绕画布原点转、图形飞出去。 -->
          <g id="leafWrap">
            <image id="clipLeaf" href="${IMG.leaf}" x="0" y="0" width="1536" height="1536"
                   transform="translate(104 -58.5) rotate(29) scale(0.074) translate(-806.5 -759.5)" />
          </g>
          <g id="flowerWrap">
            <image id="clipFlower" href="${IMG.flower}" x="0" y="0" width="1536" height="1536"
                   transform="translate(65 -61.5) rotate(12) scale(0.077) translate(-752.5 -805.5)" />
          </g>

          <!-- 4. 星环**近侧**：画在发夹之后 = 在太阳之上，压住太阳的下缘 —— 与 #ringBack 合成
               「环斜着套住太阳」。origin 钉在内孔圆心，由混合器每帧写 translate / scale / rotate。
               scale 必须放在 rotate **外面**（3D 侧转）：translate → scale(sx sy) → rotate(rot) → translate(-O)。
               反过来写压缩轴会跟着环一起转，读成「总有个方向在挤它」而不是「环被斜着看」。
               与 #ringImgBack 的 transform 逐字节相同，由 index.js 同一个字符串写入。 -->
          <g id="ringFront" clip-path="url(#ringClipFront)">
            <image id="ringImgFront" href="${IMG.ring_outer}" x="0" y="0" width="1536" height="1536" />
          </g>

          <!-- 5~6. 皇冠 + 四颗星光，**必须同组**：星光独立就会在皇冠旋转时「脱开」。
               整组绕皇冠中心 (-98,-134) 转，组内顺序仍是皇冠在下、星光在上。
               四颗星的 origin 各钉自己的内容中心，所以缩放绕星心、星不会飞走；
               初始 opacity 0 —— 平时完全不显示，点击时由 anim.js 的特效层点亮。
               #sparkGlowGroup 是**只为 glow 滤镜存在的空壳**（自己没有任何 transform），
               关掉 glow 时 index.js 摘掉它的 filter 属性。 -->
          <g id="crownGroup">
            <image id="crown" href="${IMG.crown}" x="0" y="0" width="1536" height="1536"
                   transform="translate(-98 -134) rotate(-33.0024) scale(0.115) translate(-768 -768)" />

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

      <!-- 命中区：椭圆 300×300 放在 (301,328) → r=150。放在 Sun 组外面，不随呼吸移动（避免贴边抖动）。 -->
      <circle id="hit" cx="301" cy="328" r="150" fill="transparent" style="pointer-events: all" />
    </svg>
`;
