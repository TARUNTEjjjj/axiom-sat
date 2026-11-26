// Pure 3D mathematics, matrix algebra, analytical conic sections, sphere secants,
// SAT solid cross-sections, and watertight manifold mesh builders.
// Zero DOM or Node dependencies so it runs identically in browsers, Node, and JSC.

export const DEG_TO_RAD = Math.PI / 180;
export const RAD_TO_DEG = 180 / Math.PI;
export const CONE_HALF_ANGLE_DEG = 30;
export const CONE_HALF_ANGLE_RAD = CONE_HALF_ANGLE_DEG * DEG_TO_RAD;
export const CONE_SLOPE = Math.tan(CONE_HALF_ANGLE_RAD);
export const CONE_HEIGHT = 1.8;

export const MODES = Object.freeze(['conics', 'sphere', 'volume']);
export const SOLIDS = Object.freeze(['cone', 'cylinder', 'prism']);

export const DEFAULT_ORBIT = Object.freeze({
  yaw: 0.64,
  pitch: 0.34,
  distance: 4.55,
});

export function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

/* Vector helpers */

export function vec3(x, y, z) {
  return [x, y, z];
}

export function add3(a, b) {
  return [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
}

export function sub3(a, b) {
  return [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
}

export function scale3(v, s) {
  return [v[0] * s, v[1] * s, v[2] * s];
}

export function dot3(a, b) {
  return a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
}

export function cross3(a, b) {
  return [
    a[1] * b[2] - a[2] * b[1],
    a[2] * b[0] - a[0] * b[2],
    a[0] * b[1] - a[1] * b[0],
  ];
}

export function length3(v) {
  return Math.hypot(v[0], v[1], v[2]);
}

export function normalize3(v) {
  const len = length3(v);
  if (len < 1e-12) return [0, 0, 0];
  return [v[0] / len, v[1] / len, v[2] / len];
}

/* Column-major 4x4 matrix algebra */

export function mat4Identity() {
  const m = new Float32Array(16);
  m[0] = 1;
  m[5] = 1;
  m[10] = 1;
  m[15] = 1;
  return m;
}

export function mat4Multiply(a, b) {
  const out = new Float32Array(16);
  for (let col = 0; col < 4; col++) {
    const b0 = b[col * 4];
    const b1 = b[col * 4 + 1];
    const b2 = b[col * 4 + 2];
    const b3 = b[col * 4 + 3];
    out[col * 4] = a[0] * b0 + a[4] * b1 + a[8] * b2 + a[12] * b3;
    out[col * 4 + 1] = a[1] * b0 + a[5] * b1 + a[9] * b2 + a[13] * b3;
    out[col * 4 + 2] = a[2] * b0 + a[6] * b1 + a[10] * b2 + a[14] * b3;
    out[col * 4 + 3] = a[3] * b0 + a[7] * b1 + a[11] * b2 + a[15] * b3;
  }
  return out;
}

export function mat4RotateX(rad) {
  const c = Math.cos(rad);
  const s = Math.sin(rad);
  const m = mat4Identity();
  m[5] = c;
  m[6] = s;
  m[9] = -s;
  m[10] = c;
  return m;
}

export function mat4RotateY(rad) {
  const c = Math.cos(rad);
  const s = Math.sin(rad);
  const m = mat4Identity();
  m[0] = c;
  m[2] = -s;
  m[8] = s;
  m[10] = c;
  return m;
}

export function mat4RotateZ(rad) {
  const c = Math.cos(rad);
  const s = Math.sin(rad);
  const m = mat4Identity();
  m[0] = c;
  m[1] = s;
  m[4] = -s;
  m[5] = c;
  return m;
}

export function mat4OrbitRotation(yawRad, pitchRad) {
  return mat4Multiply(mat4RotateX(pitchRad), mat4RotateY(yawRad));
}

export function mat4Extract3x3(m) {
  return [m[0], m[1], m[2], m[4], m[5], m[6], m[8], m[9], m[10]];
}

export function mat3Determinant(m) {
  const [a00, a10, a20, a01, a11, a21, a02, a12, a22] = m;
  return (
    a00 * (a11 * a22 - a12 * a21) -
    a01 * (a10 * a22 - a12 * a20) +
    a02 * (a10 * a21 - a11 * a20)
  );
}

// Maximum entry-wise deviation of R^T R from the 3x3 identity matrix.
export function mat3OrthonormalResidual(m) {
  let maxErr = 0;
  for (let i = 0; i < 3; i++) {
    for (let j = 0; j < 3; j++) {
      let sum = 0;
      for (let k = 0; k < 3; k++) {
        sum += m[i * 3 + k] * m[j * 3 + k];
      }
      const target = i === j ? 1 : 0;
      maxErr = Math.max(maxErr, Math.abs(sum - target));
    }
  }
  return maxErr;
}

export function mat4LookAt(eye, target = [0, 0, 0], up = [0, 1, 0]) {
  const f = normalize3(sub3(eye, target));
  const r = normalize3(cross3(up, f));
  const u = cross3(f, r);
  const m = mat4Identity();
  m[0] = r[0];
  m[1] = u[0];
  m[2] = f[0];
  m[4] = r[1];
  m[5] = u[1];
  m[6] = f[1];
  m[8] = r[2];
  m[9] = u[2];
  m[10] = f[2];
  m[12] = -dot3(r, eye);
  m[13] = -dot3(u, eye);
  m[14] = -dot3(f, eye);
  return m;
}

export function mat4Perspective(fovYRad, aspect, near, far) {
  const safeAspect = Math.max(0.1, aspect || 1);
  const f = 1 / Math.tan(fovYRad / 2);
  const nf = 1 / (near - far);
  const m = new Float32Array(16);
  m[0] = f / safeAspect;
  m[5] = f;
  m[10] = (far + near) * nf;
  m[11] = -1;
  m[14] = 2 * far * near * nf;
  return m;
}

export function mat4TransformPoint(m, p) {
  const x = p[0];
  const y = p[1];
  const z = p[2];
  const cx = m[0] * x + m[4] * y + m[8] * z + m[12];
  const cy = m[1] * x + m[5] * y + m[9] * z + m[13];
  const cz = m[2] * x + m[6] * y + m[10] * z + m[14];
  const cw = m[3] * x + m[7] * y + m[11] * z + m[15];
  const invW = Math.abs(cw) > 1e-8 ? 1 / cw : 1;
  return {
    x: cx,
    y: cy,
    z: cz,
    w: cw,
    ndcX: cx * invW,
    ndcY: cy * invW,
    ndcZ: cz * invW,
  };
}

export function computeCameraEye(yaw, pitch, distance, target = [0, 0, 0]) {
  const p = clamp(pitch, -1.42, 1.42);
  const cosP = Math.cos(p);
  return [
    target[0] + distance * cosP * Math.sin(yaw),
    target[1] + distance * Math.sin(p),
    target[2] + distance * cosP * Math.cos(yaw),
  ];
}

export function computeCameraMatrices({
  yaw,
  pitch,
  distance,
  aspect = 16 / 10,
  target = [0, 0, 0],
  fovYRad = 42 * DEG_TO_RAD,
  near = 0.1,
  far = 40,
}) {
  const eye = computeCameraEye(yaw, pitch, distance, target);
  const view = mat4LookAt(eye, target, [0, 1, 0]);
  const proj = mat4Perspective(fovYRad, aspect, near, far);
  const viewProj = mat4Multiply(proj, view);
  return { eye, view, proj, viewProj };
}

/* Critically damped orbit state & inertia */

export function createOrbitState(overrides = {}) {
  const yaw = overrides.yaw ?? DEFAULT_ORBIT.yaw;
  const pitch = clamp(overrides.pitch ?? DEFAULT_ORBIT.pitch, -1.42, 1.42);
  const distance = clamp(overrides.distance ?? DEFAULT_ORBIT.distance, 2.5, 9.5);
  const targetYaw = overrides.targetYaw ?? yaw;
  const targetPitch = clamp(overrides.targetPitch ?? pitch, -1.42, 1.42);
  const targetDistance = clamp(overrides.targetDistance ?? distance, 2.5, 9.5);
  return {
    yaw,
    pitch,
    distance,
    targetYaw,
    targetPitch,
    targetDistance,
    velYaw: overrides.velYaw ?? 0,
    velPitch: overrides.velPitch ?? 0,
    velDistance: overrides.velDistance ?? 0,
    autoOrbit: overrides.autoOrbit ?? true,
    paused: overrides.paused ?? false,
    reducedMotion: overrides.reducedMotion ?? false,
    autoSpeed: overrides.autoSpeed ?? 0.24,
    settled: Boolean(overrides.reducedMotion || overrides.paused || !overrides.autoOrbit),
  };
}

function stepCriticallyDamped(current, target, velocity, omega, dt) {
  const err = current - target;
  const exp = Math.exp(-omega * dt);
  const temp = (velocity + omega * err) * dt;
  const nextPos = target + (err + temp) * exp;
  const nextVel = (velocity - omega * temp) * exp;
  if (Math.abs(nextPos - target) < 1e-5 && Math.abs(nextVel) < 1e-4) {
    return [target, 0, true];
  }
  return [nextPos, nextVel, false];
}

export function stepOrbit(state, dtSeconds = 1 / 60) {
  const targetPitch = clamp(state.targetPitch, -1.42, 1.42);
  const targetDistance = clamp(state.targetDistance, 2.5, 9.5);

  if (state.reducedMotion) {
    return {
      ...state,
      yaw: state.targetYaw,
      pitch: targetPitch,
      distance: targetDistance,
      targetPitch,
      targetDistance,
      velYaw: 0,
      velPitch: 0,
      velDistance: 0,
      settled: true,
    };
  }

  const dt = clamp(dtSeconds, 0, 0.1);
  const spinning = !state.paused && state.autoOrbit;
  const targetYaw = spinning ? state.targetYaw + state.autoSpeed * dt : state.targetYaw;
  const OMEGA = 14;

  const [yaw, velYaw, yawDone] = stepCriticallyDamped(state.yaw, targetYaw, state.velYaw, OMEGA, dt);
  const [pitch, velPitch, pitchDone] = stepCriticallyDamped(
    state.pitch,
    targetPitch,
    state.velPitch,
    OMEGA,
    dt,
  );
  const [distance, velDistance, distDone] = stepCriticallyDamped(
    state.distance,
    targetDistance,
    state.velDistance,
    OMEGA,
    dt,
  );

  return {
    ...state,
    yaw,
    pitch,
    distance,
    targetYaw,
    targetPitch,
    targetDistance,
    velYaw,
    velPitch,
    velDistance,
    settled: !spinning && yawDone && pitchDone && distDone,
  };
}

/* Analytical Conic Section Classification & Intersection Geometry */

export function classifyConic(tiltDeg, offset = 0.48, halfAngleDeg = CONE_HALF_ANGLE_DEG) {
  const clampedTilt = clamp(tiltDeg, 0, 88);
  const theta = clampedTilt * DEG_TO_RAD;
  const alpha = clamp(halfAngleDeg, 5, 80) * DEG_TO_RAD;
  const k = Math.tan(alpha);
  const cosA = Math.cos(alpha);
  const sinT = Math.sin(Math.abs(theta));
  const cosT = Math.cos(theta);

  const eccentricity = sinT / cosA;
  const A = 1;
  const B = 0;
  const C = 1 - eccentricity * eccentricity;
  const discriminant = B * B - 4 * A * C; // -4(1 - e^2)
  const E = (offset * Math.sin(2 * theta)) / (cosA * cosA);
  const F = offset * offset * (sinT * sinT - cosT * cosT * k * k);

  let type;
  let label;
  let satBridge;
  if (Math.abs(offset) < 1e-6) {
    if (Math.abs(eccentricity - 1) < 1e-4) {
      type = 'degenerate-line';
      label = 'Tangent Line';
      satBridge = 'Tangent intersection through the cone apex: single generator line.';
    } else if (eccentricity < 1) {
      type = 'degenerate-point';
      label = 'Apex Point';
      satBridge = 'Plane passes through the origin apex (0, 0, 0), collapsing to a single point.';
    } else {
      type = 'degenerate-lines';
      label = 'Intersecting Lines';
      satBridge = 'Vertical plane through the apex produces two intersecting linear equations.';
    }
  } else if (clampedTilt < 0.05) {
    type = 'circle';
    label = 'Circle';
    satBridge = 'Horizontal slice: every point is equidistant from the cone axis, matching (x − h)² + (y − k)² = r².';
  } else if (Math.abs(eccentricity - 1) < 1e-4) {
    type = 'parabola';
    label = 'Parabola';
    satBridge = 'Plane parallel to cone edge (θ = 90° − α = 60°): models quadratic graphs y = ax² + bx + c.';
  } else if (eccentricity < 1) {
    type = 'ellipse';
    label = 'Ellipse';
    satBridge = 'Tilted slice inside one nappe (0 < e < 1): stretched circle with major/minor axes.';
  } else {
    type = 'hyperbola';
    label = 'Hyperbola';
    satBridge = 'Steep slice cutting both upper and lower nappes (e > 1): models inverse variation y = k/x.';
  }

  let semiMinor = null;
  let semiMajor = null;
  let wCenter = null;
  if (Math.abs(offset) >= 1e-6) {
    if (C > 1e-4) {
      semiMinor = (Math.abs(offset) * k) / Math.sqrt(C);
      semiMajor = (Math.abs(offset) * k) / C;
      wCenter = -E / (2 * C);
    } else if (C < -1e-4) {
      const K = -C;
      semiMinor = (Math.abs(offset) * k) / Math.sqrt(K);
      semiMajor = (Math.abs(offset) * k) / K;
      wCenter = E / (2 * K);
    }
  }

  return {
    type,
    label,
    tiltDeg: clampedTilt,
    offset,
    halfAngleDeg,
    eccentricity,
    discriminant,
    A,
    B,
    C,
    E,
    F,
    semiMinor,
    semiMajor,
    wCenter,
    satBridge,
    equationText: formatConicEquation(type, { offset, k, semiMinor, semiMajor, eccentricity }),
  };
}

function formatConicEquation(type, { offset, k, semiMinor, semiMajor, eccentricity }) {
  if (type === 'circle') {
    const r = Math.abs(offset) * k;
    return `x² + z² = ${r.toFixed(2)}²  (e = 0.000)`;
  }
  if (type === 'ellipse' && semiMinor && semiMajor) {
    return `u²/${semiMinor.toFixed(2)}² + w²/${semiMajor.toFixed(2)}² = 1`;
  }
  if (type === 'parabola') {
    return `w = −u²/${((2 * Math.abs(offset)) / Math.cos(CONE_HALF_ANGLE_RAD)).toFixed(2)} + v₀`;
  }
  if (type === 'hyperbola' && semiMinor && semiMajor) {
    return `w²/${semiMajor.toFixed(2)}² − u²/${semiMinor.toFixed(2)}² = 1`;
  }
  return `e = ${eccentricity.toFixed(3)} (apex slice)`;
}

function planeToWorld(u, w, offset, theta) {
  const cosT = Math.cos(theta);
  const sinT = Math.sin(theta);
  return [u, offset * cosT - w * sinT, offset * sinT + w * cosT];
}

// Evaluates conic residual (x^2 + z^2 - y^2 tan^2 alpha) and plane residual (y cos theta + z sin theta - d).
export function conicPointResidual(point, tiltDeg, offset = 0.48, halfAngleDeg = CONE_HALF_ANGLE_DEG) {
  const theta = tiltDeg * DEG_TO_RAD;
  const k = Math.tan(halfAngleDeg * DEG_TO_RAD);
  const [x, y, z] = point;
  const coneResidual = Math.abs(x * x + z * z - y * y * k * k);
  const planeResidual = Math.abs(y * Math.cos(theta) + z * Math.sin(theta) - offset);
  return { coneResidual, planeResidual };
}

export function sampleConicIntersection(
  tiltDeg,
  offset = 0.48,
  { halfAngleDeg = CONE_HALF_ANGLE_DEG, maxHeight = CONE_HEIGHT, segments = 96 } = {},
) {
  const info = classifyConic(tiltDeg, offset, halfAngleDeg);
  const theta = info.tiltDeg * DEG_TO_RAD;
  const cosT = Math.cos(theta);
  const sinT = Math.sin(theta);

  if (Math.abs(offset) < 1e-6) {
    if (info.type === 'degenerate-point') {
      return { info, branches: [], closed: false };
    }
    const ySpan = maxHeight;
    if (info.type === 'degenerate-line') {
      const wMax = ySpan / Math.max(1e-6, sinT);
      return {
        info,
        closed: false,
        branches: [[planeToWorld(0, -wMax, 0, theta), planeToWorld(0, wMax, 0, theta)]],
      };
    }
    const K = -info.C;
    const slopeU = Math.sqrt(K);
    const wMax = ySpan / Math.max(1e-6, sinT);
    return {
      info,
      closed: false,
      branches: [
        [planeToWorld(-slopeU * wMax, -wMax, 0, theta), planeToWorld(slopeU * wMax, wMax, 0, theta)],
        [planeToWorld(slopeU * wMax, -wMax, 0, theta), planeToWorld(-slopeU * wMax, wMax, 0, theta)],
      ],
    };
  }

  if (info.type === 'circle' || info.type === 'ellipse') {
    const sampleArc = (phiStart, phiEnd, count) => {
      const pts = [];
      for (let i = 0; i <= count; i++) {
        const phi = phiStart + ((phiEnd - phiStart) * i) / count;
        const u = info.semiMinor * Math.cos(phi);
        const w = info.wCenter + info.semiMajor * Math.sin(phi);
        pts.push(planeToWorld(u, w, offset, theta));
      }
      return pts;
    };

    if (sinT < 1e-6) {
      if (Math.abs(offset * cosT) > maxHeight + 1e-9) return { info, branches: [], closed: false };
      return { info, branches: [sampleArc(0, Math.PI * 2, segments)], closed: true };
    }

    const wLow = (offset * cosT - maxHeight) / sinT;
    const wHigh = (offset * cosT + maxHeight) / sinT;
    const sMin = (wLow - info.wCenter) / info.semiMajor;
    const sMax = (wHigh - info.wCenter) / info.semiMajor;

    if (sMax < -1 - 1e-9 || sMin > 1 + 1e-9) {
      return { info, branches: [], closed: false };
    }
    if (sMin <= -1 + 1e-9 && sMax >= 1 - 1e-9) {
      return { info, branches: [sampleArc(0, Math.PI * 2, segments)], closed: true };
    }

    const branches = [];
    if (sMin > -1 && sMax >= 1) {
      const phi0 = Math.asin(clamp(sMin, -1, 1));
      branches.push(sampleArc(phi0, Math.PI - phi0, segments));
    } else if (sMin <= -1 && sMax < 1) {
      const phi1 = Math.asin(clamp(sMax, -1, 1));
      branches.push(sampleArc(Math.PI - phi1, Math.PI * 2 + phi1, segments));
    } else {
      const phi0 = Math.asin(clamp(sMin, -1, 1));
      const phi1 = Math.asin(clamp(sMax, -1, 1));
      const halfSegs = Math.max(24, Math.floor(segments / 2));
      branches.push(sampleArc(phi0, phi1, halfSegs));
      branches.push(sampleArc(Math.PI - phi1, Math.PI - phi0, halfSegs));
    }
    return { info, branches, closed: false };
  }

  if (info.type === 'parabola') {
    const yTarget = offset >= 0 ? maxHeight : -maxHeight;
    const wLimit = (offset * cosT - yTarget) / sinT;
    const uMaxSq = Math.max(0, -(info.C * wLimit * wLimit + info.E * wLimit + info.F));
    const uMax = Math.sqrt(uMaxSq);
    const branch = [];
    const eSign = info.E >= 0 ? 1 : -1;
    for (let i = 0; i <= segments; i++) {
      const s = -1 + (2 * i) / segments;
      const u = s * uMax;
      const cTerm = u * u + info.F;
      const disc = Math.max(0, info.E * info.E - 4 * info.C * cTerm);
      const denom = info.E + eSign * Math.sqrt(disc);
      const w = Math.abs(denom) > 1e-12 ? (-2 * cTerm) / denom : -info.F / info.E;
      branch.push(planeToWorld(u, w, offset, theta));
    }
    return { info, branches: [branch], closed: false };
  }

  // Hyperbola: w = wCenter +/- bHyp * cosh(t), u = aHyp * sinh(t)
  const wLow = (offset * cosT - maxHeight) / sinT;
  const wHigh = (offset * cosT + maxHeight) / sinT;
  const branches = [];

  for (const sign of [1, -1]) {
    const wBound = sign > 0 ? wHigh : wLow;
    const span = sign > 0 ? wBound - info.wCenter : info.wCenter - wBound;
    if (span <= info.semiMajor + 1e-6) continue;
    const ratio = span / info.semiMajor;
    const tMax = Math.acosh(Math.max(1, ratio));
    const branch = [];
    const halfSegs = Math.max(24, Math.floor(segments / 2));
    for (let i = 0; i <= halfSegs; i++) {
      const t = -tMax + (2 * tMax * i) / halfSegs;
      const u = info.semiMinor * Math.sinh(t);
      const w = info.wCenter + sign * info.semiMajor * Math.cosh(t);
      branch.push(planeToWorld(u, w, offset, theta));
    }
    branches.push(branch);
  }
  return { info, branches, closed: false };
}

/* Coordinate Sphere & Secant Chord Geometry */

export function computeSphereSection(offsetRatio = 0.45, { center = [0.2, 0.1, -0.1], radius = 1.2 } = {}) {
  const clampedRatio = clamp(offsetRatio, -1, 1);
  const d = clampedRatio * radius;
  const secantRadiusSq = Math.max(0, radius * radius - d * d);
  const secantRadius = Math.sqrt(secantRadiusSq);
  const isTangent = Math.abs(Math.abs(clampedRatio) - 1) < 1e-3;
  const isEquator = Math.abs(clampedRatio) < 0.02;
  const sliceY = center[1] + d;
  const area = Math.PI * secantRadiusSq;

  const ring = [];
  const segs = 72;
  for (let i = 0; i <= segs; i++) {
    const phi = (i / segs) * Math.PI * 2;
    ring.push([
      center[0] + secantRadius * Math.cos(phi),
      sliceY,
      center[2] + secantRadius * Math.sin(phi),
    ]);
  }

  const pythagoreanTriangle = [
    [center[0], center[1], center[2]],
    [center[0], sliceY, center[2]],
    [center[0] + secantRadius, sliceY, center[2]],
  ];

  const signTerm = (v, axis) =>
    Math.abs(v) < 1e-6 ? `${axis}²` : `(${axis} ${v > 0 ? '−' : '+'} ${Math.abs(v).toFixed(1)})²`;
  const equationText = `${signTerm(center[0], 'x')} + ${signTerm(center[1], 'y')} + ${signTerm(center[2], 'z')} = ${(radius * radius).toFixed(2)}`;

  return {
    center,
    radius,
    offsetRatio: clampedRatio,
    offsetDistance: d,
    secantRadius,
    sliceY,
    area,
    isTangent,
    isEquator,
    ring,
    pythagoreanTriangle,
    equationText,
    label: isTangent ? 'Tangent Plane' : isEquator ? 'Great Circle' : 'Secant Circle',
    satBridge: isTangent
      ? 'At |d| = r, the plane touches the sphere at one point — perpendicular to the radius.'
      : '3D Pythagorean cross-section: r² = d² + r_slice², connecting coordinate spheres to SAT circles.',
  };
}

/* Volume Solid & Cross-Section Slice Geometry */

export function computeVolumeSection(solid = 'cone', sliceFraction = 0.45) {
  const t = clamp(sliceFraction, 0, 1);
  const height = 2.0;
  const yMin = -height / 2;
  const ySlice = yMin + t * height;
  const radius = 1.02;
  const length = 1.75;
  const width = 1.3;

  if (solid === 'cone') {
    const scaleFactor = 1 - t; // similar cone above the plane
    const sliceRadius = radius * scaleFactor;
    const baseArea = Math.PI * radius * radius;
    const sliceArea = baseArea * scaleFactor * scaleFactor;
    const totalVolume = (1 / 3) * baseArea * height;
    const upperVolumeRatio = scaleFactor ** 3;
    const ring = [];
    for (let i = 0; i <= 72; i++) {
      const phi = (i / 72) * Math.PI * 2;
      ring.push([sliceRadius * Math.cos(phi), ySlice, sliceRadius * Math.sin(phi)]);
    }
    return {
      solid,
      label: 'Right Cone',
      sliceFraction: t,
      ySlice,
      scaleFactor,
      areaScale: scaleFactor * scaleFactor,
      volumeScale: upperVolumeRatio,
      baseArea,
      sliceArea,
      totalVolume,
      contour: ring,
      equationText: `V = (1/3)πr²h · A(t) = πr²(1 − t)²`,
      satBridge: 'Similar cross-section scaling: linear ratio k scales slice area by k² and upper cone volume by k³.',
    };
  }

  if (solid === 'cylinder') {
    const baseArea = Math.PI * radius * radius;
    const totalVolume = baseArea * height;
    const ring = [];
    for (let i = 0; i <= 72; i++) {
      const phi = (i / 72) * Math.PI * 2;
      ring.push([radius * Math.cos(phi), ySlice, radius * Math.sin(phi)]);
    }
    return {
      solid,
      label: 'Right Cylinder',
      sliceFraction: t,
      ySlice,
      scaleFactor: 1,
      areaScale: 1,
      volumeScale: t,
      baseArea,
      sliceArea: baseArea,
      totalVolume,
      contour: ring,
      equationText: `V = πr²h · A(t) = πr² = ${baseArea.toFixed(2)}`,
      satBridge: 'Every horizontal cross-section is congruent (k = 1), so swept volume grows linearly as t·πr²h.',
    };
  }

  // Rectangular prism
  const baseArea = length * width;
  const totalVolume = baseArea * height;
  const hx = length / 2;
  const hz = width / 2;
  const contour = [
    [-hx, ySlice, -hz],
    [hx, ySlice, -hz],
    [hx, ySlice, hz],
    [-hx, ySlice, hz],
    [-hx, ySlice, -hz],
  ];
  return {
    solid: 'prism',
    label: 'Rectangular Prism',
    sliceFraction: t,
    ySlice,
    scaleFactor: 1,
    areaScale: 1,
    volumeScale: t,
    baseArea,
    sliceArea: baseArea,
    totalVolume,
    contour,
    equationText: `V = l·w·h · A(t) = ${length.toFixed(2)}×${width.toFixed(2)} = ${baseArea.toFixed(2)}`,
    satBridge: 'Constant rectangular slices l × w stack through height h to give volume V = l·w·h.',
  };
}

/* Watertight Indexed Mesh Builders */

function pushTri(indices, a, b, c) {
  indices.push(a, b, c);
}

export function buildSingleConeMesh({
  radius = CONE_HEIGHT * CONE_SLOPE,
  yApex = 0,
  yBase = CONE_HEIGHT,
  segments = 48,
} = {}) {
  const positions = [];
  const normals = [];
  const indices = [];
  const edgeIndices = [];

  const dir = yBase >= yApex ? 1 : -1;
  const h = Math.abs(yBase - yApex);
  const slant = Math.hypot(radius, h);
  const nr = h / slant;
  const ny = (-dir * radius) / slant;

  // Apex vertex (index 0)
  positions.push(0, yApex, 0);
  normals.push(0, -dir, 0);

  // Side rim vertices: indices 1 .. segments
  for (let i = 0; i < segments; i++) {
    const phi = (i / segments) * Math.PI * 2;
    const cx = Math.cos(phi);
    const cz = Math.sin(phi);
    positions.push(radius * cx, yBase, radius * cz);
    normals.push(nr * cx, ny, nr * cz);
  }

  // Base cap center (index segments + 1)
  const capCenterIdx = segments + 1;
  positions.push(0, yBase, 0);
  normals.push(0, dir, 0);

  for (let i = 0; i < segments; i++) {
    const a = 1 + i;
    const b = 1 + ((i + 1) % segments);
    if (dir > 0) {
      pushTri(indices, 0, b, a);
      pushTri(indices, capCenterIdx, a, b);
    } else {
      pushTri(indices, 0, a, b);
      pushTri(indices, capCenterIdx, b, a);
    }
    edgeIndices.push(a, b);
    if (i % 6 === 0) edgeIndices.push(0, a);
  }

  return {
    positions: new Float32Array(positions),
    normals: new Float32Array(normals),
    indices: new Uint16Array(indices),
    edgeIndices: new Uint16Array(edgeIndices),
  };
}

export function buildDoubleConeMesh({
  height = CONE_HEIGHT,
  halfAngleDeg = CONE_HALF_ANGLE_DEG,
  segments = 48,
} = {}) {
  const radius = height * Math.tan(halfAngleDeg * DEG_TO_RAD);
  const upper = buildSingleConeMesh({ radius, yApex: 0, yBase: height, segments });
  const lower = buildSingleConeMesh({ radius, yApex: 0, yBase: -height, segments });

  const vertOffset = upper.positions.length / 3;
  const positions = new Float32Array(upper.positions.length + lower.positions.length);
  positions.set(upper.positions, 0);
  positions.set(lower.positions, upper.positions.length);

  const normals = new Float32Array(upper.normals.length + lower.normals.length);
  normals.set(upper.normals, 0);
  normals.set(lower.normals, upper.normals.length);

  const indices = new Uint16Array(upper.indices.length + lower.indices.length);
  indices.set(upper.indices, 0);
  for (let i = 0; i < lower.indices.length; i++) {
    indices[upper.indices.length + i] = lower.indices[i] + vertOffset;
  }

  const edgeIndices = new Uint16Array(upper.edgeIndices.length + lower.edgeIndices.length);
  edgeIndices.set(upper.edgeIndices, 0);
  for (let i = 0; i < lower.edgeIndices.length; i++) {
    edgeIndices[upper.edgeIndices.length + i] = lower.edgeIndices[i] + vertOffset;
  }

  return { positions, normals, indices, edgeIndices, upper, lower };
}

export function buildSphereMesh({ center = [0, 0, 0], radius = 1.2, stacks = 24, slices = 36 } = {}) {
  const positions = [];
  const normals = [];
  const indices = [];
  const edgeIndices = [];

  // North pole (index 0)
  positions.push(center[0], center[1] + radius, center[2]);
  normals.push(0, 1, 0);

  // Rings: 1 .. stacks - 1
  for (let lat = 1; lat < stacks; lat++) {
    const theta = (lat / stacks) * Math.PI;
    const sinT = Math.sin(theta);
    const cosT = Math.cos(theta);
    for (let lon = 0; lon < slices; lon++) {
      const phi = (lon / slices) * Math.PI * 2;
      const nx = sinT * Math.cos(phi);
      const ny = cosT;
      const nz = sinT * Math.sin(phi);
      positions.push(center[0] + radius * nx, center[1] + radius * ny, center[2] + radius * nz);
      normals.push(nx, ny, nz);
    }
  }

  // South pole
  const southIdx = 1 + (stacks - 1) * slices;
  positions.push(center[0], center[1] - radius, center[2]);
  normals.push(0, -1, 0);

  // North cap fan
  for (let lon = 0; lon < slices; lon++) {
    const a = 1 + lon;
    const b = 1 + ((lon + 1) % slices);
    pushTri(indices, 0, b, a);
  }

  // Middle quads
  for (let lat = 0; lat < stacks - 2; lat++) {
    const row0 = 1 + lat * slices;
    const row1 = 1 + (lat + 1) * slices;
    for (let lon = 0; lon < slices; lon++) {
      const next = (lon + 1) % slices;
      const a = row0 + lon;
      const b = row0 + next;
      const c = row1 + lon;
      const d = row1 + next;
      pushTri(indices, a, b, c);
      pushTri(indices, b, d, c);
      if (lat % 3 === 2) edgeIndices.push(a, b);
      if (lon % 6 === 0) edgeIndices.push(a, c);
    }
  }

  // South cap fan
  const lastRow = 1 + (stacks - 2) * slices;
  for (let lon = 0; lon < slices; lon++) {
    const a = lastRow + lon;
    const b = lastRow + ((lon + 1) % slices);
    pushTri(indices, southIdx, a, b);
  }

  return {
    positions: new Float32Array(positions),
    normals: new Float32Array(normals),
    indices: new Uint16Array(indices),
    edgeIndices: new Uint16Array(edgeIndices),
  };
}

export function buildCylinderMesh({ radius = 1.02, height = 2.0, segments = 48 } = {}) {
  const positions = [];
  const normals = [];
  const indices = [];
  const edgeIndices = [];
  const halfH = height / 2;

  // Top cap center (0), bottom cap center (1)
  positions.push(0, halfH, 0, 0, -halfH, 0);
  normals.push(0, 1, 0, 0, -1, 0);

  // Top rim cap vertices (2 .. 2 + segments - 1)
  const topCapStart = 2;
  const botCapStart = 2 + segments;
  const topSideStart = 2 + 2 * segments;
  const botSideStart = 2 + 3 * segments;

  for (let i = 0; i < segments; i++) {
    const phi = (i / segments) * Math.PI * 2;
    const x = radius * Math.cos(phi);
    const z = radius * Math.sin(phi);
    positions.push(x, halfH, z);
    normals.push(0, 1, 0);
  }
  for (let i = 0; i < segments; i++) {
    const phi = (i / segments) * Math.PI * 2;
    const x = radius * Math.cos(phi);
    const z = radius * Math.sin(phi);
    positions.push(x, -halfH, z);
    normals.push(0, -1, 0);
  }
  for (let i = 0; i < segments; i++) {
    const phi = (i / segments) * Math.PI * 2;
    const nx = Math.cos(phi);
    const nz = Math.sin(phi);
    positions.push(radius * nx, halfH, radius * nz);
    normals.push(nx, 0, nz);
  }
  for (let i = 0; i < segments; i++) {
    const phi = (i / segments) * Math.PI * 2;
    const nx = Math.cos(phi);
    const nz = Math.sin(phi);
    positions.push(radius * nx, -halfH, radius * nz);
    normals.push(nx, 0, nz);
  }

  for (let i = 0; i < segments; i++) {
    const next = (i + 1) % segments;
    pushTri(indices, 0, topCapStart + next, topCapStart + i);
    pushTri(indices, 1, botCapStart + i, botCapStart + next);
    const t0 = topSideStart + i;
    const t1 = topSideStart + next;
    const b0 = botSideStart + i;
    const b1 = botSideStart + next;
    pushTri(indices, t0, t1, b0);
    pushTri(indices, t1, b1, b0);
    edgeIndices.push(t0, t1, b0, b1);
    if (i % 6 === 0) edgeIndices.push(t0, b0);
  }

  return {
    positions: new Float32Array(positions),
    normals: new Float32Array(normals),
    indices: new Uint16Array(indices),
    edgeIndices: new Uint16Array(edgeIndices),
  };
}

export function buildPrismMesh({ length = 1.75, height = 2.0, width = 1.3 } = {}) {
  const hx = length / 2;
  const hy = height / 2;
  const hz = width / 2;
  const faces = [
    { n: [0, 0, 1], v: [[-hx, -hy, hz], [hx, -hy, hz], [hx, hy, hz], [-hx, hy, hz]] },
    { n: [0, 0, -1], v: [[hx, -hy, -hz], [-hx, -hy, -hz], [-hx, hy, -hz], [hx, hy, -hz]] },
    { n: [1, 0, 0], v: [[hx, -hy, hz], [hx, -hy, -hz], [hx, hy, -hz], [hx, hy, hz]] },
    { n: [-1, 0, 0], v: [[-hx, -hy, -hz], [-hx, -hy, hz], [-hx, hy, hz], [-hx, hy, -hz]] },
    { n: [0, 1, 0], v: [[-hx, hy, hz], [hx, hy, hz], [hx, hy, -hz], [-hx, hy, -hz]] },
    { n: [0, -1, 0], v: [[-hx, -hy, -hz], [hx, -hy, -hz], [hx, -hy, hz], [-hx, -hy, hz]] },
  ];

  const positions = [];
  const normals = [];
  const indices = [];
  const edgeIndices = [];

  for (const face of faces) {
    const base = positions.length / 3;
    for (const vert of face.v) {
      positions.push(vert[0], vert[1], vert[2]);
      normals.push(face.n[0], face.n[1], face.n[2]);
    }
    pushTri(indices, base, base + 1, base + 2);
    pushTri(indices, base, base + 2, base + 3);
    edgeIndices.push(base, base + 1, base + 1, base + 2, base + 2, base + 3, base + 3, base);
  }

  return {
    positions: new Float32Array(positions),
    normals: new Float32Array(normals),
    indices: new Uint16Array(indices),
    edgeIndices: new Uint16Array(edgeIndices),
  };
}

export function buildPlaneMesh({
  center = [0, 0, 0],
  axisU = [1, 0, 0],
  axisV = [0, 0, 1],
  normal = [0, 1, 0],
  halfU = 1.65,
  halfV = 1.65,
} = {}) {
  const corners = [
    add3(center, add3(scale3(axisU, -halfU), scale3(axisV, -halfV))),
    add3(center, add3(scale3(axisU, halfU), scale3(axisV, -halfV))),
    add3(center, add3(scale3(axisU, halfU), scale3(axisV, halfV))),
    add3(center, add3(scale3(axisU, -halfU), scale3(axisV, halfV))),
  ];
  const positions = new Float32Array(corners.flat());
  const normals = new Float32Array([
    ...normal,
    ...normal,
    ...normal,
    ...normal,
  ]);
  const indices = new Uint16Array([0, 1, 2, 0, 2, 3]);
  const edgeIndices = new Uint16Array([0, 1, 1, 2, 2, 3, 3, 0]);
  return { positions, normals, indices, edgeIndices };
}

// Extrudes a 3D polyline into a closed tubular mesh so intersection curves stay
// thick and luminous even where WebGL2 clamps gl.lineWidth to 1px.
export function buildCurveTubeMesh(points, { radius = 0.024, radialSegments = 8, closed = false } = {}) {
  if (!points || points.length < 2) {
    return {
      positions: new Float32Array(0),
      normals: new Float32Array(0),
      indices: new Uint16Array(0),
    };
  }
  const count = points.length;
  const positions = [];
  const normals = [];
  const indices = [];

  for (let i = 0; i < count; i++) {
    const prev = i > 0 ? points[i - 1] : closed ? points[count - 2] : points[0];
    const next = i < count - 1 ? points[i + 1] : closed ? points[1] : points[count - 1];
    let tangent = normalize3(sub3(next, prev));
    if (length3(tangent) < 1e-6) tangent = [0, 1, 0];
    const ref = Math.abs(tangent[1]) < 0.9 ? [0, 1, 0] : [1, 0, 0];
    const binormal = normalize3(cross3(tangent, ref));
    const normal = cross3(binormal, tangent);

    for (let j = 0; j < radialSegments; j++) {
      const phi = (j / radialSegments) * Math.PI * 2;
      const c = Math.cos(phi);
      const s = Math.sin(phi);
      const nx = normal[0] * c + binormal[0] * s;
      const ny = normal[1] * c + binormal[1] * s;
      const nz = normal[2] * c + binormal[2] * s;
      positions.push(points[i][0] + radius * nx, points[i][1] + radius * ny, points[i][2] + radius * nz);
      normals.push(nx, ny, nz);
    }
  }

  for (let i = 0; i < count - 1; i++) {
    const row0 = i * radialSegments;
    const row1 = (i + 1) * radialSegments;
    for (let j = 0; j < radialSegments; j++) {
      const next = (j + 1) % radialSegments;
      pushTri(indices, row0 + j, row1 + j, row0 + next);
      pushTri(indices, row0 + next, row1 + j, row1 + next);
    }
  }

  return {
    positions: new Float32Array(positions),
    normals: new Float32Array(normals),
    indices: new Uint16Array(indices),
  };
}

/* Topological Euler Characteristic & Manifold Validator */

export function verifyMeshTopology(mesh) {
  const { positions, normals, indices } = mesh;
  const vertexCount = positions.length / 3;
  if (!Number.isInteger(vertexCount) || positions.length % 3 !== 0 || normals.length !== positions.length) {
    return { valid: false, reason: 'Position/normal buffer length mismatch' };
  }
  if (indices.length % 3 !== 0) {
    return { valid: false, reason: 'Index buffer length is not a multiple of 3' };
  }

  for (let i = 0; i < positions.length; i++) {
    if (!Number.isFinite(positions[i]) || !Number.isFinite(normals[i])) {
      return { valid: false, reason: 'Non-finite vertex attribute detected' };
    }
  }
  for (let i = 0; i < vertexCount; i++) {
    const nLen = Math.hypot(normals[i * 3], normals[i * 3 + 1], normals[i * 3 + 2]);
    if (Math.abs(nLen - 1) > 1e-4) {
      return { valid: false, reason: `Non-unit normal at vertex ${i}: ${nLen}` };
    }
  }

  // Deduplicate vertices by quantized spatial position so flat-shaded seams unify topologically.
  const posMap = new Map();
  const topoIndex = new Int32Array(vertexCount);
  let uniqueVerts = 0;
  for (let i = 0; i < vertexCount; i++) {
    const x = Math.round(positions[i * 3] * 1e5);
    const y = Math.round(positions[i * 3 + 1] * 1e5);
    const z = Math.round(positions[i * 3 + 2] * 1e5);
    const key = `${x},${y},${z}`;
    let id = posMap.get(key);
    if (id === undefined) {
      id = uniqueVerts++;
      posMap.set(key, id);
    }
    topoIndex[i] = id;
  }

  const edgeCounts = new Map();
  const faceCount = indices.length / 3;
  let degenerateTriangles = 0;

  for (let f = 0; f < faceCount; f++) {
    const i0 = indices[f * 3];
    const i1 = indices[f * 3 + 1];
    const i2 = indices[f * 3 + 2];
    if (i0 < 0 || i1 < 0 || i2 < 0 || i0 >= vertexCount || i1 >= vertexCount || i2 >= vertexCount) {
      return { valid: false, reason: `Out-of-bounds triangle index at face ${f}` };
    }
    const v0 = topoIndex[i0];
    const v1 = topoIndex[i1];
    const v2 = topoIndex[i2];
    if (v0 === v1 || v1 === v2 || v2 === v0) {
      degenerateTriangles++;
      continue;
    }
    const p0 = [positions[i0 * 3], positions[i0 * 3 + 1], positions[i0 * 3 + 2]];
    const p1 = [positions[i1 * 3], positions[i1 * 3 + 1], positions[i1 * 3 + 2]];
    const p2 = [positions[i2 * 3], positions[i2 * 3 + 1], positions[i2 * 3 + 2]];
    const area2 = length3(cross3(sub3(p1, p0), sub3(p2, p0)));
    if (area2 < 1e-8) degenerateTriangles++;

    for (const [a, b] of [
      [v0, v1],
      [v1, v2],
      [v2, v0],
    ]) {
      const ek = a < b ? `${a}:${b}` : `${b}:${a}`;
      edgeCounts.set(ek, (edgeCounts.get(ek) || 0) + 1);
    }
  }

  let boundaryEdges = 0;
  let nonManifoldEdges = 0;
  for (const count of edgeCounts.values()) {
    if (count === 1) boundaryEdges++;
    else if (count !== 2) nonManifoldEdges++;
  }

  const uniqueEdges = edgeCounts.size;
  const euler = uniqueVerts - uniqueEdges + faceCount;
  return {
    valid: degenerateTriangles === 0 && boundaryEdges === 0 && nonManifoldEdges === 0,
    vertices: uniqueVerts,
    edges: uniqueEdges,
    faces: faceCount,
    euler,
    degenerateTriangles,
    boundaryEdges,
    nonManifoldEdges,
  };
}

export function buildReferenceGrid(extent = 2.0, step = 0.5, y = -1.8) {
  const positions = [];
  const count = Math.round((extent * 2) / step);
  for (let i = 0; i <= count; i++) {
    const t = -extent + i * step;
    positions.push(-extent, y, t, extent, y, t);
    positions.push(t, y, -extent, t, y, extent);
  }
  return new Float32Array(positions);
}

export function buildAxesLines(extent = 2.05) {
  return {
    x: new Float32Array([-extent, 0, 0, extent, 0, 0]),
    y: new Float32Array([0, -extent, 0, 0, extent, 0]),
    z: new Float32Array([0, 0, -extent, 0, 0, extent]),
  };
}
