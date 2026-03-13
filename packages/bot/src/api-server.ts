/**
 * Bot HTTP API Server
 * Express server for manual trigger endpoints from web dashboard
 */

import express, { type Express } from 'express';
import rateLimit from 'express-rate-limit';
import logger from './lib/logger';
import {
  getRssPoller,
  getAttendanceChecker,
  getFineReminder,
  getRoundReporter,
  getCurationCrawler,
  getWeeklyRanking,
} from './schedulers';

export function createBotApiServer(): Express {
  const app = express();

  // Middleware
  app.use(express.json());

  // Rate limiting for trigger endpoints (10 requests per minute)
  const triggerLimiter = rateLimit({
    windowMs: 60 * 1000, // 1 minute
    max: 10, // 10 requests per minute
    message: '요청이 너무 많습니다. 잠시 후 다시 시도해주세요.',
    standardHeaders: true,
    legacyHeaders: false,
  });

  // Simple API key auth
  const API_KEY = process.env.BOT_API_KEY || 'dev-api-key-change-in-production';

  const requireAuth = (req: express.Request, res: express.Response, next: express.NextFunction) => {
    // Skip auth in development
    if (process.env.NODE_ENV === 'development') {
      return next();
    }

    const authKey = req.headers['x-api-key'] as string || req.headers['authorization'] as string;

    if (!authKey || authKey !== API_KEY) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    next();
  };

  // Health check
  app.get('/health', (_req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
  });

  // Operation trigger endpoints (with rate limiting)
  app.post('/api/trigger/rss-poll', triggerLimiter, requireAuth, async (_req, res) => {
    try {
      const rssPoller = getRssPoller();

      if (rssPoller.isPolling()) {
        return res.status(409).json({ error: 'RSS 폴링이 이미 실행 중입니다' });
      }

      const result = await rssPoller.poll();
      res.json({ success: true, result });
    } catch (error) {
      logger.error({ error }, '[API] RSS poll error');
      res.status(500).json({
        error: error instanceof Error ? error.message : '알 수 없는 오류'
      });
    }
  });

  app.post('/api/trigger/attendance-check', triggerLimiter, requireAuth, async (_req, res) => {
    try {
      const attendanceChecker = getAttendanceChecker();

      if (attendanceChecker.isChecking()) {
        return res.status(409).json({ error: '출석 체크가 이미 실행 중입니다' });
      }

      const result = await attendanceChecker.check();
      res.json({ success: true, result });
    } catch (error) {
      logger.error({ error }, '[API] Attendance check error');
      res.status(500).json({
        error: error instanceof Error ? error.message : '알 수 없는 오류'
      });
    }
  });

  app.post('/api/trigger/fine-reminder', triggerLimiter, requireAuth, async (_req, res) => {
    try {
      const fineReminder = getFineReminder();

      if (fineReminder.isReminding()) {
        return res.status(409).json({ error: '벌금 알림이 이미 실행 중입니다' });
      }

      const result = await fineReminder.sendReminders();
      res.json({ success: true, result });
    } catch (error) {
      logger.error({ error }, '[API] Fine reminder error');
      res.status(500).json({
        error: error instanceof Error ? error.message : '알 수 없는 오류'
      });
    }
  });

  app.post('/api/trigger/round-report', triggerLimiter, requireAuth, async (_req, res) => {
    try {
      const roundReporter = getRoundReporter();

      if (roundReporter.isReporting()) {
        return res.status(409).json({ error: '회차 리포트가 이미 실행 중입니다' });
      }

      const result = await roundReporter.sendRoundReport();
      res.json({ success: true, result });
    } catch (error) {
      logger.error({ error }, '[API] Round report error');
      res.status(500).json({
        error: error instanceof Error ? error.message : '알 수 없는 오류'
      });
    }
  });

  app.post('/api/trigger/round-start', triggerLimiter, requireAuth, async (_req, res) => {
    try {
      const roundReporter = getRoundReporter();
      const result = await roundReporter.sendRoundStartAnnouncement();
      res.json({ success: true, result });
    } catch (error) {
      logger.error({ error }, '[API] Round start error');
      res.status(500).json({
        error: error instanceof Error ? error.message : '알 수 없는 오류'
      });
    }
  });

  app.post('/api/trigger/curation-crawl', triggerLimiter, requireAuth, async (_req, res) => {
    try {
      const curationCrawler = getCurationCrawler();

      if (curationCrawler.isCrawlingNow()) {
        return res.status(409).json({ error: '큐레이션 크롤링이 이미 실행 중입니다' });
      }

      const result = await curationCrawler.crawl();
      res.json({ success: true, result });
    } catch (error) {
      logger.error({ error }, '[API] Curation crawl error');
      res.status(500).json({
        error: error instanceof Error ? error.message : '알 수 없는 오류'
      });
    }
  });

  app.post('/api/trigger/curation-share', triggerLimiter, requireAuth, async (_req, res) => {
    try {
      const curationCrawler = getCurationCrawler();

      if (curationCrawler.isSharingNow()) {
        return res.status(409).json({ error: '큐레이션 공유가 이미 실행 중입니다' });
      }

      const result = await curationCrawler.shareDailyContent();
      res.json({ success: true, result });
    } catch (error) {
      logger.error({ error }, '[API] Curation share error');
      res.status(500).json({
        error: error instanceof Error ? error.message : '알 수 없는 오류'
      });
    }
  });

  app.post('/api/trigger/weekly-ranking', triggerLimiter, requireAuth, async (_req, res) => {
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
      logger.error({ error }, '[API] Weekly ranking error');
      res.status(500).json({
        error: error instanceof Error ? error.message : '알 수 없는 오류'
      });
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
