#!/usr/bin/env python3
from pathlib import Path
import sys

src = Path(sys.argv[1])
dst = Path(sys.argv[2])
t = src.read_text()
old = """    const route = shop.routeChat(agent.mode);
    const userId = body.user_id || agent.user_id || 'console';
    if (!route.shop) {
      return this._userTurn(projectId, agent, settings, { text, userId, pins, rolls, images, shop: false });
    }
    return this._shopTurn(projectId, agent, settings, { text, userId, pins, rolls, images });"""
new = """    const route = shop.routeChat(agent.mode);
    const userId = body.user_id || agent.user_id || 'console';
    // Sacred talk: casual greetings stay on the friend path even if composer is Plan/Agent.
    const friendTurn = /^(hi|hey|hello|yo|sup)\\b/i.test(text)
      || /^(how are you|what's up|whats up|how's it going)\\b/i.test(text);
    if (!route.shop || friendTurn) {
      return this._userTurn(projectId, agent, settings, { text, userId, pins, rolls, images, shop: false });
    }
    return this._shopTurn(projectId, agent, settings, { text, userId, pins, rolls, images });"""
if old not in t:
    raise SystemExit('patch target not found')
dst.write_text(t.replace(old, new, 1))
print('patched ok')
