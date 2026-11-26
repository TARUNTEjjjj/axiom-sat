// Zero-dependency WebGL2 3D Geometry Studio with Canvas2D software projection fallback
// and SVG safety fallback. Strictly obeys prefers-reduced-motion and Pause 3D state.

import {
  CONE_HALF_ANGLE_DEG,
  CONE_HEIGHT,
  DEFAULT_ORBIT,
  DEG_TO_RAD,
  MODES,
  SOLIDS,
  buildAxesLines,
  buildCurveTubeMesh,
  buildCylinderMesh,
  buildDoubleConeMesh,
  buildPlaneMesh,
  buildPrismMesh,
  buildReferenceGrid,
  buildSingleConeMesh,
  buildSphereMesh,
  clamp,
  classifyConic,
  computeCameraMatrices,
  computeSphereSection,
  computeVolumeSection,
  createOrbitState,
  mat4TransformPoint,
  sampleConicIntersection,
  stepOrbit,
} from './geometry3d-math.js';

const SURFACE_VS = `#version 300 es
in vec3 aPosition;
in vec3 aNormal;
uniform mat4 uViewProj;
out vec3 vWorldPos;
out vec3 vWorldNormal;
void main() {
  vWorldPos = aPosition;
  vWorldNormal = aNormal;
  gl_Position = uViewProj * vec4(aPosition, 1.0);
}`;

const SURFACE_FS = `#version 300 es
precision highp float;
in vec3 vWorldPos;
in vec3 vWorldNormal;
uniform vec3 uEyePos;
uniform vec3 uBaseColor;
uniform vec3 uRimColor;
uniform float uAlpha;
uniform float uSpecular;
uniform float uEmissive;
out vec4 fragColor;
void main() {
  vec3 N = normalize(vWorldNormal);
  if (!gl_FrontFacing) N = -N;
  vec3 V = normalize(uEyePos - vWorldPos);
  vec3 L1 = normalize(vec3(3.2, 4.6, 3.8));
  vec3 L2 = normalize(vec3(-2.8, -1.6, -2.4));
  float diff1 = max(dot(N, L1), 0.0);
  float diff2 = max(dot(N, L2), 0.0) * 0.30;
  vec3 H1 = normalize(L1 + V);
  float spec = pow(max(dot(N, H1), 0.0), 40.0) * uSpecular;
  float fresnel = pow(1.0 - max(dot(N, V), 0.0), 2.3);
  float hemi = 0.5 + 0.5 * N.y;
  vec3 ambient = mix(vec3(0.09, 0.14, 0.24), vec3(0.20, 0.30, 0.48), hemi);
  vec3 color = uBaseColor * (ambient + diff1 * 0.72 + diff2)
             + vec3(1.0) * spec
             + uRimColor * fresnel * 0.55
             + uBaseColor * uEmissive;
  fragColor = vec4(color, uAlpha);
}`;

const LINE_VS = `#version 300 es
in vec3 aPosition;
uniform mat4 uViewProj;
void main() {
  gl_Position = uViewProj * vec4(aPosition, 1.0);
}`;

const LINE_FS = `#version 300 es
precision highp float;
uniform vec4 uColor;
out vec4 fragColor;
void main() {
  fragColor = uColor;
}`;

const MODE_DEFAULTS = {
  conics: { param: 34, label: 'Cutting plane tilt (θ)', min: 0, max: 84, step: 1 },
  sphere: { param: 45, label: 'Secant plane offset (d/r %)', min: -98, max: 98, step: 1 },
  volume: { param: 45, label: 'Cross-section height (t %)', min: 5, max: 95, step: 1 },
};

const CONIC_PRESETS = [
  { label: 'Circle (0°)', value: 0 },
  { label: 'Ellipse (34°)', value: 34 },
  { label: 'Parabola (60°)', value: 60 },
  { label: 'Hyperbola (78°)', value: 78 },
];

const SPHERE_PRESETS = [
  { label: 'Great Circle (0%)', value: 0 },
  { label: 'Secant (50%)', value: 50 },
  { label: 'Tangent (98%)', value: 98 },
];

const SOLID_PRESETS = [
  { label: 'Cone', solid: 'cone' },
  { label: 'Cylinder', solid: 'cylinder' },
  { label: 'Prism', solid: 'prism' },
];

function compileShader(gl, type, source) {
  const shader = gl.createShader(type);
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    const info = gl.getShaderInfoLog(shader);
    gl.deleteShader(shader);
    throw new Error(`Shader compile error: ${info}`);
  }
  return shader;
}

function linkProgram(gl, vsSource, fsSource) {
  const vs = compileShader(gl, gl.VERTEX_SHADER, vsSource);
  const fs = compileShader(gl, gl.FRAGMENT_SHADER, fsSource);
  const prog = gl.createProgram();
  gl.attachShader(prog, vs);
  gl.attachShader(prog, fs);
  gl.linkProgram(prog);
  gl.deleteShader(vs);
  gl.deleteShader(fs);
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
    const info = gl.getProgramInfoLog(prog);
    gl.deleteProgram(prog);
    throw new Error(`Program link error: ${info}`);
  }
  return prog;
}

