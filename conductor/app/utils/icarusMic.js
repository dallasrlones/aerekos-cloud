'use strict';

let recorder = null;
let stream = null;
let listening = false;
const subs = new Set();
let onAudio = null;

function emit() {
  subs.forEach((fn) => {
    try { fn(listening); } catch { /* */ }
  });
}

function subscribe(fn) {
  subs.add(fn);
  fn(listening);
  return () => subs.delete(fn);
}

function isListening() {
  return listening;
}

async function toggleMic({ onStop } = {}) {
  if (typeof window === 'undefined' || !window.MediaRecorder) {
    return { listening: false, unsupported: true };
  }
  if (listening) {
    try { if (recorder && recorder.state !== 'inactive') recorder.stop(); } catch { /* */ }
    return { listening: false };
  }
  onAudio = onStop;
  stream = await navigator.mediaDevices.getUserMedia({ audio: true });
  const rec = new window.MediaRecorder(stream);
  const chunks = [];
  rec.ondataavailable = (ev) => { if (ev.data?.size) chunks.push(ev.data); };
  rec.onstop = async () => {
    (stream?.getTracks() || []).forEach((t) => t.stop());
    stream = null;
    recorder = null;
    listening = false;
    emit();
    const blob = new Blob(chunks, { type: rec.mimeType || 'audio/webm' });
    const b64 = await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result || '').split(',')[1] || '');
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
    if (onAudio) await onAudio(b64);
  };
  recorder = rec;
  listening = true;
  emit();
  rec.start();
  return { listening: true };
}

function stopMic() {
  try { if (recorder && recorder.state !== 'inactive') recorder.stop(); } catch { /* */ }
}

module.exports = { toggleMic, stopMic, subscribe, isListening };
