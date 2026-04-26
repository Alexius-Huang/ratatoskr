import { describe, it, expect } from 'vitest';
import { extractTicketNumber, extractPrefix, parseDisplayId } from './ticketId';

describe('ticketId', () => {
  describe('extractPrefix', () => {
    it('should return the prefix segment for a valid displayId', () => {
      expect(extractPrefix('RAT-12')).toBe('RAT');
    });

    it('should support multi-segment prefixes', () => {
      expect(extractPrefix('FOO-BAR-3')).toBe('FOO-BAR');
    });

    it('should return null for malformed input', () => {
      expect(extractPrefix('RAT')).toBeNull();
      expect(extractPrefix('12')).toBeNull();
      expect(extractPrefix('RAT-')).toBeNull();
    });
  });

  describe('extractTicketNumber', () => {
    it('should return the numeric suffix for a valid displayId', () => {
      expect(extractTicketNumber('RAT-12')).toBe(12);
    });

    it('should accept a bare numeric string', () => {
      expect(extractTicketNumber('10')).toBe(10);
    });

    it('should return null for a non-numeric suffix', () => {
      expect(extractTicketNumber('RAT-abc')).toBeNull();
    });

    it('should return null for null input', () => {
      expect(extractTicketNumber(null)).toBeNull();
    });

    it('should return null for a zero or negative number', () => {
      // Regex captures only \d+ so negative numbers can't occur; zero is the boundary case
      expect(extractTicketNumber('RAT-0')).toBeNull();
    });
  });

  describe('parseDisplayId', () => {
    it('should return the number when prefix and suffix match', () => {
      expect(parseDisplayId('RAT-7', 'RAT')).toBe(7);
    });

    it('should return null when the prefix does not match', () => {
      expect(parseDisplayId('BUG-7', 'RAT')).toBeNull();
    });

    it('should return null for malformed input', () => {
      expect(parseDisplayId('RAT-', 'RAT')).toBeNull();
      expect(parseDisplayId('rat-7', 'RAT')).toBeNull();
    });
  });
});
