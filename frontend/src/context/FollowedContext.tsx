// frontend/src/context/FollowedContext.tsx — v3.4 multi-list
//
// Central state for the volunteer-list system:
// - lists[]            : all owned lists (default first)
// - followedSet        : derived — members of default list (legacy hot path)
// - membershipOf(vid)  : Set<listId> for chevron popover checkboxes
// - toggle(vid)        : default-list toggle (heart)
// - setMemberOf / setMemberNote / list CRUD : full multi-list mutations
//
// Role gate: only a_admin / b_admin with volunteer binding maintain state;
// other accounts get an empty stub so callers can still mount unconditionally.

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
import type { VolunteerList } from '@services/types';
import { useAuth } from './AuthContext';

interface VolunteerListsState {
  lists: VolunteerList[];
  followedSet: Set<string>;
  loading: boolean;
  refresh: () => Promise<void>;
  toggle: (volunteerId: string) => Promise<boolean>;
  setMemberOf: (
    listId: string,
    volunteerId: string,
    member: boolean,
    note?: string,
  ) => Promise<void>;
  setMemberNote: (listId: string, volunteerId: string, note: string) => Promise<void>;
  createList: (name: string) => Promise<VolunteerList | null>;
  renameList: (listId: string, name: string) => Promise<boolean>;
  deleteList: (listId: string) => Promise<boolean>;
  membershipOf: (volunteerId: string) => Set<string>;
}

const emptyState: VolunteerListsState = {
  lists: [],
  followedSet: new Set(),
  loading: false,
  refresh: async () => {},
  toggle: async () => false,
  setMemberOf: async () => {},
  setMemberNote: async () => {},
  createList: async () => null,
  renameList: async () => false,
  deleteList: async () => false,
  membershipOf: () => new Set(),
};

const VolunteerListsContext = createContext<VolunteerListsState | null>(null);

const isListOwnerRole = (role: string | undefined) =>
  role === 'a_admin' || role === 'b_admin';

export function FollowedProvider({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, account } = useAuth();
  const [lists, setLists] = useState<VolunteerList[]>([]);
  const [loading, setLoading] = useState(false);
  const inflight = useRef(false);

  const enabled =
    isAuthenticated && !!account?.volunteerId && isListOwnerRole(account?.role);

  const refresh = useCallback(async () => {
    if (!enabled) {
      setLists([]);
      return;
    }
    if (inflight.current) return;
    inflight.current = true;
    setLoading(true);
    try {
      const res = await volunteerListService.listMine();
      if (res?.success && res.data) setLists(res.data);
    } finally {
      setLoading(false);
      inflight.current = false;
    }
  }, [enabled]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const followedSet = useMemo(() => {
    const ids = new Set<string>();
    for (const l of lists) {
      if (l.isDefault) {
        for (const m of l.members) ids.add(m.volunteer.id);
      }
    }
    return ids;
  }, [lists]);

  const membershipMap = useMemo(() => {
    const map = new Map<string, Set<string>>();
    for (const l of lists) {
      for (const m of l.members) {
        const key = m.volunteer.id;
        if (!map.has(key)) map.set(key, new Set());
        map.get(key)!.add(l.id);
      }
    }
    return map;
  }, [lists]);

  const membershipOf = useCallback(
    (volunteerId: string) => membershipMap.get(volunteerId) ?? new Set<string>(),
    [membershipMap],
  );

  // Default-list toggle (heart). Optimistic UI; reverts on error.
  const toggle = useCallback(
    async (volunteerId: string) => {
      const wasFollowed = followedSet.has(volunteerId);
      try {
        if (wasFollowed) await volunteerListService.unfollow(volunteerId);
        else await volunteerListService.follow(volunteerId);
        await refresh();
        return !wasFollowed;
      } catch (err) {
        await refresh();
        throw err;
      }
    },
    [followedSet, refresh],
  );

  const setMemberOf = useCallback(
    async (listId: string, volunteerId: string, member: boolean, note?: string) => {
      try {
        if (member) await volunteerListService.addMember(listId, volunteerId, note);
        else await volunteerListService.removeMember(listId, volunteerId);
        await refresh();
      } catch (err) {
        await refresh();
        throw err;
      }
    },
    [refresh],
  );

  const setMemberNote = useCallback(
    async (listId: string, volunteerId: string, note: string) => {
      await volunteerListService.updateMemberNote(listId, volunteerId, note);
      await refresh();
    },
    [refresh],
  );

  const createList = useCallback(
    async (name: string) => {
      const res = await volunteerListService.createList(name);
      await refresh();
      return res?.success && res.data?.list ? res.data.list : null;
    },
    [refresh],
  );

  const renameList = useCallback(
    async (listId: string, name: string) => {
      const res = await volunteerListService.renameList(listId, name);
      await refresh();
      return Boolean(res?.success);
    },
    [refresh],
  );

  const deleteList = useCallback(
    async (listId: string) => {
      const res = await volunteerListService.deleteList(listId);
      await refresh();
      return Boolean(res?.success);
    },
    [refresh],
  );

  const value = useMemo<VolunteerListsState>(
    () => ({
      lists,
      followedSet,
      loading,
      refresh,
      toggle,
      setMemberOf,
      setMemberNote,
      createList,
      renameList,
      deleteList,
      membershipOf,
    }),
    [
      lists,
      followedSet,
      loading,
      refresh,
      toggle,
      setMemberOf,
      setMemberNote,
      createList,
      renameList,
      deleteList,
      membershipOf,
    ],
  );

  return (
    <VolunteerListsContext.Provider value={value}>{children}</VolunteerListsContext.Provider>
  );
}

/** Full state — preferred for new callers needing list CRUD. */
export function useVolunteerLists(): VolunteerListsState {
  return useContext(VolunteerListsContext) ?? emptyState;
}

/** Legacy alias (heart-only callers). Same underlying state. */
export const useFollowed = useVolunteerLists;
