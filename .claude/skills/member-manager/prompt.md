# Member Manager Architect

Discord.js v14.25.1 멤버 관리 기능을 설계하는 전문 스킬.

## 사용 방법
`/member-manager [멤버 관리 요구사항]`으로 호출

## 제공하는 코드 템플릿

### 1. 멤버 관리자 클래스 (src/managers/MemberManager.ts)
```typescript
import { GuildMember, Presence } from 'discord.js';

export class MemberManager {
  private memberCache = new Map<string, MemberData>();
  private presenceTracker = new Map<string, PresenceData>();

  async getMember(guildId: string, memberId: string): Promise<MemberData | null> {
    const cacheKey = `${guildId}:${memberId}`;

    if (this.memberCache.has(cacheKey)) {
      return this.memberCache.get(cacheKey)!;
    }

    const guild = await this.client.guilds.fetch(guildId);
    const member = await guild.members.fetch(memberId);

    const data: MemberData = {
      id: member.id,
      guildId: guild.id,
      joinedAt: member.joinedAt!,
      roles: Array.from(member.roles.cache.keys()),
      nickname: member.nickname,
      displayName: member.displayName,
      activities: member.activities,
      presence: member.presence,
    };

    this.memberCache.set(cacheKey, data);
    return data;
  }

  trackPresence(memberId: string, presence: Presence): void {
    const data: PresenceData = {
      status: presence.status,
      activities: presence.activities,
      clientStatus: presence.clientStatus,
      lastUpdated: Date.now(),
    };

    this.presenceTracker.set(memberId, data);
  }
}

interface MemberData {
  id: string;
  guildId: string;
  joinedAt: Date;
  roles: string[];
  nickname: string | null;
  displayName: string;
  activities: any[];
  presence: Presence | null;
}

interface PresenceData {
  status: string;
  activities: any[];
  clientStatus: any;
  lastUpdated: number;
}
```

### 2. 활동 추적 시스템 (src/utils/ActivityTracker.ts)
```typescript
export class ActivityTracker {
  private activityLog = new Map<string, ActivityEntry[]>();

  logActivity(memberId: string, activity: ActivityData): void {
    const entry: ActivityEntry = {
      timestamp: Date.now(),
      ...activity,
    };

    if (!this.activityLog.has(memberId)) {
      this.activityLog.set(memberId, []);
    }

    const log = this.activityLog.get(memberId)!;
    log.push(entry);

    // 오래된 로그 정리
    if (log.length > 1000) {
      log.splice(0, log.length - 1000);
    }
  }

  getActivityStats(memberId: string): ActivityStats {
    const log = this.activityLog.get(memberId) || [];

    return {
      totalActivityCount: log.length,
      dailyAverage: log.reduce((sum, entry) => sum + entry.score, 0) / 30,
      topActivities: this.getTopActivities(log),
      lastActivity: log[log.length - 1]?.timestamp || null,
    };
  }
}

interface ActivityData {
  type: 'message' | 'command' | 'voice' | 'reaction';
  score: number;
  details?: any;
}

interface ActivityEntry extends ActivityData {
  timestamp: number;
}

interface ActivityStats {
  totalActivityCount: number;
  dailyAverage: number;
  topActivities: Array<{ type: string; count: number }>;
  lastActivity: number | null;
}
```

### 3. 자동 역할 할당 (src/utils/AutoRoleManager.ts)
```typescript
export class AutoRoleManager {
  async assignAutoRoles(member: GuildMember): Promise<void> {
    const memberData = await this.getMemberData(member.id);

    // 활동 기반 역할
    if (memberData.activityScore >= 100) {
      const role = member.guild.roles.cache.get('ACTIVITY_ROLE_ID');
      if (role) await member.roles.add(role);
    }

    // 시간 기반 역할
    const daysInServer = Math.floor((Date.now() - member.joinedAt.getTime()) / (1000 * 60 * 60 * 24));
    if (daysInServer >= 30) {
      const role = member.guild.roles.cache.get('VETERAN_ROLE_ID');
      if (role) await member.roles.add(role);
    }

    // 특정 조건 충족 시 역할
    if (this.checkSpecialConditions(member)) {
      const role = member.guild.roles.cache.get('SPECIAL_ROLE_ID');
      if (role) await member.roles.add(role);
    }
  }
}
```

### 4. 멤버 검색 필터 (src/utils/MemberFilter.ts)
```typescript
export class MemberFilter {
  searchMembers(guild: Guild, query: SearchQuery): Promise<GuildMember[]> {
    return guild.members.cache.filter(member => {
      if (query.roles && !member.roles.cache.hasAny(...query.roles)) return false;
      if (query.status && member.presence?.status !== query.status) return false;
      if (query.joinedAfter && member.joinedAt < query.joinedAfter) return false;
      if (query.nickname && !member.displayName.toLowerCase().includes(query.nickname.toLowerCase())) return false;
      return true;
    }).values();
  }
}

interface SearchQuery {
  roles?: string[];
  status?: 'online' | 'idle' | 'dnd' | 'offline';
  joinedAfter?: Date;
  nickname?: string;
}
```

## 구현 예시
- 멤버 데이터 모델
- 캐시 최적화 전략
- 이벤트 배칭 처리
- 메모리 관리 방안

## 고급 기능
- 멤버 활동 추적
- 역할 자동 할당
- 가입일 기반 분석
- 성과 통계 계산