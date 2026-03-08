# Events Handler Architect

Discord.js v14.25.1 이벤트 시스템을 설계하는 전문 스킬.

## 사용 방법
`/events-handler [봇 유형/요구사항]`으로 호출

## 제공하는 코드 템플릿

### 1. 이벤트 핸들러 베이스 (src/handlers/BaseHandler.ts)
```typescript
import { Client } from 'discord.js';

export abstract class BaseHandler {
  protected client: Client;

  constructor(client: Client) {
    this.client = client;
  }

  abstract execute(...args: any[]): Promise<void>;

  protected handleError(error: Error): void {
    console.error(`[${this.constructor.name}] Error:`, error);
  }
}
```

### 2. 이벤트 로더 (src/events/EventLoader.ts)
```typescript
import { readdirSync } from 'fs';
import { join } from 'path';
import { Client } from 'discord.js';

export class EventLoader {
  constructor(private client: Client) {}

  loadEvents(): void {
    const eventsPath = join(__dirname, '../events');
    const eventFiles = readdirSync(eventsPath).filter(file => file.endsWith('.ts'));

    for (const file of eventFiles) {
      const event = require(join(eventsPath, file)).default;
      this.client.on(event.name, (...args) => event.execute(...args));
    }
  }
}
```

### 3. 이벤트 등록 예시 (src/events/ready.ts)
```typescript
import { Event } from '../types/Event';
import { Client } from 'discord.js';

export const ready: Event = {
  name: 'ready',
  once: true,
  execute: async (client: Client) => {
    console.log(`Ready! ${client.user?.tag} has logged in.`);
    console.log(`Serving ${client.guilds.cache.size} guilds`);
  }
};
```

### 4. 이벤트 타입 정의 (src/types/Event.ts)
```typescript
export interface Event {
  name: string;
  once?: boolean;
  execute: (...args: any[]) => Promise<void> | void;
}
```

## 지원하는 이벤트 타입
- ready: 봇 시작 시
- guildCreate/guildDelete: 서버 입/퇴장
- messageCreate: 메시지 생성
- interactionCreate: 인터랙션 (슬래시 명령어)
- voiceStateUpdate: 음성 상태 변경
- reactionAdd/reactionRemove: 리액션 이벤트

## 아키텍처 패턴
- Event-driven 설계
- Middleware 체인
- 이벤트 버스 패턴
- 에러 경계 설정