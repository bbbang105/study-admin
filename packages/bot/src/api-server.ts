/**
 * Bot HTTP API Server
 * Express server for manual trigger endpoints from web dashboard
 */

import express, { type Express, type NextFunction, type Request, type Response } from 'express';
import rateLimit from 'express-rate-limit';
import logger from './lib/logger';
import { Sentry } from './lib/sentry';
import {
  getCurationCrawler,
  getDeadlineReminder,
  getFineReminder,
  getPollReminder,
  getPopularPosts,
  getRoundReporter,
  getRssPoller,
  getWeeklyRanking,
} from './schedulers';
import { getAttendanceService } from './services/attendance.service';
import { getEmbeddingService, getFineService } from './services';
import { getCurrentRound, getRoundByNumber, isGracePeriodEnded } from './services/round.service';
import { AttendanceStatus } from '@blog-study/shared/db';

const BOT_API_SECRET = process.env.BOT_API_SECRET;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MAX_EMBEDDING_BATCH_SIZE = 100;

/**
 * Bearer token authentication middleware for trigger endpoints
 */
function authMiddleware(req: Request, res: Response, next: NextFunction): void {
  // 시크릿 미설정 시 인증 스킵 (로컬 개발용)
  if (!BOT_API_SECRET) {
    next();
    return;
  }

  const token = req.headers.authorization?.replace('Bearer ', '');
  if (token !== BOT_API_SECRET) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }

  next();
}

