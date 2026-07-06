import React from 'react';

export function Button({ className = '', variant = 'primary', ...props }) {
  const map = { primary: 'btn-primary', secondary: 'btn-secondary', ghost: 'btn-ghost', danger: 'btn-danger' };
  return <button className={`${map[variant] || map.primary} ${className}`} {...props} />;
}

export function Card({ className = '', children, ...props }) {
  return (
    <div className={`card p-5 ${className}`} {...props}>
      {children}
    </div>
  );
}

export function StatTile({ label, value, sub, accent = 'text-emerald-400' }) {
  return (
    <Card className="flex-1 min-w-[160px]">
      <p className="text-xs uppercase tracking-wider text-zinc-500 font-semibold mb-1">{label}</p>
      <p className={`text-2xl font-bold ${accent}`}>{value}</p>
      {sub && <p className="text-xs text-zinc-500 mt-1">{sub}</p>}
    </Card>
  );
}

export function money(cents, currency = 'USD') {
  const n = (cents || 0) / 100;
  try {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(n);
  } catch {
    return `${currency} ${n.toFixed(2)}`;
  }
}

export function ProgressBar({ pct, over }) {
  const clamped = Math.min(pct, 100);
  const color = over ? 'bg-red-500' : pct >= 80 ? 'bg-amber-500' : 'bg-emerald-500';
  return (
    <div className="w-full h-2 rounded-full bg-zinc-800 overflow-hidden">
      <div className={`h-full ${color} transition-all`} style={{ width: `${clamped}%` }} />
    </div>
  );
}
