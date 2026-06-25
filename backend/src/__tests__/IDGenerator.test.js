// src/__tests__/IDGenerator.test.js
//
// Covers the v3.6 birthday-based volunteerCode scheme + back-compat:
// - generateVolunteerCode(birthday) → "MMDD" + next free dedup letter
// - falls back to legacy "PG-NNNN" when no birthday
// - isValidVolunteerCode / validateIdFormat accept both formats
// - generateSupportId works on a birthday code (PS-0305a-001)

import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockPrisma } = vi.hoisted(() => ({
  mockPrisma: {
    volunteer: { findMany: vi.fn(), findFirst: vi.fn() },
    projectSupport: { findFirst: vi.fn() },
  },
}));

vi.mock('../utils/prismaClient.js', () => ({ default: mockPrisma }));

import IDGenerator from '../utils/IDGenerator.js';

describe('IDGenerator.birthdayToMMDD', () => {
  it('handles Date and string inputs (UTC, zero-padded)', () => {
    expect(IDGenerator.birthdayToMMDD('1990-03-05')).toBe('0305');
    expect(IDGenerator.birthdayToMMDD(new Date('2000-12-31'))).toBe('1231');
    expect(IDGenerator.birthdayToMMDD('1990-01-09')).toBe('0109');
  });
  it('returns null for empty / unparseable', () => {
    expect(IDGenerator.birthdayToMMDD(null)).toBeNull();
    expect(IDGenerator.birthdayToMMDD('')).toBeNull();
    expect(IDGenerator.birthdayToMMDD('not-a-date')).toBeNull();
  });
});

describe('IDGenerator.generateVolunteerCode (birthday)', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('assigns letter a when nobody shares the birthday', async () => {
    mockPrisma.volunteer.findMany.mockResolvedValue([]);
    expect(await IDGenerator.generateVolunteerCode('1990-03-05')).toBe('0305a');
  });

  it('picks the lowest free letter, skipping taken ones', async () => {
    mockPrisma.volunteer.findMany.mockResolvedValue([
      { volunteerCode: '0305a' }, { volunteerCode: '0305c' },
    ]);
    // a and c taken → b is the lowest free
    expect(await IDGenerator.generateVolunteerCode('1990-03-05')).toBe('0305b');
  });

  it('only counts same-MMDD single-letter codes', async () => {
    // a stray PG row or different-day row must not affect the letter scan
    mockPrisma.volunteer.findMany.mockResolvedValue([
      { volunteerCode: '0305a' }, { volunteerCode: '0305b' },
    ]);
    expect(await IDGenerator.generateVolunteerCode(new Date('1975-03-05'))).toBe('0305c');
  });

  it('throws when a-z is exhausted for one day', async () => {
    const all = Array.from({ length: 26 }, (_, i) => ({ volunteerCode: `0305${String.fromCharCode(97 + i)}` }));
    mockPrisma.volunteer.findMany.mockResolvedValue(all);
    await expect(IDGenerator.generateVolunteerCode('1990-03-05')).rejects.toThrow(/超过 26 人/);
  });
});

describe('IDGenerator.generateVolunteerCode (legacy fallback)', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('increments PG-NNNN when no birthday given', async () => {
    mockPrisma.volunteer.findFirst.mockResolvedValue({ volunteerCode: 'PG-0007' });
    expect(await IDGenerator.generateVolunteerCode()).toBe('PG-0008');
    expect(await IDGenerator.generateVolunteerCode('')).toBe('PG-0008');
  });

  it('starts at PG-0001 on an empty table', async () => {
    mockPrisma.volunteer.findFirst.mockResolvedValue(null);
    expect(await IDGenerator.generateVolunteerCode(null)).toBe('PG-0001');
  });
});

describe('IDGenerator validation', () => {
  it('isValidVolunteerCode accepts both formats, rejects junk', () => {
    expect(IDGenerator.isValidVolunteerCode('PG-0001')).toBe(true);
    expect(IDGenerator.isValidVolunteerCode('0305a')).toBe(true);
    expect(IDGenerator.isValidVolunteerCode('0305')).toBe(false);   // no letter
    expect(IDGenerator.isValidVolunteerCode('0305A')).toBe(false);  // uppercase
    expect(IDGenerator.isValidVolunteerCode('PG-1')).toBe(false);
  });

  it('validateIdFormat handles birthday supportId', () => {
    expect(IDGenerator.validateIdFormat('0305a', 'volunteer').isValid).toBe(true);
    expect(IDGenerator.validateIdFormat('PS-0305a-001', 'support').isValid).toBe(true);
    expect(IDGenerator.validateIdFormat('PS-PG-0001-003', 'support').isValid).toBe(true);
  });
});

describe('IDGenerator.generateSupportId on a birthday code', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('builds PS-0305a-001 for the first record', async () => {
    mockPrisma.projectSupport.findFirst.mockResolvedValue(null);
    expect(await IDGenerator.generateSupportId('0305a')).toBe('PS-0305a-001');
  });

  it('increments the per-owner sequence', async () => {
    mockPrisma.projectSupport.findFirst.mockResolvedValue({ supportId: 'PS-0305a-004' });
    expect(await IDGenerator.generateSupportId('0305a')).toBe('PS-0305a-005');
  });
});
