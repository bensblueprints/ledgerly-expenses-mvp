import React, { useEffect, useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { api } from '../api';
import { Card, Button, money, ProgressBar } from './ui.jsx';

export default function Budgets() {
  const [budgets, setBudgets] = useState([]);
  const [categories, setCategories] = useState([]);
  const [report, setReport] = useState(null);
  const [settings, setSettings] = useState({ base_currency: 'USD' });
  const [form, setForm] = useState({ category_id: '', month: '', amount: '' });
  const month = new Date().toISOString().slice(0, 7);

  async function load() {
    const [b, c, r, s] = await Promise.all([api.budgets(), api.categories(), api.monthlyReport(month), api.getSettings()]);
    setBudgets(b);
    setCategories(c);
    setReport(r);
    setSettings(s);
  }

  useEffect(() => {
    load();
  }, []);

  async function add(e) {
    e.preventDefault();
    if (!form.category_id || !form.amount) return;
    await api.createBudget({ category_id: Number(form.category_id), month: form.month || null, amount: Number(form.amount) });
    setForm({ category_id: '', month: '', amount: '' });
    load();
  }

  async function remove(id) {
    await api.deleteBudget(id);
    load();
  }

  const categoryName = (id) => categories.find((c) => c.id === id)?.name || '—';

  return (
    <div className="space-y-6">
      <Card>
        <h3 className="font-semibold mb-4">This month's progress</h3>
        {!report || report.budgetProgress.length === 0 ? (
          <p className="text-zinc-500 text-sm">No budgets set yet — add one below.</p>
        ) : (
          <div className="space-y-4">
            {report.budgetProgress.map((b) => (
              <div key={b.category_id}>
                <div className="flex justify-between text-sm mb-1">
                  <span className="text-zinc-300">{b.category_name}</span>
                  <span className={b.over ? 'text-red-400 font-semibold' : 'text-zinc-400'}>
                    {money(b.spent_cents, settings.base_currency)} / {money(b.budget_cents, settings.base_currency)} ({b.pct}%)
                    {b.over ? ' — over budget' : b.pct >= 80 ? ' — near limit' : ''}
                  </span>
                </div>
                <ProgressBar pct={b.pct} over={b.over} />
              </div>
            ))}
          </div>
        )}
      </Card>

      <Card>
        <h3 className="font-semibold mb-4">All budgets</h3>
        <form onSubmit={add} className="flex flex-wrap gap-3 items-end mb-5">
          <div>
            <label>Category</label>
            <select value={form.category_id} onChange={(e) => setForm({ ...form, category_id: e.target.value })}>
              <option value="">Select…</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label>Month (blank = every month)</label>
            <input type="month" value={form.month} onChange={(e) => setForm({ ...form, month: e.target.value })} />
          </div>
          <div>
            <label>Monthly budget</label>
            <input type="number" step="0.01" min="0" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} />
          </div>
          <Button type="submit">
            <Plus size={15} /> Add budget
          </Button>
        </form>

        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs uppercase tracking-wider text-zinc-500 border-b border-zinc-800">
              <th className="py-2">Category</th>
              <th className="py-2">Month</th>
              <th className="py-2">Amount</th>
              <th></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-800">
            {budgets.map((b) => (
              <tr key={b.id}>
                <td className="py-2">{categoryName(b.category_id)}</td>
                <td className="py-2 text-zinc-400">{b.month || 'Every month'}</td>
                <td className="py-2 font-semibold">{money(b.amount_cents, settings.base_currency)}</td>
                <td className="py-2 text-right">
                  <button className="text-zinc-500 hover:text-red-400 cursor-pointer" onClick={() => remove(b.id)}>
                    <Trash2 size={15} />
                  </button>
                </td>
              </tr>
            ))}
            {budgets.length === 0 && (
              <tr>
                <td colSpan={4} className="py-6 text-center text-zinc-500">
                  No budgets yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
