'use client';
import { useCallback, useEffect, useRef, useState } from 'react';

// Thin wrapper over the Express API. Contracts are unchanged from the original app.
export async function api(path, opts = {}) {
  const init = { ...opts };
  if (opts.json !== undefined) {
    init.method = opts.method || 'POST';
    init.headers = { 'Content-Type': 'application/json' };
    init.body = JSON.stringify(opts.json);
  }
  delete init.json;
  let res;
  try {
    res = await fetch('/api' + path, init);
  } catch {
    throw new Error("Couldn't reach the server. Check your connection and try again.");
  }
  if (res.status === 401 && path !== '/auth/login') {
    window.location.href = '/login';
    throw new Error('Your session has ended. Please sign in again.');
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw Object.assign(new Error(data.error || `The server returned an error (${res.status}).`), { status: res.status });
  return data;
}

// Upload with progress events, which fetch can't report.
export function uploadWithProgress(path, form, onProgress) {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('POST', '/api' + path);
    xhr.upload.onprogress = (e) => { if (e.lengthComputable) onProgress?.(e.loaded / e.total); };
    xhr.onload = () => {
      let data = {};
      try { data = JSON.parse(xhr.responseText); } catch { /* not JSON */ }
      if (xhr.status === 401) { window.location.href = '/login'; return reject(new Error('Please sign in')); }
      if (xhr.status >= 200 && xhr.status < 300) resolve(data);
      else reject(new Error(data.error || `Upload failed (${xhr.status})`));
    };
    xhr.onerror = () => reject(new Error("Couldn't reach the server. Check your connection and try again."));
    xhr.send(form);
  });
}

// Keeps the previous data while a new request loads, so tables don't flash empty.
export function useApi(path) {
  const [state, setState] = useState({ data: null, error: null, loading: !!path });
  const seq = useRef(0);
  const load = useCallback(() => {
    if (!path) { setState({ data: null, error: null, loading: false }); return; }
    const id = ++seq.current;
    setState((s) => ({ ...s, loading: true }));
    api(path)
      .then((data) => { if (id === seq.current) setState({ data, error: null, loading: false }); })
      .catch((e) => { if (id === seq.current) setState((s) => ({ data: s.data, error: e.message, loading: false })); });
  }, [path]);
  useEffect(load, [load]);
  return { ...state, reload: load };
}

export const qs = (obj) => {
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries(obj)) if (v !== '' && v !== null && v !== undefined) p.set(k, v);
  return p.toString();
};
