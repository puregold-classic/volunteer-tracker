import { useEffect, useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { forumError } from '@/services/forumService';

export function useForumResource<T>(load: () => Promise<T>) {
  const { account } = useAuth();
  const [state, setState] = useState<{ data: T | null; loading: boolean; error: string }>({ data: null, loading: true, error: '' });
  const [version, setVersion] = useState(0);
  useEffect(() => {
    let cancelled = false;
    setState({ data: null, loading: true, error: '' });
    void load().then((data) => { if (!cancelled) setState({ data, loading: false, error: '' }); })
      .catch((error) => { if (!cancelled) setState({ data: null, loading: false, error: forumError(error) }); });
    return () => { cancelled = true; };
  }, [load, version, account?.id]);
  return { ...state, update: (patch: Partial<T>) => setState((previous) => ({ ...previous, data: previous.data ? { ...previous.data, ...patch } : null })), refresh: () => setVersion((v) => v + 1) };
}
