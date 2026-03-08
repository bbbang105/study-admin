# Commands Manager Architect

Discord.js v14.25.1 커맨드 시스템을 설계하는 전문 스킬.

## 사용 방법
`/commands-manager [커맨드 유형/요구사항]`으로 호출

## 제공하는 코드 템플릿

### 1. 커맨드 인터페이스 (src/types/Command.ts)
```typescript
import { ChatInputCommandInteraction, Message, AutocompleteInteraction } from 'discord.js';

export interface Command {
  name: string;
  description: string;
  category?: string;
  permissions?: string[];
  cooldown?: number;
  slash?: boolean;
  message?: boolean;
  execute: (interaction: ChatInputCommandInteraction | Message, args: string[]) => Promise<void>;
  autocomplete?: (interaction: AutocompleteInteraction) => Promise<void>;
}
```

### 2. 슬래시 커맨드 등록 (src/commands/SlashCommandManager.ts)
```typescript
import { REST, Routes } from 'discord.js';
import { Command } from '../types/Command';

export class SlashCommandManager {
  private commands: Command[] = [];

  constructor(private clientId: string, private guildId: string) {}

  registerCommand(command: Command): void {
    this.commands.push(command);
  }

  async register(): Promise<void> {
    const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN!);

    const commands = this.commands.map(cmd => ({
      name: cmd.name,
      description: cmd.description,
      default_member_permissions: cmd.permissions?.join(',') || undefined,
    }));

    await rest.put(
      Routes.applicationGuildCommands(this.clientId, this.guildId),
      { body: commands }
    );
  }
}
```

### 3. 커맨드 핸들러 (src/handlers/CommandHandler.ts)
```typescript
import { ChatInputCommandInteraction, Message } from 'discord.js';
import { Command } from '../types/Command';

export class CommandHandler {
  private commands = new Map<string, Command>();

  registerCommand(command: Command): void {
    this.commands.set(command.name, command);
  }

  async handleInteraction(interaction: ChatInputCommandInteraction): Promise<void> {
    const command = this.commands.get(interaction.commandName);
    if (!command) return;

    // 권한 체크
    if (command.permissions && !interaction.memberPermissions?.has(command.permissions)) {
      return await interaction.reply({ content: '권한이 부족합니다.', ephemeral: true });
    }

    // 쿨다운 체크
    if (command.cooldown) {
      // 쿨다운 로직 구현
    }

    await command.execute(interaction, []);
  }
}
```

### 4. 커맨드 파일 구조
```
src/
├── commands/
│   ├── help.ts
│   ├── ping.ts
│   └── userinfo.ts
├── types/
│   └── Command.ts
└── handlers/
    └── CommandHandler.ts
```

## 지원하는 커맨드 타입
- 슬래시 커맨드 (/)
- 메시지 커맨드 (!, ! 등 접두사)
- 버튼 인터랙션
- 셀렉트 메뉴
- 모달 인터랙션

## 구현 패턴
- Command Handler 클래스
- Middleware 체인 (인증, 권한, 냄새 체크)
- 커맨드 레지스트리
- 에러 핸들링