function buildSceneData(state) {
  const { mode, param, solid } = state;

  if (mode === 'conics') {
    const offset = 0.48;
    const conic = sampleConicIntersection(param, offset, { segments: 96 });
    const theta = conic.info.tiltDeg * DEG_TO_RAD;
    const cosT = Math.cos(theta);
    const sinT = Math.sin(theta);
    const plane = buildPlaneMesh({
      center: [0, offset * cosT, offset * sinT],
      axisU: [1, 0, 0],
      axisV: [0, -sinT, cosT],
      normal: [0, cosT, sinT],
      halfU: 1.55,
      halfV: 1.7,
    });
    const curveTubes = conic.branches.map((branch) =>
      buildCurveTubeMesh(branch, { radius: 0.026, radialSegments: 8, closed: conic.closed }),
    );
    return {
      mode,
      classification: conic.info.label,
      equationText: conic.info.equationText,
      satBridge: conic.info.satBridge,
      metrics: [
        { label: 'Eccentricity (e)', value: conic.info.eccentricity.toFixed(3) },
        { label: 'Discriminant (Δ)', value: conic.info.discriminant.toFixed(3) },
        { label: 'Plane Tilt (θ)', value: `${Math.round(conic.info.tiltDeg)}°` },
        { label: 'Half-Angle (α)', value: `${CONE_HALF_ANGLE_DEG}°` },
      ],
      bankHref: 'bank.html?d=advanced',
      bankLabel: 'Explore Advanced Math & Geometry →',
      hudText: `${conic.info.label} · e = ${conic.info.eccentricity.toFixed(2)}`,
      plane,
      curveBranches: conic.branches,
      curveTubes,
      solidColor: [0.24, 0.54, 0.96],
      planeColor: [0.34, 0.78, 0.98],
      curveColor: [0.99, 0.75, 0.18],
      extraLines: null,
      markerPos: null,
    };
  }

  if (mode === 'sphere') {
    const ratio = param / 100;
    const secant = computeSphereSection(ratio);
    const plane = buildPlaneMesh({
      center: [secant.center[0], secant.sliceY, secant.center[2]],
      axisU: [1, 0, 0],
      axisV: [0, 0, 1],
      normal: [0, 1, 0],
      halfU: 1.55,
      halfV: 1.55,
    });
    const curveBranches = secant.secantRadius > 0.03 ? [secant.ring] : [];
    const curveTubes = curveBranches.map((branch) =>
      buildCurveTubeMesh(branch, { radius: 0.026, radialSegments: 8, closed: true }),
    );
    const tri = secant.pythagoreanTriangle;
    const extraLines = new Float32Array([
      ...tri[0], ...tri[1],
      ...tri[1], ...tri[2],
      ...tri[0], ...tri[2],
    ]);
    return {
      mode,
      classification: secant.label,
      equationText: secant.equationText,
      satBridge: secant.satBridge,
      metrics: [
        { label: 'Sphere Radius (r)', value: secant.radius.toFixed(2) },
        { label: 'Offset (d)', value: secant.offsetDistance.toFixed(2) },
        { label: 'Secant Radius', value: secant.secantRadius.toFixed(2) },
        { label: 'Slice Area', value: `${(secant.secantRadius ** 2).toFixed(2)}π` },
      ],
      bankHref: 'bank.html?d=geometry',
      bankLabel: 'Practice Circles & Tangency →',
      hudText: `${secant.label} · r_slice = ${secant.secantRadius.toFixed(2)}`,
      plane,
      curveBranches,
      curveTubes,
      solidColor: [0.22, 0.56, 0.96],
      planeColor: [0.20, 0.82, 0.68],
      curveColor: [0.99, 0.75, 0.18],
      extraLines,
      markerPos: secant.center,
    };
  }

  // Volume solid mode
  const t = param / 100;
  const vol = computeVolumeSection(solid, t);
  const plane = buildPlaneMesh({
    center: [0, vol.ySlice, 0],
    axisU: [1, 0, 0],
    axisV: [0, 0, 1],
    normal: [0, 1, 0],
    halfU: 1.45,
    halfV: 1.45,
  });
  const curveBranches = vol.contour.length >= 2 ? [vol.contour] : [];
  const curveTubes = curveBranches.map((branch) =>
    buildCurveTubeMesh(branch, { radius: 0.026, radialSegments: 8, closed: true }),
  );
  return {
    mode,
    classification: vol.label,
    equationText: vol.equationText,
    satBridge: vol.satBridge,
    metrics: [
      { label: 'Elevation (t)', value: `${Math.round(vol.sliceFraction * 100)}%` },
      { label: 'Linear Ratio (k)', value: vol.scaleFactor.toFixed(2) },
      { label: 'Area Scale (k²)', value: vol.areaScale.toFixed(2) },
      { label: 'Volume Ratio', value: vol.volumeScale.toFixed(2) },
    ],
    bankHref: 'bank.html?d=geometry',
    bankLabel: 'Practice Area & Volume →',
    hudText: `${vol.label} · A = ${vol.sliceArea.toFixed(2)}`,
    plane,
    curveBranches,
    curveTubes,
    solidColor: [0.24, 0.52, 0.95],
    planeColor: [0.36, 0.78, 0.96],
    curveColor: [0.25, 0.92, 0.62],
    extraLines: null,
    markerPos: null,
  };
}

