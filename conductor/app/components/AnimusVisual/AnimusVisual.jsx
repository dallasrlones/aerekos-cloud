import React, { useEffect, useRef } from 'react';
import { View, Platform } from 'react-native';

/**
 * AnimusVisual — a real-time "solar system captured in an Animus" view of a
 * device's live resources (web only, Three.js).
 *
 *   - RAM   -> a fixed wireframe "cage" (= 100% capacity) with a SOLID sun inside
 *              that fills the cage in proportion to usage; particles stream outside.
 *   - CPU   -> a single connected ring of icy particles; each core raises the
 *              HEIGHT of its slice. The "CPU" label follows the first core (C0).
 *   - Storage -> the original segmented block ring; the used fraction glows gold.
 *   - Disk  -> a ring that ORBITS the sun and reacts to read/write throughput
 *              (widens + heats like the CPU ring), drawn in front of the CPU ring.
 *   - CPU/RAM heat toward red above 80% usage (deep red at 100%).
 *   - A faint wireframe field frames the whole system.
 *
 * Fast: one rAF loop, no per-frame React renders, capped DPR, auto-pauses hidden.
 */
const GOLD = 0xd4af37;
const STRUCT_LIGHT = 0x2c2c2c;
const STRUCT_DARK = 0x8a93a0;
const ICE_LOW = 0x7fc4d8;
const ICE_HOT = 0xeafcff;

