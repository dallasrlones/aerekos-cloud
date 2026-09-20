import React, { useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, Platform, TouchableOpacity } from 'react-native';
import { colors } from '../../styles/theme';
import { llmPhase } from '../../utils/icarusThink';
import { AIManagerStyles as S } from './AIManager.styles';

/**
 * Icarus shop orbits (web only, Three.js). Sun = user, inner = manager, outer = workers.
 * One rAF, gold/ice/heat. Does not reuse AnimusVisual.
 */
const GOLD = 0xd4af37;
const ICE = 0x7fc4d8;
const HEAT = 0xc23b22;
const STRUCT = 0x2c2c2c;

const HUD_COLOR = {
  called: '#d4af37',
  waiting: '#7fc4d8',
  done: colors.textMuted || '#8a8a8a',
};

export function IcarusVisual({ pulse, stream, timeline = [], onSelect, style }) {
  const hostRef = useRef(null);
  const pulseRef = useRef(pulse);
  const streamRef = useRef(stream);
  const [cursor, setCursor] = useState(null);
  const shown = useMemo(() => {
    if (cursor == null) return timeline;
    return timeline.slice(0, cursor + 1);
  }, [timeline, cursor]);
  const hud = llmPhase(stream, pulse?.gateway);

  useEffect(() => { pulseRef.current = pulse; }, [pulse]);
  useEffect(() => { streamRef.current = stream; }, [stream]);

  useEffect(() => {
    if (Platform.OS !== 'web') return undefined;
    const host = hostRef.current;
    if (!host || typeof window === 'undefined') return undefined;
    let THREE;
    try { THREE = require('three'); } catch { return undefined; }

    let disposed = false;
    let raf = null;
    const width = host.clientWidth || 640;
    const height = host.clientHeight || 200;
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setSize(width, height, false);
    renderer.domElement.style.width = '100%';
    renderer.domElement.style.height = '100%';
    renderer.domElement.style.display = 'block';
    host.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(40, width / Math.max(height, 1), 0.1, 80);
    camera.position.set(0, 2.1, 8.6);
    const CENTER = new THREE.Vector3(0, 0.25, 0);
    camera.lookAt(CENTER);
    const root = new THREE.Group();
    scene.add(root);

    const sun = new THREE.Mesh(
      new THREE.SphereGeometry(0.34, 24, 24),
      new THREE.MeshBasicMaterial({ color: GOLD }),
    );
    sun.position.copy(CENTER);
    root.add(sun);

    const field = new THREE.Mesh(
      new THREE.SphereGeometry(2.45, 16, 12),
      new THREE.MeshBasicMaterial({ color: STRUCT, wireframe: true, transparent: true, opacity: 0.18 }),
    );
    field.position.copy(CENTER);
    root.add(field);

    const inner = [];
    const outer = [];
    const mkMoon = (r, color) => {
      const m = new THREE.Mesh(
        new THREE.SphereGeometry(0.1, 12, 12),
        new THREE.MeshBasicMaterial({ color }),
      );
      root.add(m);
      return { mesh: m, r, a: Math.random() * Math.PI * 2, color };
    };
    for (let i = 0; i < 4; i += 1) inner.push(mkMoon(1.05, ICE));
    for (let i = 0; i < 8; i += 1) outer.push(mkMoon(1.85, GOLD));

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
      const p = pulseRef.current || {};
      const asking = (p.open_asks || []).length > 0;
      const phase = llmPhase(streamRef.current, p.gateway).phase;
      const thinking = phase === 'called' || phase === 'waiting';
      const owner = (p.gateway?.in_flight || [])[0]?.lane || '';
      sun.material.color.setHex(asking ? HEAT : thinking ? ICE : GOLD);
      sun.scale.setScalar(thinking ? 1.18 : 1);
      field.material.opacity = owner || thinking ? 0.32 : 0.16;
      const goals = (p.work || []).filter((w) => w.kind === 'goal');
      inner.forEach((m, i) => {
        m.a += 0.008;
        const g = goals[i];
        m.mesh.visible = !g || g.status !== 'done';
        m.mesh.material.color.setHex(g?.status === 'running' ? GOLD : ICE);
        m.mesh.position.set(CENTER.x + Math.cos(m.a) * m.r, CENTER.y, CENTER.z + Math.sin(m.a) * m.r);
      });
      const workers = p.workers || [];
      outer.forEach((m, i) => {
        m.a += 0.012;
        const w = workers[i];
        m.mesh.visible = i < Math.max(workers.length, 2);
        const heat = w?.status === 'waiting_ask';
        const pulseOn = w?.status === 'running';
        m.mesh.material.color.setHex(heat ? HEAT : pulseOn ? GOLD : ICE);
        const rr = m.r + (pulseOn ? 0.08 : 0);
        m.mesh.position.set(CENTER.x + Math.cos(m.a + i) * rr, CENTER.y + (heat ? 0.12 : 0), CENTER.z + Math.sin(m.a + i) * rr);
      });
      root.rotation.y = t * 0.00008;
      renderer.render(scene, camera);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);

    const vis = () => {
      if (document.hidden) {
        if (raf) cancelAnimationFrame(raf);
        raf = null;
      } else if (!raf) raf = requestAnimationFrame(tick);
    };
    document.addEventListener('visibilitychange', vis);

    return () => {
      disposed = true;
      document.removeEventListener('visibilitychange', vis);
      window.removeEventListener('resize', onResize);
      if (ro) ro.disconnect();
      if (raf) cancelAnimationFrame(raf);
      renderer.dispose();
      if (renderer.domElement.parentNode === host) host.removeChild(renderer.domElement);
    };
  }, []);

  return (
    <View style={[S.orbitWrap, style]}>
      {Platform.OS === 'web' ? (
        <View style={S.orbitCanvasWrap}>
          <View ref={hostRef} style={S.orbitCanvas} />
        </View>
      ) : (
        <Text style={S.hintText}>Orbit visual is web-only.</Text>
      )}
      {hud.phase !== 'idle' ? (
        <View style={S.orbitHud}>
          <Text style={[S.orbitHudText, { color: HUD_COLOR[hud.phase] || colors.textPrimary }]}>
            {hud.label}
          </Text>
        </View>
      ) : null}
      <View style={S.orbitScrub}>
        {(shown.slice(-6) || []).map((ev, i) => (
          <TouchableOpacity key={ev.id || i} onPress={() => { setCursor(i); onSelect?.(ev); }}>
            <Text
              style={[S.orbitScrubLine, cursor != null && i > cursor && { opacity: 0.4 }]}
              numberOfLines={3}
            >
              {ev.layer || 'shop'} · {ev.type} · {String(ev.summary || '')}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
}
