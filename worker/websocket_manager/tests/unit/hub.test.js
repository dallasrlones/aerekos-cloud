const { ChannelHub } = require('../../api/hub');

describe('ChannelHub', () => {
  test('publish delivers to ready subscribers only', () => {
    const hub = new ChannelHub();
    const pid = 'p-hub-' + Date.now();
    const open = { readyState: 1, sent: [], send(m) { this.sent.push(m); }, on() {} };
    const closed = { readyState: 3, sent: [], send(m) { this.sent.push(m); }, on() {} };
    hub.subscribe(pid, 'app', open);
    hub.subscribe(pid, 'app', closed);
    const result = hub.publish(pid, 'app', { ping: 1 });
    expect(result.delivered).toBe(1);
    expect(result.channel).toBe('app');
    expect(JSON.parse(open.sent[0]).payload.ping).toBe(1);
    expect(closed.sent).toHaveLength(0);
  });

  test('unsubscribe removes subscriber', () => {
    const hub = new ChannelHub();
    const pid = 'p-hub-unsub-' + Date.now();
    const ws = { readyState: 1, sent: [], send(m) { this.sent.push(m); }, on() {} };
    hub.subscribe(pid, 'app', ws);
    hub.unsubscribe(pid, 'app', ws);
    const result = hub.publish(pid, 'app', { x: 1 });
    expect(result.delivered).toBe(0);
  });
});
