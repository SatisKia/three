import * as THREE from "three";
import { OBJLoader } from "three/addons/loaders/OBJLoader.js";
import { MTLLoader } from "three/addons/loaders/MTLLoader.js";

export async function loadObjMtl(basePath, modelName) {
  const path = basePath.endsWith("/") ? basePath : `${basePath}/`;
  const mtlLoader = new MTLLoader();
  mtlLoader.setPath(path);
  const materials = await mtlLoader.loadAsync(`${modelName}.mtl`);
  materials.preload();
  const objLoader = new OBJLoader();
  objLoader.setMaterials(materials);
  objLoader.setPath(path);
  const root = await objLoader.loadAsync(`${modelName}.obj`);

  // MTLLoaderはKaを無視するため、後段でKaを参照できるよう.mtlを軽くパースする
  const url = `${path}${modelName}.mtl`;
  const text = await (await fetch(url)).text();
  const kaMap = new Map();
  let current = null;
  for (const line of text.split("\n")) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const low = t.toLowerCase();
    if (low.startsWith("newmtl ")) {
      current = t.slice(7).trim();
      continue;
    }
    if (low.startsWith("ka ") && current) {
      const parts = t.slice(3).trim().split(/\s+/).map(Number);
      if (parts.length >= 3 && parts.every((n) => !Number.isNaN(n))) {
        const c = new THREE.Color().fromArray(parts).convertSRGBToLinear();
        kaMap.set(current, [c.r, c.g, c.b]);
      }
    }
  }

  root.traverse((obj) => {
    if (!obj.isMesh) return;
    const materials = Array.isArray(obj.material) ? obj.material : [obj.material];
    for (const material of materials) {
      if (!material || !material.name) continue;
      if (kaMap.has(material.name)) material.userData.mtlKaRgb = kaMap.get(material.name);
    }
  });
  return root;
}

// MTLLoaderが付与するMeshPhong等をLambertにし、d2js版に近い拡散光モデルに寄せる
export function convertMaterialsToLambert(root) {
  root.traverse((obj) => {
    if (!obj.isMesh) return;
    const materials = Array.isArray(obj.material) ? obj.material : [obj.material];
    const next = materials.map((material) => {
      if (!material) return material;
      if (material.isMeshLambertMaterial) return material;
      const lambert = new THREE.MeshLambertMaterial();
      lambert.copy(material);
      lambert.needsUpdate = true;
      material.dispose();
      return lambert;
    });
    obj.material = Array.isArray(obj.material) ? next : next[0];
  });
}

// ライトを使わずmap×colorのみ（テクスチャの見た目をそのまま近づける）
export function convertMaterialsToBasic(root) {
  root.traverse((obj) => {
    if (!obj.isMesh) return;
    const materials = Array.isArray(obj.material) ? obj.material : [obj.material];
    const next = materials.map((material) => {
      if (!material) return material;
      if (material.isMeshBasicMaterial) return material;
      const basic = new THREE.MeshBasicMaterial();
      basic.copy(material);
      basic.needsUpdate = true;
      material.dispose();
      return basic;
    });
    obj.material = Array.isArray(obj.material) ? next : next[0];
  });
}

// MTLマテリアル名に対応する拡散テクスチャを差し替える（convertMaterialsToLambert/convertMaterialsToBasicより後に実行）
export function applyDiffuseMapsFromUrls(root, materialUrlByName) {
  const urlMap = {};
  for (const entry of materialUrlByName) {
    urlMap[entry.materialName] = entry.url;
  }
  if (!urlMap) return;
  const loader = new THREE.TextureLoader();
  root.traverse((obj) => {
    if (!obj.isMesh) return;
    const materials = Array.isArray(obj.material) ? obj.material : [obj.material];
    for (const material of materials) {
      if (!material || !material.name) continue;
      const url = urlMap[material.name];
      if (url == null || typeof url !== "string") continue;
      if (material.map) material.map.dispose();
      material.map = loader.load(url);
      material.map.colorSpace = THREE.SRGBColorSpace;
      material.needsUpdate = true;
    }
  });
}

// MeshPhongMaterialのみを走査し、specularとshininessを設定する。specularはTHREE.Color、16進数（0xRRGGBB）、CSS文字列（"#RRGGBB"）などTHREE.Colorコンストラクタが受け付ける値
export function applyPhongSpecular(root, specular, shininess) {
  const _specular = specular && specular.isColor === true ? specular : new THREE.Color(specular);
  root.traverse((obj) => {
    if (!obj.isMesh) return;
    const materials = Array.isArray(obj.material) ? obj.material : [obj.material];
    for (const material of materials) {
      if (material && material.isMeshPhongMaterial) {
        material.specular.copy(_specular);
        material.shininess = shininess;
        material.needsUpdate = true;
      }
    }
  });
}