export function createBotApiServer(): Express {
  const app = express();

  // Middleware
  app.use(express.json({ limit: '10kb' }));

  // Rate limiting for trigger endpoints (10 requests per minute)
  const triggerLimiter = rateLimit({
    windowMs: 60 * 1000, // 1 minute
    max: 10, // 10 requests per minute
    message: '요청이 너무 많습니다. 잠시 후 다시 시도해주세요.',
    standardHeaders: true,
    legacyHeaders: false,
  });

  // Health check
  app.get('/health', (_req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
  });

  app.post('/api/internal/embedding/batch', authMiddleware, triggerLimiter, async (req, res) => {
    try {
      const { memberIds = [], curationItemIds = [], postIds = [] } = req.body || {};

      if (
        !Array.isArray(memberIds) ||
        !Array.isArray(curationItemIds) ||
        !Array.isArray(postIds)
      ) {
        return res.status(400).json({ error: '임베딩 갱신 ID 목록이 필요합니다' });
      }

      const uniqueMemberIds = [...new Set(memberIds)].slice(0, MAX_EMBEDDING_BATCH_SIZE);
      const uniqueCurationItemIds = [...new Set(curationItemIds)].slice(0, MAX_EMBEDDING_BATCH_SIZE);
      const uniquePostIds = [...new Set(postIds)].slice(0, MAX_EMBEDDING_BATCH_SIZE);
      const allIds = [...uniqueMemberIds, ...uniqueCurationItemIds, ...uniquePostIds];

      if (
        allIds.length === 0 ||
        allIds.some((id) => typeof id !== 'string' || !UUID_RE.test(id))
      ) {
        return res.status(400).json({ error: '유효한 임베딩 갱신 ID가 필요합니다' });
      }

      const embeddingService = getEmbeddingService();
      let memberPreferencesUpdated = 0;
      let curationItemsUpdated = 0;
      let postsUpdated = 0;

      for (const memberId of uniqueMemberIds) {
        if (await embeddingService.refreshMemberPreference(memberId as string)) {
          memberPreferencesUpdated++;
        }
      }
      for (const itemId of uniqueCurationItemIds) {
        if (await embeddingService.refreshCurationItem(itemId as string)) {
          curationItemsUpdated++;
        }
      }
      for (const postId of uniquePostIds) {
        if (await embeddingService.refreshPost(postId as string)) {
          postsUpdated++;
        }
      }

      res.json({
        success: true,
        updated: {
          memberPreferences: memberPreferencesUpdated,
          curationItems: curationItemsUpdated,
          posts: postsUpdated,
        },
      });
    } catch (error) {
      Sentry.captureException(error);
      logger.error({ error }, '🌐 [API] 임베딩 일괄 갱신 에러');
      res.status(500).json({ error: '내부 오류가 발생했습니다' });
    }
  });

  app.post(
    '/api/internal/embedding/member-preference',
    authMiddleware,
    triggerLimiter,
    async (req, res) => {
      try {
        const { memberId } = req.body || {};
        if (typeof memberId !== 'string' || !UUID_RE.test(memberId)) {
          return res.status(400).json({ error: '유효한 memberId가 필요합니다' });
        }

        const updated = await getEmbeddingService().refreshMemberPreference(memberId);
        res.json({ success: true, updated });
      } catch (error) {
        Sentry.captureException(error);
        logger.error({ error }, '🌐 [API] 멤버 취향 임베딩 갱신 에러');
        res.status(500).json({ error: '내부 오류가 발생했습니다' });
      }
    }
  );

  app.post(
    '/api/internal/embedding/curation-item',
    authMiddleware,
    triggerLimiter,
    async (req, res) => {
      try {
        const { itemId } = req.body || {};
        if (typeof itemId !== 'string' || !UUID_RE.test(itemId)) {
          return res.status(400).json({ error: '유효한 itemId가 필요합니다' });
        }

        const updated = await getEmbeddingService().refreshCurationItem(itemId);
        res.json({ success: true, updated });
      } catch (error) {
        Sentry.captureException(error);
        logger.error({ error }, '🌐 [API] 큐레이션 아이템 임베딩 갱신 에러');
        res.status(500).json({ error: '내부 오류가 발생했습니다' });
      }
    }
  );

  app.post('/api/internal/embedding/post', authMiddleware, triggerLimiter, async (req, res) => {
    try {
      const { postId } = req.body || {};
      if (typeof postId !== 'string' || !UUID_RE.test(postId)) {
        return res.status(400).json({ error: '유효한 postId가 필요합니다' });
      }

      const updated = await getEmbeddingService().refreshPost(postId);
      res.json({ success: true, updated });
    } catch (error) {
      Sentry.captureException(error);
      logger.error({ error }, '🌐 [API] 포스트 임베딩 갱신 에러');
      res.status(500).json({ error: '내부 오류가 발생했습니다' });
    }
  });

  // Operation trigger endpoints (auth + rate limiting)
  app.post('/api/trigger/rss-poll', authMiddleware, triggerLimiter, async (_req, res) => {
    try {
      const rssPoller = getRssPoller();

      if (rssPoller.isPolling()) {
        return res.status(409).json({ error: 'RSS 폴링이 이미 실행 중입니다' });
      }

      const result = await rssPoller.poll();
      res.json({ success: true, result });
    } catch (error) {
      Sentry.captureException(error);
      logger.error({ error }, '🌐 [API] RSS 폴링 에러');
      res.status(500).json({ error: '내부 오류가 발생했습니다' });
    }
  });

  app.post('/api/trigger/attendance-check', authMiddleware, triggerLimiter, async (_req, res) => {
    try {
      const currentRound = await getCurrentRound();
      const prevRound = await getRoundByNumber(currentRound.roundNumber - 1);

      if (!prevRound) {
        return res.status(400).json({ error: '이전 회차가 없습니다' });
      }

      if (!isGracePeriodEnded(prevRound)) {
        return res.status(400).json({ error: '이전 회차 유예 기간이 아직 종료되지 않았습니다' });
      }

      const attendanceService = getAttendanceService();
      const fineService = getFineService();

      // 이전 회차 PENDING → ABSENT 처리
      const processedRecords = await attendanceService.processGracePeriodEnd(prevRound.id);
      const absentRecords = processedRecords.filter((r) => r.status === AttendanceStatus.ABSENT);

      // 결석 벌금 부과
      for (const record of absentRecords) {
        try {
          await fineService.create(record.memberId, prevRound.id, 'absent');
        } catch (fineError) {
          logger.error(
            { memberId: record.memberId, error: fineError },
            '🌐 [API] 결석 벌금 부과 실패'
          );
        }
      }

      res.json({
        success: true,
        result: { roundNumber: prevRound.roundNumber, processedCount: absentRecords.length },
      });
    } catch (error) {
      Sentry.captureException(error);
      logger.error({ error }, '🌐 [API] 출석 체크 에러');
      res.status(500).json({ error: '내부 오류가 발생했습니다' });
    }
  });

  app.post('/api/trigger/fine-reminder', authMiddleware, triggerLimiter, async (_req, res) => {
    try {
      const fineReminder = getFineReminder();

      if (fineReminder.isReminding()) {
        return res.status(409).json({ error: '벌금 알림이 이미 실행 중입니다' });
      }

      const result = await fineReminder.sendAllReminders();
      res.json({ success: true, result });
    } catch (error) {
      Sentry.captureException(error);
      logger.error({ error }, '🌐 [API] 벌금 리마인더 에러');
      res.status(500).json({ error: '내부 오류가 발생했습니다' });
    }
  });

  app.post('/api/trigger/round-report', authMiddleware, triggerLimiter, async (_req, res) => {
    try {
      const roundReporter = getRoundReporter();

      if (roundReporter.isSending()) {
        return res.status(409).json({ error: '회차 리포트가 이미 실행 중입니다' });
      }

      const result = await roundReporter.sendRoundReport(true);
      res.json({ success: true, result });
    } catch (error) {
      Sentry.captureException(error);
      logger.error({ error }, '🌐 [API] 회차 리포트 에러');
      res.status(500).json({ error: '내부 오류가 발생했습니다' });
    }
  });

  app.post('/api/trigger/round-start', authMiddleware, triggerLimiter, async (_req, res) => {
    try {
      const roundReporter = getRoundReporter();

      if (roundReporter.isSending()) {
        return res.status(409).json({ error: '회차 작업이 이미 실행 중입니다' });
      }

      const result = await roundReporter.sendRoundStartAnnouncement(true);
      res.json({ success: true, result });
    } catch (error) {
      Sentry.captureException(error);
      logger.error({ error }, '🌐 [API] 회차 시작 에러');
      res.status(500).json({ error: '내부 오류가 발생했습니다' });
    }
  });

  app.post('/api/trigger/curation-crawl', authMiddleware, triggerLimiter, async (_req, res) => {
    try {
      const curationCrawler = getCurationCrawler();

      if (curationCrawler.isCrawlingNow()) {
        return res.status(409).json({ error: '큐레이션 크롤링이 이미 실행 중입니다' });
      }

      const result = await curationCrawler.crawl();
      res.json({ success: true, result });
    } catch (error) {
      Sentry.captureException(error);
      logger.error({ error }, '🌐 [API] 큐레이션 크롤링 에러');
      res.status(500).json({ error: '내부 오류가 발생했습니다' });
    }
  });

  app.post('/api/trigger/curation-share', authMiddleware, triggerLimiter, async (_req, res) => {
    try {
      const curationCrawler = getCurationCrawler();

      if (curationCrawler.isSharingNow()) {
        return res.status(409).json({ error: '큐레이션 공유가 이미 실행 중입니다' });
      }

      const result = await curationCrawler.shareDailyContent();
      res.json({ success: true, result });
    } catch (error) {
      Sentry.captureException(error);
      logger.error({ error }, '🌐 [API] 큐레이션 공유 에러');
      res.status(500).json({ error: '내부 오류가 발생했습니다' });
    }
  });

  app.post('/api/trigger/weekly-ranking', authMiddleware, triggerLimiter, async (_req, res) => {
    try {
      const weeklyRanking = getWeeklyRanking();

      if (weeklyRanking.isSending()) {
        return res.status(409).json({ error: '주간 랭킹이 이미 실행 중입니다' });
      }

      const result = await weeklyRanking.sendWeeklyRanking();

      // Convert Date objects to strings for JSON serialization
      const serializedResult = {
        ...result,
        timestamp:
          result.timestamp instanceof Date ? result.timestamp.toISOString() : result.timestamp,
      };

      res.json({ success: true, result: serializedResult });
    } catch (error) {
      Sentry.captureException(error);
      logger.error({ error }, '🌐 [API] 주간 랭킹 에러');
      res.status(500).json({ error: '내부 오류가 발생했습니다' });
    }
  });

  app.post('/api/trigger/poll-reminder-dm', authMiddleware, triggerLimiter, async (req, res) => {
    try {
      const pollReminder = getPollReminder();

      if (pollReminder.isReminding()) {
        return res.status(409).json({ error: '투표 리마인더가 이미 실행 중입니다' });
      }

      const { pollId, discordId } = req.body || {};

      if (!pollId) {
        return res.status(400).json({ error: 'pollId가 필요합니다' });
      }

      const result = await pollReminder.sendRemindersForPoll(pollId, discordId);

      const serializedResult = {
        ...result,
        timestamp:
          result.timestamp instanceof Date ? result.timestamp.toISOString() : result.timestamp,
      };

      res.json({ success: true, result: serializedResult });
    } catch (error) {
      Sentry.captureException(error);
      logger.error({ error }, '🌐 [API] 투표 리마인더 에러');
      res.status(500).json({ error: '내부 오류가 발생했습니다' });
    }
  });

  app.post('/api/trigger/popular-posts', authMiddleware, triggerLimiter, async (req, res) => {
    try {
      const popularPosts = getPopularPosts();

      if (popularPosts.isSending()) {
        return res.status(409).json({ error: '인기 포스트 알림이 이미 실행 중입니다' });
      }

      const { roundNumber } = req.body || {};

      const result = await popularPosts.sendPopularPosts(
        true,
        typeof roundNumber === 'number' ? roundNumber : undefined
      );

      const serializedResult = {
        ...result,
        timestamp:
          result.timestamp instanceof Date ? result.timestamp.toISOString() : result.timestamp,
      };

      res.json({ success: true, result: serializedResult });
    } catch (error) {
      Sentry.captureException(error);
      logger.error({ error }, '🌐 [API] 인기 포스트 에러');
      res.status(500).json({ error: '내부 오류가 발생했습니다' });
    }
  });

  app.post('/api/trigger/deadline-reminder', authMiddleware, triggerLimiter, async (req, res) => {
    try {
      const deadlineReminder = getDeadlineReminder();

      if (deadlineReminder.isSending()) {
        return res.status(409).json({ error: '마감 리마인더가 이미 실행 중입니다' });
      }

      const { dDay } = req.body || {};

      // dDay가 지정되면 수동 발송, 아니면 자동(오늘 날짜 기준)
      const result =
        typeof dDay === 'number'
          ? await deadlineReminder.sendManual(dDay)
          : await deadlineReminder.sendReminders();

      const serializedResult = {
        ...result,
        timestamp:
          result.timestamp instanceof Date ? result.timestamp.toISOString() : result.timestamp,
      };

      res.json({ success: true, result: serializedResult });
    } catch (error) {
      Sentry.captureException(error);
      logger.error({ error }, '🌐 [API] 마감 리마인더 에러');
      res.status(500).json({ error: '내부 오류가 발생했습니다' });
    }
  });

  return app;
}

/**
 * Start the API server
 */
export function startBotApiServer(port: number = 3001): Express {
  const app = createBotApiServer();

  app.listen(port, () => {
    logger.info({ port }, '🌐 [API] Bot API 서버 시작 완료');
  });

  return app;
}
