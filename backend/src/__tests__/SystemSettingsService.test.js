// src/__tests__/SystemSettingsService.test.js — v2.1
//
// Tests the singleton + lock validation rules:
// - get() returns the row, self-heals if missing
// - setLockedBefore refuses backward moves (forward-only)
// - unlock requires explicit allowUnlock=true
// - isDateLocked reflects current state

import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockPrisma } = vi.hoisted(() => ({
  mockPrisma: {
    systemSettings: {
      findUnique: vi.fn(),
      update: vi.fn(),
      upsert: vi.fn(),
    },
  },
}));

vi.mock('../utils/prismaClient.js', () => ({ default: mockPrisma }));

import SystemSettingsService from '../services/SystemSettingsService.js';

beforeEach(() => {
  vi.clearAllMocks();
});

describe('SystemSettingsService.get', () => {
  it('returns row when present', async () => {
    mockPrisma.systemSettings.findUnique.mockResolvedValue({ id: 1, lockedBefore: null });
    const r = await SystemSettingsService.get();
    expect(r.id).toBe(1);
    expect(mockPrisma.systemSettings.upsert).not.toHaveBeenCalled();
  });

  it('self-heals via upsert when row missing', async () => {
    mockPrisma.systemSettings.findUnique.mockResolvedValue(null);
    mockPrisma.systemSettings.upsert.mockResolvedValue({ id: 1, lockedBefore: null });
    const r = await SystemSettingsService.get();
    expect(r.id).toBe(1);
    expect(mockPrisma.systemSettings.upsert).toHaveBeenCalled();
  });
});

describe('SystemSettingsService.setLockedBefore', () => {
  const operator = { id: 'admin-1', name: 'Admin', role: 'admin' };

  it('forward move accepted (null → date)', async () => {
    mockPrisma.systemSettings.findUnique.mockResolvedValue({ id: 1, lockedBefore: null });
    mockPrisma.systemSettings.update.mockResolvedValue({ id: 1, lockedBefore: new Date('2026-04-01') });
    const r = await SystemSettingsService.setLockedBefore('2026-04-01', operator);
    expect(r.settings).toBeDefined();
  });

  it('forward move accepted (earlier → later date)', async () => {
    mockPrisma.systemSettings.findUnique.mockResolvedValue({ id: 1, lockedBefore: new Date('2026-03-01') });
    mockPrisma.systemSettings.update.mockResolvedValue({ id: 1, lockedBefore: new Date('2026-04-01') });
    const r = await SystemSettingsService.setLockedBefore('2026-04-01', operator);
    expect(r.settings).toBeDefined();
  });

  it('backward move rejected', async () => {
    mockPrisma.systemSettings.findUnique.mockResolvedValue({ id: 1, lockedBefore: new Date('2026-04-01') });
    const r = await SystemSettingsService.setLockedBefore('2026-03-01', operator);
    expect(r.validationError).toMatch(/回退/);
    expect(mockPrisma.systemSettings.update).not.toHaveBeenCalled();
  });

  it('unlock without allowUnlock rejected', async () => {
    mockPrisma.systemSettings.findUnique.mockResolvedValue({ id: 1, lockedBefore: new Date('2026-04-01') });
    const r = await SystemSettingsService.setLockedBefore(null, operator);
    expect(r.validationError).toMatch(/allowUnlock/);
    expect(mockPrisma.systemSettings.update).not.toHaveBeenCalled();
  });

  it('unlock with allowUnlock accepted', async () => {
    mockPrisma.systemSettings.findUnique.mockResolvedValue({ id: 1, lockedBefore: new Date('2026-04-01') });
    mockPrisma.systemSettings.update.mockResolvedValue({ id: 1, lockedBefore: null });
    const r = await SystemSettingsService.setLockedBefore(null, operator, { allowUnlock: true });
    expect(r.settings).toBeDefined();
  });
});

describe('SystemSettingsService.isDateLocked', () => {
  it('returns false when no lock set', async () => {
    mockPrisma.systemSettings.findUnique.mockResolvedValue({ id: 1, lockedBefore: null });
    const r = await SystemSettingsService.isDateLocked('2026-04-01');
    expect(r).toBe(false);
  });

  it('returns true for date strictly before lockedBefore', async () => {
    mockPrisma.systemSettings.findUnique.mockResolvedValue({ id: 1, lockedBefore: new Date('2026-04-01') });
    const r = await SystemSettingsService.isDateLocked('2026-03-30');
    expect(r).toBe(true);
  });

  it('returns false for date on or after lockedBefore', async () => {
    mockPrisma.systemSettings.findUnique.mockResolvedValue({ id: 1, lockedBefore: new Date('2026-04-01') });
    const r = await SystemSettingsService.isDateLocked('2026-04-15');
    expect(r).toBe(false);
  });
});