function createWebGL2Backend(canvas) {
  let gl = null;
  try {
    gl = canvas.getContext('webgl2', {
      antialias: true,
      alpha: true,
      preserveDrawingBuffer: true,
      powerPreference: 'high-performance',
    });
  } catch {
    return null;
  }
  if (!gl) return null;

  let surfaceProg;
  let lineProg;
  try {
    surfaceProg = linkProgram(gl, SURFACE_VS, SURFACE_FS);
    lineProg = linkProgram(gl, LINE_VS, LINE_FS);
  } catch {
    return null;
  }

  const surfLoc = {
    aPos: gl.getAttribLocation(surfaceProg, 'aPosition'),
    aNorm: gl.getAttribLocation(surfaceProg, 'aNormal'),
    uViewProj: gl.getUniformLocation(surfaceProg, 'uViewProj'),
    uEyePos: gl.getUniformLocation(surfaceProg, 'uEyePos'),
    uBaseColor: gl.getUniformLocation(surfaceProg, 'uBaseColor'),
    uRimColor: gl.getUniformLocation(surfaceProg, 'uRimColor'),
    uAlpha: gl.getUniformLocation(surfaceProg, 'uAlpha'),
    uSpecular: gl.getUniformLocation(surfaceProg, 'uSpecular'),
    uEmissive: gl.getUniformLocation(surfaceProg, 'uEmissive'),
  };
  const lineLoc = {
    aPos: gl.getAttribLocation(lineProg, 'aPosition'),
    uViewProj: gl.getUniformLocation(lineProg, 'uViewProj'),
    uColor: gl.getUniformLocation(lineProg, 'uColor'),
  };

  function uploadSurfaceMesh(mesh) {
    const vao = gl.createVertexArray();
    gl.bindVertexArray(vao);

    const posBuf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, posBuf);
    gl.bufferData(gl.ARRAY_BUFFER, mesh.positions, gl.STATIC_DRAW);
    gl.enableVertexAttribArray(surfLoc.aPos);
    gl.vertexAttribPointer(surfLoc.aPos, 3, gl.FLOAT, false, 0, 0);

    const normBuf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, normBuf);
    gl.bufferData(gl.ARRAY_BUFFER, mesh.normals, gl.STATIC_DRAW);
    gl.enableVertexAttribArray(surfLoc.aNorm);
    gl.vertexAttribPointer(surfLoc.aNorm, 3, gl.FLOAT, false, 0, 0);

    const idxBuf = gl.createBuffer();
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, idxBuf);
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, mesh.indices, gl.STATIC_DRAW);

    let edgeBuf = null;
    let edgeVao = null;
    if (mesh.edgeIndices && mesh.edgeIndices.length) {
      edgeVao = gl.createVertexArray();
      gl.bindVertexArray(edgeVao);
      gl.bindBuffer(gl.ARRAY_BUFFER, posBuf);
      gl.enableVertexAttribArray(lineLoc.aPos);
      gl.vertexAttribPointer(lineLoc.aPos, 3, gl.FLOAT, false, 0, 0);
      edgeBuf = gl.createBuffer();
      gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, edgeBuf);
      gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, mesh.edgeIndices, gl.STATIC_DRAW);
    }

    gl.bindVertexArray(null);
    return {
      vao,
      edgeVao,
      indexCount: mesh.indices.length,
      edgeCount: mesh.edgeIndices ? mesh.edgeIndices.length : 0,
      dispose() {
        gl.deleteVertexArray(vao);
        if (edgeVao) gl.deleteVertexArray(edgeVao);
        gl.deleteBuffer(posBuf);
        gl.deleteBuffer(normBuf);
        gl.deleteBuffer(idxBuf);
        if (edgeBuf) gl.deleteBuffer(edgeBuf);
      },
    };
  }

  function uploadLineArray(positions) {
    const vao = gl.createVertexArray();
    gl.bindVertexArray(vao);
    const buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, positions, gl.STATIC_DRAW);
    gl.enableVertexAttribArray(lineLoc.aPos);
    gl.vertexAttribPointer(lineLoc.aPos, 3, gl.FLOAT, false, 0, 0);
    gl.bindVertexArray(null);
    return {
      vao,
      vertexCount: positions.length / 3,
      dispose() {
        gl.deleteVertexArray(vao);
        gl.deleteBuffer(buf);
      },
    };
  }

  const staticMeshes = {
    doubleCone: uploadSurfaceMesh(buildDoubleConeMesh({ height: CONE_HEIGHT, halfAngleDeg: CONE_HALF_ANGLE_DEG })),
    sphere: uploadSurfaceMesh(buildSphereMesh({ center: [0.2, 0.1, -0.1], radius: 1.2 })),
    marker: uploadSurfaceMesh(buildSphereMesh({ center: [0.2, 0.1, -0.1], radius: 0.058, stacks: 10, slices: 14 })),
    cone: uploadSurfaceMesh(buildSingleConeMesh({ radius: 1.02, yApex: 1.0, yBase: -1.0 })),
    cylinder: uploadSurfaceMesh(buildCylinderMesh({ radius: 1.02, height: 2.0 })),
    prism: uploadSurfaceMesh(buildPrismMesh({ length: 1.75, height: 2.0, width: 1.3 })),
  };

  const axes = buildAxesLines(2.05);
  const staticLines = {
    grid: uploadLineArray(buildReferenceGrid(2.0, 0.5, -1.82)),
    axisX: uploadLineArray(axes.x),
    axisY: uploadLineArray(axes.y),
    axisZ: uploadLineArray(axes.z),
  };

  let dynamicPlane = null;
  let dynamicTubes = [];
  let dynamicExtraLines = null;

  function syncDynamic(scene) {
    if (dynamicPlane) dynamicPlane.dispose();
    dynamicPlane = uploadSurfaceMesh(scene.plane);

    for (const tube of dynamicTubes) tube.dispose();
    dynamicTubes = scene.curveTubes
      .filter((t) => t.indices.length > 0)
      .map((t) => uploadSurfaceMesh(t));

    if (dynamicExtraLines) {
      dynamicExtraLines.dispose();
      dynamicExtraLines = null;
    }
    if (scene.extraLines && scene.extraLines.length) {
      dynamicExtraLines = uploadLineArray(scene.extraLines);
    }
  }

  function drawSurface(gpuMesh, viewProj, eye, { baseColor, rimColor, alpha, specular, emissive }) {
    gl.useProgram(surfaceProg);
    gl.bindVertexArray(gpuMesh.vao);
    gl.uniformMatrix4fv(surfLoc.uViewProj, false, viewProj);
    gl.uniform3fv(surfLoc.uEyePos, eye);
    gl.uniform3fv(surfLoc.uBaseColor, baseColor);
    gl.uniform3fv(surfLoc.uRimColor, rimColor);
    gl.uniform1f(surfLoc.uAlpha, alpha);
    gl.uniform1f(surfLoc.uSpecular, specular);
    gl.uniform1f(surfLoc.uEmissive, emissive);
    gl.drawElements(gl.TRIANGLES, gpuMesh.indexCount, gl.UNSIGNED_SHORT, 0);
  }

  function drawEdges(gpuMesh, viewProj, color) {
    if (!gpuMesh.edgeVao || !gpuMesh.edgeCount) return;
    gl.useProgram(lineProg);
    gl.bindVertexArray(gpuMesh.edgeVao);
    gl.uniformMatrix4fv(lineLoc.uViewProj, false, viewProj);
    gl.uniform4fv(lineLoc.uColor, color);
    gl.drawElements(gl.LINES, gpuMesh.edgeCount, gl.UNSIGNED_SHORT, 0);
  }

  function drawLines(gpuLines, viewProj, color) {
    gl.useProgram(lineProg);
    gl.bindVertexArray(gpuLines.vao);
    gl.uniformMatrix4fv(lineLoc.uViewProj, false, viewProj);
    gl.uniform4fv(lineLoc.uColor, color);
    gl.drawArrays(gl.LINES, 0, gpuLines.vertexCount);
  }

  function render(orbit, scene, width, height) {
    if (gl.isContextLost()) return;
    gl.viewport(0, 0, width, height);
    gl.clearColor(0.055, 0.082, 0.145, 1.0);
    gl.clearDepth(1.0);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    gl.enable(gl.DEPTH_TEST);
    gl.depthFunc(gl.LEQUAL);

    const { eye, viewProj } = computeCameraMatrices({
      yaw: orbit.yaw,
      pitch: orbit.pitch,
      distance: orbit.distance,
      aspect: width / Math.max(1, height),
    });

    // 1. Reference grid and XYZ coordinate axes
    gl.disable(gl.CULL_FACE);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
    gl.depthMask(true);
    drawLines(staticLines.grid, viewProj, [0.42, 0.56, 0.78, 0.22]);
    drawLines(staticLines.axisX, viewProj, [0.96, 0.42, 0.42, 0.65]);
    drawLines(staticLines.axisY, viewProj, [0.34, 0.84, 0.56, 0.65]);
    drawLines(staticLines.axisZ, viewProj, [0.40, 0.68, 0.98, 0.65]);

    const activeSolid =
      scene.mode === 'conics'
        ? staticMeshes.doubleCone
        : scene.mode === 'sphere'
          ? staticMeshes.sphere
          : staticMeshes[scene.solid] || staticMeshes.cone;

    // 2. Translucent primary solid (back faces then front faces for depth clarity)
    gl.depthMask(false);
    gl.enable(gl.CULL_FACE);
    gl.cullFace(gl.FRONT);
    drawSurface(activeSolid, viewProj, eye, {
      baseColor: scene.solidColor,
      rimColor: [0.56, 0.80, 1.0],
      alpha: 0.20,
      specular: 0.45,
      emissive: 0.05,
    });
    gl.cullFace(gl.BACK);
    drawSurface(activeSolid, viewProj, eye, {
      baseColor: scene.solidColor,
      rimColor: [0.64, 0.86, 1.0],
      alpha: 0.30,
      specular: 0.75,
      emissive: 0.08,
    });

    // Solid wireframe edges
    gl.disable(gl.CULL_FACE);
    drawEdges(activeSolid, viewProj, [0.64, 0.82, 1.0, 0.34]);

    // 3. Cutting / secant / slice plane
    if (dynamicPlane) {
      drawSurface(dynamicPlane, viewProj, eye, {
        baseColor: scene.planeColor,
        rimColor: [0.85, 0.95, 1.0],
        alpha: 0.20,
        specular: 0.35,
        emissive: 0.08,
      });
      drawEdges(dynamicPlane, viewProj, [0.55, 0.88, 1.0, 0.62]);
    }

    // 4. Optional Pythagorean legs in Sphere mode
    if (dynamicExtraLines) {
      drawLines(dynamicExtraLines, viewProj, [0.99, 0.84, 0.36, 0.95]);
    }

    // 5. Opaque glowing 3D intersection tubes
    gl.depthMask(true);
    gl.disable(gl.BLEND);
    gl.enable(gl.CULL_FACE);
    gl.cullFace(gl.BACK);
    for (const tube of dynamicTubes) {
      drawSurface(tube, viewProj, eye, {
        baseColor: scene.curveColor,
        rimColor: [1.0, 0.95, 0.82],
        alpha: 1.0,
        specular: 0.95,
        emissive: 0.62,
      });
    }

    // Center marker dot in Sphere mode
    if (scene.markerPos) {
      drawSurface(staticMeshes.marker, viewProj, eye, {
        baseColor: [0.99, 0.78, 0.22],
        rimColor: [1.0, 0.96, 0.84],
        alpha: 1.0,
        specular: 0.9,
        emissive: 0.7,
      });
    }

    gl.bindVertexArray(null);
  }

  return {
    type: 'webgl2',
    syncDynamic,
    render,
    dispose() {
      Object.values(staticMeshes).forEach((m) => m.dispose());
      Object.values(staticLines).forEach((l) => l.dispose());
      if (dynamicPlane) dynamicPlane.dispose();
      dynamicTubes.forEach((t) => t.dispose());
      if (dynamicExtraLines) dynamicExtraLines.dispose();
      gl.deleteProgram(surfaceProg);
      gl.deleteProgram(lineProg);
    },
  };
}

