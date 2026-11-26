import { test, assert, assertEqual } from './harness.js';
import { createRng } from '../src/questions/prng.js';
import {
  CONE_HALF_ANGLE_DEG,
  CONE_HEIGHT,
  buildCurveTubeMesh,
  buildCylinderMesh,
  buildDoubleConeMesh,
  buildPrismMesh,
  buildSingleConeMesh,
  buildSphereMesh,
  classifyConic,
  computeCameraMatrices,
  computeSphereSection,
  computeVolumeSection,
  conicPointResidual,
  createOrbitState,
  mat3Determinant,
  mat3OrthonormalResidual,
  mat4Extract3x3,
  mat4OrbitRotation,
  mat4TransformPoint,
  sampleConicIntersection,
  stepOrbit,
  verifyMeshTopology,
} from '../src/webgl/geometry3d-math.js';

const close = (a, b, tol = 1e-9) => Math.abs(a - b) <= tol;

test('geometry3d: orbit rotation and LookAt camera matrices stay in SO(3) across 200 samples', () => {
  const rng = createRng(20261126);
  for (let i = 0; i < 200; i++) {
    const yaw = (rng.next() - 0.5) * Math.PI * 4;
    const pitch = (rng.next() - 0.5) * 2.7; // stays safely within [-1.35, 1.35]
    const distance = 2.6 + rng.next() * 6.5;
    const aspect = 0.7 + rng.next() * 1.8;

    const rot = mat4Extract3x3(mat4OrbitRotation(yaw, pitch));
    assert(mat3OrthonormalResidual(rot) < 1e-6, `orbit R^T R != I at sample ${i}`);
    assert(close(mat3Determinant(rot), 1, 1e-6), `orbit det(R) != 1 at sample ${i}`);

    const { eye, view, proj, viewProj } = computeCameraMatrices({ yaw, pitch, distance, aspect });
    const view3 = mat4Extract3x3(view);
    assert(mat3OrthonormalResidual(view3) < 1e-6, `LookAt R^T R != I at sample ${i}`);
    assert(close(mat3Determinant(view3), 1, 1e-6), `LookAt det(R) != 1 at sample ${i}`);

    const eyeInCam = mat4TransformPoint(view, eye);
    assert(
      close(eyeInCam.x, 0, 1e-5) && close(eyeInCam.y, 0, 1e-5) && close(eyeInCam.z, 0, 1e-5),
      `camera eye did not map to view origin at sample ${i}`,
    );

    const originProj = mat4TransformPoint(viewProj, [0, 0, 0]);
    const originView = mat4TransformPoint(view, [0, 0, 0]);
    const originManual = mat4TransformPoint(proj, [originView.x, originView.y, originView.z]);
    assert(
      close(originProj.ndcX, 0, 1e-5) && close(originProj.ndcY, 0, 1e-5),
      `optical axis target did not project to NDC center at sample ${i}`,
    );
    assert(
      close(originProj.ndcZ, originManual.ndcZ, 1e-5),
      `combined viewProj diverged from proj(view(p)) at sample ${i}`,
    );
  }
});

