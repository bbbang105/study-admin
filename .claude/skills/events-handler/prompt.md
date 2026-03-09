# Events Handler Reference

Discord.js v14 이벤트 처리 예시 모음 - 현재 프로젝트 패턴 기반

## 사용 방법
새로운 이벤트 핸들러 구현 시 참고

## 기본 패턴 (현재 프로젝트 방식)

```typescript
import type { Client, Message } from 'discord.js';
import { Events } from 'discord.js';

/**
 * 커스텀 이벤트 핸들러 등록
 */
export function setupCustomHandler(client: Client): void {
  // 메시지 생성 이벤트
  client.on(Events.MessageCreate, async (message: Message) => {
    try {
      // 봇 메시지 무시
      if (message.author.bot) return;

      // DM 무시
      if (!message.guild) return;

      // 처리 로직
      console.log(`[CustomHandler] Message from ${message.author.id}`);
    } catch (error) {
      console.error('[CustomHandler] Error:', error);
    }
  });

  console.log('✅ Custom handler registered');
}
```

## 주요 이벤트 타입

### 1. 봇 시작 (ClientReady)
```typescript
client.once(Events.ClientReady, (readyClient) => {
  console.log(`✅ Bot logged in as ${readyClient.user.tag}`);
  console.log(`📊 Serving ${readyClient.guilds.cache.size} guild(s)`);
});
```

### 2. 메시지 생성 (MessageCreate)
```typescript
client.on(Events.MessageCreate, async (message: Message) => {
  if (message.author.bot) return;
  if (!message.guild) return;

  // 메시지 처리
});
```

### 3. 리액션 추가 (MessageReactionAdd)
```typescript
client.on(Events.MessageReactionAdd, async (reaction, user) => {
  if (user.bot) return;

  // partial인 경우 fetch
  if (reaction.partial) {
    await reaction.fetch();
  }

  // 리액션 처리
});
```

### 4. 리액션 제거 (MessageReactionRemove)
```typescript
client.on(Events.MessageReactionRemove, async (reaction, user) => {
  if (user.bot) return;

  // 리액션 제거 처리
});
```

### 5. 음성 상태 변경 (VoiceStateUpdate)
```typescript
client.on(Events.VoiceStateUpdate, (oldState, newState) => {
  // 음성 채널 입장/퇴장 처리
});
```

### 6. 멤버 입장 (GuildMemberAdd)
```typescript
client.on(Events.GuildMemberAdd, (member) => {
  // 새 멤버 환영
});
```

### 7. 에러 처리 (Error)
```typescript
client.on(Events.Error, (error) => {
  console.error('❌ Discord client error:', error);
});
```

## 등록 방법 (index.ts)

```typescript
import { createBotClient, setupEventHandlers } from './bot';
import { setupActivityHandler } from './handlers/activity-handler';
import { setupCustomHandler } from './handlers/custom-handler';

async function main(): Promise<void> {
  const client = createBotClient();

  // 기본 이벤트 핸들러
  setupEventHandlers(client);

  // 활동 점수 핸들러
  setupActivityHandler(client);

  // 커스텀 핸들러
  setupCustomHandler(client);

  await startBot(client, env.DISCORD_TOKEN);
}
```

## 에러 처리 패턴

모든 이벤트 핸들러는 try-catch로 감싸야 합니다:

```typescript
client.on(Events.SomeEvent, async (...args) => {
  try {
    // 이벤트 처리 로직
  } catch (error) {
    console.error('[HandlerName] Error:', error);
    // 필요시 로깅 또는 알림
  }
});
```

## 프로젝트에서 사용 중인 핸들러

- `setupEventHandlers()` - 기본 이벤트 (ready, error, warn)
- `setupActivityHandler()` - 활동 점수 (message, reaction)
- `setupDMHandler()` - DM 처리 (벌금 납부 확인)

## 참고

- Discord.js v14.25.1 Events: https://discord.js.org/docs/packages/discord.js/14.25.1/Classes/Client
- 현재 프로젝트: `packages/bot/src/handlers/` 참고
