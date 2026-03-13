import { describe, it, expect, beforeEach } from 'vitest';
import { createIdService } from './idService';

describe('idService', () => {
  describe('generate()', () => {
    it('returns a string on the first call', () => {
      const svc = createIdService();
      const id = svc.generate();
      expect(typeof id).toBe('string');
      expect(id.length).toBeGreaterThan(0);
    });

    it('returns unique IDs on successive calls', () => {
      const svc = createIdService();
      const ids = Array.from({ length: 10 }, () => svc.generate());
      const unique = new Set(ids);
      expect(unique.size).toBe(10);
    });

    it('starts with track-1 prefix pattern', () => {
      const svc = createIdService();
      const id = svc.generate();
      expect(id).toBe('track-1');
    });

    it('returns sequential IDs on successive calls', () => {
      const svc = createIdService();
      expect(svc.generate()).toBe('track-1');
      expect(svc.generate()).toBe('track-2');
      expect(svc.generate()).toBe('track-3');
    });

    it('generated IDs are never reused even after many calls', () => {
      const svc = createIdService();
      const count = 50;
      const ids = Array.from({ length: count }, () => svc.generate());
      const unique = new Set(ids);
      expect(unique.size).toBe(count);
    });
  });

  describe('seed()', () => {
    it('prevents seeded IDs from being generated', () => {
      const svc = createIdService();
      svc.seed(['track-1']);
      const id = svc.generate();
      expect(id).not.toBe('track-1');
    });

    it('after seeding [track-1, track-2], generate() returns track-3', () => {
      const svc = createIdService();
      svc.seed(['track-1', 'track-2']);
      expect(svc.generate()).toBe('track-3');
    });

    it('can be called multiple times (additive)', () => {
      const svc = createIdService();
      svc.seed(['track-1']);
      svc.seed(['track-2']);
      // Both should be skipped
      expect(svc.generate()).toBe('track-3');
    });

    it('seeded IDs are never returned even if counter reaches them later', () => {
      const svc = createIdService();
      svc.seed(['track-3', 'track-5']);
      const ids = Array.from({ length: 5 }, () => svc.generate());
      expect(ids).not.toContain('track-3');
      expect(ids).not.toContain('track-5');
    });

    it('accepts an empty array without error', () => {
      const svc = createIdService();
      expect(() => svc.seed([])).not.toThrow();
      // generate() still works normally
      expect(svc.generate()).toBe('track-1');
    });
  });

  describe('independence', () => {
    it('two services have independent state', () => {
      const svc1 = createIdService();
      const svc2 = createIdService();
      svc1.seed(['track-1', 'track-2']);
      // svc2 is not affected by svc1 seed
      expect(svc2.generate()).toBe('track-1');
    });
  });
});
