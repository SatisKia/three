const fs = require('fs');
const path = require('path');

const EOL = process.platform === 'win32' ? '\r\n' : '\n';

function createCursor(text, pos = 0) {
  return { text, pos };
}

function skipWs(cur) {
  while (cur.pos < cur.text.length) {
    const c = cur.text[cur.pos];
    if (c === ' ' || c === '\t' || c === '\r' || c === '\n') {
      cur.pos++;
    } else {
      break;
    }
  }
}

function word(cur) {
  skipWs(cur);
  const start = cur.pos;
  while (cur.pos < cur.text.length) {
    const c = cur.text[cur.pos];
    if (c === ' ' || c === '\t' || c === '\r' || c === '\n' || c === ')') {
      break;
    }
    cur.pos++;
  }
  return cur.text.slice(start, cur.pos);
}

function quotedString(cur) {
  skipWs(cur);
  if (cur.text[cur.pos] === '"') {
    cur.pos++;
  }
  const start = cur.pos;
  while (cur.pos < cur.text.length && cur.text[cur.pos] !== '"') {
    cur.pos++;
  }
  const out = cur.text.slice(start, cur.pos);
  if (cur.text[cur.pos] === '"') {
    cur.pos++;
  }
  return out;
}

function findToken(text, token, fromPos = 0) {
  const idx = text.indexOf(token, fromPos);
  return idx === -1 ? -1 : idx + token.length;
}

function getLine(cur) {
  const start = cur.pos;
  while (cur.pos < cur.text.length && cur.text[cur.pos] !== '\n') {
    cur.pos++;
  }
  const line = cur.text.slice(start, cur.pos);
  if (cur.text[cur.pos] === '\n') {
    cur.pos++;
  }
  return line;
}

function skipLine(cur) {
  while (cur.pos < cur.text.length && cur.text[cur.pos] !== '\n') {
    cur.pos++;
  }
  if (cur.text[cur.pos] === '\n') {
    cur.pos++;
  }
}

function parseVertexIndex(token) {
  if (token.startsWith('V(')) {
    return parseInt(token.slice(2), 10);
  }
  return parseInt(token, 10);
}

function changeExt(filePath, ext) {
  return filePath.replace(/\.[^./\\]+$/, '') + ext;
}

function basenameOnly(filePath) {
  return path.basename(filePath.replace(/\\/g, '/'));
}

function loadFile(filePath) {
  return fs.readFileSync(filePath, 'latin1');
}

function parseMaterials(buf) {
  let pos = findToken(buf, 'Material ');
  if (pos === -1) {
    return [];
  }

  const cur = createCursor(buf, pos);
  const count = parseInt(word(cur), 10);
  if (!Number.isFinite(count) || count <= 0) {
    return [];
  }
  skipLine(cur);

  const mats = [];
  for (let i = 0; i < count; i++) {
    const line = getLine(cur);
    const lineCur = createCursor(line, 0);
    const mat = {
      name: quotedString(lineCur),
      col: [1, 1, 1],
      dif: 0.8,
      amb: 0.6,
      spc: 0.0,
      emi: 0.0,
      power: 5.0,
      tex: '',
      has_tex: false,
    };

    let p = line.indexOf('col(');
    if (p !== -1) {
      const colCur = createCursor(line, p + 4);
      mat.col[0] = parseFloat(word(colCur));
      mat.col[1] = parseFloat(word(colCur));
      mat.col[2] = parseFloat(word(colCur));
    }
    p = line.indexOf('dif(');
    if (p !== -1) {
      const difCur = createCursor(line, p + 4);
      mat.dif = parseFloat(word(difCur));
    }
    p = line.indexOf('amb(');
    if (p !== -1) {
      const ambCur = createCursor(line, p + 4);
      mat.amb = parseFloat(word(ambCur));
    }
    p = line.indexOf('spc(');
    if (p !== -1) {
      const spcCur = createCursor(line, p + 4);
      mat.spc = parseFloat(word(spcCur));
    }
    p = line.indexOf('power(');
    if (p !== -1) {
      const powerCur = createCursor(line, p + 6);
      mat.power = parseFloat(word(powerCur));
    }
    p = line.indexOf('tex(');
    if (p !== -1) {
      const texCur = createCursor(line, p + 4);
      mat.tex = basenameOnly(quotedString(texCur));
      mat.has_tex = mat.tex.length > 0;
    }

    mats.push(mat);
  }

  return mats;
}

function countObjects(buf) {
  let count = 0;
  let pos = 0;
  for (;;) {
    pos = findToken(buf, 'Object ', pos);
    if (pos === -1) {
      break;
    }
    count++;
  }
  return count;
}

