const { app, ensureDatabase, initDb } = require('../server/app');

let initialized = false;

module.exports = async (req, res) => {
  if (!initialized) {
    try {
      await ensureDatabase();
      await initDb();
      initialized = true;
    } catch (err) {
      console.error('DB init error:', err.message);
    }
  }
  return app(req, res);
};
