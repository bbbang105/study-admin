# Guild Manager Architect

Discord.js v14.25.1 길드(서버) 관리 기능을 설계하는 전문 스킬.

## 사용 방법
`/guild-manager [관리 기능 요구사항]`으로 호출

## 제공하는 코드 템플릿

### 1. 길드 관리자 클래스 (src/managers/GuildManager.ts)
```typescript
import { Guild, Snowflake } from 'discord.js';

export class GuildManager {
  private guildCache = new Map<Snowflake, GuildData>();

  async getGuild(guildId: Snowflake): Promise<GuildData> {
    if (this.guildCache.has(guildId)) {
      return this.guildCache.get(guildId)!;
    }

    const guild = await this.client.guilds.fetch(guildId);
    const data = {
      id: guild.id,
      name: guild.name,
      memberCount: guild.memberCount,
      channels: Array.from(guild.channels.cache.keys()),
      roles: Array.from(guild.roles.cache.keys()),
      settings: await this.loadGuildSettings(guildId),
    };

    this.guildCache.set(guildId, data);
    return data;
  }

  async updateGuild(guildId: Snowflake, data: Partial<GuildData>): Promise<void> {
    const current = await this.getGuild(guildId);
    this.guildCache.set(guildId, { ...current, ...data });
    await this.saveGuildSettings(guildId, this.guildCache.get(guildId)!);
  }
}

interface GuildData {
  id: Snowflake;
  name: string;
  memberCount: number;
  channels: Snowflake[];
  roles: Snowflake[];
  settings: GuildSettings;
}
```

### 2. 길드 설정 모델 (src/models/GuildSettings.ts)
```typescript
export interface GuildSettings {
  prefix: string;
  adminRoleId: Snowflake;
  modRoleId: Snowflake;
  logChannelId: Snowflake;
  welcomeChannelId: Snowflake;
  autoRoleIds: Snowflake[];
  disabledCommands: string[];
  language: 'ko' | 'en';
}
```

### 3. 길드 로그 시스템 (src/utils/GuildLogger.ts)
```typescript
export class GuildLogger {
  private logQueue = new Map<Snowflake, LogEntry[]>();

  async log(guildId: Snowflake, type: 'join' | 'leave' | 'command' | 'error', data: any): Promise<void> {
    const entry: LogEntry = {
      timestamp: Date.now(),
      type,
      data,
    };

    if (!this.logQueue.has(guildId)) {
      this.logQueue.set(guildId, []);
    }

    const queue = this.logQueue.get(guildId)!;
    queue.push(entry);

    // 배치 처리
    if (queue.length >= 100) {
      await this.flushLogs(guildId);
    }
  }

  private async flushLogs(guildId: Snowflake): Promise<void> {
    const queue = this.logQueue.get(guildId);
    if (!queue) return;

    // 데이터베이스에 저장
    await this.saveLogs(guildId, queue);
    this.logQueue.delete(guildId);
  }
}
```

### 4. 길드 통계 모듈 (src/utils/GuildStats.ts)
```typescript
export class GuildStats {
  async getStats(guildId: Snowflake): Promise<GuildStatsData> {
    const guild = await this.client.guilds.fetch(guildId);

    return {
      memberCount: guild.memberCount,
      channelCount: guild.channels.cache.size,
      roleCount: guild.roles.cache.size,
      onlineCount: guild.members.cache.filter(m => m.presence?.status === 'online').size,
      activityByDay: await this.getActivityByDay(guildId),
    };
  }
}

interface GuildStatsData {
  memberCount: number;
  channelCount: number;
  roleCount: number;
  onlineCount: number;
  activityByDay: Record<string, number>;
}
```

## 구현 예시
- 길드 데이터베이스 모델
- 캐시 최적화 방안
- 배치 처리 구조
- 메모리 관리 패턴

## 성능 최적화
- 길드 데이터 캐싱
- 불필요한 API 호출 방지
- 이벤트 드리블링
- 배치 처리 활용