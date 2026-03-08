# Discord Client Architect

Discord.js v14.25.1 클라이언트 초기화 및 핵심 설정을 전문으로 하는 스킬.

## 사용 방법
`/discord-client [배포 환경/요구사항]`으로 호출

## 제공하는 코드 템플릿

### 1. 기본 클라이언트 설정 (bot/bot.ts)
```typescript
import { Client, GatewayIntentBits, Partials } from 'discord.js';

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessageReactions,
    GatewayIntentBits.MessageContent,
  ],
  partials: [
    Partials.Channel,
    Partials.Message,
    Partials.User,
    Partials.GuildMember,
  ],
  rest: {
    timeout: 30000,
  },
});

client.on('ready', () => {
  console.log(`Logged in as ${client.user?.tag}`);
});

client.login(process.env.DISCORD_TOKEN);
```

### 2. AWS EC2 배포용 설정
- PM2 설정 파일 생성 (ecosystem.config.js)
- 자동 재시작 구성
- 로깅 시스템 설정
- 메모리 모니터링 스크립트

### 3. 환경변수 설정 (.env.example)
```env
DISCORD_TOKEN=your_bot_token
DISCORD_CLIENT_ID=your_client_id
DISCORD_GUILD_ID=your_guild_id
NODE_ENV=production
```

### 4. 구성 검사기 (config validator)
- 필수 환경변수 체크
- Intents 설정 검증
- 권한 확인 스크립트

## 핵심 기능
- Intents 최적화
- 파셜(Partial) 설정
- 타임아웃 설정
- 에러 핸들링
- 로깅 시스템

## 문서 참조
- [Discord.js Client Docs](https://discord.js.org/docs/packages/discord.js/14.25.1/Client)
- [Intents Reference](https://discord.js.org/docs/packages/discord.js/14.25.1/Intents)