function createCanvas2DBackend(canvas) {
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;

  const staticMeshes = {
    doubleCone: buildDoubleConeMesh({ height: CONE_HEIGHT, halfAngleDeg: CONE_HALF_ANGLE_DEG, segments: 28 }),
    sphere: buildSphereMesh({ center: [0.2, 0.1, -0.1], radius: 1.2, stacks: 14, slices: 22 }),
    cone: buildSingleConeMesh({ radius: 1.02, yApex: 1.0, yBase: -1.0, segments: 28 }),
    cylinder: buildCylinderMesh({ radius: 1.02, height: 2.0, segments: 28 }),
    prism: buildPrismMesh({ length: 1.75, height: 2.0, width: 1.3 }),
  };
  const grid = buildReferenceGrid(2.0, 0.5, -1.82);
  const axes = buildAxesLines(2.05);

  function project(p, viewProj, w, h) {
    const t = mat4TransformPoint(viewProj, p);
    if (t.w <= 0.05) return null;
    return {
      x: (t.ndcX * 0.5 + 0.5) * w,
      y: (-t.ndcY * 0.5 + 0.5) * h,
      z: t.ndcZ,
    };
  }

  function drawLineSegments(arr, viewProj, w, h, stroke, lineWidth = 1) {
    ctx.strokeStyle = stroke;
    ctx.lineWidth = lineWidth;
    ctx.beginPath();
    for (let i = 0; i < arr.length; i += 6) {
      const a = project([arr[i], arr[i + 1], arr[i + 2]], viewProj, w, h);
      const b = project([arr[i + 3], arr[i + 4], arr[i + 5]], viewProj, w, h);
      if (!a || !b) continue;
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(b.x, b.y);
    }
    ctx.stroke();
  }

  function renderMeshTriangles(mesh, viewProj, w, h, rgb, alpha) {
    const tris = [];
    const { positions, normals, indices } = mesh;
    for (let i = 0; i < indices.length; i += 3) {
      const i0 = indices[i] * 3;
      const i1 = indices[i + 1] * 3;
      const i2 = indices[i + 2] * 3;
      const p0 = project([positions[i0], positions[i0 + 1], positions[i0 + 2]], viewProj, w, h);
      const p1 = project([positions[i1], positions[i1 + 1], positions[i1 + 2]], viewProj, w, h);
      const p2 = project([positions[i2], positions[i2 + 1], positions[i2 + 2]], viewProj, w, h);
      if (!p0 || !p1 || !p2) continue;
      const ny = (normals[i0 + 1] + normals[i1 + 1] + normals[i2 + 1]) / 3;
      const nx = (normals[i0] + normals[i1] + normals[i2]) / 3;
      const shade = 0.55 + 0.45 * Math.max(0, nx * 0.55 + ny * 0.72);
      tris.push({ p0, p1, p2, z: (p0.z + p1.z + p2.z) / 3, shade });
    }
    tris.sort((a, b) => b.z - a.z);
    for (const tri of tris) {
      ctx.fillStyle = `rgba(${Math.round(rgb[0] * tri.shade)}, ${Math.round(rgb[1] * tri.shade)}, ${Math.round(rgb[2] * tri.shade)}, ${alpha})`;
      ctx.beginPath();
      ctx.moveTo(tri.p0.x, tri.p0.y);
      ctx.lineTo(tri.p1.x, tri.p1.y);
      ctx.lineTo(tri.p2.x, tri.p2.y);
      ctx.closePath();
      ctx.fill();
    }
  }

  return {
    type: 'canvas2d',
    syncDynamic() {},
    render(orbit, scene, width, height) {
      const grad = ctx.createRadialGradient(width * 0.5, height * 0.45, 20, width * 0.5, height * 0.5, Math.max(width, height) * 0.7);
      grad.addColorStop(0, '#13203b');
      grad.addColorStop(1, '#0b1120');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, width, height);

      const { viewProj } = computeCameraMatrices({
        yaw: orbit.yaw,
        pitch: orbit.pitch,
        distance: orbit.distance,
        aspect: width / Math.max(1, height),
      });

      drawLineSegments(grid, viewProj, width, height, 'rgba(130, 165, 220, 0.18)', 1);
      drawLineSegments(axes.x, viewProj, width, height, 'rgba(244, 114, 114, 0.65)', 1.5);
      drawLineSegments(axes.y, viewProj, width, height, 'rgba(74, 222, 128, 0.65)', 1.5);
      drawLineSegments(axes.z, viewProj, width, height, 'rgba(96, 165, 250, 0.65)', 1.5);

      const solidMesh =
        scene.mode === 'conics'
          ? staticMeshes.doubleCone
          : scene.mode === 'sphere'
            ? staticMeshes.sphere
            : staticMeshes[scene.solid] || staticMeshes.cone;

      renderMeshTriangles(solidMesh, viewProj, width, height, [62, 138, 245], 0.28);
      renderMeshTriangles(scene.plane, viewProj, width, height, [88, 196, 248], 0.20);

      // Cutting plane border
      const pPos = scene.plane.positions;
      const borderArr = new Float32Array([
        pPos[0], pPos[1], pPos[2], pPos[3], pPos[4], pPos[5],
        pPos[3], pPos[4], pPos[5], pPos[6], pPos[7], pPos[8],
        pPos[6], pPos[7], pPos[8], pPos[9], pPos[10], pPos[11],
        pPos[9], pPos[10], pPos[11], pPos[0], pPos[1], pPos[2],
      ]);
      drawLineSegments(borderArr, viewProj, width, height, 'rgba(147, 213, 255, 0.72)', 1.5);

      if (scene.extraLines) {
        drawLineSegments(scene.extraLines, viewProj, width, height, 'rgba(252, 211, 77, 0.9)', 2);
      }

      // Glowing intersection curve
      ctx.save();
      ctx.strokeStyle = scene.mode === 'volume' ? '#34d399' : '#fbbf24';
      ctx.lineWidth = 3.2;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      for (const branch of scene.curveBranches) {
        ctx.beginPath();
        let started = false;
        for (const pt of branch) {
          const projPt = project(pt, viewProj, width, height);
          if (!projPt) continue;
          if (!started) {
            ctx.moveTo(projPt.x, projPt.y);
            started = true;
          } else {
            ctx.lineTo(projPt.x, projPt.y);
          }
        }
        ctx.stroke();
      }
      ctx.restore();
    },
    dispose() {},
  };
}

