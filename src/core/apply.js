/**
 * 把姿态写进 DOM：按角色名取节点，逐帧写 transform 与三态眼 opacity。
 *
 * 各角色 `scene.js` 的 id 约定（`name` 就是角色名）：
 *   `#<name>`             入场缩放，局部原点即角色中心
 *   `#<name>Scene`        整层淡入
 *   `#<name>BodyWrap`     呼吸 + 悬停 + 按压
 *   `#<name>Eye{Open,Half,Closed}`  三态眼，`eyes: true` 时用
 *
 * 入场缩放与下移叠在 `#<name>` 上（原点 = 角色中心，原地放大）。
 */
export function setupPose({ name, bodyC, eyes = false }) {
  return function setup(root) {
    const el = root.querySelector(`#${name}`);
    const sceneEl = root.querySelector(`#${name}Scene`);
    const bodyWrapEl = root.querySelector(`#${name}BodyWrap`);
    /* 三态眼按名字取，不用数组下标 —— eyeWeights() 返回 [open, half, closed]，
       DOM 顺序或权重顺序变动时不致静默错位。 */
    const eyeEls = eyes ? {
      open: root.querySelector(`#${name}EyeOpen`),
      half: root.querySelector(`#${name}EyeHalf`),
      closed: root.querySelector(`#${name}EyeClosed`),
    } : null;

    const tx = (v) => v.toFixed(3);
    const sc = (v) => v.toFixed(6);

    return {
      apply(v, iv) {
        /* `iv.opacity === null` → 清掉 inline opacity */
        if (iv.opacity === null) { if (sceneEl.style.opacity) sceneEl.style.opacity = ''; }
        else sceneEl.style.opacity = iv.opacity;

        el.setAttribute('transform', `scale(${sc(iv.k)}) translate(0 ${iv.dy.toFixed(4)})`);

        /* 本体：呼吸（绕球心缩放）+ 悬停上浮 + 按压下沉。
           眼睛是 `#<name>BodyWrap` 的子节点，随之一起移动，不会与烘死的嘴错开。 */
        bodyWrapEl.setAttribute('transform',
          `translate(0 ${v.bodyDY.toFixed(4)}) ` +
          `translate(${tx(bodyC.x)} ${tx(bodyC.y)}) ` +
          `scale(${sc(v.bodySX)} ${sc(v.bodySY)}) ` +
          `translate(${tx(-bodyC.x)} ${tx(-bodyC.y)})`);

        /* 眨眼：三态眼按权重切 opacity。相邻两段权重和恒为 1，不会闪。 */
        if (eyeEls) {
          const [wOpen, wHalf, wClosed] = v.eyes;
          eyeEls.open.setAttribute('opacity', wOpen.toFixed(4));
          eyeEls.half.setAttribute('opacity', wHalf.toFixed(4));
          eyeEls.closed.setAttribute('opacity', wClosed.toFixed(4));
        }
      },
    };
  };
}
