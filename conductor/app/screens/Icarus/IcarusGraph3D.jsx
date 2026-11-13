import React, { useEffect, useMemo, useRef } from 'react';
import { View, Text, Platform, TouchableOpacity } from 'react-native';
import { layoutPlanGraph, STATUS_COLOR } from '../AIManager/planGraphLayout';
import { colors, spacing, typography } from '../../styles/theme';

const EDGE_COLOR = {
  BEFORE: 0x7fc4d8,
  PARALLEL: 0xd4af37,
  MUTEX: 0xc45c26,
  INVALIDATES: 0x6b4c7a,
};

/**
 * Live PlanGraph in 3D (web). Native falls back to a clickable list DAG.
 */
export function IcarusGraph3D({
  subgraph,
  workers = [],
  selectedId,
  onSelect,
  style,
}) {
  const hostRef = useRef(null);
  const layout = useMemo(() => layoutPlanGraph(subgraph || {}), [subgraph]);
  const selectRef = useRef(onSelect);
  const selectedRef = useRef(selectedId);
  useEffect(() => { selectRef.current = onSelect; }, [onSelect]);
  useEffect(() => { selectedRef.current = selectedId; }, [selectedId]);

  useEffect(() => {
    if (Platform.OS !== 'web') return undefined;
    const host = hostRef.current;
    if (!host || typeof window === 'undefined') return undefined;
    let THREE;
    try { THREE = require('three'); } catch { return undefined; }

    let disposed = false;
    let raf = null;
    const width = host.clientWidth || 480;
    const height = host.clientHeight || 320;
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setSize(width, height, false);
    renderer.domElement.style.width = '100%';
    renderer.domElement.style.height = '100%';
    renderer.domElement.style.display = 'block';
    renderer.domElement.style.cursor = 'pointer';
    host.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(42, width / Math.max(height, 1), 0.1, 200);
    camera.position.set(0, 8, 14);
    const look = new THREE.Vector3(0, 0, 0);
    camera.lookAt(look);

    const root = new THREE.Group();
    scene.add(root);
    const pickables = [];

    const scale = 0.035;
    const cx = (layout.width || 320) / 2;
    const cy = (layout.height || 120) / 2;

    (layout.edges || []).forEach((e) => {
      const geo = new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3((e.x1 - cx) * scale, 0.02, (e.y1 - cy) * scale),
        new THREE.Vector3((e.x2 - cx) * scale, 0.02, (e.y2 - cy) * scale),
      ]);
      const line = new THREE.Line(
        geo,
        new THREE.LineBasicMaterial({
          color: EDGE_COLOR[e.type] || 0x555555,
          transparent: true,
          opacity: 0.75,
        }),
      );
      root.add(line);
    });

    (layout.nodes || []).forEach((n) => {
      const status = n.status || 'pending';
      const hex = parseInt(String(STATUS_COLOR[status] || STATUS_COLOR.pending).replace('#', ''), 16);
      const mesh = new THREE.Mesh(
        new THREE.SphereGeometry(status === 'running' ? 0.22 : 0.16, 16, 16),
        new THREE.MeshBasicMaterial({ color: hex }),
      );
      mesh.position.set((n.x - cx) * scale, 0, (n.y - cy) * scale);
      mesh.userData = { node: { ...n, kind: 'task' } };
      root.add(mesh);
      pickables.push(mesh);

      if (status === 'running') {
        const ring = new THREE.Mesh(
          new THREE.RingGeometry(0.28, 0.34, 24),
          new THREE.MeshBasicMaterial({
            color: hex, transparent: true, opacity: 0.45, side: THREE.DoubleSide,
          }),
        );
        ring.rotation.x = -Math.PI / 2;
        ring.position.copy(mesh.position);
        ring.userData = { pulse: true, base: mesh.position.clone() };
        root.add(ring);
      }
    });

    (workers || []).slice(0, 12).forEach((w, i) => {
      const mesh = new THREE.Mesh(
        new THREE.BoxGeometry(0.18, 0.18, 0.18),
        new THREE.MeshBasicMaterial({ color: 0xd4af37 }),
      );
      const a = (i / Math.max(workers.length, 1)) * Math.PI * 2;
      mesh.position.set(Math.cos(a) * 3.2, 0.4, Math.sin(a) * 3.2);
      mesh.userData = {
        node: {
          id: w.id,
          kind: 'worker',
          title: w.persona || w.name || w.role || `Worker ${String(w.id).slice(0, 6)}`,
          status: w.status || 'running',
          ...w,
        },
      };
      root.add(mesh);
      pickables.push(mesh);
    });

    if (subgraph?.plan_id || subgraph?.id) {
      const planMesh = new THREE.Mesh(
        new THREE.OctahedronGeometry(0.28, 0),
        new THREE.MeshBasicMaterial({ color: 0xffffff }),
      );
      planMesh.position.set(0, 0.8, 0);
      planMesh.userData = {
        node: {
          id: subgraph.plan_id || subgraph.id,
          kind: 'plan',
          title: subgraph.title || 'Plan',
          status: subgraph.status || 'running',
        },
      };
      root.add(planMesh);
      pickables.push(planMesh);
    }

    const raycaster = new THREE.Raycaster();
    const pointer = new THREE.Vector2();
    const onClick = (ev) => {
      const rect = renderer.domElement.getBoundingClientRect();
      pointer.x = ((ev.clientX - rect.left) / rect.width) * 2 - 1;
      pointer.y = -((ev.clientY - rect.top) / rect.height) * 2 + 1;
      raycaster.setFromCamera(pointer, camera);
      const hits = raycaster.intersectObjects(pickables, false);
      if (hits[0]?.object?.userData?.node) {
        selectRef.current?.(hits[0].object.userData.node);
      }
    };
    renderer.domElement.addEventListener('click', onClick);

    let drag = false;
    let lastX = 0;
    const onDown = (ev) => { drag = true; lastX = ev.clientX; };
    const onUp = () => { drag = false; };
    const onMove = (ev) => {
      if (!drag) return;
      const dx = (ev.clientX - lastX) * 0.005;
      lastX = ev.clientX;
      root.rotation.y += dx;
    };
    renderer.domElement.addEventListener('pointerdown', onDown);
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointermove', onMove);

    const onResize = () => {
      const w = host.clientWidth || width;
      const h = host.clientHeight || height;
      camera.aspect = w / Math.max(h, 1);
      camera.updateProjectionMatrix();
      renderer.setSize(w, h, false);
    };
    window.addEventListener('resize', onResize);
    let ro;
    if (typeof ResizeObserver !== 'undefined') {
      ro = new ResizeObserver(onResize);
      ro.observe(host);
    }

    const tick = (t) => {
      if (disposed) return;
      root.children.forEach((ch) => {
        if (ch.userData?.pulse) {
          const s = 1 + Math.sin(t * 0.004) * 0.12;
          ch.scale.setScalar(s);
        }
        if (selectedRef.current && ch.userData?.node?.id === selectedRef.current) {
          ch.scale.setScalar(1.35);
        }
      });
      root.rotation.y += 0.0012;
      renderer.render(scene, camera);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);

    return () => {
      disposed = true;
      if (raf) cancelAnimationFrame(raf);
      renderer.domElement.removeEventListener('click', onClick);
      renderer.domElement.removeEventListener('pointerdown', onDown);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('resize', onResize);
      ro?.disconnect?.();
      renderer.dispose();
      if (renderer.domElement.parentNode === host) host.removeChild(renderer.domElement);
    };
  }, [layout, workers, subgraph?.plan_id, subgraph?.id, subgraph?.title, subgraph?.status]);

  if (Platform.OS !== 'web') {
    return (
      <View style={[{ padding: spacing.sm }, style]}>
        <Text style={typography.caption}>Plan graph</Text>
        {(layout.nodes || []).map((n) => (
          <TouchableOpacity key={n.id} onPress={() => onSelect?.({ ...n, kind: 'task' })} style={{ paddingVertical: 6 }}>
            <Text style={{ color: STATUS_COLOR[n.status] || colors.textPrimary }}>
              {n.title || n.id} · {n.status}
            </Text>
          </TouchableOpacity>
        ))}
        {!layout.nodes?.length ? (
          <Text style={typography.caption}>No live plan yet — ask Icarus to do work.</Text>
        ) : null}
      </View>
    );
  }

  return (
    <View style={[{ flex: 1, minHeight: 280, backgroundColor: '#0c0c0c', borderRadius: 8, overflow: 'hidden' }, style]}>
      <View ref={hostRef} style={{ flex: 1, minHeight: 280 }} />
      <View style={{
        position: 'absolute', bottom: 8, left: 8, right: 8, flexDirection: 'row', flexWrap: 'wrap', gap: 8,
      }}
      >
        {['BEFORE', 'PARALLEL', 'MUTEX'].map((k) => (
          <Text key={k} style={{ color: '#aaa', fontSize: 10 }}>{k}</Text>
        ))}
      </View>
    </View>
  );
}

export default IcarusGraph3D;
