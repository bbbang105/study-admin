/**
 * Bot HTTP API Server
 * Express server for manual trigger endpoints from web dashboard
 */

import express, { type Express, type NextFunction, type Request, type Response } from 'express';
import rateLimit from 'express-rate-limit';
import logger from './lib/logger';
import { Sentry } from './lib/sentry';
import {
  getAttendanceChecker,
  getCurationCrawler,
  getDeadlineReminder,
  getFineReminder,
  getPollReminder,
  getRoundReporter,
  getRssPoller,
  getWeeklyRanking,
} from './schedulers';

const BOT_API_SECRET = process.env.BOT_API_SECRET;

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
      const attendanceChecker = getAttendanceChecker();

      if (attendanceChecker.isChecking()) {
        return res.status(409).json({ error: '출석 체크가 이미 실행 중입니다' });
      }

      const result = await attendanceChecker.check();
      res.json({ success: true, result });
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
        timestamp: result.timestamp instanceof Date
          ? result.timestamp.toISOString()
          : result.timestamp,
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
        timestamp: result.timestamp instanceof Date
          ? result.timestamp.toISOString()
          : result.timestamp,
      };

      res.json({ success: true, result: serializedResult });
    } catch (error) {
      Sentry.captureException(error);
      logger.error({ error }, '🌐 [API] 투표 리마인더 에러');
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
      const result = typeof dDay === 'number'
        ? await deadlineReminder.sendManual(dDay)
        : await deadlineReminder.sendReminders();

      const serializedResult = {
        ...result,
        timestamp: result.timestamp instanceof Date
          ? result.timestamp.toISOString()
          : result.timestamp,
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
