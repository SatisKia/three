import * as THREE from "three";

export const WAIT_1 = 60;

export const GROUND_SIZE = 1200.0;

export const JIKI_Y_MIN = 20.0;
export const JIKI_Y_MAX = 100.0;
export const JIKI_RX_MAX = 60.0;
export const JIKI_RZ_MAX = 45.0;

export const JIKI_SPEED = 1.0;
export const JIKI_RX_ADD = 0.1;
export const JIKI_RX_ADD_MAX = 0.5;
export const JIKI_RY_ADD = 0.1;
export const JIKI_RY_ADD_MAX = 0.5;
export const JIKI_RZ_ADD = 1.0;
export const JIKI_RX_ADD2 = 1.0;

export const JIKI_JET_FRAME = (WAIT_1 / 4) | 0;

export const JIKI_SHOT_MAX = 3;
export const JIKI_SHOT_INTERVAL = 8;
export const JIKI_SHOT_SPEED = 3.0;
export const JIKI_SHOT_END = WAIT_1;

export const DEG2RAD = THREE.MathUtils.DEG2RAD; // Math.PI / 180

export function _MOD(a, b) {
  return ((a % b) + b) % b;
}
export function _DIV(a, b) {
  return (a / b) | 0;
}

function forwardFromPitchYawDeg(rx, ry) {
  const v = new THREE.Vector3(0.0, 0.0, -1.0);
  v.applyAxisAngle(new THREE.Vector3(1.0, 0.0, 0.0), rx * DEG2RAD);
  v.applyAxisAngle(new THREE.Vector3(0.0, 1.0, 0.0), ry * DEG2RAD);
  return v;
}

// 自機
export class Jiki {
  constructor(radius = 1.0) {
    this._x = 0.0;
    this._y = 50.0;
    this._z = 0.0;
    this._rx = 0.0;
    this._ry = 0.0;
    this._rz = 0.0;
    this._rx_add = 0.0;
    this._ry_add = 0.0;
    this._radius = radius;
    const f = forwardFromPitchYawDeg(this._rx, this._ry);
    this._vx = f.x;
    this._vy = f.y;
    this._vz = f.z;
  }

