'use strict';

function pickChatModel(models) {
  const list = Array.isArray(models) ? models : [];
  const chat = list.filter((m) => {
    const name = String(m?.name || m?.model || '');
    const family = String(m?.details?.family || '');
    if (!name) return false;
    if (family.includes('bert') || /embed/i.test(name)) return false;
    return true;
  });
  const byName = (re) => chat.find((m) => re.test(m.name || m.model || ''));
  const hit = byName(/llama3\.2:3b/i) || byName(/:1b\b|:3b\b|:8b\b/i);
  if (hit) return hit.name || hit.model;
  const sorted = [...chat].sort((a, b) => (a.size || Infinity) - (b.size || Infinity));
  return sorted[0]?.name || sorted[0]?.model;
}

/**
 * Cloud owns the model. Never use the client body.model. Skip LoRA suffix on vLLM.
 * @param {object} [opts.selectedLora] — Laya-picked adapter { name, derived_model }; else first attachment.
 */
function resolveOwnedChatModel({ endpoint, provider, listedModels, selectedLora } = {}) {
  const isVllm = String(provider?.provider || provider?.provider_type || '').toLowerCase() === 'vllm';
  let model = String(endpoint?.model || provider?.model || '').trim() || undefined;
  if (!model) model = pickChatModel(listedModels);
  const list = endpoint?.lora || [];
  let loraAtt = selectedLora || null;
  if (!loraAtt && list.length) {
    loraAtt = list.find((a) => a && (a.attached || a.selected)) || list[0];
  }
  // Personality LoRA on Ollama only — tools/code stay on base for vLLM.
  if (!isVllm && loraAtt && model) {
    model = loraAtt.derived_model || `${model}-${loraAtt.name}`;
  }
  return { model, isVllm, lora: loraAtt || null };
}

module.exports = { pickChatModel, resolveOwnedChatModel };
