async function req(method, url, body) {
  const opts = { method, headers: {}, credentials: 'same-origin' };
  if (body !== undefined) {
    opts.headers['Content-Type'] = 'application/json';
    opts.body = JSON.stringify(body);
  }
  const r = await fetch(url, opts);
  if (r.status === 401) throw Object.assign(new Error('Unauthorized'), { unauthorized: true });
  const ct = r.headers.get('content-type') || '';
  const j = ct.includes('application/json') ? await r.json().catch(() => ({})) : {};
  if (!r.ok) throw new Error(j.error || `Request failed (${r.status})`);
  return j;
}

function qs(params = {}) {
  const p = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => {
    if (v !== undefined && v !== null && v !== '') p.set(k, v);
  });
  const s = p.toString();
  return s ? `?${s}` : '';
}

export const api = {
  me: () => req('GET', '/api/me'),
  login: (password) => req('POST', '/api/login', { password }),
  logout: () => req('POST', '/api/logout'),

  getSettings: () => req('GET', '/api/settings'),
  saveSettings: (s) => req('PUT', '/api/settings', s),

  categories: () => req('GET', '/api/categories'),
  createCategory: (c) => req('POST', '/api/categories', c),
  updateCategory: (id, c) => req('PUT', `/api/categories/${id}`, c),
  deleteCategory: (id) => req('DELETE', `/api/categories/${id}`),

  projects: () => req('GET', '/api/projects'),
  createProject: (p) => req('POST', '/api/projects', p),
  updateProject: (id, p) => req('PUT', `/api/projects/${id}`, p),
  deleteProject: (id) => req('DELETE', `/api/projects/${id}`),

  currencies: () => req('GET', '/api/currencies'),
  upsertCurrency: (c) => req('POST', '/api/currencies', c),
  deleteCurrency: (code) => req('DELETE', `/api/currencies/${code}`),

  budgets: () => req('GET', '/api/budgets'),
  createBudget: (b) => req('POST', '/api/budgets', b),
  updateBudget: (id, b) => req('PUT', `/api/budgets/${id}`, b),
  deleteBudget: (id) => req('DELETE', `/api/budgets/${id}`),

  recurring: () => req('GET', '/api/recurring'),
  createRecurring: (r) => req('POST', '/api/recurring', r),
  updateRecurring: (id, r) => req('PUT', `/api/recurring/${id}`, r),
  deleteRecurring: (id) => req('DELETE', `/api/recurring/${id}`),
  runRecurring: () => req('POST', '/api/recurring/run'),

  expenses: (filters) => req('GET', `/api/expenses${qs(filters)}`),
  createExpense: (e) => req('POST', '/api/expenses', e),
  updateExpense: (id, e) => req('PUT', `/api/expenses/${id}`, e),
  deleteExpense: (id) => req('DELETE', `/api/expenses/${id}`),
  recalculateExpense: (id) => req('POST', `/api/expenses/${id}/recalculate`),
  uploadReceipt: async (id, file) => {
    const fd = new FormData();
    fd.append('file', file);
    const r = await fetch(`/api/expenses/${id}/receipt`, { method: 'POST', body: fd, credentials: 'same-origin' });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(j.error || 'Upload failed');
    return j;
  },

  ocrConfig: () => req('GET', '/api/ocr/config'),
  extractFields: (text) => req('POST', '/api/ocr/extract-fields', { text }),

  monthlyReport: (month) => req('GET', `/api/reports/monthly${qs({ month })}`),

  exportCsvUrl: (filters) => `/api/export/csv${qs(filters)}`,
  exportPdfUrl: (month) => `/api/export/pdf${qs({ month })}`
};
