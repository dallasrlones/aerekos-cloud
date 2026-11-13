/**
 * Want8 — stick-figure Icarus FSM (app ESM copy for Metro/Expo).
 * Keep in sync with conductor/api/services/mascotFsm.js (Jest CJS twin).
 */

export const MASCOT_STATES = [
  'idle',
  'talk',
  'listen',
  'think',
  'happy',
  'sad',
  'confused',
  'walk',
  'run',
  'jump',
  'point',
  'teleport',
  'climb',
  'fall',
  'bonk',
  'get_up',
  'combat',
  'on_fire',
  'strain',
  'heal',
  'lora_train',
  'lora_wear',
  'celebrate',
];

/** Higher number wins when deciding whether ambient clips may run. */
export const STATE_PRIORITY = {
  combat: 100,
  on_fire: 95,
  lora_train: 80,
  strain: 70,
  talk: 60,
  listen: 55,
  think: 50,
  sad: 45,
  confused: 40,
  happy: 35,
  celebrate: 35,
  heal: 30,
  lora_wear: 28,
  teleport: 25,
  run: 22,
  climb: 22,
  fall: 22,
  bonk: 22,
  get_up: 20,
  walk: 18,
  jump: 18,
  point: 15,
  idle: 0,
};

const EVENT_MAP = {
  speech_start: 'talk',
  speech_stop: 'idle',
  ask_open: 'listen',
  listen: 'listen',
  ask_close: 'idle',
  navigate: 'walk',
  walk: 'walk',
  think: 'think',
  thinking: 'think',
  success: 'celebrate',
  fail: 'sad',
  error: 'combat',
  threat: 'combat',
  broken: 'on_fire',
  on_fire: 'on_fire',
  resource_strain: 'strain',
  strain: 'strain',
  heal: 'heal',
  point: 'point',
  jump: 'jump',
  happy: 'happy',
  confused: 'confused',
  idle: 'idle',
  run: 'run',
  teleport: 'teleport',
  climb: 'climb',
  fall: 'fall',
  bonk: 'bonk',
  get_up: 'get_up',
  lora_train: 'lora_train',
  lora_wear: 'lora_wear',
  lora_fail: 'sad',
};

export function mapMascotEvent(eventName) {
  const key = String(eventName || '').toLowerCase();
  return EVENT_MAP[key] || null;
}

export function transitionMascot(current, eventName) {
  const next = mapMascotEvent(eventName);
  if (!next) return current || 'idle';
  if (!MASCOT_STATES.includes(next)) return current || 'idle';
  return next;
}

export function statePriority(state) {
  return STATE_PRIORITY[state] || 0;
}

export function allowsAmbient(state) {
  return statePriority(state) <= statePriority('walk');
}

export default {
  MASCOT_STATES,
  STATE_PRIORITY,
  mapMascotEvent,
  transitionMascot,
  statePriority,
  allowsAmbient,
};