test('geometry3d: conic discriminant, eccentricity, and analytical intersection residuals hold', () => {
  const rng = createRng(991122);
  const parabolaTilt = 90 - CONE_HALF_ANGLE_DEG; // exact 60 deg

  const circle = classifyConic(0, 0.48);
  assertEqual(circle.type, 'circle');
  assertEqual(circle.eccentricity, 0);
  assert(circle.discriminant < 0, 'circle discriminant must be negative');

  const parabola = classifyConic(parabolaTilt, 0.48);
  assertEqual(parabola.type, 'parabola');
  assert(close(parabola.eccentricity, 1, 1e-12), 'parabola eccentricity must equal 1');
  assert(close(parabola.discriminant, 0, 1e-12), 'parabola discriminant must equal 0');

  assertEqual(classifyConic(0, 0).type, 'degenerate-point');
  assertEqual(classifyConic(parabolaTilt, 0).type, 'degenerate-line');
  assertEqual(classifyConic(78, 0).type, 'degenerate-lines');

  const angles = [0, 18, 34, 48, 59.9999, parabolaTilt, 72, 78, 84];
  for (let i = 0; i < 60; i++) {
    angles.push(rng.next() * 85);
  }

  for (const tilt of angles) {
    const offset = 0.35 + rng.next() * 0.45;
    const res = sampleConicIntersection(tilt, offset, { segments: 72 });
    const { info, branches } = res;

    if (info.type === 'ellipse') {
      assert(info.eccentricity > 0 && info.eccentricity < 1, `ellipse e=${info.eccentricity}`);
      assert(info.discriminant < 0, `ellipse discriminant=${info.discriminant}`);
      const ratio = info.semiMinor / info.semiMajor;
      assert(
        close(ratio * ratio, 1 - info.eccentricity ** 2, 1e-12),
        'ellipse semi-axis ratio mismatch',
      );
    } else if (info.type === 'hyperbola') {
      assert(info.eccentricity > 1, `hyperbola e=${info.eccentricity}`);
      assert(info.discriminant > 0, `hyperbola discriminant=${info.discriminant}`);
      const ratio = info.semiMinor / info.semiMajor;
      assert(
        close(ratio * ratio, info.eccentricity ** 2 - 1, 1e-12),
        'hyperbola semi-axis ratio mismatch',
      );
    }

    for (const branch of branches) {
      assert(branch.length >= 2, `branch has too few points at tilt ${tilt}`);
      for (const point of branch) {
        assert(Math.abs(point[1]) <= CONE_HEIGHT + 1e-7, `point escaped cone height at tilt ${tilt}`);
        const { coneResidual, planeResidual } = conicPointResidual(point, tilt, offset);
        assert(coneResidual < 1e-10, `cone residual ${coneResidual} at tilt ${tilt}`);
        assert(planeResidual < 1e-10, `plane residual ${planeResidual} at tilt ${tilt}`);
      }
    }
  }
});

test('geometry3d: coordinate sphere secant chord satisfies 3D Pythagorean theorem and tangency', () => {
  const center = [0.2, 0.1, -0.1];
  const radius = 1.2;

  for (const ratio of [-1, -0.75, -0.3, 0, 0.45, 0.85, 1]) {
    const sec = computeSphereSection(ratio, { center, radius });
    const d = sec.offsetDistance;
    assert(close(d * d + sec.secantRadius * sec.secantRadius, radius * radius, 1e-12));
    if (Math.abs(ratio) === 1) {
      assert(sec.isTangent, 'expected tangent classification at |d| = r');
      assert(close(sec.secantRadius, 0, 1e-12));
    }
    for (const [x, y, z] of sec.ring) {
      assert(close(y, sec.sliceY, 1e-12));
      const distSq = (x - center[0]) ** 2 + (y - center[1]) ** 2 + (z - center[2]) ** 2;
      assert(close(distSq, radius * radius, 1e-11), `secant point off sphere: ${distSq}`);
    }
  }
});

test('geometry3d: volume solid cross-sections follow exact similar-solid k, k^2, k^3 scaling', () => {
  for (const t of [0.1, 0.25, 0.5, 0.75, 0.9]) {
    const cone = computeVolumeSection('cone', t);
    assert(close(cone.scaleFactor, 1 - t, 1e-12));
    assert(close(cone.areaScale, (1 - t) ** 2, 1e-12));
    assert(close(cone.volumeScale, (1 - t) ** 3, 1e-12));
    assert(close(cone.sliceArea, cone.baseArea * (1 - t) ** 2, 1e-12));

    const cyl = computeVolumeSection('cylinder', t);
    assertEqual(cyl.scaleFactor, 1);
    assert(close(cyl.sliceArea, cyl.baseArea, 1e-12));
    assert(close(cyl.volumeScale, t, 1e-12));

    const prism = computeVolumeSection('prism', t);
    assertEqual(prism.scaleFactor, 1);
    assert(close(prism.sliceArea, prism.baseArea, 1e-12));
    assertEqual(prism.contour.length, 5);
  }
});

