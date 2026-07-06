const { createApp } = require('./app');
const { runRecurringSweep } = require('./recurring');

const PORT = Number(process.env.PORT) || 5335;
const app = createApp();

// catch-up sweep on boot, then once a day thereafter
try {
  runRecurringSweep(app.locals.db);
} catch (e) {
  console.error('[recurring] boot sweep failed:', e.message);
}
setInterval(() => {
  try {
    runRecurringSweep(app.locals.db);
  } catch (e) {
    console.error('[recurring] daily sweep failed:', e.message);
  }
}, 24 * 3600 * 1000);

app.listen(PORT, () => {
  console.log(`Ledgerly running at http://localhost:${PORT}`);
});
