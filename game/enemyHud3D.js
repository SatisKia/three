import * as THREE from "three";

const ENEMY_HUD_LABEL_W = 64;
const ENEMY_HUD_LABEL_H = 16;

const enemyHudCorner = new THREE.Vector3();
const enemyHudLabelPos = new THREE.Vector3();
const enemyHudPixelScale = new THREE.Vector3();
const hitProjNdc = new THREE.Vector3();
const hitUnproj = new THREE.Vector3();

function screenToWorldAtDepth(px, py, ndcZ, out, camera, canvasWidth, canvasHeight) {
  const ndcX = (px / canvasWidth) * 2.0 - 1.0;
  const ndcY = -((py / canvasHeight) * 2.0 - 1.0);
  out.set(ndcX, ndcY, ndcZ);
  out.unproject(camera);
  return out;
}

function worldSizeForPixels(wx, wy, wz, pixels, camera, canvasWidth) {
  hitProjNdc.set(wx, wy, wz);
  hitProjNdc.project(camera);
  const ndcX1px = hitProjNdc.x + (2.0 / canvasWidth) * pixels;
  hitUnproj.set(ndcX1px, hitProjNdc.y, hitProjNdc.z);
  hitUnproj.unproject(camera);
  enemyHudPixelScale.set(wx, wy, wz);
  return enemyHudPixelScale.distanceTo(hitUnproj);
}

export function createEnemyHudObjects(scene) {
  // 距離テキスト
  const labelCanvas = document.createElement("canvas");
  labelCanvas.width = ENEMY_HUD_LABEL_W;
  labelCanvas.height = ENEMY_HUD_LABEL_H;
  const labelContext = labelCanvas.getContext("2d");
  const labelTexture = new THREE.CanvasTexture(labelCanvas);
  labelTexture.colorSpace = THREE.SRGBColorSpace;
  labelTexture.premultiplyAlpha = true;
  labelTexture.minFilter = THREE.NearestFilter;
  labelTexture.magFilter = THREE.NearestFilter;
  labelTexture.generateMipmaps = false;
  const labelSprite = new THREE.Sprite(new THREE.SpriteMaterial({
    map: labelTexture,
    transparent: true,
    depthWrite: false,
    toneMapped: false,
  }));
  labelSprite.center.set(0, 0);
  labelSprite.renderOrder = 1;
  scene.add(labelSprite);

  // 引き出し線
  const linePositions = new Float32Array(9);
  const lineGeometry = new THREE.BufferGeometry();
  lineGeometry.setAttribute("position", new THREE.BufferAttribute(linePositions, 3));
  const line = new THREE.Line(
    lineGeometry,
    new THREE.LineBasicMaterial({ color: 0x00ffff })
  );
  line.renderOrder = 1;
  scene.add(line);

  return { labelCanvas, labelContext, labelTexture, labelSprite, line, linePositions };
}

export function disposeEnemyHudObjects(scene, hud) {
  scene.remove(hud.labelSprite);
  scene.remove(hud.line);
  hud.labelTexture.dispose();
  hud.labelSprite.material.dispose();
  hud.line.geometry.dispose();
  hud.line.material.dispose();
}

export function updateEnemyHud({ hud, enemy, enemyHudProj, camera, jiki, canvas3d }) {
  const ex = enemy.x();
  const ey = enemy.y();
  const ez = enemy.z();
  enemyHudProj.set(ex, ey, ez);
  enemyHudProj.project(camera);
  if (enemyHudProj.z < -1.0 || enemyHudProj.z > 1.0) {
    hud.labelSprite.visible = false;
    hud.line.visible = false;
    return;
  }

  const dx = ex - jiki.x();
  const dy = ey - jiki.y();
  const dz = ez - jiki.z();
  const distance = Math.sqrt(dx * dx + dy * dy + dz * dz);
  let seg = 50.0 - distance;
  if (seg < 15.0) seg = 15.0;

  const canvasWidth = canvas3d.width;
  const canvasHeight = canvas3d.height;
  const px = (enemyHudProj.x * 0.5 + 0.5) * canvasWidth;
  const py = (-enemyHudProj.y * 0.5 + 0.5) * canvasHeight;
  const tx = px + seg + 20.0;
  const ty = py - seg;
  const ndcZ = enemyHudProj.z;
  screenToWorldAtDepth(px + seg, ty, ndcZ, enemyHudCorner, camera, canvasWidth, canvasHeight);
  screenToWorldAtDepth(tx, ty, ndcZ, enemyHudLabelPos, camera, canvasWidth, canvasHeight);

  // 引き出し線の更新
  hud.linePositions[0] = ex;
  hud.linePositions[1] = ey;
  hud.linePositions[2] = ez;
  hud.linePositions[3] = enemyHudCorner.x;
  hud.linePositions[4] = enemyHudCorner.y;
  hud.linePositions[5] = enemyHudCorner.z;
  hud.linePositions[6] = enemyHudLabelPos.x;
  hud.linePositions[7] = enemyHudLabelPos.y;
  hud.linePositions[8] = enemyHudLabelPos.z;
  hud.line.geometry.attributes.position.needsUpdate = true;

  // 距離テキストの更新
  const label = String((distance * 100.0) | 0);
  const whole = label.slice(0, -2) || "0";
  const frac = label.slice(-2).padStart(2, "0");
  const text = `${whole}.${frac}`;
  hud.labelContext.clearRect(0, 0, ENEMY_HUD_LABEL_W, ENEMY_HUD_LABEL_H);
  hud.labelContext.font = "8px 'MS Gothic', sans-serif";
  hud.labelContext.fillStyle = "rgb(0, 255, 255)";
  hud.labelContext.textBaseline = "bottom";
  hud.labelContext.fillText(text, 0, ENEMY_HUD_LABEL_H - 2);
  hud.labelTexture.needsUpdate = true;

  hud.labelSprite.position.copy(enemyHudCorner);
  const scaleX = worldSizeForPixels(enemyHudCorner.x, enemyHudCorner.y, enemyHudCorner.z, ENEMY_HUD_LABEL_W, camera, canvasWidth);
  const scaleY = worldSizeForPixels(enemyHudCorner.x, enemyHudCorner.y, enemyHudCorner.z, ENEMY_HUD_LABEL_H, camera, canvasWidth);
  hud.labelSprite.scale.set(scaleX, scaleY, 1.0);
  hud.labelSprite.visible = true;
  hud.line.visible = true;
}