function parseObject(curObj) {
  const buf = curObj.text;
  let pos = findToken(buf, 'vertex ', curObj.pos);
  if (pos === -1) {
    return null;
  }

  const cur = createCursor(buf, pos);
  const vertNum = parseInt(word(cur), 10);
  if (!Number.isFinite(vertNum) || vertNum <= 0) {
    return null;
  }

  skipLine(cur);
  const verts = [];
  for (let i = 0; i < vertNum; i++) {
    verts.push({
      x: parseFloat(word(cur)),
      y: parseFloat(word(cur)),
      z: parseFloat(word(cur)),
    });
  }

  pos = findToken(buf, 'face ', cur.pos);
  if (pos === -1) {
    return null;
  }
  cur.pos = pos;

  const faceNum = parseInt(word(cur), 10);
  if (!Number.isFinite(faceNum) || faceNum <= 0) {
    return null;
  }

  skipLine(cur);
  const faces = [];
  for (let i = 0; i < faceNum; i++) {
    const line = getLine(cur);
    const lineCur = createCursor(line, 0);
    const face = {
      v: [0, 0, 0, 0],
      v_num: parseInt(word(lineCur), 10),
      mat: -1,
      uv: [0, 0, 0, 0, 0, 0, 0, 0],
      has_uv: false,
    };

    if (face.v_num < 3 || face.v_num > 4) {
      return null;
    }

    for (let j = 0; j < face.v_num; j++) {
      face.v[j] = parseVertexIndex(word(lineCur));
    }

    let mp = line.indexOf('M(');
    if (mp !== -1) {
      const mCur = createCursor(line, mp + 2);
      face.mat = parseInt(word(mCur), 10);
    }

    let up = line.indexOf('UV(');
    if (up !== -1) {
      const uCur = createCursor(line, up + 3);
      face.has_uv = true;
      for (let j = 0; j < face.v_num * 2; j++) {
        face.uv[j] = parseFloat(word(uCur));
      }
    }

    faces.push(face);
  }

  curObj.pos = cur.pos;
  return { verts, vert_num: vertNum, faces, face_num: faceNum };
}

// 法線
function computeFaceNormal(verts, face) {
  const n = { x: 0, y: 0, z: 0 };

  for (let i = 0; i < face.v_num; i++) {
    const i0 = face.v[i];
    const i1 = face.v[(i + 1) % face.v_num];
    const v0 = verts[i0];
    const v1 = verts[i1];

    n.x += (v0.y - v1.y) * (v0.z + v1.z);
    n.y += (v0.z - v1.z) * (v0.x + v1.x);
    n.z += (v0.x - v1.x) * (v0.y + v1.y);
  }

  const len = Math.hypot(n.x, n.y, n.z);
  if (len > 1e-10) {
    n.x /= len;
    n.y /= len;
    n.z /= len;
  }
  return n;
}
function computeVertexNormals(obj) {
  const normals = Array.from({ length: obj.vert_num }, () => ({ x: 0, y: 0, z: 0 }));

  for (const face of obj.faces) {
    const fn = computeFaceNormal(obj.verts, face);
    for (let j = 0; j < face.v_num; j++) {
      const idx = face.v[j];
      normals[idx].x += fn.x;
      normals[idx].y += fn.y;
      normals[idx].z += fn.z;
    }
  }

  for (const normal of normals) {
    const len = Math.hypot(normal.x, normal.y, normal.z);
    if (len > 1e-10) {
      normal.x /= len;
      normal.y /= len;
      normal.z /= len;
    } else {
      normal.x = 0;
      normal.y = 0;
      normal.z = 1;
    }
  }

  return normals;
}

function writeMtl(filePath, mats) {
  const lines = ['# Created by mqo2obj', ''];
  for (const mat of mats) {
    lines.push(`newmtl ${mat.name}`);
    lines.push(`Ka ${(mat.amb * mat.col[0]).toFixed(5)} ${(mat.amb * mat.col[1]).toFixed(5)} ${(mat.amb * mat.col[2]).toFixed(5)}`);
    lines.push(`Kd ${(mat.dif * mat.col[0]).toFixed(5)} ${(mat.dif * mat.col[1]).toFixed(5)} ${(mat.dif * mat.col[2]).toFixed(5)}`);
    lines.push(`Ks ${(mat.spc * mat.col[0]).toFixed(5)} ${(mat.spc * mat.col[1]).toFixed(5)} ${(mat.spc * mat.col[2]).toFixed(5)}`);
    lines.push(`Ns ${mat.power.toFixed(5)}`);
    if (mat.has_tex) {
      lines.push(`map_Kd ${mat.tex}`);
    }
    lines.push('');
  }
  fs.writeFileSync(filePath, lines.join(EOL), 'latin1');
}

