import React, { useEffect, useState } from 'react';
import { Plus, Search, Download, Pencil, Trash2, Image as ImageIcon, RefreshCw } from 'lucide-react';
import { api } from '../api';
import { Card, Button, money } from './ui.jsx';
import ExpenseFormModal from './ExpenseFormModal.jsx';

export default function ExpensesList() {
  const [rows, setRows] = useState([]);
  const [categories, setCategories] = useState([]);
  const [projects, setProjects] = useState([]);
  const [filters, setFilters] = useState({ from: '', to: '', category: '', project: '', q: '' });
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [sortKey, setSortKey] = useState('date');
  const [sortDir, setSortDir] = useState('desc');
  const [popoverId, setPopoverId] = useState(null);

  async function load() {
    const [e, c, p] = await Promise.all([api.expenses(filters), api.categories(), api.projects()]);
    setRows(e);
    setCategories(c);
    setProjects(p);
  }

  useEffect(() => {
    load();
  }, [filters.from, filters.to, filters.category, filters.project, filters.q]);

  function sortedRows() {
    const copy = [...rows];
    copy.sort((a, b) => {
      let av = a[sortKey];
      let bv = b[sortKey];
      if (sortKey === 'amount_cents' || sortKey === 'base_amount_cents') {
        av = Number(av);
        bv = Number(bv);
      }
      if (av < bv) return sortDir === 'asc' ? -1 : 1;
      if (av > bv) return sortDir === 'asc' ? 1 : -1;
      return 0;
    });
    return copy;
  }

  function toggleSort(key) {
    if (sortKey === key) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    else {
      setSortKey(key);
      setSortDir('desc');
    }
  }

  async function remove(id) {
    if (!confirm('Delete this expense?')) return;
    await api.deleteExpense(id);
    load();
  }

  async function recalc(id) {
    await api.recalculateExpense(id);
    load();
  }

  const categoryName = (id) => categories.find((c) => c.id === id)?.name || '—';
  const projectName = (id) => projects.find((p) => p.id === id)?.name || '—';

  return (
    <div className="space-y-4">
      <Card className="flex flex-wrap gap-3 items-end">
        <div>
          <label>From</label>
          <input type="date" value={filters.from} onChange={(e) => setFilters({ ...filters, from: e.target.value })} />
        </div>
        <div>
          <label>To</label>
          <input type="date" value={filters.to} onChange={(e) => setFilters({ ...filters, to: e.target.value })} />
        </div>
        <div>
          <label>Category</label>
          <select value={filters.category} onChange={(e) => setFilters({ ...filters, category: e.target.value })}>
            <option value="">All</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label>Project</label>
          <select value={filters.project} onChange={(e) => setFilters({ ...filters, project: e.target.value })}>
            <option value="">All</option>
            {projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </div>
        <div className="flex-1 min-w-[180px]">
          <label>Search vendor / notes</label>
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
            <input className="pl-9" value={filters.q} onChange={(e) => setFilters({ ...filters, q: e.target.value })} placeholder="Search…" />
          </div>
        </div>
        <a href={api.exportCsvUrl(filters)} className="btn-secondary">
          <Download size={15} /> CSV
        </a>
        <Button
          onClick={() => {
            setEditing(null);
            setShowForm(true);
          }}
        >
          <Plus size={15} /> Add expense
        </Button>
      </Card>

      <Card className="p-0 overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs uppercase tracking-wider text-zinc-500 border-b border-zinc-800">
              {[
                ['date', 'Date'],
                ['vendor', 'Vendor'],
                ['amount_cents', 'Amount'],
                ['base_amount_cents', 'Base amount']
              ].map(([key, label]) => (
                <th key={key} className="px-4 py-3 cursor-pointer select-none" onClick={() => toggleSort(key)}>
                  {label} {sortKey === key ? (sortDir === 'asc' ? '↑' : '↓') : ''}
                </th>
              ))}
              <th className="px-4 py-3">Category</th>
              <th className="px-4 py-3">Project</th>
              <th className="px-4 py-3">Receipt</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-800">
            {sortedRows().map((r) => (
              <tr key={r.id} className="hover:bg-zinc-800/40">
                <td className="px-4 py-3">{r.date}</td>
                <td className="px-4 py-3 font-medium">{r.vendor || '—'}</td>
                <td className="px-4 py-3">{money(r.amount_cents, r.currency)}</td>
                <td className="px-4 py-3">{money(r.base_amount_cents, 'USD')}</td>
                <td className="px-4 py-3 text-zinc-400">{categoryName(r.category_id)}</td>
                <td className="px-4 py-3 text-zinc-400">{projectName(r.project_id)}</td>
                <td className="px-4 py-3 relative">
                  {r.receipt_path ? (
                    <button
                      className="text-emerald-400 hover:text-emerald-300 cursor-pointer"
                      onMouseEnter={() => setPopoverId(r.id)}
                      onMouseLeave={() => setPopoverId(null)}
                    >
                      <ImageIcon size={16} />
                      {popoverId === r.id && (
                        <img src={`/api/receipts/${r.id}`} alt="receipt" className="absolute z-10 left-0 top-6 w-40 rounded-lg border border-zinc-700 shadow-xl" />
                      )}
                    </button>
                  ) : (
                    <span className="text-zinc-600">—</span>
                  )}
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2 justify-end">
                    <button className="text-zinc-500 hover:text-white cursor-pointer" title="Recalculate base amount" onClick={() => recalc(r.id)}>
                      <RefreshCw size={15} />
                    </button>
                    <button
                      className="text-zinc-500 hover:text-white cursor-pointer"
                      onClick={() => {
                        setEditing(r);
                        setShowForm(true);
                      }}
                    >
                      <Pencil size={15} />
                    </button>
                    <button className="text-zinc-500 hover:text-red-400 cursor-pointer" onClick={() => remove(r.id)}>
                      <Trash2 size={15} />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={8} className="px-4 py-8 text-center text-zinc-500">
                  No expenses match these filters.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </Card>

      {showForm && (
        <ExpenseFormModal
          expense={editing}
          onClose={() => setShowForm(false)}
          onSaved={() => {
            setShowForm(false);
            load();
          }}
        />
      )}
    </div>
  );
}
