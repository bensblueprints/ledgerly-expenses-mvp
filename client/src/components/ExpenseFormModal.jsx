import React, { useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { X, UploadCloud, Loader2, AlertTriangle, Image as ImageIcon } from 'lucide-react';
import { api } from '../api';
import { Button } from './ui.jsx';
import { recognizeReceipt } from '../ocrClient';

const METHODS = ['Cash', 'Credit Card', 'Debit Card', 'Bank Transfer', 'Check', 'Other'];

export default function ExpenseFormModal({ expense, onClose, onSaved }) {
  const isEdit = !!expense;
  const [categories, setCategories] = useState([]);
  const [projects, setProjects] = useState([]);
  const [currencies, setCurrencies] = useState([]);
  const [form, setForm] = useState({
    date: expense?.date || new Date().toISOString().slice(0, 10),
    vendor: expense?.vendor || '',
    amount: expense ? (expense.amount_cents / 100).toFixed(2) : '',
    currency: expense?.currency || 'USD',
    category_id: expense?.category_id || '',
    project_id: expense?.project_id || '',
    method: expense?.method || '',
    notes: expense?.notes || ''
  });
  const [receiptFile, setReceiptFile] = useState(null);
  const [receiptPreview, setReceiptPreview] = useState(expense?.receipt_path ? `/api/receipts/${expense.id}` : null);
  const [ocrBusy, setOcrBusy] = useState(false);
  const [ocrProgress, setOcrProgress] = useState(0);
  const [ocrFlagged, setOcrFlagged] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const fileInputRef = useRef(null);
  const [dragOver, setDragOver] = useState(false);

  useEffect(() => {
    Promise.all([api.categories(), api.projects(), api.currencies()]).then(([c, p, cur]) => {
      setCategories(c);
      setProjects(p);
      setCurrencies(cur);
    });
  }, []);

  async function handleFile(file) {
    if (!file) return;
    setReceiptFile(file);
    setReceiptPreview(URL.createObjectURL(file));
    setOcrBusy(true);
    setOcrProgress(0);
    setError('');
    try {
      const text = await recognizeReceipt(file, (m) => {
        if (m.status === 'recognizing text' && typeof m.progress === 'number') setOcrProgress(Math.round(m.progress * 100));
      });
      const fields = await api.extractFields(text);
      setForm((f) => ({
        ...f,
        vendor: fields.vendor || f.vendor,
        amount: fields.amount != null ? String(fields.amount) : f.amount,
        date: fields.date || f.date
      }));
      setOcrFlagged(true);
    } catch (e) {
      setError('OCR failed: ' + e.message);
    } finally {
      setOcrBusy(false);
    }
  }

  function onDrop(e) {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) handleFile(file);
  }

  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      const payload = { ...form, category_id: form.category_id || null, project_id: form.project_id || null };
      let saved;
      if (isEdit) {
        saved = await api.updateExpense(expense.id, payload);
      } else {
        saved = await api.createExpense(payload);
      }
      if (receiptFile) {
        await api.uploadReceipt(saved.id, receiptFile);
      }
      onSaved(saved);
    } catch (e2) {
      setError(e2.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center p-4 z-50" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <motion.form
        initial={{ opacity: 0, scale: 0.97 }}
        animate={{ opacity: 1, scale: 1 }}
        onSubmit={submit}
        className="w-full max-w-2xl bg-zinc-900 border border-zinc-800 rounded-2xl p-6 max-h-[90vh] overflow-y-auto"
      >
        <div className="flex items-center justify-between mb-5">
          <h2 className="font-bold text-lg">{isEdit ? 'Edit expense' : 'Add expense'}</h2>
          <button type="button" onClick={onClose} className="text-zinc-500 hover:text-white cursor-pointer">
            <X size={20} />
          </button>
        </div>

        <div
          onDragOver={(e) => {
            e.preventDefault();
            setDragOver(true);
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={onDrop}
          onClick={() => fileInputRef.current?.click()}
          className={`border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-colors mb-4 ${
            dragOver ? 'border-emerald-500 bg-emerald-500/5' : 'border-zinc-700 hover:border-zinc-600'
          }`}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept="image/png,image/jpeg,image/webp"
            hidden
            onChange={(e) => handleFile(e.target.files?.[0])}
          />
          {receiptPreview ? (
            <div className="flex flex-col items-center gap-2">
              <img src={receiptPreview} alt="receipt" className="max-h-40 rounded-lg border border-zinc-800 object-contain" />
              <span className="text-xs text-zinc-500">Click or drop to replace</span>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-2 text-zinc-500">
              <UploadCloud size={28} />
              <span className="text-sm">Drop a receipt image, or click to upload</span>
              <span className="text-xs">OCR runs locally in your browser — nothing leaves your machine</span>
            </div>
          )}
          {ocrBusy && (
            <div className="mt-3 flex items-center justify-center gap-2 text-xs text-emerald-400">
              <Loader2 size={14} className="animate-spin" /> Reading receipt… {ocrProgress}%
            </div>
          )}
        </div>

        {ocrFlagged && (
          <div className="flex items-start gap-2 bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs rounded-lg px-3 py-2 mb-4">
            <AlertTriangle size={14} className="mt-0.5 shrink-0" />
            <span>OCR prefilled the fields below — please check them before saving.</span>
          </div>
        )}

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label>Date</label>
            <input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} required />
          </div>
          <div>
            <label>Vendor</label>
            <input value={form.vendor} onChange={(e) => setForm({ ...form, vendor: e.target.value })} placeholder="Acme Coffee" />
          </div>
          <div>
            <label>Amount</label>
            <input
              type="number"
              step="0.01"
              min="0"
              value={form.amount}
              onChange={(e) => setForm({ ...form, amount: e.target.value })}
              required
            />
          </div>
          <div>
            <label>Currency</label>
            <select value={form.currency} onChange={(e) => setForm({ ...form, currency: e.target.value })}>
              {currencies.map((c) => (
                <option key={c.code} value={c.code}>
                  {c.code}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label>Category</label>
            <select value={form.category_id} onChange={(e) => setForm({ ...form, category_id: e.target.value })}>
              <option value="">None</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label>Project</label>
            <select value={form.project_id} onChange={(e) => setForm({ ...form, project_id: e.target.value })}>
              <option value="">None</option>
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label>Payment method</label>
            <select value={form.method} onChange={(e) => setForm({ ...form, method: e.target.value })}>
              <option value="">—</option>
              {METHODS.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>
          </div>
          <div className="col-span-2">
            <label>Notes</label>
            <textarea rows={2} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
          </div>
        </div>

        {error && <p className="text-red-400 text-sm mt-3">{error}</p>}

        <div className="flex justify-end gap-2 mt-5">
          <Button type="button" variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" disabled={busy}>
            {busy ? 'Saving…' : isEdit ? 'Save changes' : 'Add expense'}
          </Button>
        </div>
      </motion.form>
    </div>
  );
}
