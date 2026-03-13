/**
 * Bot HTTP API Server
 * Express server for manual trigger endpoints from web dashboard
 */

import express, { type Express, type Request, type Response, type NextFunction } from 'express';
import rateLimit from 'express-rate-limit';
import logger from './lib/logger';
import { Sentry } from './lib/sentry';
import {
  getRssPoller,
  getAttendanceChecker,
  getFineReminder,
  getRoundReporter,
  getCurationCrawler,
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
      logger.error({ error }, '[API] RSS poll error');
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
      logger.error({ error }, '[API] Attendance check error');
      res.status(500).json({ error: '내부 오류가 발생했습니다' });
    }
  });

  app.post('/api/trigger/fine-reminder', authMiddleware, triggerLimiter, async (_req, res) => {
    try {
      const fineReminder = getFineReminder();

      if (fineReminder.isReminding()) {
        return res.status(409).json({ error: '벌금 알림이 이미 실행 중입니다' });
      }

      const result = await fineReminder.sendReminders();
      res.json({ success: true, result });
    } catch (error) {
      Sentry.captureException(error);
      logger.error({ error }, '[API] Fine reminder error');
      res.status(500).json({ error: '내부 오류가 발생했습니다' });
    }
  });

  app.post('/api/trigger/round-report', authMiddleware, triggerLimiter, async (_req, res) => {
    try {
      const roundReporter = getRoundReporter();

      if (roundReporter.isReporting()) {
        return res.status(409).json({ error: '회차 리포트가 이미 실행 중입니다' });
      }

      const result = await roundReporter.sendRoundReport();
      res.json({ success: true, result });
    } catch (error) {
      Sentry.captureException(error);
      logger.error({ error }, '[API] Round report error');
      res.status(500).json({ error: '내부 오류가 발생했습니다' });
    }
  });

  app.post('/api/trigger/round-start', authMiddleware, triggerLimiter, async (_req, res) => {
    try {
      const roundReporter = getRoundReporter();

      if (roundReporter.isReporting()) {
        return res.status(409).json({ error: '회차 작업이 이미 실행 중입니다' });
      }

      const result = await roundReporter.sendRoundStartAnnouncement();
      res.json({ success: true, result });
    } catch (error) {
      Sentry.captureException(error);
      logger.error({ error }, '[API] Round start error');
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
      logger.error({ error }, '[API] Curation crawl error');
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
      logger.error({ error }, '[API] Curation share error');
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
      logger.error({ error }, '[API] Weekly ranking error');
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
    logger.info({ port }, 'Bot API Server started');
  });

  return app;
}
