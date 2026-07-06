import React, { useEffect, useState } from 'react';
import { Plus, Trash2, Save, RefreshCw, Play } from 'lucide-react';
import { api } from '../api';
import { Card, Button, money } from './ui.jsx';
import { CategoryIcon, ICONS } from './icons.jsx';

export default function SettingsTab() {
  const [settings, setSettings] = useState(null);
  const [currencies, setCurrencies] = useState([]);
  const [categories, setCategories] = useState([]);
  const [projects, setProjects] = useState([]);
  const [recurring, setRecurring] = useState([]);
  const [newCat, setNewCat] = useState({ name: '', color: '#10b981', icon: 'circle-dot' });
  const [newCur, setNewCur] = useState({ code: '', rate_to_base: '' });
  const [newRec, setNewRec] = useState({ vendor: '', amount: '', currency: 'USD', category_id: '', frequency: 'monthly', next_date: new Date().toISOString().slice(0, 10) });
  const [msg, setMsg] = useState('');

  async function load() {
    const [s, cur, cat, proj, rec] = await Promise.all([api.getSettings(), api.currencies(), api.categories(), api.projects(), api.recurring()]);
    setSettings(s);
    setCurrencies(cur);
    setCategories(cat);
    setProjects(proj);
    setRecurring(rec);
  }

  useEffect(() => {
    load();
  }, []);

  if (!settings) return <div className="text-zinc-500">Loading…</div>;

  async function saveSettings(patch) {
    const s = await api.saveSettings({ ...settings, ...patch });
    setSettings(s);
  }

  async function addCategory(e) {
    e.preventDefault();
    if (!newCat.name) return;
    await api.createCategory(newCat);
    setNewCat({ name: '', color: '#10b981', icon: 'circle-dot' });
    load();
  }

  async function addCurrency(e) {
    e.preventDefault();
    if (!newCur.code || !newCur.rate_to_base) return;
    await api.upsertCurrency({ code: newCur.code.toUpperCase(), rate_to_base: Number(newCur.rate_to_base) });
    setNewCur({ code: '', rate_to_base: '' });
    load();
  }

  async function addRecurring(e) {
    e.preventDefault();
    if (!newRec.amount || !newRec.next_date) return;
    await api.createRecurring({ ...newRec, category_id: newRec.category_id || null });
    setNewRec({ vendor: '', amount: '', currency: 'USD', category_id: '', frequency: 'monthly', next_date: new Date().toISOString().slice(0, 10) });
    load();
  }

  async function runSweep() {
    const r = await api.runRecurring();
    setMsg(`Created ${r.created} expense(s) from recurring templates.`);
    load();
  }

  return (
    <div className="space-y-6">
      <Card>
        <h3 className="font-semibold mb-4">General</h3>
        <div className="grid sm:grid-cols-2 gap-4 max-w-xl">
          <div>
            <label>Base currency</label>
            <select value={settings.base_currency} onChange={(e) => saveSettings({ base_currency: e.target.value })}>
              {currencies.map((c) => (
                <option key={c.code} value={c.code}>
                  {c.code}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label>Date parsing preference (ambiguous dates)</label>
            <select value={settings.date_pref} onChange={(e) => saveSettings({ date_pref: e.target.value })}>
              <option value="MDY">MM/DD/YYYY (US)</option>
              <option value="DMY">DD/MM/YYYY (international)</option>
            </select>
          </div>
        </div>
      </Card>

      <Card>
        <h3 className="font-semibold mb-4">Currencies &amp; exchange rates</h3>
        <p className="text-xs text-zinc-500 mb-4">Rate = units of this currency per 1 unit of base currency. Editing a rate only affects new expenses and recalculations — past entries keep their snapshot rate.</p>
        <form onSubmit={addCurrency} className="flex flex-wrap gap-3 items-end mb-4">
          <div>
            <label>Code</label>
            <input value={newCur.code} onChange={(e) => setNewCur({ ...newCur, code: e.target.value })} placeholder="EUR" maxLength={3} className="w-24" />
          </div>
          <div>
            <label>Rate to base</label>
            <input type="number" step="0.0001" value={newCur.rate_to_base} onChange={(e) => setNewCur({ ...newCur, rate_to_base: e.target.value })} placeholder="1.10" className="w-32" />
          </div>
          <Button type="submit">
            <Plus size={15} /> Add / update
          </Button>
        </form>
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs uppercase tracking-wider text-zinc-500 border-b border-zinc-800">
              <th className="py-2">Code</th>
              <th className="py-2">Rate to base</th>
              <th className="py-2">Updated</th>
              <th></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-800">
            {currencies.map((c) => (
              <tr key={c.code}>
                <td className="py-2 font-medium">{c.code}</td>
                <td className="py-2">{c.rate_to_base}</td>
                <td className="py-2 text-zinc-500">{c.updated_at}</td>
                <td className="py-2 text-right">
                  {c.code !== settings.base_currency && (
                    <button className="text-zinc-500 hover:text-red-400 cursor-pointer" onClick={() => api.deleteCurrency(c.code).then(load)}>
                      <Trash2 size={15} />
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>

      <Card>
        <h3 className="font-semibold mb-4">Categories</h3>
        <form onSubmit={addCategory} className="flex flex-wrap gap-3 items-end mb-4">
          <div>
            <label>Name</label>
            <input value={newCat.name} onChange={(e) => setNewCat({ ...newCat, name: e.target.value })} placeholder="Utilities" />
          </div>
          <div>
            <label>Color</label>
            <input type="color" value={newCat.color} onChange={(e) => setNewCat({ ...newCat, color: e.target.value })} className="w-14 h-9 p-1" />
          </div>
          <div>
            <label>Icon</label>
            <select value={newCat.icon} onChange={(e) => setNewCat({ ...newCat, icon: e.target.value })}>
              {Object.keys(ICONS).map((k) => (
                <option key={k} value={k}>
                  {k}
                </option>
              ))}
            </select>
          </div>
          <Button type="submit">
            <Plus size={15} /> Add category
          </Button>
        </form>
        <div className="flex flex-wrap gap-2">
          {categories.map((c) => (
            <div key={c.id} className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-zinc-800 text-sm">
              <span style={{ color: c.color }}>
                <CategoryIcon icon={c.icon} size={14} />
              </span>
              {c.name}
              <button className="text-zinc-500 hover:text-red-400 cursor-pointer" onClick={() => api.deleteCategory(c.id).then(load)}>
                <Trash2 size={12} />
              </button>
            </div>
          ))}
        </div>
      </Card>

      <Card>
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold">Recurring expenses</h3>
          <Button variant="secondary" onClick={runSweep}>
            <Play size={14} /> Run now
          </Button>
        </div>
        {msg && <p className="text-emerald-400 text-sm mb-3">{msg}</p>}
        <form onSubmit={addRecurring} className="flex flex-wrap gap-3 items-end mb-4">
          <div>
            <label>Vendor</label>
            <input value={newRec.vendor} onChange={(e) => setNewRec({ ...newRec, vendor: e.target.value })} placeholder="Adobe" className="w-32" />
          </div>
          <div>
            <label>Amount</label>
            <input type="number" step="0.01" value={newRec.amount} onChange={(e) => setNewRec({ ...newRec, amount: e.target.value })} className="w-28" />
          </div>
          <div>
            <label>Category</label>
            <select value={newRec.category_id} onChange={(e) => setNewRec({ ...newRec, category_id: e.target.value })}>
              <option value="">None</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label>Frequency</label>
            <select value={newRec.frequency} onChange={(e) => setNewRec({ ...newRec, frequency: e.target.value })}>
              <option value="daily">Daily</option>
              <option value="weekly">Weekly</option>
              <option value="monthly">Monthly</option>
              <option value="yearly">Yearly</option>
            </select>
          </div>
          <div>
            <label>Next date</label>
            <input type="date" value={newRec.next_date} onChange={(e) => setNewRec({ ...newRec, next_date: e.target.value })} />
          </div>
          <Button type="submit">
            <Plus size={15} /> Add
          </Button>
        </form>
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs uppercase tracking-wider text-zinc-500 border-b border-zinc-800">
              <th className="py-2">Vendor</th>
              <th className="py-2">Amount</th>
              <th className="py-2">Frequency</th>
              <th className="py-2">Next date</th>
              <th></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-800">
            {recurring.map((r) => (
              <tr key={r.id}>
                <td className="py-2">{r.template.vendor || '—'}</td>
                <td className="py-2">{money(r.template.amount_cents, r.template.currency)}</td>
                <td className="py-2 capitalize text-zinc-400">{r.frequency}</td>
                <td className="py-2 text-zinc-400">{r.next_date}</td>
                <td className="py-2 text-right">
                  <button className="text-zinc-500 hover:text-red-400 cursor-pointer" onClick={() => api.deleteRecurring(r.id).then(load)}>
                    <Trash2 size={15} />
                  </button>
                </td>
              </tr>
            ))}
            {recurring.length === 0 && (
              <tr>
                <td colSpan={5} className="py-6 text-center text-zinc-500">
                  No recurring expenses yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </Card>

      <Card>
        <h3 className="font-semibold mb-4">Projects</h3>
        <ProjectsEditor projects={projects} onChange={load} />
      </Card>
    </div>
  );
}

function ProjectsEditor({ projects, onChange }) {
  const [name, setName] = useState('');
  async function add(e) {
    e.preventDefault();
    if (!name) return;
    await api.createProject({ name });
    setName('');
    onChange();
  }
  return (
    <div>
      <form onSubmit={add} className="flex gap-3 items-end mb-4">
        <div>
          <label>Project name</label>
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Client A" />
        </div>
        <Button type="submit">
          <Plus size={15} /> Add project
        </Button>
      </form>
      <div className="flex flex-wrap gap-2">
        {projects.map((p) => (
          <div key={p.id} className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-zinc-800 text-sm">
            {p.name}
            <button className="text-zinc-500 hover:text-red-400 cursor-pointer" onClick={() => api.deleteProject(p.id).then(onChange)}>
              <Trash2 size={12} />
            </button>
          </div>
        ))}
        {projects.length === 0 && <p className="text-zinc-500 text-sm">No projects yet.</p>}
      </div>
    </div>
  );
}
