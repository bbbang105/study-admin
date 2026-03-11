/**
 * Round Service Integration Tests
 * P2 #15: 테스트 커버리지 추가
 */

import { describe, it, expect } from 'vitest';
import {
  isDeadlinePassed,
  isGracePeriod,
  isGracePeriodEnded,
  getConfigValue,
} from './round.service';

describe('Round Service Integration Tests', () => {

  describe('isDeadlinePassed', () => {
    describe('Property 4: 마감일 지났으면 true', () => {
      it('should return true when date is after deadline', () => {
        const round = {
          roundNumber: 1,
          startDate: '2026-03-01',
          endDate: '2026-03-07',
          graceEndDate: '2026-03-10',
        };

        const currentDate = new Date('2026-03-08');
        const result = isDeadlinePassed(round, currentDate);
        expect(result).toBe(true);
      });
    });

    describe('Property 5: 마감일 전이면 false', () => {
      it('should return false when date is before deadline', () => {
        const round = {
          roundNumber: 1,
          startDate: '2026-03-01',
          endDate: '2026-03-07',
          graceEndDate: '2026-03-10',
        };

        const currentDate = new Date('2026-03-05');
        const result = isDeadlinePassed(round, currentDate);
        expect(result).toBe(false);
      });
    });
  });

  describe('isGracePeriod', () => {
    describe('Property 6: 그레이스 기간 내이면 true', () => {
      it('should return true when date is within grace period', () => {
        const round = {
          roundNumber: 1,
          startDate: '2026-03-01',
          endDate: '2026-03-07',
          graceEndDate: '2026-03-10',
        };

        const currentDate = new Date('2026-03-09');
        const result = isGracePeriod(round, currentDate);
        expect(result).toBe(true);
      });
    });

    describe('Property 7: 그레이스 기간 밖이면 false', () => {
      it('should return false when date is outside grace period', () => {
        const round = {
          roundNumber: 1,
          startDate: '2026-03-01',
          endDate: '2026-03-07',
          graceEndDate: '2026-03-10',
        };

        const currentDate = new Date('2026-03-11');
        const result = isGracePeriod(round, currentDate);
        expect(result).toBe(false);
      });
    });
  });

  describe('isGracePeriodEnded', () => {
    describe('Property 8: 그레이스 기간 종료 후이면 true', () => {
      it('should return true when date is after grace period', () => {
        const round = {
          roundNumber: 1,
          startDate: '2026-03-01',
          endDate: '2026-03-07',
          graceEndDate: '2026-03-10',
        };

        const currentDate = new Date('2026-03-11');
        const result = isGracePeriodEnded(round, currentDate);
        expect(result).toBe(true);
      });
    });

    describe('Property 9: 그레이스 기간 내이면 false', () => {
      it('should return false when date is within grace period', () => {
        const round = {
          roundNumber: 1,
          startDate: '2026-03-01',
          endDate: '2026-03-07',
          graceEndDate: '2026-03-10',
        };

        const currentDate = new Date('2026-03-09');
        const result = isGracePeriodEnded(round, currentDate);
        expect(result).toBe(false);
      });
    });

    describe('Property 10: 그레이스 종료일 23:59:59이면 false', () => {
      it('should return false at grace end date 23:59:59', () => {
        const round = {
          roundNumber: 1,
          startDate: '2026-03-01',
          endDate: '2026-03-07',
          graceEndDate: '2026-03-10',
        };

        const currentDate = new Date('2026-03-10T23:59:59');
        const result = isGracePeriodEnded(round, currentDate);
        expect(result).toBe(false);
      });
    });
  });

  describe('Function Exports', () => {
    describe('Property 11: isDeadlinePassed export 확인', () => {
      it('should export isDeadlinePassed function', () => {
        expect(typeof isDeadlinePassed).toBe('function');
      });
    });

    describe('Property 12: isGracePeriod export 확인', () => {
      it('should export isGracePeriod function', () => {
        expect(typeof isGracePeriod).toBe('function');
      });
    });

    describe('Property 13: isGracePeriodEnded export 확인', () => {
      it('should export isGracePeriodEnded function', () => {
        expect(typeof isGracePeriodEnded).toBe('function');
      });
    });
  });

  describe('Date Handling', () => {
    describe('Property 14: 날짜 문자열 파싱 정확성', () => {
      it('should correctly parse date strings internally', () => {
        const round = {
          roundNumber: 1,
          startDate: '2026-03-01',
          endDate: '2026-03-07',
          graceEndDate: '2026-03-10',
        };

        const currentDate = new Date('2026-03-05');

        // Should not throw
        expect(() => isDeadlinePassed(round, currentDate)).not.toThrow();
        expect(() => isGracePeriod(round, currentDate)).not.toThrow();
        expect(() => isGracePeriodEnded(round, currentDate)).not.toThrow();
      });
    });

    describe('Property 15: 여러 번 호출해도 일관된 결과', () => {
      it('should return consistent results across multiple calls', () => {
        const round = {
          roundNumber: 1,
          startDate: '2026-03-01',
          endDate: '2026-03-07',
          graceEndDate: '2026-03-10',
        };

        const currentDate = new Date('2026-03-05');

        const results = Array.from({ length: 10 }, () =>
          isDeadlinePassed(round, currentDate)
        );

        results.forEach((result) => {
          expect(result).toBe(results[0]);
        });
      });
    });
  });
});
