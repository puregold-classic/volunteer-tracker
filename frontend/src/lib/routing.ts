// Pure decision helpers for click-driven navigation. Kept separate
// from App.tsx so they can be unit-tested without router/context mocks.

export interface VolunteerCardTargetOpts {
  isAuthenticated: boolean;
  ownVolunteerId: string | null | undefined;
  targetVolunteerId: string;
}

export interface VolunteerCardTarget {
  route: string;
  /** True when the click should be intercepted by the auth gate. */
  needsLogin: boolean;
  /** True when the user clicked their own card and should land in /me. */
  isSelf: boolean;
}

/**
 * Decide where a volunteer-card click should navigate.
 *
 * Three cases (security-relevant — prevents anonymous access to records
 * and routes self-clicks to the personal page instead of the public
 * detail view):
 *
 * 1. Anonymous → `/login` (caller should also surface a toast)
 * 2. Self      → `/me`     (skip the public detail page)
 * 3. Other     → `/volunteers/:id`
 */
export function resolveVolunteerCardTarget(
  opts: VolunteerCardTargetOpts,
): VolunteerCardTarget {
  if (!opts.isAuthenticated) {
    return { route: '/login', needsLogin: true, isSelf: false };
  }
  if (opts.ownVolunteerId && opts.ownVolunteerId === opts.targetVolunteerId) {
    return { route: '/me', needsLogin: false, isSelf: true };
  }
  return {
    route: `/volunteers/${opts.targetVolunteerId}`,
    needsLogin: false,
    isSelf: false,
  };
}