function convertMqoToObj(inPath, outObjPath, options = {}) {
  const exportNormals = options.exportNormals === true;
  let buf;
  try {
    buf = loadFile(inPath);
  } catch (err) {
    throw new Error(`cannot read ${inPath}`);
  }

  const mats = parseMaterials(buf);
  const objPath = outObjPath || changeExt(inPath, '.obj');
  const mtlPath = changeExt(objPath, '.mtl');
  const mtlName = basenameOnly(mtlPath);

  writeMtl(mtlPath, mats);

  const objLines = ['# Created by mqo2obj', '', `mtllib ${mtlName}`, ''];
  let vertexOffset = 0;
  let vtCount = 0;
  let lastMat = -2;

  const objCount = countObjects(buf);
  const curObj = createCursor(buf, 0);
  for (let objIndex = 0; objIndex < objCount; objIndex++) {
    const pos = findToken(buf, 'Object ', curObj.pos);
    if (pos === -1) {
      break;
    }
    curObj.pos = pos;

    const obj = parseObject(curObj);
    if (!obj) {
      continue;
    }

    const normals = exportNormals ? computeVertexNormals(obj) : null;

    for (const vert of obj.verts) {
      objLines.push(`v ${vert.x.toFixed(6)} ${vert.y.toFixed(6)} ${vert.z.toFixed(6)}`);
    }
    objLines.push(`# ${obj.vert_num} vertices`, '');

    if (exportNormals) {
      for (const normal of normals) {
        objLines.push(`vn ${normal.x.toFixed(4)} ${normal.y.toFixed(4)} ${normal.z.toFixed(4)}`);
      }
      objLines.push(`# ${obj.vert_num} vertex normals`, '');
    }

    for (const face of obj.faces) {
      const mat = face.mat >= 0 && face.mat < mats.length ? mats[face.mat] : null;

      if (face.mat !== lastMat) {
        if (mat) {
          objLines.push(`usemtl ${mat.name}`);
        }
        lastMat = face.mat;
      }

      if (face.has_uv) {
        for (let j = 0; j < face.v_num; j++) {
          const u = face.uv[j * 2];
          const v = face.uv[j * 2 + 1];
          objLines.push(`vt ${u.toFixed(5)} ${(1.0 - v).toFixed(5)}`);
          vtCount++;
        }

        let faceLine = 'f';
        for (let j = 0; j < face.v_num; j++) {
          const vIdx = face.v[j] + 1 + vertexOffset;
          const vtIdx = vtCount - face.v_num + j + 1;
          faceLine += exportNormals ? ` ${vIdx}/${vtIdx}/${vIdx}` : ` ${vIdx}/${vtIdx}`;
        }
        objLines.push(faceLine);
      } else {
        let faceLine = 'f';
        for (let j = 0; j < face.v_num; j++) {
          const vIdx = face.v[j] + 1 + vertexOffset;
          faceLine += exportNormals ? ` ${vIdx}//${vIdx}` : ` ${vIdx}`;
        }
        objLines.push(faceLine);
      }
    }
    objLines.push(`# ${obj.face_num} faces`, '');

    vertexOffset += obj.vert_num;
  }

  fs.writeFileSync(objPath, objLines.join(EOL), 'latin1');

  return { inPath, objPath, mtlPath };
}

function main(argv) {
  let argCur = 2;
  let exportNormals = false;

  while (argCur < argv.length && argv[argCur].startsWith('-')) {
    if (argv[argCur] === '-n') {
      exportNormals = true;
      argCur++;
    } else {
      console.error(`error: unknown option ${argv[argCur]}`);
      process.exit(1);
    }
  }

  if (argCur >= argv.length) {
    console.log('usage: node mqo2obj [-n] <input.mqo> [output.obj]');
    process.exit(1);
  }

  const inPath = argv[argCur++];
  const outPath = argCur < argv.length ? argv[argCur] : null;

  try {
    const result = convertMqoToObj(inPath, outPath, { exportNormals });
    console.log(`converted: ${result.inPath} -> ${result.objPath}, ${result.mtlPath}`);
  } catch (err) {
    console.error(`error: ${err.message}`);
    process.exit(1);
  }
}

if (require.main === module) {
  main(process.argv);
}

module.exports = { convertMqoToObj };