function renderSvgFallback(viewportWrap, scene) {
  let svg = viewportWrap.querySelector('.studio-svg-fallback');
  if (!svg) {
    svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('viewBox', '0 0 400 280');
    svg.setAttribute('class', 'studio-svg-fallback');
    svg.setAttribute('aria-hidden', 'true');
    svg.innerHTML =
      '<rect width="400" height="280" fill="#0d1424"/>' +
      '<polygon points="200,140 120,30 280,30" fill="rgba(59,130,246,0.28)" stroke="#60a5fa" stroke-width="1.5"/>' +
      '<polygon points="200,140 120,250 280,250" fill="rgba(59,130,246,0.28)" stroke="#60a5fa" stroke-width="1.5"/>' +
      '<ellipse cx="200" cy="96" rx="52" ry="18" fill="none" stroke="#fbbf24" stroke-width="3"/>';
    viewportWrap.append(svg);
  }
  svg.dataset.mode = scene.mode;
}

export function mountGeometryStudio(root, options = {}) {
  if (!root) return null;

  const canvas = root.querySelector('#geometry-canvas');
  const viewportWrap = root.querySelector('.studio-viewport-wrap');
  const rendererBadge = root.querySelector('#studio-renderer-badge');
  const hudPill = root.querySelector('#studio-hud');
  const modeButtons = [...root.querySelectorAll('[data-mode]')];
  const paramInput = root.querySelector('#studio-param');
  const paramLabel = root.querySelector('#studio-param-label');
  const paramValue = root.querySelector('#studio-param-value');
  const presetsWrap = root.querySelector('#studio-presets');
  const shapeName = root.querySelector('#studio-shape-name');
  const equationEl = root.querySelector('#studio-equation');
  const metricsEl = root.querySelector('#studio-metrics');
  const noteEl = root.querySelector('#studio-note');
  const bankLink = root.querySelector('#studio-bank-link');
  const zoomInBtn = root.querySelector('#studio-zoom-in');
  const zoomOutBtn = root.querySelector('#studio-zoom-out');
  const resetBtn = root.querySelector('#studio-reset');
  const pauseBtn = root.querySelector('#studio-pause');
  const liveEl = root.querySelector('#studio-live');

  const reduceQuery =
    typeof window !== 'undefined' && typeof window.matchMedia === 'function'
      ? window.matchMedia('(prefers-reduced-motion: reduce)')
      : { matches: false };

  const state = {
    mode: 'conics',
    param: MODE_DEFAULTS.conics.param,
    solid: 'cone',
    userPaused: false,
  };

  let orbit = createOrbitState({
    reducedMotion: Boolean(reduceQuery.matches),
    paused: Boolean(reduceQuery.matches),
    autoOrbit: !reduceQuery.matches,
  });

  let backend = null;
  if (canvas && options.forceFallback !== 'svg') {
    if (options.forceFallback !== 'canvas2d') {
      backend = createWebGL2Backend(canvas);
    }
    if (!backend) {
      backend = createCanvas2DBackend(canvas);
    }
  }

  let scene = buildSceneData(state);
  if (backend) {
    backend.syncDynamic(scene);
    if (viewportWrap) viewportWrap.dataset.renderer = backend.type;
    if (rendererBadge) rendererBadge.textContent = backend.type === 'webgl2' ? 'WebGL2' : 'Canvas 2D';
  } else if (viewportWrap) {
    viewportWrap.dataset.renderer = 'svg';
    if (rendererBadge) rendererBadge.textContent = 'SVG';
    renderSvgFallback(viewportWrap, scene);
  }

  let rafId = 0;
  let resizeRaf = 0;
  let lastTime = 0;
  let canvasWidth = 640;
  let canvasHeight = 400;

  function updateCanvasSize() {
    if (!canvas) return;
    const host = viewportWrap || canvas;
    const rect = host.getBoundingClientRect();
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const cssW = host.clientWidth || rect.width || 640;
    const cssH = host.clientHeight || rect.height || 400;
    const w = Math.max(240, Math.round(cssW * dpr));
    const h = Math.max(180, Math.round(cssH * dpr));
    if (canvas.width !== w || canvas.height !== h) {
      canvas.width = w;
      canvas.height = h;
    }
    canvasWidth = w;
    canvasHeight = h;
  }

  function renderFrame() {
    if (!backend) {
      if (viewportWrap) renderSvgFallback(viewportWrap, scene);
      return;
    }
    updateCanvasSize();
    backend.render(orbit, { ...scene, solid: state.solid }, canvasWidth, canvasHeight);
  }

  function stopLoop() {
    if (rafId) {
      cancelAnimationFrame(rafId);
      rafId = 0;
    }
    lastTime = 0;
  }

  function tick(now) {
    rafId = 0;
    const dt = lastTime ? (now - lastTime) / 1000 : 1 / 60;
    lastTime = now;
    orbit = stepOrbit(orbit, dt);
    renderFrame();
    if (!orbit.settled && !orbit.reducedMotion) {
      rafId = requestAnimationFrame(tick);
    } else {
      lastTime = 0;
    }
  }

  function requestRender() {
    if (orbit.reducedMotion) {
      stopLoop();
      orbit = stepOrbit(orbit, 0);
      renderFrame();
      return;
    }
    if (!rafId) {
      rafId = requestAnimationFrame(tick);
    }
  }

  function announce(message) {
    if (liveEl) liveEl.textContent = message;
  }

  function renderPresets() {
    if (!presetsWrap) return;
    const buttons = [];
    if (state.mode === 'conics') {
      for (const preset of CONIC_PRESETS) {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'studio-preset-btn';
        btn.textContent = preset.label;
        const active = Math.abs(state.param - preset.value) <= 1;
        btn.setAttribute('aria-pressed', String(active));
        btn.addEventListener('click', () => {
          setParam(preset.value);
          announce(`${preset.label} selected`);
        });
        buttons.push(btn);
      }
    } else if (state.mode === 'sphere') {
      for (const preset of SPHERE_PRESETS) {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'studio-preset-btn';
        btn.textContent = preset.label;
        const active = Math.abs(state.param - preset.value) <= 2;
        btn.setAttribute('aria-pressed', String(active));
        btn.addEventListener('click', () => {
          setParam(preset.value);
          announce(`${preset.label} selected`);
        });
        buttons.push(btn);
      }
    } else {
      for (const preset of SOLID_PRESETS) {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'studio-preset-btn';
        btn.textContent = preset.label;
        const active = state.solid === preset.solid;
        btn.setAttribute('aria-pressed', String(active));
        btn.addEventListener('click', () => {
          setSolid(preset.solid);
          announce(`${preset.label} solid selected`);
        });
        buttons.push(btn);
      }
    }
    presetsWrap.replaceChildren(...buttons);
  }

  function syncPauseUi() {
    if (!pauseBtn) return;
    const isPaused = orbit.reducedMotion || state.userPaused;
    pauseBtn.setAttribute('aria-pressed', String(isPaused));
    pauseBtn.textContent = orbit.reducedMotion
      ? 'Motion paused'
      : state.userPaused
        ? 'Resume 3D'
        : 'Pause 3D';
  }

  function syncUi() {
    for (const btn of modeButtons) {
      btn.setAttribute('aria-pressed', String(btn.dataset.mode === state.mode));
    }
    const cfg = MODE_DEFAULTS[state.mode];
    if (paramLabel) paramLabel.textContent = cfg.label;
    if (paramInput) {
      paramInput.min = String(cfg.min);
      paramInput.max = String(cfg.max);
      paramInput.step = String(cfg.step);
      paramInput.value = String(state.param);
    }
    if (paramValue) {
      paramValue.textContent = state.mode === 'conics' ? `${state.param}°` : `${state.param}%`;
    }
    if (shapeName) shapeName.textContent = scene.classification;
    if (equationEl) equationEl.textContent = scene.equationText;
    if (noteEl) noteEl.textContent = scene.satBridge;
    if (hudPill) hudPill.textContent = scene.hudText;
    if (bankLink) {
      bankLink.href = scene.bankHref;
      bankLink.textContent = scene.bankLabel;
    }
    if (metricsEl) {
      const cells = scene.metrics.map((m) => {
        const card = document.createElement('div');
        card.className = 'studio-metric';
        const dt = document.createElement('span');
        dt.className = 'studio-metric-label';
        dt.textContent = m.label;
        const dd = document.createElement('strong');
        dd.className = 'studio-metric-value';
        dd.textContent = m.value;
        card.append(dt, dd);
        return card;
      });
      metricsEl.replaceChildren(...cells);
    }
    renderPresets();
    syncPauseUi();
  }

  function rebuildScene() {
    scene = buildSceneData(state);
    if (backend) backend.syncDynamic(scene);
    syncUi();
    renderFrame();
    requestRender();
  }

  function setMode(nextMode) {
    if (!MODES.includes(nextMode) || state.mode === nextMode) return;
    state.mode = nextMode;
    state.param = MODE_DEFAULTS[nextMode].param;
    rebuildScene();
    announce(`${scene.classification} mode active`);
  }

  function setParam(value) {
    const cfg = MODE_DEFAULTS[state.mode];
    const next = clamp(Math.round(Number(value)), cfg.min, cfg.max);
    if (!Number.isFinite(next) || next === state.param) return;
    state.param = next;
    rebuildScene();
  }

  function setSolid(nextSolid) {
    if (!SOLIDS.includes(nextSolid)) return;
    state.solid = nextSolid;
    if (state.mode !== 'volume') {
      state.mode = 'volume';
      state.param = MODE_DEFAULTS.volume.param;
    }
    rebuildScene();
  }

  function orbitBy(dYaw, dPitch) {
    orbit = {
      ...orbit,
      autoOrbit: false,
      targetYaw: orbit.targetYaw + dYaw,
      targetPitch: clamp(orbit.targetPitch + dPitch, -1.42, 1.42),
    };
    requestRender();
  }

  function zoomBy(deltaDist) {
    orbit = {
      ...orbit,
      targetDistance: clamp(orbit.targetDistance + deltaDist, 2.5, 9.5),
    };
    requestRender();
  }

  function setPaused(paused) {
    state.userPaused = Boolean(paused);
    orbit = {
      ...orbit,
      paused: orbit.reducedMotion || state.userPaused,
      autoOrbit: !(orbit.reducedMotion || state.userPaused),
    };
    syncPauseUi();
    if (orbit.paused) {
      stopLoop();
      renderFrame();
      announce('3D rotation paused');
    } else {
      requestRender();
      announce('3D rotation resumed');
    }
  }

  function reset() {
    state.param = MODE_DEFAULTS[state.mode].param;
    state.userPaused = false;
    orbit = createOrbitState({
      ...DEFAULT_ORBIT,
      reducedMotion: orbit.reducedMotion,
      paused: orbit.reducedMotion,
      autoOrbit: !orbit.reducedMotion,
    });
    rebuildScene();
    announce('3D view reset');
  }

  // Wire controls
  for (const btn of modeButtons) {
    btn.addEventListener('click', () => setMode(btn.dataset.mode));
  }

  if (paramInput) {
    paramInput.addEventListener('input', () => setParam(paramInput.value));
  }

  if (zoomInBtn) {
    zoomInBtn.addEventListener('click', () => zoomBy(-0.5));
  }
  if (zoomOutBtn) {
    zoomOutBtn.addEventListener('click', () => zoomBy(0.5));
  }
  if (resetBtn) {
    resetBtn.addEventListener('click', reset);
  }
  if (pauseBtn) {
    pauseBtn.addEventListener('click', () => {
      if (orbit.reducedMotion) return;
      setPaused(!state.userPaused);
    });
  }

  // Pointer drag-to-orbit on canvas
  let dragging = false;
  let lastX = 0;
  let lastY = 0;
  if (canvas) {
    canvas.addEventListener('pointerdown', (event) => {
      if (event.button !== 0 && event.pointerType === 'mouse') return;
      dragging = true;
      lastX = event.clientX;
      lastY = event.clientY;
      canvas.setPointerCapture?.(event.pointerId);
    });

    canvas.addEventListener('pointermove', (event) => {
      if (!dragging) return;
      const dx = event.clientX - lastX;
      const dy = event.clientY - lastY;
      lastX = event.clientX;
      lastY = event.clientY;
      orbitBy(-dx * 0.009, dy * 0.009);
    });

    const endDrag = (event) => {
      if (!dragging) return;
      dragging = false;
      canvas.releasePointerCapture?.(event.pointerId);
    };
    canvas.addEventListener('pointerup', endDrag);
    canvas.addEventListener('pointercancel', endDrag);

    // Keyboard navigation when canvas is focused
    canvas.addEventListener('keydown', (event) => {
      switch (event.key) {
        case 'ArrowLeft':
          event.preventDefault();
          orbitBy(-0.14, 0);
          break;
        case 'ArrowRight':
          event.preventDefault();
          orbitBy(0.14, 0);
          break;
        case 'ArrowUp':
          event.preventDefault();
          orbitBy(0, 0.12);
          break;
        case 'ArrowDown':
          event.preventDefault();
          orbitBy(0, -0.12);
          break;
        case '+':
        case '=':
          event.preventDefault();
          zoomBy(-0.45);
          break;
        case '-':
        case '_':
          event.preventDefault();
          zoomBy(0.45);
          break;
        case 'r':
        case 'R':
          event.preventDefault();
          reset();
          break;
        case ' ':
        case 'p':
        case 'P':
          event.preventDefault();
          if (!orbit.reducedMotion) setPaused(!state.userPaused);
          break;
      }
    });

    // WebGL context loss resilience -> upgrade seamlessly to Canvas2D fallback
    canvas.addEventListener('webglcontextlost', (event) => {
      event.preventDefault();
      stopLoop();
      if (backend && backend.type === 'webgl2') {
        backend = createCanvas2DBackend(canvas);
        if (backend) {
          backend.syncDynamic(scene);
          if (viewportWrap) viewportWrap.dataset.renderer = 'canvas2d';
          if (rendererBadge) rendererBadge.textContent = 'Canvas 2D';
          renderFrame();
        }
      }
    });
  }

  let resizeObserver = null;
  if (typeof ResizeObserver !== 'undefined' && (viewportWrap || canvas)) {
    resizeObserver = new ResizeObserver(() => {
      if (resizeRaf) return;
      resizeRaf = requestAnimationFrame(() => {
        resizeRaf = 0;
        renderFrame();
      });
    });
    resizeObserver.observe(viewportWrap || canvas);
  }

  const onReduceChange = () => {
    const reduced = Boolean(reduceQuery.matches);
    orbit = {
      ...orbit,
      reducedMotion: reduced,
      paused: reduced || state.userPaused,
      autoOrbit: !(reduced || state.userPaused),
    };
    syncPauseUi();
    if (reduced) {
      stopLoop();
      orbit = stepOrbit(orbit, 0);
      renderFrame();
    } else {
      requestRender();
    }
  };
  reduceQuery.addEventListener?.('change', onReduceChange);

  // Initial sync and draw
  syncUi();
  renderFrame();
  if (!orbit.reducedMotion && !orbit.paused) {
    requestRender();
  }

  return {
    setMode,
    setParam,
    setSolid,
    zoomIn: () => zoomBy(-0.5),
    zoomOut: () => zoomBy(0.5),
    orbitBy,
    reset,
    setPaused,
    getState: () => ({
      ...state,
      renderer: backend ? backend.type : 'svg',
      orbit: { ...orbit },
      classification: scene.classification,
      eccentricity: scene.mode === 'conics' ? classifyConic(state.param, 0.48).eccentricity : null,
    }),
    destroy() {
      stopLoop();
      if (resizeRaf) {
        cancelAnimationFrame(resizeRaf);
        resizeRaf = 0;
      }
      resizeObserver?.disconnect();
      reduceQuery.removeEventListener?.('change', onReduceChange);
      backend?.dispose();
    },
  };
}
