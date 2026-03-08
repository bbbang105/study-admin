# Message Handler Architect

Discord.js v14.25.1 메시지 처리 시스템을 설계하는 전문 스킬.

## 사용 방법
`/message-handler [메시지 처리 요구사항]`으로 호출

## 제공하는 코드 템플릿

### 1. 메시지 핸들러 베이스 (src/handlers/MessageHandler.ts)
```typescript
import { Message, MessageFlags } from 'discord.js';

export class MessageHandler {
  private filters = new Set<MessageFilter>();
  private processors = new Set<MessageProcessor>();

  addFilter(filter: MessageFilter): void {
    this.filters.add(filter);
  }

  addProcessor(processor: MessageProcessor): void {
    this.processors.add(processor);
  }

  async handleMessage(message: Message): Promise<void> {
    // 1. 필터링
    for (const filter of this.filters) {
      const result = await filter.check(message);
      if (!result.passed) {
        await message.reply({ content: result.reason, flags: [MessageFlags.Ephemeral] });
        return;
      }
    }

    // 2. 처리
    for (const processor of this.processors) {
      await processor.process(message);
    }
  }
}

export interface MessageFilter {
  check(message: Message): Promise<{ passed: boolean; reason?: string }>;
}

export interface MessageProcessor {
  process(message: Message): Promise<void>;
}
```

### 2. 스팸 필터 (src/filters/SpamFilter.ts)
```typescript
export class SpamFilter implements MessageFilter {
  private userMessages = new Map<string, MessageData[]>();

  async check(message: Message): Promise<{ passed: boolean; reason?: string }> {
    const userMsgs = this.userMessages.get(message.author.id) || [];
    const recentMessages = userMsgs.filter(m => Date.now() - m.timestamp < 5000);

    if (recentMessages.length > 5) {
      return {
        passed: false,
        reason: '스팸 메시지가 감지되었습니다.',
      };
    }

    // 메시지 기록
    userMsgs.push({
      content: message.content,
      timestamp: Date.now(),
    });

    // 오래된 메시지 정리
    if (userMsgs.length > 100) {
      userMsgs.splice(0, userMsgs.length - 100);
    }

    this.userMessages.set(message.author.id, userMsgs);
    return { passed: true };
  }
}
```

### 3. 커맨드 프로세서 (src/processors/CommandProcessor.ts)
```typescript
export class CommandProcessor implements MessageProcessor {
  private commands = new Map<string, CommandHandler>();

  registerCommand(prefix: string, handler: CommandHandler): void {
    this.commands.set(prefix, handler);
  }

  async process(message: Message): Promise<void> {
    if (!message.content.startsWith(this.bot.prefix)) return;

    const content = message.content.slice(this.bot.prefix.length);
    const args = content.split(' ');
    const command = args.shift();

    const handler = this.commands.get(command!);
    if (handler) {
      try {
        await handler.handle(message, args);
      } catch (error) {
        await message.reply('명령어 처리 중 오류가 발생했습니다.');
      }
    }
  }
}

export interface CommandHandler {
  handle(message: Message, args: string[]): Promise<void>;
}
```

### 4. 자동 응답 시스템 (src/processors/AutoResponseProcessor.ts)
```typescript
export class AutoResponseProcessor implements MessageProcessor {
  private responses = new Map<string, AutoResponse>();

  addResponse(trigger: string, response: AutoResponse): void {
    this.responses.set(trigger, response);
  }

  async process(message: Message): Promise<void> {
    const content = message.content.toLowerCase();

    for (const [trigger, response] of this.responses) {
      if (content.includes(trigger.toLowerCase())) {
        await message.reply(response.text);
        if (response.deleteAfter) {
          setTimeout(() => message.delete(), response.deleteAfter);
        }
      }
    }
  }
}

export interface AutoResponse {
  text: string;
  deleteAfter?: number;
  cooldown?: number;
}
```

## 처리 방식
- 이벤트 드리블링
- 미들웨어 체인
- 비동기 처리 큐
- 캐시 최적화

## 고급 기능
- 자연어 처리(NLP) 연동
- 감정 분석
- 키워드 추출
- 컨텍스트 유지