  update(up, down, left, right) {
    let rx_flag = false;
    let ry_flag = false;
    let rz_flag = false;
    if (up) {
      if (this._y < JIKI_Y_MAX) {
        if (this._rx_add < JIKI_RX_ADD_MAX) {
          this._rx_add += JIKI_RX_ADD;
          if (this._rx_add > JIKI_RX_ADD_MAX) this._rx_add = JIKI_RX_ADD_MAX;
        }
        rx_flag = true;
      }
    }
    if (down) {
      if (this._y > JIKI_Y_MIN) {
        if (this._rx_add > -JIKI_RX_ADD_MAX) {
          this._rx_add -= JIKI_RX_ADD;
          if (this._rx_add < -JIKI_RX_ADD_MAX) this._rx_add = -JIKI_RX_ADD_MAX;
        }
        rx_flag = true;
      }
    }
    if (left) {
      if (this._ry_add < JIKI_RY_ADD_MAX) this._ry_add += JIKI_RY_ADD;
      ry_flag = true;
      if (this._rz < -JIKI_RZ_MAX) {
        this._rz += JIKI_RZ_ADD;
        if (this._rz > -JIKI_RZ_MAX) this._rz = -JIKI_RZ_MAX;
      } else {
        this._rz -= JIKI_RZ_ADD;
        if (this._rz < -JIKI_RZ_MAX) this._rz = -JIKI_RZ_MAX;
      }
      rz_flag = true;
    }
    if (right) {
      if (this._ry_add > -JIKI_RY_ADD_MAX) this._ry_add -= JIKI_RY_ADD;
      ry_flag = true;
      if (this._rz > JIKI_RZ_MAX) {
        this._rz -= JIKI_RZ_ADD;
        if (this._rz < JIKI_RZ_MAX) this._rz = JIKI_RZ_MAX;
      } else {
        this._rz += JIKI_RZ_ADD;
        if (this._rz > JIKI_RZ_MAX) this._rz = JIKI_RZ_MAX;
      }
      rz_flag = true;
    }

    if (!rx_flag) {
      if (this._rx_add > 0.0) {
        this._rx_add -= JIKI_RX_ADD;
        if (this._rx_add < 0.0) this._rx_add = 0.0;
      } else if (this._rx_add < 0.0) {
        this._rx_add += JIKI_RX_ADD;
        if (this._rx_add > 0.0) this._rx_add = 0.0;
      }
    }
    this._rx += this._rx_add;
    if (this._rx < -JIKI_RX_MAX) this._rx = -JIKI_RX_MAX;
    if (this._rx > JIKI_RX_MAX) this._rx = JIKI_RX_MAX;

    if (!ry_flag) {
      if (this._ry_add > 0.0) {
        this._ry_add -= JIKI_RY_ADD;
        if (this._ry_add < 0.0) this._ry_add = 0.0;
      } else if (this._ry_add < 0.0) {
        this._ry_add += JIKI_RY_ADD;
        if (this._ry_add > 0.0) this._ry_add = 0.0;
      }
    }
    this._ry += this._ry_add;
    if (this._ry < 0.0) this._ry += 360.0;
    if (this._ry > 360.0) this._ry -= 360.0;

    if (!rz_flag) {
      if (this._rz >= 180.0) this._rz -= 360.0;
      else if (this._rz <= -180.0) this._rz += 360.0;
      if (this._rz >= JIKI_RZ_ADD) this._rz -= JIKI_RZ_ADD;
      else if (this._rz <= -JIKI_RZ_ADD) this._rz += JIKI_RZ_ADD;
      else this._rz = 0.0;
    }

    const f = forwardFromPitchYawDeg(this._rx, this._ry);
    this._vx = f.x;
    this._vy = f.y;
    this._vz = f.z;
    this._x += this._vx * JIKI_SPEED;
    this._y += this._vy * JIKI_SPEED;
    this._z += this._vz * JIKI_SPEED;
    if (this._y < JIKI_Y_MIN) {
      this._y = JIKI_Y_MIN;
      if (this._rx < 0.0) {
        this._rx += JIKI_RX_ADD2;
        if (this._rx > 0.0) this._rx = 0.0;
      }
    }
    if (this._y > JIKI_Y_MAX) {
      this._y = JIKI_Y_MAX;
      if (this._rx > 0.0) {
        this._rx -= JIKI_RX_ADD2;
        if (this._rx < 0.0) this._rx = 0.0;
      }
    }
  }

  x() {
    return this._x;
  }
  y() {
    return this._y;
  }
  z() {
    return this._z;
  }
  vx() {
    return this._vx;
  }
  vy() {
    return this._vy;
  }
  vz() {
    return this._vz;
  }
  rx() {
    return this._rx;
  }
  ry() {
    return this._ry;
  }
  rz() {
    return this._rz;
  }
  rx_add() {
    return this._rx_add;
  }
  ry_add() {
    return this._ry_add;
  }
  radius() {
    return this._radius;
  }

  pose(model) {
    const rotX = new THREE.Matrix4().makeRotationX(-this.rx() * DEG2RAD);
    const rotY = new THREE.Matrix4().makeRotationY((this.ry() + 180.0) * DEG2RAD);
    const rotZ = new THREE.Matrix4().makeRotationZ(this.rz() * DEG2RAD);

    // rotY*rotX*rotZ
    const m = new THREE.Matrix4().multiplyMatrices(rotY, rotX);
    m.multiply(rotZ);

    model.setRotationFromMatrix(m);
    model.position.set(this.x(), this.y(), this.z());
  }

