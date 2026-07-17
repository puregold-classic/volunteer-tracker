// src/__tests__/identifierUtils.test.js — v3.3
// Tri-modal login identifier detection + phone normalization.

import { describe, it, expect } from 'vitest';
import { normalizePhone, detectIdentifierKind } from '../utils/identifierUtils.js';

describe('normalizePhone', () => {
  it('returns null for nullish / empty', () => {
    expect(normalizePhone(null)).toBeNull();
    expect(normalizePhone(undefined)).toBeNull();
    expect(normalizePhone('')).toBeNull();
    expect(normalizePhone('   ')).toBeNull();
  });

  it('strips spaces / dashes / parens', () => {
    expect(normalizePhone('138 0013 8001')).toBe('13800138001');
    expect(normalizePhone('138-0013-8001')).toBe('13800138001');
    expect(normalizePhone('(138) 0013 8001')).toBe('13800138001');
  });

  it('strips +86 country prefix when the rest looks like a Chinese mobile', () => {
    expect(normalizePhone('+86 13800138001')).toBe('13800138001');
    expect(normalizePhone('+8613800138001')).toBe('13800138001');
    expect(normalizePhone('8613800138001')).toBe('13800138001');
  });

  it('rejects too-short / too-long digit strings', () => {
    expect(normalizePhone('12345')).toBeNull();
    expect(normalizePhone('1'.repeat(20))).toBeNull();
  });

  it('preserves full length when not a +86-style number', () => {
    expect(normalizePhone('+1 415 555 1234')).toBe('14155551234');
  });
});

describe('detectIdentifierKind', () => {
  it('email: contains @', () => {
    expect(detectIdentifierKind('ADMIN@Example.COM ')).toEqual({
      kind: 'email', value: 'admin@example.com',
    });
  });

  it('phone: digits-only / with separators', () => {
    expect(detectIdentifierKind('13800138001')).toEqual({
      kind: 'phone', value: '13800138001',
    });
    expect(detectIdentifierKind('+86 138-0013-8001')).toEqual({
      kind: 'phone', value: '13800138001',
    });
  });

  it('volunteerCode: PG-xxxx shape, upper-cased', () => {
    expect(detectIdentifierKind('PG-0001')).toEqual({
      kind: 'volunteerCode', value: 'PG-0001',
    });
    expect(detectIdentifierKind('pg-0042')).toEqual({
      kind: 'volunteerCode', value: 'PG-0042',
    });
  });

  // v3.6 生日制 code "0305a" — 4 digits + one letter, no dash. Regression for the
  // login bug where these fell through to `invalid` (shape required a dash).
  it('volunteerCode: 生日制 MMDDx shape, letter lower-cased', () => {
    expect(detectIdentifierKind('0305a')).toEqual({
      kind: 'volunteerCode', value: '0305a',
    });
    expect(detectIdentifierKind(' 0305A ')).toEqual({
      kind: 'volunteerCode', value: '0305a',
    });
  });

  it('returns invalid for nonsense', () => {
    expect(detectIdentifierKind('').kind).toBe('invalid');
    expect(detectIdentifierKind('   ').kind).toBe('invalid');
    expect(detectIdentifierKind(null).kind).toBe('invalid');
    expect(detectIdentifierKind('random text').kind).toBe('invalid');
  });

  it('phone wins over volunteerCode when dashes are present in a phone', () => {
    // Regression: before the fix, dashed phones were misrouted as codes.
    expect(detectIdentifierKind('+86 138-0013-8001').kind).toBe('phone');
  });
});
