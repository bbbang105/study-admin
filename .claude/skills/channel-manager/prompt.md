# Channel Manager Architect

Discord.js v14.25.1 채널 관리 기능을 설계하는 전문 스킬.

## 사용 방법
`/channel-manager [채널 관리 요구사항]`으로 호출

## 제공하는 코드 템플릿

### 1. 채널 관리자 클래스 (src/managers/ChannelManager.ts)
```typescript
import {
  Guild,
  TextChannel,
  VoiceChannel,
  CategoryChannel,
  ForumChannel,
  StageChannel,
  ChannelType,
  OverwriteResolvable,
  PermissionOverwrite,
} from 'discord.js';

export class ChannelManager {
  async createChannel(
    guild: Guild,
    options: CreateChannelOptions
  ): Promise<TextChannel | VoiceChannel | ForumChannel | StageChannel> {
    const channel = await guild.channels.create({
      name: options.name,
      type: options.type,
      parent: options.parentId,
      topic: options.topic,
      position: options.position,
      permissionOverwrites: options.overwrites,
      bitrate: options.bitrate,
      userLimit: options.userLimit,
      availableTags: options.availableTags,
      defaultReactionEmoji: options.defaultReactionEmoji,
      defaultSortOrder: options.defaultSortOrder,
    });

    return channel;
  }
}

interface CreateChannelOptions {
  name: string;
  type: ChannelType;
  parentId?: string;
  topic?: string;
  position?: number;
  overwrites?: OverwriteResolvable[];
  bitrate?: number;
  userLimit?: number;
  availableTags?: any[];
  defaultReactionEmoji?: string;
  defaultSortOrder?: 'latest_activity' | 'creation_date';
}
```

### 2. 채널 권한 설정 (src/utils/ChannelPermissions.ts)
```typescript
export class ChannelPermissions {
  setChannelPermissions(
    channel: TextChannel | VoiceChannel,
    permissions: Record<string, PermissionResolvable[]>
  ): Promise<void> {
    const overwrites: OverwriteResolvable[] = [];

    for (const [roleName, perms] of Object.entries(permissions)) {
      const role = channel.guild.roles.cache.find(r => r.name === roleName);
      if (role) {
        overwrites.push({
          id: role.id,
          allow: perms,
          deny: [],
        });
      }
    }

    return channel.edit({
      permissionOverwrites: overwrites,
    });
  }
}
```

### 3. 카테고리 관리 (src/managers/CategoryManager.ts)
```typescript
export class CategoryManager {
  async createCategory(guild: Guild, name: string, position?: number): Promise<CategoryChannel> {
    return guild.channels.create({
      name,
      type: ChannelType.GuildCategory,
      position,
    });
  }

  async organizeChannels(guild: Guild, category: CategoryChannel, channelTypes: ChannelType[]): Promise<void> {
    const channels = guild.channels.cache
      .filter(c => c.type === ChannelType.GuildText || c.type === ChannelType.GuildVoice)
      .filter(c => !c.parentId);

    for (const channel of channels) {
      await channel.edit({
        parent: category.id,
        position: 0,
      });
    }
  }
}
```

### 4. 채널 통계 (src/utils/ChannelStats.ts)
```typescript
export class ChannelStats {
  async getChannelStats(channelId: string): Promise<ChannelStatsData> {
    const channel = await this.client.channels.fetch(channelId);

    if (!channel.isTextBased()) return {};

    const messages = await channel.messages.fetch({ limit: 100 });

    return {
      messageCount: messages.size,
      activeHours: this.getActiveHours(messages),
      topUsers: this.getTopUsers(messages),
      mostUsedCommands: this.getMostUsedCommands(messages),
    };
  }
}

interface ChannelStatsData {
  messageCount: number;
  activeHours: Record<string, number>;
  topUsers: Array<{ id: string; count: number }>;
  mostUsedCommands: Array<{ command: string; count: number }>;
}
```

## 지원하는 채널 타입
- 텍스트 채널 (GuildText)
- 음성 채널 (GuildVoice)
- 카테고리 (GuildCategory)
- 스테이지 채널 (GuildStageVoice)
- 포럼 채널 (GuildForum)

## 구현 패턴
- 채널 캐십 전략
- 권한 상속 처리
- 채널 이벤트 핸들링
- 배치 최적화