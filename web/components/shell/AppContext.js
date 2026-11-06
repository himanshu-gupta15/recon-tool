'use client';
import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { CheckCircle2 } from 'lucide-react';
import { api } from '@/lib/api';

const Ctx = createContext(null);

export function AppProvider({ user, children }) {
  const [counts, setCounts] = useState(null);
  const [toasts, setToasts] = useState([]);
  const timer = useRef({});
  const refreshCounts = useCallback(() => { api('/counts').then(setCounts).catch(() => {}); }, []);
  useEffect(() => { refreshCounts(); }, [refreshCounts]);
  const toast = useCallback((message) => {
    const id = Math.random().toString(36).slice(2);
    setToasts((t) => [...t, { id, message }]);
    timer.current[id] = setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 3800);
  }, []);
  return (
    <Ctx.Provider value={{ user, counts, refreshCounts, toast }}>
      {children}
      <div className="toast-region" aria-live="polite">
        {toasts.map((t) => <div className="toast" key={t.id}><CheckCircle2 aria-hidden="true" />{t.message}</div>)}
      </div>
    </Ctx.Provider>
  );
}

export const useApp = () => useContext(Ctx);
export const useUser = () => useContext(Ctx)?.user;
