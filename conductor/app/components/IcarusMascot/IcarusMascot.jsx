import React, { useCallback, useEffect, useRef, useState } from 'react';
import { View, Text, Platform } from 'react-native';
import {
  transitionMascot, allowsAmbient, statePriority,
} from './mascotFsm';
import { createMascotStyles } from './IcarusMascot.styles';

function prefersReducedMotion() {
  if (typeof window === 'undefined' || !window.matchMedia) return false;
  try {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  } catch {
    return false;
  }
}

/** Ambient choreography clips — always one of these is running. */
const CLIPS = [
  'walk', 'run', 'kungfu', 'kick', 'punch', 'flip', 'jump',
  'rocket', 'spin', 'stretch', 'shadowbox', 'cartwheel',
];

const MOOD = {
  sad: '#c44', combat: '#c44', on_fire: '#e85', strain: '#c70',
  happy: '#2a8', celebrate: '#2a8', heal: '#2a8', confused: '#c90',
  lora_wear: '#46a', lora_train: '#46a', think: '#00C3FF', talk: '#00C3FF',
};

/**
 * Always-moving stick-figure Icarus — never idle-static.
 * Continuous rAF body + wandering stage; mood overlays from FSM state.
 */
export const IcarusMascot = ({
  state: stateProp = 'idle',
  targetAnchorId = null,
  onStateChange,
  size = 160,
  label = 'Icarus',
  adapterLabel = null,
  showStage = true,
}) => {
  const [fsm, setFsm] = useState(stateProp || 'idle');
  const [frame, setFrame] = useState({
    x: 0, y: 0, rot: 0, scaleY: 1, scaleX: 1,
    armL: 0, armR: 0, legL: 0, legR: 0,
    bounce: 0, rocket: false, trail: 0, opacity: 1,
  });
  const fsmRef = useRef(fsm);
  const clipRef = useRef({ name: 'walk', t0: 0, dur: 2200, dir: 1, nextAt: 0 });
  const poseRef = useRef({ x: 0, y: 0, vx: 0.35 });
  const rafRef = useRef(null);
  const clipTimer = useRef(null);
  const reduced = prefersReducedMotion();

  const applyState = useCallback((next) => {
    if (!next) return;
    fsmRef.current = next;
    setFsm(next);
    onStateChange?.(next);
  }, [onStateChange]);

  useEffect(() => {
    applyState(stateProp || 'idle');
  }, [stateProp, applyState]);

  const pickClip = useCallback((prefer) => {
    const mood = fsmRef.current;
    if (prefer) return prefer;
    if (mood === 'think' || mood === 'lora_train') return Math.random() < 0.5 ? 'shadowbox' : 'stretch';
    if (mood === 'combat' || mood === 'on_fire') return Math.random() < 0.6 ? 'kungfu' : 'kick';
    if (mood === 'celebrate' || mood === 'happy') return Math.random() < 0.5 ? 'flip' : 'jump';
    if (mood === 'talk') return 'walk';
    return CLIPS[Math.floor(Math.random() * CLIPS.length)];
  }, []);

  const startClip = useCallback((name) => {
    const n = name || pickClip();
    const durs = {
      walk: 2400, run: 1600, kungfu: 2800, kick: 900, punch: 700,
      flip: 1100, jump: 900, rocket: 3200, spin: 1400, stretch: 2000,
      shadowbox: 2200, cartwheel: 1300,
    };
    const now = performance.now();
    const dir = poseRef.current.vx >= 0 ? 1 : -1;
    clipRef.current = {
      name: n,
      t0: now,
      dur: durs[n] || 2000,
      dir,
      nextAt: now + (durs[n] || 2000),
    };
    if (n === 'run' || n === 'rocket') poseRef.current.vx = dir * 0.9;
    else if (n === 'walk') poseRef.current.vx = dir * 0.4;
    else if (n === 'cartwheel' || n === 'flip') poseRef.current.vx = dir * 0.55;
  }, [pickClip]);

  // Perpetual animation — never still (except reduced-motion: soft sway only)
  useEffect(() => {
    if (typeof window === 'undefined') return undefined;
    startClip('walk');
    let last = performance.now();

    const tick = (now) => {
      const dt = Math.min(32, now - last);
      last = now;
      const clip = clipRef.current;
      const p = poseRef.current;
      let u = (now - clip.t0) / clip.dur;
      if (u >= 1 || now >= clip.nextAt) {
        // Chance to reverse direction when wandering
        if (Math.random() < 0.35) p.vx *= -1;
        startClip(pickClip());
        u = 0;
      }

      const w = Math.sin(now / 180);
      const w2 = Math.sin(now / 90);
      const w3 = Math.sin(now / 55);
      const name = clip.name;
      const dir = clip.dir || (p.vx >= 0 ? 1 : -1);
      const range = showStage ? Math.max(40, size * 0.9) : Math.max(18, size * 0.28);

      // Wander X
      if (!reduced) {
        p.x += p.vx * (dt / 16);
        if (p.x > range) { p.x = range; p.vx = -Math.abs(p.vx); }
        if (p.x < -range) { p.x = -range; p.vx = Math.abs(p.vx); }
      }

      let armL = 12 * w;
      let armR = -12 * w;
      let legL = 14 * w;
      let legR = -14 * w;
      let bounce = reduced ? Math.sin(now / 900) * 2 : 3 + Math.abs(w) * 4;
      let rot = 0;
      let scaleY = 1;
      let scaleX = dir < 0 ? -1 : 1;
      let rocket = false;
      let trail = 0;
      let y = 0;

      if (reduced) {
        // Soft breath only
        bounce = Math.sin(now / 800) * 3;
        armL = 8 * Math.sin(now / 700);
        armR = -8 * Math.sin(now / 700);
        legL = 4; legR = -4;
      } else if (name === 'walk') {
        armL = 28 * w; armR = -28 * w;
        legL = 32 * w; legR = -32 * w;
        bounce = 4 + Math.abs(w) * 5;
      } else if (name === 'run') {
        armL = 42 * w2; armR = -42 * w2;
        legL = 48 * w2; legR = -48 * w2;
        bounce = 6 + Math.abs(w2) * 8;
        rot = w2 * 6;
      } else if (name === 'kungfu') {
        const kick = Math.sin(u * Math.PI * 4);
        armL = -50 + 30 * Math.sin(u * Math.PI * 2);
        armR = 60 * Math.max(0, Math.sin(u * Math.PI * 3));
        legL = 20;
        legR = -10 + 70 * Math.max(0, kick);
        bounce = 8 + Math.abs(kick) * 10;
        rot = kick * 12;
      } else if (name === 'kick') {
        const k = Math.sin(Math.min(1, u * 1.4) * Math.PI);
        armL = -35; armR = 40;
        legL = 15; legR = -20 + 85 * k;
        bounce = 10 * k; rot = 18 * k;
      } else if (name === 'punch') {
        const pk = Math.sin(Math.min(1, u * 1.6) * Math.PI);
        armR = -20 + 95 * pk; armL = -40;
        legL = 25; legR = -25; bounce = 6 * pk; rot = -8 * pk;
      } else if (name === 'flip' || name === 'cartwheel') {
        rot = u * 360 * (name === 'cartwheel' ? 1 : -1);
        armL = -40; armR = 40;
        legL = 35; legR = -35;
        bounce = Math.sin(u * Math.PI) * 28;
        y = -bounce;
      } else if (name === 'jump') {
        const j = Math.sin(Math.min(1, u) * Math.PI);
        bounce = 36 * j; y = -bounce;
        armL = -50 * j; armR = 50 * j;
        legL = 20 - 30 * j; legR = -20 + 30 * j;
        scaleY = 1 - 0.12 * j;
      } else if (name === 'rocket') {
        rocket = true;
        trail = 0.6 + 0.4 * Math.abs(w3);
        armL = -70; armR = 70;
        legL = 10 + 8 * w; legR = -10 - 8 * w;
        bounce = 10 + 6 * w;
        y = -18 - 8 * Math.abs(w);
        rot = w * 8;
        p.x += dir * 0.6 * (dt / 16);
      } else if (name === 'spin') {
        rot = u * 720;
        armL = 50; armR = -50;
        legL = 30; legR = -30;
        bounce = 8;
      } else if (name === 'stretch') {
        armL = -80 * Math.sin(u * Math.PI); armR = 80 * Math.sin(u * Math.PI);
        legL = 8; legR = -8;
        bounce = 2; scaleY = 1 + 0.08 * Math.sin(u * Math.PI);
      } else if (name === 'shadowbox') {
        armL = -30 + 40 * Math.sin(now / 120);
        armR = 50 * Math.sin(now / 95 + 1);
        legL = 18 * w; legR = -18 * w;
        bounce = 5 + Math.abs(w) * 4;
        rot = w * 4;
      }

      // Mood overlays nudge motion
      const mood = fsmRef.current;
      if (mood === 'think') bounce += 2 + Math.sin(now / 400) * 2;
      if (mood === 'on_fire' || mood === 'combat') {
        armL += 10 * w3; bounce += 3;
      }
      if (mood === 'sad') { bounce *= 0.5; armL = 20; armR = -20; }
      if (mood === 'fall') { y += 20; rot = 40; scaleY = 0.85; }
      if (mood === 'bonk') { scaleY = 0.7; scaleX *= 1.15; bounce = 0; }

      setFrame({
        x: p.x, y, rot, scaleY, scaleX,
        armL, armR, legL, legR, bounce, rocket, trail, opacity: 1,
      });
      rafRef.current = requestAnimationFrame(tick);
    };

    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      clearTimeout(clipTimer.current);
    };
  }, [pickClip, showStage, size, startClip, reduced]);

  const resolveAnchor = (anchorId) => {
    if (!anchorId || typeof document === 'undefined') return null;
    return (
      document.querySelector(`[data-icarus-anchor="${anchorId}"]`) ||
      document.getElementById(`icarus-${anchorId}`)
    );
  };

  const runClip = useCallback((kind, detail = {}) => {
    clearTimeout(clipTimer.current);
    const map = {
      teleport: 'flip', run: 'run', walk: 'walk', navigate: 'walk',
      climb: 'jump', fall: 'flip', bonk: 'punch', jump: 'jump',
      combat: 'kungfu', celebrate: 'flip', think: 'shadowbox',
    };
    const clip = map[kind] || pickClip(kind);
    if (detail.anchorId) {
      const el = resolveAnchor(detail.anchorId);
      if (el) {
        const rect = el.getBoundingClientRect();
        const targetX = Math.max(-80, Math.min(80, (rect.left + rect.width / 2) / 20 - 40));
        poseRef.current.vx = targetX > poseRef.current.x ? 0.7 : -0.7;
      }
    }
    startClip(clip);
    if (kind === 'teleport') {
      applyState('teleport');
      clipTimer.current = setTimeout(() => applyState(detail.follow === 'run' ? 'run' : 'point'), 200);
      return;
    }
    applyState(kind === 'navigate' ? 'walk' : kind);
  }, [applyState, pickClip, startClip]);

  const walkToAnchor = useCallback((anchorId, mode) => {
    if (!anchorId) return;
    const cur = fsmRef.current;
    if (!allowsAmbient(cur) && statePriority(cur) > statePriority('walk')) return;
    runClip(mode === 'teleport' ? 'teleport' : mode === 'run' ? 'run' : 'walk', { anchorId });
  }, [runClip]);

  useEffect(() => {
    if (typeof window === 'undefined') return undefined;
    const onEvt = (e) => {
      const detail = e.detail || {};
      const eventName = detail.event || detail.type;
      const next = transitionMascot(fsmRef.current, eventName);
      const mode = detail.mode;
      const isLoco = ['teleport', 'run', 'climb', 'fall', 'bonk', 'navigate', 'walk', 'jump']
        .includes(String(eventName || '').toLowerCase()) || mode === 'teleport' || mode === 'run';

      if (detail.anchorId || e.type === 'icarus:focus') {
        walkToAnchor(detail.anchorId || detail.id, mode || 'walk');
        return;
      }
      if (isLoco) {
        runClip(String(eventName || mode || 'run').toLowerCase(), detail);
        return;
      }
      if (next && next !== fsmRef.current) {
        applyState(next);
        if (['combat', 'on_fire', 'celebrate', 'think', 'jump'].includes(next)) {
          startClip(pickClip(next === 'think' ? 'shadowbox' : next === 'celebrate' ? 'flip' : 'kungfu'));
        }
      }
    };
    window.addEventListener('icarus:mascot', onEvt);
    window.addEventListener('icarus:focus', onEvt);
    return () => {
      window.removeEventListener('icarus:mascot', onEvt);
      window.removeEventListener('icarus:focus', onEvt);
    };
  }, [applyState, pickClip, runClip, startClip, walkToAnchor]);

  useEffect(() => {
    if (targetAnchorId) walkToAnchor(targetAnchorId, 'walk');
  }, [targetAnchorId, walkToAnchor]);

  const mood = MOOD[fsm] || '#222';
  const stroke = fsm === 'think' || fsm === 'talk' ? '#00C3FF' : mood;
  const f = frame;
  // Stick limb endpoints from joint angles (degrees → offset)
  const rad = (d) => (d * Math.PI) / 180;
  const armLX = 50 + Math.sin(rad(f.armL - 40)) * 22;
  const armLY = 48 + Math.cos(rad(f.armL - 40)) * 22;
  const armRX = 50 + Math.sin(rad(f.armR + 40)) * 22;
  const armRY = 48 + Math.cos(rad(f.armR + 40)) * 22;
  const legLX = 50 + Math.sin(rad(f.legL - 20)) * 28;
  const legLY = 72 + Math.cos(rad(Math.min(50, Math.abs(f.legL)))) * 28;
  const legRX = 50 + Math.sin(rad(f.legR + 20)) * 28;
  const legRY = 72 + Math.cos(rad(Math.min(50, Math.abs(f.legR)))) * 28;

  const styles = createMascotStyles(
    { surface: '#0a0e14', textMuted: '#668' },
    { goldSoft: '#00C3FF55', gold: '#00C3FF', glassBorder: '#00C3FF44', mono: 'ui-monospace, monospace' },
    { sm: 8, md: 16 },
    { sm: 6 },
  );

  const figure = (
    <View
      accessibilityRole="image"
      accessibilityLabel={`${label || 'Icarus'}, ${fsm}${adapterLabel ? `, adapter ${adapterLabel}` : ''}`}
      style={{
        width: size,
        height: size,
        opacity: f.opacity,
        transform: [
          { translateX: f.x },
          { translateY: f.y - f.bounce },
          { rotate: `${f.rot}deg` },
          { scaleX: f.scaleX },
          { scaleY: f.scaleY },
        ],
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      {Platform.OS === 'web' ? (
        <svg width={size} height={size} viewBox="0 0 100 120" aria-hidden>
          {f.rocket ? (
            <>
              <ellipse cx="50" cy="95" rx="10" ry="18" fill="#00C3FF" opacity={0.25 * f.trail} />
              <path d="M42 88 L50 118 L58 88 Z" fill="#ff6a00" opacity={0.85 * f.trail} />
              <path d="M45 88 L50 108 L55 88 Z" fill="#ffcc00" opacity={0.9 * f.trail} />
              <rect x="40" y="70" width="20" height="28" rx="4" fill="none" stroke="#00C3FF" strokeWidth="2" />
              <circle cx="50" cy="78" r="4" fill="#00C3FF" opacity="0.5" />
            </>
          ) : null}
          <circle cx="50" cy="22" r="12" fill="none" stroke={stroke} strokeWidth="3" />
          {/* eyes — blink via opacity pulse */}
          <circle cx="46" cy="20" r="1.5" fill={stroke} opacity={0.85} />
          <circle cx="54" cy="20" r="1.5" fill={stroke} opacity="0.85" />
          <line x1="50" y1="34" x2="50" y2="72" stroke={stroke} strokeWidth="3" />
          <line x1="50" y1="48" x2={armLX} y2={armLY} stroke={stroke} strokeWidth="3" strokeLinecap="round" />
          <line x1="50" y1="48" x2={armRX} y2={armRY} stroke={stroke} strokeWidth="3" strokeLinecap="round" />
          <line x1="50" y1="72" x2={legLX} y2={legLY} stroke={stroke} strokeWidth="3" strokeLinecap="round" />
          <line x1="50" y1="72" x2={legRX} y2={legRY} stroke={stroke} strokeWidth="3" strokeLinecap="round" />
          {(fsm === 'on_fire' || fsm === 'combat') ? (
            <>
              <path d="M18 70 Q22 50 28 68 Q24 58 22 72 Z" fill="#e85" opacity="0.85">
                <animate attributeName="d" dur="0.4s" repeatCount="indefinite"
                  values="M18 70 Q22 50 28 68 Q24 58 22 72 Z;M18 70 Q20 48 28 66 Q24 56 22 72 Z;M18 70 Q22 50 28 68 Q24 58 22 72 Z" />
              </path>
              <path d="M72 68 Q78 48 84 66 Q80 56 78 70 Z" fill="#f64" opacity="0.75" />
            </>
          ) : null}
          {(fsm === 'lora_train' || fsm === 'lora_wear') ? (
            <rect x="62" y="40" width="16" height="22" rx="3" fill="none"
              stroke={fsm === 'lora_wear' ? '#6cf' : '#46a'} strokeWidth="2" />
          ) : null}
          {fsm === 'think' || fsm === 'lora_train' ? (
            <g opacity="0.9">
              <circle cx="72" cy="12" r="3" fill={stroke}>
                <animate attributeName="cy" values="12;8;12" dur="1.2s" repeatCount="indefinite" />
              </circle>
              <circle cx="80" cy="8" r="2" fill={stroke}>
                <animate attributeName="cy" values="8;4;8" dur="1.2s" begin="0.2s" repeatCount="indefinite" />
              </circle>
              <circle cx="86" cy="6" r="1.5" fill={stroke}>
                <animate attributeName="cy" values="6;2;6" dur="1.2s" begin="0.4s" repeatCount="indefinite" />
              </circle>
            </g>
          ) : null}
          {fsm === 'combat' || fsm === 'on_fire' ? (
            <text x="72" y="40" fontSize="14" fill="#e85">!</text>
          ) : null}
          {fsm === 'bonk' ? (
            <text x="70" y="30" fontSize="12" fill={stroke}>*</text>
          ) : null}
          {/* motion dust */}
          {!reduced && (clipRef.current.name === 'run' || clipRef.current.name === 'kungfu') ? (
            <g opacity="0.35">
              <circle cx={30} cy={100} r="2" fill={stroke}>
                <animate attributeName="opacity" values="0.4;0;0.4" dur="0.5s" repeatCount="indefinite" />
              </circle>
              <circle cx={70} cy={102} r="1.5" fill={stroke}>
                <animate attributeName="opacity" values="0.3;0;0.3" dur="0.45s" begin="0.15s" repeatCount="indefinite" />
              </circle>
            </g>
          ) : null}
        </svg>
      ) : (
        <Text style={{ fontSize: size * 0.45, color: stroke }}>
          {fsm === 'combat' || fsm === 'on_fire' ? '🔥' : '🧍'}
        </Text>
      )}
      {label ? (
        <Text style={{ fontSize: 11, color: '#668', marginTop: 4 }}>{fsm}</Text>
      ) : null}
      {adapterLabel ? (
        <View style={styles.badge}>
          <Text style={styles.badgeText}>{adapterLabel}</Text>
        </View>
      ) : null}
    </View>
  );

  if (!showStage) return figure;

  return (
    <View
      {...(Platform.OS === 'web' ? { 'data-icarus-anchor': 'mascot-stage' } : {})}
      style={[styles.stage, { overflow: 'visible', minHeight: size + 48 }]}
    >
      {figure}
      <View style={styles.floor} />
      <View
        {...(Platform.OS === 'web' ? { 'data-icarus-prop': 'crate' } : {})}
        style={{
          position: 'absolute',
          right: '18%',
          bottom: 28,
          width: 28,
          height: 22,
          backgroundColor: '#1a3040',
          borderRadius: 2,
          borderWidth: 1,
          borderColor: '#00C3FF44',
          opacity: 0.7,
        }}
      />
      <View
        {...(Platform.OS === 'web' ? { 'data-icarus-prop': 'ledge' } : {})}
        style={{
          position: 'absolute',
          left: '16%',
          bottom: 48,
          width: 40,
          height: 8,
          backgroundColor: '#1a3040',
          borderRadius: 2,
          borderWidth: 1,
          borderColor: '#00C3FF33',
          opacity: 0.65,
        }}
      />
    </View>
  );
};

export default IcarusMascot;
