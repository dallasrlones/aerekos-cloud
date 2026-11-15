const express = require('express');
const { EmailMessageService } = require('../services/EmailMessageService');
const r = express.Router();
const s = new EmailMessageService();
const q = (req) => req.query.project_id || req.body?.project_id || req.headers['x-project-id'];
r.post('/', async (req,res,next) => { try { const o = await s.create({ ...req.body, project_id: q(req) }); res.status(201).json({ item: o }); } catch (e) { if (e.status) return res.status(e.status).json({ error: { message: e.message } }); next(e); } });
r.get('/', async (req,res,next) => { try { const o = await s.list(q(req)); res.json({ items: o }); } catch (e) { if (e.status) return res.status(e.status).json({ error: { message: e.message } }); next(e); } });
r.get('/:id', async (req,res,next) => { try { const o = await s.get(req.params.id, q(req)); res.json({ item: o }); } catch (e) { if (e.status) return res.status(e.status).json({ error: { message: e.message } }); next(e); } });
const upd = async (req,res,next) => { try { const o = await s.update(req.params.id, q(req), req.body || {}); res.json({ item: o }); } catch (e) { if (e.status) return res.status(e.status).json({ error: { message: e.message } }); next(e); } };
r.patch('/:id', upd);
r.put('/:id', upd);
r.delete('/:id', async (req,res,next) => { try { res.json(await s.del(req.params.id, q(req))); } catch (e) { if (e.status) return res.status(e.status).json({ error: { message: e.message } }); next(e); } });
r.post('/:id/send', async (req,res,next) => {
  try {
    const { sendEmail } = require('../../../shared/outboundSend');
    const current = await s.get(req.params.id, q(req));
    const result = await sendEmail({
      to: current.to_address || current.to || current.recipient || req.body?.to || req.body?.to_address,
      subject: current.subject || req.body?.subject,
      body: current.body || current.text || req.body?.body,
    });
    const item = await s.update(req.params.id, q(req), { status: result.sent ? 'sent' : 'queued' });
    res.json({ item, skipped: !result.sent, reason: result.reason || (result.sent ? 'sent' : 'queue_only'), note: result.note });
  } catch (e) { if (e.status) return res.status(e.status).json({ error: { message: e.message } }); next(e); }
});
module.exports = r;
