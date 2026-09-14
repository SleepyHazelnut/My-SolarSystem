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
 *    y / scaleX / scaleY / 星环的 x,y,rot,scale / 各层 opacity 全部由 anim.js 每帧写绝对值，
 *    所以这里**不要**再套 sunHover / sunBreathe / sunClick 三层 —— Rive 里那三个是互斥状态，
 *    不是可以叠乘的图层。
 *
 * 3) 命中区 <circle id="hit"> 故意放在 Sun 组**外面**：它不跟着呼吸上下动，
 *    否则贴边移动时 hover 会抖。半径 150 = scene.rml 里 SunHit 椭圆 300×300 的一半。
 *
 * 13 张 PNG 直接复用原设计稿（现位于 src/assets/sun/）：没有重绘，也没有转成矢量。
 */
import cat_face from './assets/sun/cat_face.png';
import clip from './assets/sun/clip.png';
import crown from './assets/sun/crown.png';
import eye_closed from './assets/sun/eye_closed.png';
import eye_dot from './assets/sun/eye_dot.png';
import mouth_flat from './assets/sun/mouth_flat.png';
import mouth_round from './assets/sun/mouth_round.png';
import ring_outer from './assets/sun/ring_outer.png';
import spark1 from './assets/sun/spark1.png';
import spark2 from './assets/sun/spark2.png';
import spark3 from './assets/sun/spark3.png';
import spark4 from './assets/sun/spark4.png';
import sun_base from './assets/sun/sun_base.png';

export const IMG = { cat_face, clip, crown, eye_closed, eye_dot, mouth_flat, mouth_round, ring_outer, spark1, spark2, spark3, spark4, sun_base };

export const SVG_SCENE = `
    <svg id="scene" viewBox="0 0 590 600" role="img"
         aria-label="会呼吸、眼睛跟随指针、可点击的太阳角色">

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
               这里自下而上（= 下面这个顺序）：SunBody → 五官 → Clip → Ring → Crown → Spark4..1 -->

          <!-- 1. 太阳本体（含短锯齿）：最底层 -->
          <image id="sunBody" href="${IMG.sun_base}" x="0" y="0" width="1536" height="1536"
                 transform="scale(0.30) translate(-768 -768)" />

          <!-- 2. 五官：Face 节点 (0,4) scale 0.30；Look 子节点由 JS 每帧写 x/y 做视线跟随。
                组内同样要倒着写：Rive 是 EyeDot→…→CatFace，这里 CatFace→…→EyeDot -->
          <g transform="translate(0 4) scale(0.30)">
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

          <!-- 3. 向日葵发夹 (91,-59) scale 0.11 -->
          <image id="clip" href="${IMG.clip}" x="0" y="0" width="1536" height="1536"
                 transform="translate(91 -59) scale(0.11) translate(-768 -768)" />

          <!-- 4. 星环。origin 钉在**内孔圆心**，由混合器写 translate/rotate/scale -->
          <g id="ring">
            <image href="${IMG.ring_outer}" x="0" y="0" width="1536" height="1536" />
          </g>

          <!-- 5. 皇冠 (-98,-134) rotate -33.0024° scale 0.10（静态，三段动画都没驱动它） -->
          <image id="crown" href="${IMG.crown}" x="0" y="0" width="1536" height="1536"
                 transform="translate(-98 -134) rotate(-33.0024) scale(0.10) translate(-768 -768)" />

          <!-- 6. 四颗星光。origin 各自钉在「自己的内容中心」，所以缩放绕星心、星不会飞走。
                 和 Rive 的 Spark1→4 反着来，这里 Spark4→1 -->
          <g id="spark4" opacity="1">
            <image href="${IMG.spark4}" x="0" y="0" width="1536" height="1536" />
          </g>
          <g id="spark3" opacity="1">
            <image href="${IMG.spark3}" x="0" y="0" width="1536" height="1536" />
          </g>
          <g id="spark2" opacity="1">
            <image href="${IMG.spark2}" x="0" y="0" width="1536" height="1536" />
          </g>
          <g id="spark1" opacity="1">
            <image href="${IMG.spark1}" x="0" y="0" width="1536" height="1536" />
          </g>

        </g>
      </g>

      <!-- 命中区：照抄 scene.rml 的 SunHit —— 椭圆 300×300 放在 (301,328) → 半径 150。
           放在 Sun 组外面，所以不随呼吸移动（Rive 里也是静态的，避免贴边抖动）。 -->
      <circle id="hit" cx="301" cy="328" r="150" fill="transparent" style="pointer-events: all" />
    </svg>
`;
