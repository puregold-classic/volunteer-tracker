// frontend/src/context/FollowedContext.tsx — v3 wave 3
//
// Shared follow-state for the default "我的关注" list. Caches which
// volunteer ids the authenticated caller has followed so individual
// VolunteerCard components don't each hit the network. Toggles go
// through volunteerListService and refresh the set.

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import volunteerListService from '@services/volunteerListService';
import { useAuth } from './AuthContext';

interface FollowedState {
  followedSet: Set<string>;
  loading: boolean;
  /** Returns the new membership state (true = now followed). */
  toggle: (volunteerId: string) => Promise<boolean>;
  refresh: () => Promise<void>;
}

const FollowedContext = createContext<FollowedState | null>(null);

const emptyState: FollowedState = {
  followedSet: new Set(),
  loading: false,
  toggle: async () => false,
  refresh: async () => {},
};

export function FollowedProvider({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, account } = useAuth();
  const [followedSet, setFollowedSet] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);
  const inflight = useRef(false);

  const refresh = useCallback(async () => {
    if (!isAuthenticated || !account?.volunteerId) {
      setFollowedSet(new Set());
      return;
    }
    if (inflight.current) return;
    inflight.current = true;
    setLoading(true);
    try {
      const res = await volunteerListService.listMine();
      if (res?.success && res.data) {
        const ids = new Set<string>();
        for (const list of res.data) {
          if (list.isDefault) {
            for (const m of list.members) ids.add(m.volunteer.id);
          }
        }
        setFollowedSet(ids);
      }
    } finally {
      setLoading(false);
      inflight.current = false;
    }
  }, [isAuthenticated, account?.volunteerId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const toggle = useCallback(async (volunteerId: string) => {
    const wasFollowed = followedSet.has(volunteerId);
    // Optimistic update so the heart flips instantly.
    setFollowedSet((prev) => {
      const next = new Set(prev);
      if (wasFollowed) next.delete(volunteerId);
      else next.add(volunteerId);
      return next;
    });
    try {
      if (wasFollowed) {
        await volunteerListService.unfollow(volunteerId);
      } else {
        await volunteerListService.follow(volunteerId);
      }
      return !wasFollowed;
    } catch (err) {
      // Rollback on failure.
      setFollowedSet((prev) => {
        const next = new Set(prev);
        if (wasFollowed) next.add(volunteerId);
        else next.delete(volunteerId);
        return next;
      });
      throw err;
    }
  }, [followedSet]);

  const value = useMemo(() => ({ followedSet, loading, toggle, refresh }), [
    followedSet, loading, toggle, refresh,
  ]);

  return (
    <FollowedContext.Provider value={value}>{children}</FollowedContext.Provider>
  );
}

export function useFollowed(): FollowedState {
  return useContext(FollowedContext) ?? emptyState;
}
