/**
 * Bot HTTP API Server
 * Express server for manual trigger endpoints from web dashboard
 */

import express from 'express';
import {
  getRssPoller,
  getAttendanceChecker,
  getFineReminder,
  getRoundReporter,
  getCurationCrawler,
  getWeeklyRanking,
} from './schedulers';

export function createBotApiServer() {
  const app = express();

  // Middleware
  app.use(express.json());

  // Simple API key auth (TODO: use proper auth)
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

  // Operation trigger endpoints
  app.post('/api/trigger/rss-poll', requireAuth, async (_req, res) => {
    try {
      const rssPoller = getRssPoller();

      if (rssPoller.isPolling()) {
        return res.status(409).json({ error: 'RSS 폴링이 이미 실행 중입니다' });
      }

      const result = await rssPoller.poll();
      res.json({ success: true, result });
    } catch (error) {
      console.error('[API] RSS poll error:', error);
      res.status(500).json({
        error: error instanceof Error ? error.message : '알 수 없는 오류'
      });
    }
  });

  app.post('/api/trigger/attendance-check', requireAuth, async (_req, res) => {
    try {
      const attendanceChecker = getAttendanceChecker();

      if (attendanceChecker.isChecking()) {
        return res.status(409).json({ error: '출석 체크가 이미 실행 중입니다' });
      }

      const result = await attendanceChecker.check();
      res.json({ success: true, result });
    } catch (error) {
      console.error('[API] Attendance check error:', error);
      res.status(500).json({
        error: error instanceof Error ? error.message : '알 수 없는 오류'
      });
    }
  });

  app.post('/api/trigger/fine-reminder', requireAuth, async (_req, res) => {
    try {
      const fineReminder = getFineReminder();

      if (fineReminder.isReminding()) {
        return res.status(409).json({ error: '벌금 알림이 이미 실행 중입니다' });
      }

      const result = await fineReminder.sendReminders();
      res.json({ success: true, result });
    } catch (error) {
      console.error('[API] Fine reminder error:', error);
      res.status(500).json({
        error: error instanceof Error ? error.message : '알 수 없는 오류'
      });
    }
  });

  app.post('/api/trigger/round-report', requireAuth, async (_req, res) => {
    try {
      const roundReporter = getRoundReporter();

      if (roundReporter.isReporting()) {
        return res.status(409).json({ error: '회차 리포트가 이미 실행 중입니다' });
      }

      const result = await roundReporter.sendRoundReport();
      res.json({ success: true, result });
    } catch (error) {
      console.error('[API] Round report error:', error);
      res.status(500).json({
        error: error instanceof Error ? error.message : '알 수 없는 오류'
      });
    }
  });

  app.post('/api/trigger/round-start', requireAuth, async (_req, res) => {
    try {
      const roundReporter = getRoundReporter();
      const result = await roundReporter.sendRoundStartAnnouncement();
      res.json({ success: true, result });
    } catch (error) {
      console.error('[API] Round start error:', error);
      res.status(500).json({
        error: error instanceof Error ? error.message : '알 수 없는 오류'
      });
    }
  });

  app.post('/api/trigger/curation-crawl', requireAuth, async (_req, res) => {
    try {
      const curationCrawler = getCurationCrawler();

      if (curationCrawler.isCrawlingNow()) {
        return res.status(409).json({ error: '큐레이션 크롤링이 이미 실행 중입니다' });
      }

      const result = await curationCrawler.crawl();
      res.json({ success: true, result });
    } catch (error) {
      console.error('[API] Curation crawl error:', error);
      res.status(500).json({
        error: error instanceof Error ? error.message : '알 수 없는 오류'
      });
    }
  });

  app.post('/api/trigger/curation-share', requireAuth, async (_req, res) => {
    try {
      const curationCrawler = getCurationCrawler();

      if (curationCrawler.isSharingNow()) {
        return res.status(409).json({ error: '큐레이션 공유가 이미 실행 중입니다' });
      }

      const result = await curationCrawler.shareDailyContent();
      res.json({ success: true, result });
    } catch (error) {
      console.error('[API] Curation share error:', error);
      res.status(500).json({
        error: error instanceof Error ? error.message : '알 수 없는 오류'
      });
    }
  });

  app.post('/api/trigger/weekly-ranking', requireAuth, async (_req, res) => {
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
      console.error('[API] Weekly ranking error:', error);
      // Log full error details
      if (error instanceof Error) {
        console.error('[API] Error stack:', error.stack);
        console.error('[API] Error name:', error.name);
        console.error('[API] Error message:', error.message);
      }
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
export function startBotApiServer(port: number = 3001) {
  const app = createBotApiServer();

  app.listen(port, () => {
    console.log(`[Bot API Server] Listening on port ${port}`);
  });

  return app;
}
