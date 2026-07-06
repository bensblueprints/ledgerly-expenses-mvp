import React, { useEffect, useState } from 'react';
import { Plus } from 'lucide-react';
import { api } from '../api';
import { Card, StatTile, ProgressBar, money, Button } from './ui.jsx';
import { CategoryIcon } from './icons.jsx';
import ExpenseFormModal from './ExpenseFormModal.jsx';

export default function Dashboard({ onNavigate }) {
  const [report, setReport] = useState(null);
  const [recent, setRecent] = useState([]);
  const [settings, setSettings] = useState({ base_currency: 'USD' });
  const [showAdd, setShowAdd] = useState(false);
  const month = new Date().toISOString().slice(0, 7);

  async function load() {
    const [r, exp, s] = await Promise.all([api.monthlyReport(month), api.expenses({}), api.getSettings()]);
    setReport(r);
    setRecent(exp.slice(0, 8));
    setSettings(s);
  }

  useEffect(() => {
    load();
  }, []);

  if (!report) return <div className="text-zinc-500">Loading…</div>;

  const delta = report.total - report.prevMonthTotal;
  const deltaPct = report.prevMonthTotal ? Math.round((delta / report.prevMonthTotal) * 100) : null;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap gap-4">
        <StatTile label="This month" value={money(report.total, settings.base_currency)} sub={`${month}`} />
        <StatTile
          label="vs last month"
          value={deltaPct === null ? '—' : `${delta >= 0 ? '+' : ''}${deltaPct}%`}
          accent={delta > 0 ? 'text-red-400' : 'text-emerald-400'}
          sub={money(report.prevMonthTotal, settings.base_currency) + ' prior'}
        />
        <StatTile label="Categories over budget" value={report.budgetProgress.filter((b) => b.over).length} accent="text-amber-400" />
      </div>

      {report.budgetProgress.length > 0 && (
        <Card>
          <h3 className="font-semibold mb-4">Budget progress</h3>
          <div className="space-y-4">
            {report.budgetProgress.map((b) => (
              <div key={b.category_id}>
                <div className="flex justify-between text-sm mb-1">
                  <span className="text-zinc-300">{b.category_name}</span>
                  <span className={b.over ? 'text-red-400' : 'text-zinc-400'}>
                    {money(b.spent_cents, settings.base_currency)} / {money(b.budget_cents, settings.base_currency)} ({b.pct}%)
                  </span>
                </div>
                <ProgressBar pct={b.pct} over={b.over} />
              </div>
            ))}
          </div>
        </Card>
      )}

      <Card>
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold">Recent expenses</h3>
          <div className="flex gap-2">
            <Button onClick={() => setShowAdd(true)}>
              <Plus size={15} /> Quick add
            </Button>
            <Button variant="ghost" onClick={() => onNavigate('expenses')}>
              View all
            </Button>
          </div>
        </div>
        {recent.length === 0 ? (
          <p className="text-zinc-500 text-sm">No expenses yet — add your first one.</p>
        ) : (
          <div className="divide-y divide-zinc-800">
            {recent.map((e) => (
              <div key={e.id} className="flex items-center justify-between py-2.5 text-sm">
                <div className="flex items-center gap-2">
                  <span className="text-zinc-500 w-24">{e.date}</span>
                  <span className="font-medium">{e.vendor || 'Untitled'}</span>
                </div>
                <span className="font-semibold">{money(e.amount_cents, e.currency)}</span>
              </div>
            ))}
          </div>
        )}
      </Card>

      {showAdd && (
        <ExpenseFormModal
          onClose={() => setShowAdd(false)}
          onSaved={() => {
            setShowAdd(false);
            load();
          }}
        />
      )}
    </div>
  );
}