export const AnimusVisual = ({ data, cores = 8, style, isDark = false }) => {
  const STRUCT = isDark ? STRUCT_DARK : STRUCT_LIGHT;
  const hostRef = useRef(null);
  const dataRef = useRef(data);
  const coresRef = useRef(cores);
  const sceneRef = useRef(null);

  useEffect(() => { dataRef.current = data; }, [data]);

  useEffect(() => {
    if (coresRef.current !== cores && sceneRef.current?.rebuildCores) {
      coresRef.current = cores;
      sceneRef.current.rebuildCores(cores);
    }
  }, [cores]);

  useEffect(() => {
    if (Platform.OS !== 'web') return undefined;
    const host = hostRef.current;
    if (!host || typeof window === 'undefined') return undefined;

    let THREE;
    try {
      THREE = require('three');
    } catch (e) {
      return undefined;
    }

    let disposed = false;
    let raf = null;

    const width = host.clientWidth || 640;
    const height = host.clientHeight || 480;

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setSize(width, height, false);
    renderer.domElement.style.width = '100%';
    renderer.domElement.style.height = '100%';
    renderer.domElement.style.display = 'block';
    host.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(46, width / height, 0.1, 100);
    camera.position.set(0, 4.0, 8.8);
    const CENTER = new THREE.Vector3(0, 1.3, 0);
    camera.lookAt(CENTER);

    const root = new THREE.Group();
    scene.add(root);

    const colStruct = new THREE.Color(STRUCT);
    const colGold = new THREE.Color(GOLD);
    const tmpColor = new THREE.Color();
    const lerp = (a, b, t) => a + (b - a) * t;

    // Danger thresholds: nothing changes until 80% usage, then the element heats
    // toward red, reaching deep "red red" at 100%. Mutates `col` in place.
    const HOT_RED = new THREE.Color(0xff4d3a);
    const DEEP_RED = new THREE.Color(0x8b0f06);
    const dangerTint = (col, u) => {
      if (u <= 0.8) return col;
      const k = (u - 0.8) / 0.2;            // 0 at 80% -> 1 at 100%
      col.lerp(HOT_RED, Math.min(1, k * 2)); // fully red by ~90%
      col.lerp(DEEP_RED, k);                 // then deepen toward 100%
      return col;
    };

    // --- Screen-filling Animus mesh (one big wireframe shell around the camera) -
    const field = new THREE.LineSegments(
      new THREE.WireframeGeometry(new THREE.IcosahedronGeometry(16, 3)),
      new THREE.LineBasicMaterial({ color: colStruct, transparent: true, opacity: 0.05 })
    );
    field.position.copy(CENTER);
    root.add(field);

    const baseGroup = new THREE.Group();
    baseGroup.rotation.x = -Math.PI / 2;
    baseGroup.position.y = 0.02;
    root.add(baseGroup);
    const gridMat = new THREE.LineBasicMaterial({ color: colStruct, transparent: true, opacity: 0.06 });
    for (let r = 1; r <= 4; r++) {
      const pts = [];
      for (let i = 0; i <= 96; i++) {
        const a = (i / 96) * Math.PI * 2;
        pts.push(new THREE.Vector3(Math.cos(a) * (r * 1.05), Math.sin(a) * (r * 1.05), 0));
      }
      baseGroup.add(new THREE.LineLoop(new THREE.BufferGeometry().setFromPoints(pts), gridMat));
    }

    // High-res so the type stays crisp; wide aspect leaves room for tracking.
    const LABEL_W = 640;
    const LABEL_H = 192;
    const makeLabel = () => {
      const canvas = document.createElement('canvas');
      canvas.width = LABEL_W;
      canvas.height = LABEL_H;
      const ctx = canvas.getContext('2d');
      const texture = new THREE.CanvasTexture(canvas);
      texture.minFilter = THREE.LinearFilter;
      texture.generateMipmaps = false;
      const mat = new THREE.SpriteMaterial({ map: texture, transparent: true, depthTest: false, depthWrite: false });
      const sprite = new THREE.Sprite(mat);
      sprite.renderOrder = 20;
      return { canvas, ctx, texture, sprite };
    };
    // Clean, professional HUD type: uppercase monospace with wide tracking and a
    // soft shadow for legibility (no cartoon outline).
    const drawWord = (lbl, word, color, size) => {
      const { ctx, canvas, texture } = lbl;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.font = `600 ${size}px ui-monospace, "SF Mono", Menlo, Consolas, monospace`;
      try { ctx.letterSpacing = `${Math.round(size * 0.22)}px`; } catch (e) { /* older canvas */ }
      ctx.shadowColor = 'rgba(20,16,4,0.35)';
      ctx.shadowBlur = Math.round(size * 0.22);
      ctx.shadowOffsetY = 1;
      ctx.fillStyle = color;
      // nudge left by half the trailing tracking so it stays optically centred
      ctx.fillText(word, canvas.width / 2 - Math.round(size * 0.11), canvas.height / 2);
      texture.needsUpdate = true;
    };

    // --- RAM: fixed cage (100%) + solid sun that fills it ----------------------
    const RAM_FULL_RADIUS = 1.7;
    const ramCage = new THREE.LineSegments(
      new THREE.WireframeGeometry(new THREE.IcosahedronGeometry(RAM_FULL_RADIUS, 1)),
      new THREE.LineBasicMaterial({ color: colStruct, transparent: true, opacity: 0.3 })
    );
    ramCage.position.copy(CENTER);
    root.add(ramCage);

    // Soft radial glow texture (white-hot core -> gold -> transparent).
    const makeGlowTexture = (stops) => {
      const c = document.createElement('canvas');
      c.width = 256; c.height = 256;
      const g = c.getContext('2d');
      const grad = g.createRadialGradient(128, 128, 0, 128, 128, 128);
      stops.forEach(([o, col]) => grad.addColorStop(o, col));
      g.fillStyle = grad;
      g.fillRect(0, 0, 256, 256);
      const tx = new THREE.CanvasTexture(c);
      tx.minFilter = THREE.LinearFilter;
      return tx;
    };

    // Bright opaque core (writes depth so the ring passes in front/behind it).
    const sun = new THREE.Mesh(
      new THREE.SphereGeometry(1, 32, 32),
      new THREE.MeshBasicMaterial({ color: new THREE.Color(0xfff1c4) })
    );
    sun.position.copy(CENTER);
    sun.scale.setScalar(0.3);
    root.add(sun);

    // Glowing corona bloom (additive sprite that scales with the sun).
    const sunGlow = new THREE.Sprite(new THREE.SpriteMaterial({
      map: makeGlowTexture([[0, 'rgba(255,244,214,0.95)'], [0.25, 'rgba(255,196,77,0.7)'], [0.55, 'rgba(232,140,30,0.28)'], [1, 'rgba(232,140,30,0)']]),
      transparent: true, blending: THREE.AdditiveBlending, depthWrite: false,
    }));
    sunGlow.position.copy(CENTER);
    sunGlow.renderOrder = 2;
    root.add(sunGlow);

    // Photosphere: dense particles on the sun's surface, flickering like fire.
    const SURF_COUNT = 2200;
    const surfDir = new Float32Array(SURF_COUNT * 3);
    const surfPhase = new Float32Array(SURF_COUNT);
    const surfSpeed = new Float32Array(SURF_COUNT);
    const surfPos = new Float32Array(SURF_COUNT * 3);
    const surfCol = new Float32Array(SURF_COUNT * 3);
    const sunHot = new THREE.Color(0xfff6d8);
    const sunMid = new THREE.Color(0xffc14d);
    const sunLow = new THREE.Color(0xe8730f);
    for (let i = 0; i < SURF_COUNT; i++) {
      const u = Math.random() * 2 - 1;
      const th = Math.random() * Math.PI * 2;
      const r = Math.sqrt(1 - u * u);
      surfDir[i * 3] = r * Math.cos(th);
      surfDir[i * 3 + 1] = u;
      surfDir[i * 3 + 2] = r * Math.sin(th);
      surfPhase[i] = Math.random() * Math.PI * 2;
      surfSpeed[i] = 1.5 + Math.random() * 3.0;
      const m = Math.random();
      tmpColor.copy(m < 0.45 ? sunHot : m < 0.8 ? sunMid : sunLow);
      surfCol[i * 3] = tmpColor.r; surfCol[i * 3 + 1] = tmpColor.g; surfCol[i * 3 + 2] = tmpColor.b;
    }
    const surfGeom = new THREE.BufferGeometry();
    surfGeom.setAttribute('position', new THREE.BufferAttribute(surfPos, 3));
    surfGeom.setAttribute('color', new THREE.BufferAttribute(surfCol, 3));
    const surfMat = new THREE.PointsMaterial({ size: 0.08, transparent: true, opacity: 0.95, depthWrite: false, vertexColors: true, blending: THREE.AdditiveBlending });
    root.add(new THREE.Points(surfGeom, surfMat));

    const ramState = { current: 0.3, target: 0.3 };

    const ramLabel = makeLabel();
    ramLabel.sprite.scale.set(2.0, 0.6, 1);
    ramLabel.sprite.position.copy(CENTER);
    ramLabel.sprite.renderOrder = 25;
    root.add(ramLabel.sprite);
    drawWord(ramLabel, 'RAM', '#6B5612', 72);

    // --- RAM corona particles (a sun's halo, CONTAINED inside the cage) --------
    // Each particle sits at a fixed direction + radius factor; at render time its
    // radius is mapped into the gap between the solid sun's surface and the cage,
    // so nothing ever escapes the cage. More RAM -> more visible particles.
    const EMIT_COUNT = 320;
    const emDir = new Float32Array(EMIT_COUNT * 3);
    const emRF = new Float32Array(EMIT_COUNT);
    const emPhase = new Float32Array(EMIT_COUNT);
    const emSpeed = new Float32Array(EMIT_COUNT);
    const emPos = new Float32Array(EMIT_COUNT * 3);
    for (let i = 0; i < EMIT_COUNT; i++) {
      const u = Math.random() * 2 - 1;
      const th = Math.random() * Math.PI * 2;
      const r = Math.sqrt(1 - u * u);
      emDir[i * 3] = r * Math.cos(th);
      emDir[i * 3 + 1] = u;
      emDir[i * 3 + 2] = r * Math.sin(th);
      emRF[i] = Math.random();
      emPhase[i] = Math.random() * Math.PI * 2;
      emSpeed[i] = 0.6 + Math.random() * 1.1;
      emPos[i * 3 + 1] = -9999;
    }
    const emGeom = new THREE.BufferGeometry();
    emGeom.setAttribute('position', new THREE.BufferAttribute(emPos, 3));
    const emMat = new THREE.PointsMaterial({ color: new THREE.Color(0xffb733), size: 0.07, transparent: true, opacity: 0.85, depthWrite: false, blending: THREE.AdditiveBlending });
    // Child of root so the corona drifts with the system.
    root.add(new THREE.Points(emGeom, emMat));

    // --- CPU ring: a flat ring made of the SAME glowing, flickering particle
    // material as the sun's photosphere. Each core owns an angular wedge; a busy
    // core's wedge grows WIDER outward (inner edge fixed) and goes white-hot.
    const RING_INNER = 2.55;
    const RING_MIN_W = 0.18;      // delicate width when a core is idle
    const RING_W = 1.15;          // extra outward width at full load
    // Ring ANGLE is locked at a fixed, open, diagonal tilt. Parented to the scene
    // (not root) so the slow whole-system drift can't change the angle. iceSpin
    // still rotates inside this fixed plane, so the ring orbits the sun.
    const iceTilt = new THREE.Group();
    iceTilt.position.copy(CENTER);
    iceTilt.rotation.order = 'ZXY';
    iceTilt.rotation.x = 0.72;   // open tilt
    iceTilt.rotation.z = -0.42;  // diagonal roll (upper-left -> lower-right)
    iceTilt.rotation.y = 0.0;
    scene.add(iceTilt);
    const iceSpin = new THREE.Group();
    iceTilt.add(iceSpin);

    // Match the sun: warm gold idle -> white-hot as a core loads up.
    const coolColor = new THREE.Color(0xffbf45);  // idle core (sun gold)
    const hotColor = new THREE.Color(0xfff6d8);    // maxed core (white-hot)

    const RING_P = 6000;
    const ringCosA = new Float32Array(RING_P);
    const ringSinA = new Float32Array(RING_P);
    const ringTheta = new Float32Array(RING_P);
    const ringRF = new Float32Array(RING_P);
    const ringPhase = new Float32Array(RING_P);
    const ringSpeed = new Float32Array(RING_P);
    const ringYJ = new Float32Array(RING_P);
    const ringSecArr = new Int32Array(RING_P);
    const ringPos = new Float32Array(RING_P * 3);
    const ringCol = new Float32Array(RING_P * 3);
    for (let i = 0; i < RING_P; i++) {
      const th = Math.random() * Math.PI * 2;
      ringTheta[i] = th;
      ringCosA[i] = Math.cos(th);
      ringSinA[i] = Math.sin(th);
      ringRF[i] = Math.random();
      ringPhase[i] = Math.random() * Math.PI * 2;
      ringSpeed[i] = 1.5 + Math.random() * 3.0;
      ringYJ[i] = (Math.random() - 0.5) * 0.05;  // thin, flat profile
      ringPos[i * 3 + 1] = -9999;
    }
    const ringGeom = new THREE.BufferGeometry();
    ringGeom.setAttribute('position', new THREE.BufferAttribute(ringPos, 3));
    ringGeom.setAttribute('color', new THREE.BufferAttribute(ringCol, 3));
    const ringMat = new THREE.PointsMaterial({ size: 0.085, transparent: true, opacity: 0.95, depthWrite: false, vertexColors: true, blending: THREE.AdditiveBlending });
    const ringPoints = new THREE.Points(ringGeom, ringMat);
    ringPoints.renderOrder = 4;   // CPU ring draws behind the disk ring
    iceSpin.add(ringPoints);

    let secCur = [];
    let secTar = [];
    const buildCores = (n) => {
      const count = Math.max(1, Math.min(n || 1, 64));
      secCur = new Array(count).fill(0);
      secTar = new Array(count).fill(0);
      for (let i = 0; i < RING_P; i++) {
        ringSecArr[i] = Math.min(count - 1, Math.floor((ringTheta[i] / (Math.PI * 2)) * count));
      }
    };
    buildCores(coresRef.current);

    // CPU label rides just above the first core's segment.
    const cpuLabel = makeLabel();
    cpuLabel.sprite.scale.set(1.8, 0.54, 1);
    cpuLabel.sprite.renderOrder = 22;
    iceSpin.add(cpuLabel.sprite);
    drawWord(cpuLabel, 'CPU', '#6B5612', 64);

    // --- Storage: segmented block ring (used fraction = gold) ------------------
    // (Original storage ring — left exactly as designed.)
    const storageGroup = new THREE.Group();
    storageGroup.rotation.x = -Math.PI / 2;
    storageGroup.position.y = 0.04;
    root.add(storageGroup);
    const storageSegs = 64;
    const storageSegMats = [];
    const storageGeom = new THREE.BoxGeometry(0.22, 0.05, 0.06);
    for (let i = 0; i < storageSegs; i++) {
      const a = (i / storageSegs) * Math.PI * 2;
      const mat = new THREE.MeshBasicMaterial({ color: colStruct.clone(), transparent: true, opacity: 0.16 });
      const mesh = new THREE.Mesh(storageGeom, mat);
      mesh.position.set(Math.cos(a) * 4.0, Math.sin(a) * 4.0, 0);
      mesh.rotation.z = a + Math.PI / 2;
      storageGroup.add(mesh);
      storageSegMats.push(mat);
    }
    const storageState = { current: 0, target: 0 };

    // --- Disk: a NEW glowing usage ring that ORBITS the sun (its own tilt + spin,
    // distinct from both the CPU ring and the flat storage ring). The used
    // fraction of the ring lights up gold; the remainder stays dim.
    const diskTilt = new THREE.Group();
    diskTilt.position.copy(CENTER);
    diskTilt.rotation.order = 'ZXY';
    diskTilt.rotation.x = -0.6;   // tilts the opposite way from the CPU ring
    diskTilt.rotation.z = 0.55;
    scene.add(diskTilt);
    const diskSpin = new THREE.Group();
    diskTilt.add(diskSpin);
    // Behaves like the CPU ring: a thin glowing band whose WIDTH + heat react to
    // read/write throughput (idle = thin gold, busy = wide white-hot).
    const DISK_INNER = 4.25;
    const DISK_MIN_W = 0.12;     // delicate width when the disk is idle
    const DISK_RANGE = 0.95;     // extra outward width at peak read/write
    const DISK_P = 4200;
    const diskCosA = new Float32Array(DISK_P);
    const diskSinA = new Float32Array(DISK_P);
    const diskRF = new Float32Array(DISK_P);
    const diskPhase = new Float32Array(DISK_P);
    const diskSpeed = new Float32Array(DISK_P);
    const diskYJ = new Float32Array(DISK_P);
    const diskPos = new Float32Array(DISK_P * 3);
    const diskCol = new Float32Array(DISK_P * 3);
    for (let i = 0; i < DISK_P; i++) {
      const th = Math.random() * Math.PI * 2;
      diskCosA[i] = Math.cos(th);
      diskSinA[i] = Math.sin(th);
      diskRF[i] = Math.random();
      diskPhase[i] = Math.random() * Math.PI * 2;
      diskSpeed[i] = 1.2 + Math.random() * 2.5;
      diskYJ[i] = (Math.random() - 0.5) * 0.05;  // thin, flat profile within its plane
    }
    const diskGeom = new THREE.BufferGeometry();
    diskGeom.setAttribute('position', new THREE.BufferAttribute(diskPos, 3));
    diskGeom.setAttribute('color', new THREE.BufferAttribute(diskCol, 3));
    const diskMat = new THREE.PointsMaterial({ size: 0.085, transparent: true, opacity: 0.95, depthWrite: false, vertexColors: true, blending: THREE.AdditiveBlending });
    const diskPoints = new THREE.Points(diskGeom, diskMat);
    diskPoints.renderOrder = 8;   // draw the disk ring IN FRONT of the CPU ring
    diskSpin.add(diskPoints);
    const diskState = { current: 0, target: 0 };

    // DISK label rides on the ring and orbits the sun with it.
    const diskLabel = makeLabel();
    diskLabel.sprite.scale.set(1.7, 0.5, 1);
    diskLabel.sprite.position.set(0, 0.18, DISK_INNER - 0.45);
    diskLabel.sprite.renderOrder = 22;
    diskSpin.add(diskLabel.sprite);
    drawWord(diskLabel, 'DISK', '#6B5612', 60);

    // --- Live targets ----------------------------------------------------------
    // Overall CPU load drives the ring's red "danger" tint (per-core load still
    // drives each wedge's width independently).
    const cpuState = { current: 0, target: 0 };
    const sunBaseColor = new THREE.Color(0xfff1c4);
    const coronaBaseColor = new THREE.Color(0xffb733);
    sceneRef.current = { rebuildCores: buildCores };
    const applyTargets = () => {
      const d = dataRef.current || {};
      const cpu = d.cpu || {};
      const ram = d.ram || {};
      const disk = d.disk || {};
      const perCore = Array.isArray(cpu.perCore) ? cpu.perCore : [];
      const overall = parseFloat(cpu.usagePercent || cpu.usage || 0) / 100;
      cpuState.target = Math.max(0, Math.min(1, overall));
      for (let s = 0; s < secTar.length; s++) {
        const u = perCore[s] ? parseFloat(perCore[s].usagePercent || perCore[s].usage || 0) / 100 : overall;
        secTar[s] = Math.max(0, Math.min(1, u));
      }
      ramState.target = Math.max(0, Math.min(1, parseFloat(ram.usagePercent || 0) / 100));
      // Storage block ring = how full the disk is (capacity used).
      storageState.target = Math.max(0, Math.min(1, parseFloat(disk.usagePercent || 0) / 100));
      // Disk ring = live read/write THROUGHPUT (like the CPU ring reacts to load).
      // sqrt curve so even modest I/O is visible; ~100 MB/s reads as full width.
      const io = parseFloat(disk.read_bytes_per_sec || 0) + parseFloat(disk.write_bytes_per_sec || 0);
      diskState.target = Math.max(0, Math.min(1, Math.sqrt(io / (100 * 1024 * 1024))));
    };

    const clock = new THREE.Clock();
    const render = () => {
      if (disposed) return;
      const dt = Math.min(clock.getDelta(), 0.05);
      const t = clock.elapsedTime;
      applyTargets();

      // Gentle whole-system drift; ring + disk get their OWN spins below so they
      // clearly rotate differently from each other.
      root.rotation.y += dt * 0.03;
      baseGroup.rotation.z += dt * 0.03;
      field.rotation.y -= dt * 0.04;
      field.rotation.x += dt * 0.02;
      ramCage.rotation.y += dt * 0.1;
      iceSpin.rotation.y += dt * 0.18;        // CPU ring orbits around the sun (angle stays locked)
      storageGroup.rotation.z -= dt * 0.09;   // storage block ring: slow rotation
      diskSpin.rotation.y += dt * 0.12;        // disk usage ring orbits the sun (its own tilted plane)

      // RAM: glowing star whose size reads usage; the cage is the fixed 100% bound.
      ramState.current = lerp(ramState.current, ramState.target, 0.08);
      const pulse = 1 + Math.sin(t * 2.0) * 0.03;
      // Sun radius is DIRECTLY proportional to RAM usage: at 100% it fills the
      // cage (the fixed 100% boundary); a small floor keeps it visible when idle.
      const sunRadius = RAM_FULL_RADIUS * Math.max(0.08, ramState.current) * pulse;
      sun.scale.setScalar(sunRadius);
      sunGlow.scale.setScalar(sunRadius * 3.6 + 0.4);
      sunGlow.material.opacity = 0.55 + 0.12 * Math.sin(t * 1.7);

      // RAM danger: heat the whole star toward red past 80% usage.
      sun.material.color.copy(sunBaseColor); dangerTint(sun.material.color, ramState.current);
      sunGlow.material.color.setRGB(1, 1, 1); dangerTint(sunGlow.material.color, ramState.current);
      surfMat.color.setRGB(1, 1, 1); dangerTint(surfMat.color, ramState.current);
      emMat.color.copy(coronaBaseColor); dangerTint(emMat.color, ramState.current);

      // Photosphere: flicker each surface particle's radius for a roiling-fire look.
      const sp = surfGeom.attributes.position.array;
      for (let i = 0; i < SURF_COUNT; i++) {
        const rr = sunRadius * (0.98 + Math.sin(t * surfSpeed[i] + surfPhase[i]) * 0.05);
        sp[i * 3] = CENTER.x + surfDir[i * 3] * rr;
        sp[i * 3 + 1] = CENTER.y + surfDir[i * 3 + 1] * rr;
        sp[i * 3 + 2] = CENTER.z + surfDir[i * 3 + 2] * rr;
      }
      surfGeom.attributes.position.needsUpdate = true;

      // Corona / prominences: contained between the sun surface and the cage.
      const activeCount = Math.round((0.06 + 0.94 * ramState.target) * EMIT_COUNT);
      const innerR = sunRadius * 0.96;
      const span = Math.max(0.05, RAM_FULL_RADIUS * 0.97 - innerR);
      const ep = emGeom.attributes.position.array;
      for (let i = 0; i < EMIT_COUNT; i++) {
        if (i < activeCount) {
          const shimmer = Math.sin(t * emSpeed[i] + emPhase[i]) * 0.04;
          const rr = innerR + emRF[i] * span + shimmer;
          ep[i * 3] = CENTER.x + emDir[i * 3] * rr;
          ep[i * 3 + 1] = CENTER.y + emDir[i * 3 + 1] * rr;
          ep[i * 3 + 2] = CENTER.z + emDir[i * 3 + 2] * rr;
        } else {
          ep[i * 3 + 1] = -9999;
        }
      }
      emGeom.attributes.position.needsUpdate = true;

      // CPU ring: glowing flickering particles (same as the sun). A core's wedge
      // grows WIDER outward with usage and heats from gold toward white-hot.
      for (let s = 0; s < secCur.length; s++) {
        secCur[s] = lerp(secCur[s], secTar[s], 0.16);
      }
      cpuState.current = lerp(cpuState.current, cpuState.target, 0.12);
      const rp = ringGeom.attributes.position.array;
      const rc = ringGeom.attributes.color.array;
      for (let i = 0; i < RING_P; i++) {
        const u = secCur[ringSecArr[i]];
        const width = RING_MIN_W + u * RING_W;
        const flick = Math.sin(t * ringSpeed[i] + ringPhase[i]) * 0.03;
        const r = RING_INNER + ringRF[i] * width + flick;
        rp[i * 3] = ringCosA[i] * r;
        rp[i * 3 + 1] = ringYJ[i];
        rp[i * 3 + 2] = ringSinA[i] * r;
        const br = 0.7 + 0.3 * Math.sin(t * ringSpeed[i] * 0.7 + ringPhase[i]);  // twinkle
        // Per-core load: gold -> white-hot. Overall CPU >80%: heat toward red.
        tmpColor.copy(coolColor).lerp(hotColor, u);
        dangerTint(tmpColor, cpuState.current);
        rc[i * 3] = tmpColor.r * br;
        rc[i * 3 + 1] = tmpColor.g * br;
        rc[i * 3 + 2] = tmpColor.b * br;
      }
      ringGeom.attributes.position.needsUpdate = true;
      ringGeom.attributes.color.needsUpdate = true;

      // CPU label rides just above core 0's wedge.
      const count = secCur.length;
      const c0 = (0.5 / count) * Math.PI * 2;
      const labelR = RING_INNER - 0.55;  // tuck the label on the inner side of the ring
      cpuLabel.sprite.position.set(Math.cos(c0) * labelR, 0.18, Math.sin(c0) * labelR);

      // Storage block ring (used fraction gold) — original behaviour.
      storageState.current = lerp(storageState.current, storageState.target, 0.08);
      const storageFilled = Math.round(storageState.current * storageSegs);
      for (let i = 0; i < storageSegs; i++) {
        const on = i < storageFilled;
        storageSegMats[i].color.copy(on ? colGold : colStruct);
        storageSegMats[i].opacity = on ? 0.85 : 0.14;
      }

      // Disk ring: glowing flickering particles (same as the CPU ring). The whole
      // band widens outward and heats gold -> white-hot with read/write activity.
      diskState.current = lerp(diskState.current, diskState.target, 0.16);
      const diskU = diskState.current;
      const diskWidth = DISK_MIN_W + diskU * DISK_RANGE;
      const dp = diskGeom.attributes.position.array;
      const dc = diskGeom.attributes.color.array;
      for (let i = 0; i < DISK_P; i++) {
        const flick = Math.sin(t * diskSpeed[i] + diskPhase[i]) * 0.03;
        const r = DISK_INNER + diskRF[i] * diskWidth + flick;
        dp[i * 3] = diskCosA[i] * r;
        dp[i * 3 + 1] = diskYJ[i];
        dp[i * 3 + 2] = diskSinA[i] * r;
        const br = 0.7 + 0.3 * Math.sin(t * diskSpeed[i] * 0.7 + diskPhase[i]);
        tmpColor.copy(coolColor).lerp(hotColor, diskU);
        dc[i * 3] = tmpColor.r * br;
        dc[i * 3 + 1] = tmpColor.g * br;
        dc[i * 3 + 2] = tmpColor.b * br;
      }
      diskGeom.attributes.position.needsUpdate = true;
      diskGeom.attributes.color.needsUpdate = true;

      // Camera drift
      camera.position.x = Math.sin(t * 0.15) * 0.7;
      camera.position.y = 4.0 + Math.sin(t * 0.26) * 0.16;
      camera.lookAt(CENTER);

      renderer.render(scene, camera);
      raf = requestAnimationFrame(render);
    };
    raf = requestAnimationFrame(render);

    const onVisibility = () => {
      if (document.hidden) {
        if (raf) cancelAnimationFrame(raf);
        raf = null;
      } else if (!raf && !disposed) {
        clock.getDelta();
        raf = requestAnimationFrame(render);
      }
    };
    document.addEventListener('visibilitychange', onVisibility);

    let ro = null;
    if (typeof ResizeObserver !== 'undefined') {
      ro = new ResizeObserver(() => {
        const w = host.clientWidth || width;
        const h = host.clientHeight || height;
        renderer.setSize(w, h, false);
        camera.aspect = w / h;
        camera.updateProjectionMatrix();
      });
      ro.observe(host);
    }

    return () => {
      disposed = true;
      if (raf) cancelAnimationFrame(raf);
      document.removeEventListener('visibilitychange', onVisibility);
      if (ro) ro.disconnect();
      sceneRef.current = null;
      try {
        renderer.dispose();
        scene.traverse((o) => {
          if (o.geometry) o.geometry.dispose();
          if (o.material) {
            const mats = Array.isArray(o.material) ? o.material : [o.material];
            mats.forEach((mm) => { if (mm.map) mm.map.dispose(); mm.dispose(); });
          }
        });
        if (renderer.domElement && renderer.domElement.parentNode === host) {
          host.removeChild(renderer.domElement);
        }
      } catch (e) {
        /* noop */
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return <View ref={hostRef} style={style} />;
};

export default AnimusVisual;
