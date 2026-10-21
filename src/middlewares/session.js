// src/middlewares/session.js
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

module.exports = function session(req, res, next) {
  const id = req.get('x-session-id');
  if (!id || !UUID_RE.test(id)) {
    return res.status(400).json({ error: 'Sesión inválida' });
  }
  req.sessionId = id;
  next();
};
