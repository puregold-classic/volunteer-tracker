// Security-relevant unit coverage for resolveVolunteerCardTarget.
//
// Three cases this guards:
// 1. Anonymous viewers must NEVER reach /volunteers/:id directly via
//    a card click (records would 401 anyway, but the click should
//    surface a login prompt).
// 2. A logged-in volunteer clicking their own card must land on /me,
//    not the public detail page (UX + privacy parity).
// 3. Otherwise the click resolves to the public detail page.

import { describe, it, expect } from 'vitest';
import { resolveVolunteerCardTarget } from '../lib/routing';

describe('resolveVolunteerCardTarget', () => {
  it('anonymous click → /login + needsLogin flag', () => {
    const t = resolveVolunteerCardTarget({
      isAuthenticated: false,
      ownVolunteerId: null,
      targetVolunteerId: 'cuid_other',
    });
    expect(t).toEqual({ route: '/login', needsLogin: true, isSelf: false });
  });

  it('self click → /me', () => {
    const t = resolveVolunteerCardTarget({
      isAuthenticated: true,
      ownVolunteerId: 'cuid_self',
      targetVolunteerId: 'cuid_self',
    });
    expect(t).toEqual({ route: '/me', needsLogin: false, isSelf: true });
  });

  it('other volunteer click → /volunteers/:id', () => {
    const t = resolveVolunteerCardTarget({
      isAuthenticated: true,
      ownVolunteerId: 'cuid_self',
      targetVolunteerId: 'cuid_other',
    });
    expect(t).toEqual({
      route: '/volunteers/cuid_other',
      needsLogin: false,
      isSelf: false,
    });
  });

  it('admin (no volunteerId) clicking any card → /volunteers/:id', () => {
    // admin role has volunteerId === null, so isSelf can never trigger.
    const t = resolveVolunteerCardTarget({
      isAuthenticated: true,
      ownVolunteerId: null,
      targetVolunteerId: 'cuid_other',
    });
    expect(t.route).toBe('/volunteers/cuid_other');
    expect(t.isSelf).toBe(false);
  });

  it('does NOT trigger isSelf when both ids are null/empty', () => {
    // Defensive: empty string === empty string but should not be treated
    // as the user clicking themselves.
    const t = resolveVolunteerCardTarget({
      isAuthenticated: true,
      ownVolunteerId: null,
      targetVolunteerId: '',
    });
    expect(t.isSelf).toBe(false);
    expect(t.route).toBe('/volunteers/');
  });
});
