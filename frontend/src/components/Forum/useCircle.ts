import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import { forumError, forumService } from '@/services/forumService';
import type { ForumCircle } from '@/services/types';

export function useCircle(management = false) {
  const { slug = '' } = useParams();
  const { account } = useAuth();
  const [circle, setCircle] = useState<ForumCircle | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [version, setVersion] = useState(0);
  useEffect(() => {
    let cancelled = false;
    setCircle(null); setError(''); setLoading(true);
    void forumService.get(slug, management).then((data) => { if (!cancelled) setCircle(data); })
      .catch((err) => { if (!cancelled) setError(forumError(err)); }).finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [slug, management, version, account?.id]);
  return { circle, setCircle, loading, error, refresh: () => setVersion((v) => v + 1) };
}