  jetOffsetWorld() {
    const rotX = new THREE.Matrix4().makeRotationX(-this.rx() * DEG2RAD);
    const rotY = new THREE.Matrix4().makeRotationY(this.ry() * DEG2RAD);
    const rotZ = new THREE.Matrix4().makeRotationZ(-this.rz() * DEG2RAD);

    // rotY*rotX*rotZ
    const m = new THREE.Matrix4().multiplyMatrices(rotY, rotX);
    m.multiply(rotZ);

    const right = new THREE.Vector3(1.0, 0.0, 0.0).applyMatrix4(m);
    const left = right.clone().multiplyScalar(-1.0);
    return { right, left };
  }
}

// 噴射
export class JikiJet {
  constructor(x, y, z, vx, vy, vz) {
    this._x = x;
    this._y = y;
    this._z = z;
    this._vx = vx;
    this._vy = vy;
    this._vz = vz;
    this._elapse = 0;
  }
  update() {
    this._x += this._vx;
    this._y += this._vy;
    this._z += this._vz;
    this._elapse++;
    return this._elapse <= JIKI_JET_FRAME;
  }
  x() {
    return this._x;
  }
  y() {
    return this._y;
  }
  z() {
    return this._z;
  }
  elapse() {
    return this._elapse;
  }
  trans() {
    return (1.0 / JIKI_JET_FRAME) * (JIKI_JET_FRAME - (this._elapse - 1.0));
  }
}

// 自弾
export class JikiShot {
  constructor(x, y, z, vx, vy, vz, rz, shotRadius) {
    this._x = x;
    this._y = y;
    this._z = z;
    this._vx = vx;
    this._vy = vy;
    this._vz = vz;
    this._rz = rz;
    this._radius = shotRadius;
    this._elapse = 0;
  }
  update(expandHitFlag) {
    if (expandHitFlag && _MOD(this._elapse, _DIV(WAIT_1, 15)) === 0) this._radius += 0.5;
    this._x += this._vx;
    this._y += this._vy;
    this._z += this._vz;
    this._elapse++;
    return this._elapse <= JIKI_SHOT_END;
  }
  x() {
    return this._x;
  }
  y() {
    return this._y;
  }
  z() {
    return this._z;
  }
  vx() {
    return this._vx;
  }
  vy() {
    return this._vy;
  }
  vz() {
    return this._vz;
  }
  rz() {
    return this._rz;
  }
  elapse() {
    return this._elapse;
  }
  radius() {
    return this._radius;
  }
}

export class JikiShots {
  constructor(shotRadius) {
    this._shotRadius = shotRadius;
    this._shots = [];
    this._elapse = -JIKI_SHOT_INTERVAL;
  }
  add(elapse, jx, jy, jz, jvx, jvy, jvz, jrz) {
    if (this._shots.length < JIKI_SHOT_MAX && elapse >= this._elapse + JIKI_SHOT_INTERVAL) {
      this._elapse = elapse;
      this._shots.push(
        new JikiShot(jx, jy, jz, jvx * JIKI_SHOT_SPEED, jvy * JIKI_SHOT_SPEED, jvz * JIKI_SHOT_SPEED, jrz, this._shotRadius)
      );
      return true;
    }
    return false;
  }
  size() {
    return this._shots.length;
  }
  get(i) {
    return this._shots[i];
  }
  remove(i) {
    this._shots.splice(i, 1);
  }
  update(expandHitFlag) {
    for (let i = this._shots.length - 1; i >= 0; i--) {
      if (!this._shots[i].update(expandHitFlag)) this._shots.splice(i, 1);
    }
  }
}

// ワールド単位のおおよその半径（バウンディングボックス最大辺の半分）
export function modelBoundingRadius(root) {
  const box = new THREE.Box3().setFromObject(root);
  const size = new THREE.Vector3();
  box.getSize(size);
  return Math.max(size.x, size.y, size.z) * 0.5;
}
