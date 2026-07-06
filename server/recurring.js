// Recurring expense sweep: materializes due instances from templates, advancing
// next_date past "today" so re-running the same day never double-creates.
function advance(dateStr, frequency) {
  const d = new Date(dateStr + 'T00:00:00Z');
  switch (frequency) {
    case 'daily':
      d.setUTCDate(d.getUTCDate() + 1);
      break;
    case 'weekly':
      d.setUTCDate(d.getUTCDate() + 7);
      break;
    case 'yearly':
      d.setUTCFullYear(d.getUTCFullYear() + 1);
      break;
    case 'monthly':
    default:
      d.setUTCMonth(d.getUTCMonth() + 1);
      break;
  }
  return d.toISOString().slice(0, 10);
}

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

// Runs the sweep against an open db. Returns list of created expense rows.
function runRecurringSweep(db) {
  const today = todayStr();
  const due = db.prepare('SELECT * FROM recurring WHERE active = 1 AND next_date <= ?').all(today);
  const created = [];

  const insertExpense = db.prepare(`
    INSERT INTO expenses (date, vendor, amount_cents, currency, rate_used, base_amount_cents, category_id, project_id, method, notes, recurring_id)
    VALUES (@date, @vendor, @amount_cents, @currency, @rate_used, @base_amount_cents, @category_id, @project_id, @method, @notes, @recurring_id)
  `);
  const updateNext = db.prepare('UPDATE recurring SET next_date = ? WHERE id = ?');
  const getRate = db.prepare('SELECT rate_to_base FROM currencies WHERE code = ?');

  const tx = db.transaction(() => {
    for (const rec of due) {
      const tpl = JSON.parse(rec.template_json);
      let nextDate = rec.next_date;
      let guard = 0;
      // catch-up: materialize every missed occurrence up to today, cap iterations for safety
      while (nextDate <= today && guard < 366) {
        const rateRow = getRate.get(tpl.currency || 'USD');
        const rate = rateRow ? rateRow.rate_to_base : 1;
        const amountCents = Math.round(Number(tpl.amount_cents) || 0);
        const baseCents = Math.round(amountCents * rate);
        const info = insertExpense.run({
          date: nextDate,
          vendor: tpl.vendor || '',
          amount_cents: amountCents,
          currency: tpl.currency || 'USD',
          rate_used: rate,
          base_amount_cents: baseCents,
          category_id: tpl.category_id || null,
          project_id: tpl.project_id || null,
          method: tpl.method || '',
          notes: tpl.notes || '',
          recurring_id: rec.id
        });
        created.push(db.prepare('SELECT * FROM expenses WHERE id = ?').get(info.lastInsertRowid));
        nextDate = advance(nextDate, rec.frequency);
        guard++;
      }
      updateNext.run(nextDate, rec.id);
    }
  });
  tx();
  return created;
}

module.exports = { runRecurringSweep, advance, todayStr };
