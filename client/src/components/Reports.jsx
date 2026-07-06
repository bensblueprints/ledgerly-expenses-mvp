import React, { useEffect, useState } from 'react';
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { Download, FileText } from 'lucide-react';
import { api } from '../api';
import { Card, StatTile, money, Button } from './ui.jsx';

const COLORS = ['#10b981', '#f59e0b', '#3b82f6', '#ec4899', '#8b5cf6', '#ef4444', '#14b8a6', '#eab308'];

export default function Reports() {
  const [month, setMonth] = useState(new Date().toISOString().slice(0, 7));
  const [report, setReport] = useState(null);
  const [settings, setSettings] = useState({ base_currency: 'USD' });

  useEffect(() => {
    Promise.all([api.monthlyReport(month), api.getSettings()]).then(([r, s]) => {
      setReport(r);
      setSettings(s);
    });
  }, [month]);

  if (!report) return <div className="text-zinc-500">Loading…</div>;

  const pieData = report.byCategory.filter((c) => c.total_cents > 0).map((c) => ({ name: c.name, value: c.total_cents / 100 }));
  const barData = report.byDay.map((d) => ({ day: d.day.slice(8), total: d.total_cents / 100 }));
  const delta = report.total - report.prevMonthTotal;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end gap-3 justify-between">
        <div>
          <label>Month</label>
          <input type="month" value={month} onChange={(e) => setMonth(e.target.value)} />
        </div>
        <div className="flex gap-2">
          <a href={api.exportCsvUrl({ from: `${month}-01`, to: `${month}-31` })} className="btn-secondary">
            <Download size={15} /> CSV
          </a>
          <a href={api.exportPdfUrl(month)} className="btn-secondary">
            <FileText size={15} /> PDF
          </a>
        </div>
      </div>

      <div className="flex flex-wrap gap-4">
        <StatTile label="Total" value={money(report.total, settings.base_currency)} />
        <StatTile
          label="vs prior month"
          value={`${delta >= 0 ? '+' : ''}${money(delta, settings.base_currency)}`}
          accent={delta > 0 ? 'text-red-400' : 'text-emerald-400'}
        />
        <StatTile label="Top vendor" value={report.topVendors[0]?.vendor || '—'} sub={report.topVendors[0] ? money(report.topVendors[0].total_cents, settings.base_currency) : ''} />
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        <Card>
          <h3 className="font-semibold mb-3">By category</h3>
          {pieData.length === 0 ? (
            <p className="text-zinc-500 text-sm">No spend recorded this month.</p>
          ) : (
            <ResponsiveContainer width="100%" height={280}>
              <PieChart>
                <Pie data={pieData} dataKey="value" nameKey="name" innerRadius={60} outerRadius={100} paddingAngle={2}>
                  {pieData.map((_, i) => (
                    <Cell key={i} fill={COLORS[i % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip formatter={(v) => `$${v.toFixed(2)}`} contentStyle={{ background: '#18181b', border: '1px solid #3f3f46', borderRadius: 8 }} />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          )}
        </Card>

        <Card>
          <h3 className="font-semibold mb-3">Daily spend</h3>
          {barData.length === 0 ? (
            <p className="text-zinc-500 text-sm">No spend recorded this month.</p>
          ) : (
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={barData}>
                <XAxis dataKey="day" stroke="#71717a" fontSize={11} />
                <YAxis stroke="#71717a" fontSize={11} />
                <Tooltip formatter={(v) => `$${v.toFixed(2)}`} contentStyle={{ background: '#18181b', border: '1px solid #3f3f46', borderRadius: 8 }} />
                <Bar dataKey="total" fill="#10b981" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </Card>
      </div>

      <Card>
        <h3 className="font-semibold mb-3">Top vendors</h3>
        {report.topVendors.length === 0 ? (
          <p className="text-zinc-500 text-sm">No vendors recorded this month.</p>
        ) : (
          <table className="w-full text-sm">
            <tbody className="divide-y divide-zinc-800">
              {report.topVendors.map((v) => (
                <tr key={v.vendor}>
                  <td className="py-2">{v.vendor}</td>
                  <td className="py-2 text-right font-semibold">{money(v.total_cents, settings.base_currency)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>
    </div>
  );
}
