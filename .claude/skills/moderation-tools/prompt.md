# Moderation Tools Architect

Discord.js v14.25.1 관리 도구(경고, 밴 등)를 설계하는 전문 스킬.

## 사용 방법
`/moderation-tools [관리 기능 요구사항]`으로 호출

## 제공하는 코드 템플릿

### 1. 관리자 시스템 클래스 (src/managers/ModerationManager.ts)
```typescript
import { GuildMember, User } from 'discord.js';

export class ModerationManager {
  private warnings = new Map<string, WarningData[]>();
  private bans = new Map<string, BanData>();
  private kicks = new Map<string, KickData>();

  async warn(member: GuildMember, moderator: User, reason: string): Promise<WarningData> {
    const warning: WarningData = {
      id: this.generateId(),
      memberId: member.id,
      moderatorId: moderator.id,
      reason,
      timestamp: Date.now(),
      guildId: member.guild.id,
    };

    if (!this.warnings.has(member.id)) {
      this.warnings.set(member.id, []);
    }

    const warnings = this.warnings.get(member.id)!;
    warnings.push(warning);

    // 자동 패널티 적용
    await this.applyAutoPenalty(member, warnings.length);

    return warning;
  }

  async ban(member: GuildMember, moderator: User, reason: string, daysToDelete?: number): Promise<BanData> {
    const banData: BanData = {
      id: this.generateId(),
      memberId: member.id,
      moderatorId: moderator.id,
      reason,
      timestamp: Date.now(),
      guildId: member.guild.id,
      daysToDelete,
    };

    await member.ban({ reason, deleteMessageDays: daysToDelete });
    this.bans.set(member.id, banData);

    return banData;
  }

  private async applyAutoPenalty(member: GuildMember, warningCount: number): Promise<void> {
    const rules = await this.getAutoRules();

    for (const rule of rules) {
      if (warningCount >= rule.threshold) {
        switch (rule.action) {
          case 'mute':
            await member.timeout(rule.duration, rule.reason);
            break;
          case 'kick':
            await member.kick(rule.reason);
            break;
          case 'ban':
            await member.ban({ reason: rule.reason });
            break;
        }
        break;
      }
    }
  }
}

interface WarningData {
  id: string;
  memberId: string;
  moderatorId: string;
  reason: string;
  timestamp: number;
  guildId: string;
}

interface BanData {
  id: string;
  memberId: string;
  moderatorId: string;
  reason: string;
  timestamp: number;
  guildId: string;
  daysToDelete?: number;
}
```

### 2. 자동 규칙 시스템 (src/rules/AutoRules.ts)
```typescript
export class AutoRules {
  private rules: AutoRule[] = [
    {
      id: 'spam',
      threshold: 3,
      action: 'mute',
      duration: 300000, // 5분
      reason: '스팸 행위',
      checkType: 'messageCount',
      timeframe: 60000, // 1분
    },
    {
      id: 'link_spam',
      threshold: 1,
      action: 'kick',
      duration: 0,
      reason: '링크 스팸',
      checkType: 'linkMessage',
    },
  ];

  async checkMember(member: GuildMember): Promise<void> {
    for (const rule of this.rules) {
      const violated = await this.checkRuleViolation(member, rule);
      if (violated) {
        await this.applyRule(member, rule);
        break;
      }
    }
  }

  private async checkRuleViolation(member: GuildMember, rule: AutoRule): Promise<boolean> {
    // 규칙 위반 로직 구현
    return false;
  }

  private async applyRule(member: GuildMember, rule: AutoRule): Promise<void> {
    const moderator = this.client.user;

    switch (rule.action) {
      case 'mute':
        await member.timeout(rule.duration, rule.reason);
        break;
      case 'kick':
        await member.kick(rule.reason);
        break;
      case 'ban':
        await member.ban({ reason: rule.reason });
        break;
    }
  }
}

interface AutoRule {
  id: string;
  threshold: number;
  action: 'mute' | 'kick' | 'ban';
  duration: number;
  reason: string;
  checkType: string;
  timeframe?: number;
}
```

### 3. 로깅 시스템 (src/utils/ModerationLogger.ts)
```typescript
export class ModerationLogger {
  async logAction(action: string, moderatorId: string, targetId: string, details: any): Promise<void> {
    const logEntry: ModerationLog = {
      id: this.generateId(),
      action,
      moderatorId,
      targetId,
      details,
      timestamp: Date.now(),
      guildId: details.guildId,
    };

    await this.saveToDatabase(logEntry);

    // 채널에 로그 전송
    const logChannel = await this.getLogChannel(details.guildId);
    if (logChannel) {
      await logChannel.send(this.formatLogMessage(logEntry));
    }
  }

  private formatLogMessage(log: ModerationLog): string {
    const icons = {
      warn: '⚠️',
      kick: '👢',
      ban: '🚫',
      timeout: '⏰',
    };

    return `${icons[log.action as keyof typeof icons] || '📝'} **${log.action.toUpperCase()}**
**대상:** <@${log.targetId}>
**관리자:** <@${log.moderatorId}>
**사유:** ${log.details.reason}
**시간:** <t:${Math.floor(log.timestamp / 1000)}:R>`;
  }
}

interface ModerationLog {
  id: string;
  action: string;
  moderatorId: string;
  targetId: string;
  details: any;
  timestamp: number;
  guildId: string;
}
```

### 4. 관리 커맨드 (src/commands/admin/ModerationCommands.ts)
```typescript
export const warnCommand: Command = {
  name: '경고',
  description: '사용자에게 경고를 부여합니다.',
  options: [
    {
      name: '사용자',
      type: 'USER',
      required: true,
    },
    {
      name: '사유',
      type: 'STRING',
      required: true,
    },
  ],
  async execute(interaction: ChatInputCommandInteraction): Promise<void> {
    const member = interaction.options.getMember('사용자') as GuildMember;
    const reason = interaction.options.getString('사유')!;

    const moderationManager = new ModerationManager();
    const warning = await moderationManager.warn(member, interaction.user, reason);

    await interaction.reply({
      content: `경고가 부여되었습니다.\n**대상:** ${member.user.tag}\n**사유:** ${reason}`,
      ephemeral: true,
    });
  },
};
```

## 구현 패턴
- 패널티 포인트 시스템
- 경고 단계별 처리
- 자동 음정 참여 차단
- 스팸 방지 필터

## 데이터베이스 설계
- 패널티 기록 테이블
- 관리자 로그 테이블
- 규칙 설정 테이블
- 자동화 트리거