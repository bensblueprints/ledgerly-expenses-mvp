// Client-side OCR: runs tesseract.js entirely in the browser/renderer, loading
// its worker/core/lang assets from OUR server (never a CDN) — works identically
// in web mode and inside Electron's BrowserWindow since both load from the same
// local HTTP origin.
import { createWorker } from 'tesseract.js';

let workerPromise = null;

async function getWorker(onProgress) {
  if (!workerPromise) {
    workerPromise = (async () => {
      const cfg = await fetch('/api/ocr/config', { credentials: 'same-origin' }).then((r) => r.json());
      const worker = await createWorker('eng', 1, {
        workerPath: cfg.workerPath,
        corePath: cfg.corePath,
        langPath: cfg.langPath,
        logger: onProgress
      });
      return worker;
    })();
  }
  return workerPromise;
}

export async function recognizeReceipt(fileOrBlob, onProgress) {
  const worker = await getWorker(onProgress);
  const {
    data: { text }
  } = await worker.recognize(fileOrBlob);
  return text;
}