test('geometry3d: solid meshes satisfy closed 2-manifold bounds and Euler characteristic V - E + F = 2', () => {
  const doubleCone = buildDoubleConeMesh();
  const meshes = [
    ['singleCone', buildSingleConeMesh()],
    ['doubleCone.upper', doubleCone.upper],
    ['doubleCone.lower', doubleCone.lower],
    ['cylinder', buildCylinderMesh()],
    ['prism', buildPrismMesh()],
    ['sphere', buildSphereMesh()],
  ];

  for (const [name, mesh] of meshes) {
    const report = verifyMeshTopology(mesh);
    assert(report.valid, `${name} failed topology check: ${JSON.stringify(report)}`);
    assertEqual(report.euler, 2, `${name} Euler characteristic`);
    assertEqual(report.degenerateTriangles, 0, `${name} degenerate triangles`);
    assertEqual(report.boundaryEdges, 0, `${name} boundary edges`);
    assertEqual(report.nonManifoldEdges, 0, `${name} non-manifold edges`);
  }

  const conic = sampleConicIntersection(34, 0.48);
  const tube = buildCurveTubeMesh(conic.branches[0], { closed: conic.closed });
  assert(tube.indices.length > 0 && tube.indices.length % 3 === 0);
  const vertCount = tube.positions.length / 3;
  for (const idx of tube.indices) assert(idx >= 0 && idx < vertCount, 'tube index out of bounds');
  for (let i = 0; i < vertCount; i++) {
    const nLen = Math.hypot(tube.normals[i * 3], tube.normals[i * 3 + 1], tube.normals[i * 3 + 2]);
    assert(close(nLen, 1, 1e-4), `tube normal not unit length: ${nLen}`);
  }
});

test('geometry3d: orbit kinematics snap under reduced motion and converge cleanly without overshoot', () => {
  const reduced = createOrbitState({
    yaw: 0,
    pitch: 0,
    distance: 4,
    targetYaw: 1.5,
    targetPitch: 0.7,
    targetDistance: 6,
    velYaw: 3.2,
    reducedMotion: true,
    paused: true,
    autoOrbit: false,
  });
  const snapped = stepOrbit(reduced, 1 / 60);
  assertEqual(snapped.yaw, 1.5);
  assertEqual(snapped.pitch, 0.7);
  assertEqual(snapped.distance, 6);
  assertEqual(snapped.velYaw, 0);
  assertEqual(snapped.settled, true);

  let damped = createOrbitState({
    yaw: 0,
    pitch: 0,
    distance: 4,
    targetYaw: 1.0,
    targetPitch: 0.5,
    targetDistance: 5.5,
    paused: true,
    autoOrbit: false,
    reducedMotion: false,
  });
  for (let i = 0; i < 180; i++) {
    damped = stepOrbit(damped, 1 / 60);
    assert(damped.yaw <= 1.0 + 1e-6, `critically damped yaw overshot target: ${damped.yaw}`);
    assert(damped.pitch <= 0.5 + 1e-6, `critically damped pitch overshot target: ${damped.pitch}`);
  }
  assert(damped.settled, 'damped orbit should settle at equilibrium');
  assert(close(damped.yaw, 1.0, 1e-5) && close(damped.pitch, 0.5, 1e-5));

  let spinning = createOrbitState({ paused: false, autoOrbit: true, reducedMotion: false, targetPitch: 5 });
  const initialYaw = spinning.yaw;
  for (let i = 0; i < 60; i++) spinning = stepOrbit(spinning, 1 / 60);
  assert(spinning.yaw > initialYaw, 'active auto-orbit should advance yaw');
  assert(Math.abs(spinning.pitch) <= 1.42 + 1e-9, 'pitch must remain clamped away from gimbal pole');
});
