/**
 * Handlers Integration Tests
 * P2 #15: 테스트 커버리지 추가
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Client, Events } from 'discord.js';
import { setupDMHandler } from './dm-handler';

// Mock dependencies
vi.mock('@blog-study/shared/db', () => ({
  getDb: vi.fn(),
  fines: {},
}));

vi.mock('../services', () => ({
  getFineService: vi.fn(() => ({
    markPaid: vi.fn(() => Promise.resolve()),
  })),
  formatFineReason: vi.fn((type) => type === 'late' ? '지각' : '결석'),
}));

describe('Handlers Integration Tests', () => {
  describe('setupDMHandler', () => {
    let mockClient: Client;
    let onSpy: ReturnType<typeof vi.fn>;

    beforeEach(() => {
      onSpy = vi.fn();
      mockClient = {
        on: onSpy,
      } as unknown as Client;
    });

    afterEach(() => {
      vi.clearAllMocks();
    });

    describe('Property 3: 이벤트 리스너 등록', () => {
      it('should register InteractionCreate event listener', () => {
        setupDMHandler(mockClient);
        expect(onSpy).toHaveBeenCalledWith(Events.InteractionCreate, expect.any(Function));
      });

      it('should register exactly 1 event listener', () => {
        setupDMHandler(mockClient);
        expect(onSpy).toHaveBeenCalledTimes(1);
      });
    });

    describe('Property 4: 핸들러 동작 확인', () => {
      it('should call handler function without throwing', () => {
        expect(() => setupDMHandler(mockClient)).not.toThrow();
      });
    });
  });

  describe('DM Handler Helper Functions', () => {
    describe('Property 5: sendFineNotification export 확인', () => {
      it('should export sendFineNotification function', async () => {
        const { sendFineNotification } = await import('./dm-handler');
        expect(typeof sendFineNotification).toBe('function');
      });
    });

    describe('Property 6: sendFineReminder export 확인', () => {
      it('should export sendFineReminder function', async () => {
        const { sendFineReminder } = await import('./dm-handler');
        expect(typeof sendFineReminder).toBe('function');
      });
    });
  });
});