// メッシュのmaterial.color（拡散色）を一括で置き換える。colorはTHREE.Color、16進数（0xRRGGBB）、CSS文字列（"#RRGGBB"）などTHREE.Colorコンストラクタが受け付ける値
export function applyDiffuse(root, color) {
  const _color = color && color.isColor === true ? color : new THREE.Color(color);
  root.traverse((obj) => {
    if (!obj.isMesh) return;
    const materials = Array.isArray(obj.material) ? obj.material : [obj.material];
    for (const material of materials) {
      if (material && material.color) {
        material.color.copy(_color);
      }
    }
  });
}

// MTLのKaを拡散色へブレンド（ThreeのMTLLoaderはKaを捨てるためloadObjMtlがuserData.mtlKaRgbを付与）
export function applyKaBlendToDiffuse(root, weight) {
  if (weight <= 0) return;
  const w = Math.min(1, weight);
  const ow = 1 - w;
  root.traverse((obj) => {
    if (!obj.isMesh) return;
    const materials = Array.isArray(obj.material) ? obj.material : [obj.material];
    for (const material of materials) {
      if (!material || !material.color) continue;
      const ka = material.userData?.mtlKaRgb;
      if (!ka || ka.length < 3) continue;
      const c = material.color;
      c.r = c.r * ow + ka[0] * w;
      c.g = c.g * ow + ka[1] * w;
      c.b = c.b * ow + ka[2] * w;
    }
  });
}

// emissiveを拡散色colorと同じにし、emissiveIntensityをambientにして、Lambert向けに環境光の底上げを発光で近似する
export function applyAmbient(root, ambient) {
  root.traverse((obj) => {
    if (!obj.isMesh) return;
    const materials = Array.isArray(obj.material) ? obj.material : [obj.material];
    for (const material of materials) {
      if (!material || !material.emissive || typeof material.emissive.copy !== "function") continue;
      material.emissive.copy(material.color); // 拡散色と同じ色で環境光近似
      material.emissiveIntensity = ambient; // LambertではemissiveIntensityで近似
    }
  });
}

// 頂点法線を再計算し、マテリアルをスムースシェーディング（flatShading = false）にする
export function applySmoothShading(root) {
  root.traverse((obj) => {
    if (!obj.isMesh) return;
    const geometry = obj.geometry;
    if (geometry && geometry.isBufferGeometry && geometry.getAttribute("position")) {
      geometry.computeVertexNormals(); // 面法線から頂点法線を求めて平均化し、面と面の境が滑らかに見えやすくする
      // 座標が（ほぼ）同一の分裂頂点どうしで法線を平均し、UV違いで分裂した同一座標頂点を揃える（Metasequoia等のOBJ向け）
      {
        const tolerance = 1e-4;
        const position = geometry.getAttribute("position");
        const normal = geometry.getAttribute("normal");
        if (position && normal && position.count === normal.count) {
          const invTol = 1 / tolerance;
          const keyFor = (i) =>
            `${Math.round(position.getX(i) * invTol)},${Math.round(position.getY(i) * invTol)},${Math.round(position.getZ(i) * invTol)}`;

          const groups = new Map();
          const n = position.count;
          for (let i = 0; i < n; i++) {
            const k = keyFor(i);
            if (!groups.has(k)) groups.set(k, []);
            groups.get(k).push(i);
          }

          const tmp1 = new THREE.Vector3();
          const tmp2 = new THREE.Vector3();
          for (const indices of groups.values()) {
            if (indices.length < 2) continue;
            tmp2.set(0, 0, 0);
            for (const i of indices) {
              tmp1.fromBufferAttribute(normal, i);
              tmp2.add(tmp1);
            }
            if (tmp2.lengthSq() === 0) continue;
            tmp2.normalize();
            for (const i of indices) {
              normal.setXYZ(i, tmp2.x, tmp2.y, tmp2.z);
            }
          }
          normal.needsUpdate = true;
        }
      }
    }
    const materials = Array.isArray(obj.material) ? obj.material : [obj.material];
    for (const material of materials) {
      if (material && "flatShading" in material) {
        material.flatShading = false; // 頂点法線で補間されるスムースシェーディングにする
        material.needsUpdate = true; // シェーダー切り替えを確実に反映させる
      }
    }
  });
}
