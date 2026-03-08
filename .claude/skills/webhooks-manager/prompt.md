# Webhooks Manager Architect

Discord.js v14.25.1 웹훅 관리 기능을 설계하는 전문 스킬.

## 사용 방법
`/webhooks-manager [웹훅 관리 요구사항]`으로 호출

## 제공하는 코드 템플릿

### 1. 웹훅 관리자 클래스 (src/managers/WebhookManager.ts)
```typescript
import { Webhook, WebhookClient, Message } from 'discord.js';
import { WebhookConfig } from '../types/WebhookConfig';

export class WebhookManager {
  private webhooks = new Map<string, WebhookClient>();

  async createWebhook(channelId: string, name: string, avatar?: string): Promise<Webhook> {
    const channel = await this.client.channels.fetch(channelId);
    if (!channel.isTextBased()) {
      throw new Error('텍스트 채널만 웹훅을 생성할 수 있습니다.');
    }

    const webhook = await channel.createWebhook({
      name,
      avatar: avatar ? this.resolveAttachment(avatar) : undefined,
    });

    // 클라이언트 저장
    const client = new WebhookClient({ id: webhook.id, token: webhook.token });
    this.webhooks.set(`${channelId}-${name}`, client);

    return webhook;
  }

  async sendMessage(channelId: string, webhookName: string, message: WebhookMessage): Promise<Message> {
    const client = this.getWebhookClient(channelId, webhookName);
    return client.send(message.content, message.options);
  }

  async deleteWebhook(channelId: string, webhookName: string): Promise<void> {
    const client = this.webhooks.get(`${channelId}-${webhookName}`);
    if (client) {
      await client.delete();
      this.webhooks.delete(`${channelId}-${webhookName}`);
    }
  }

  private getWebhookClient(channelId: string, webhookName: string): WebhookClient {
    const key = `${channelId}-${webhookName}`;
    const client = this.webhooks.get(key);

    if (!client) {
      throw new Error(`웹훅을 찾을 수 없습니다: ${webhookName}`);
    }

    return client;
  }
}

interface WebhookMessage {
  content: string;
  options?: {
    username?: string;
    avatarURL?: string;
    embeds?: any[];
    files?: any[];
    threadId?: string;
  };
}
```

### 2. 웹훅 템플릿 엔진 (src/templates/WebhookTemplate.ts)
```typescript
export class WebhookTemplate {
  private templates = new Map<string, TemplateConfig>();

  registerTemplate(name: string, template: TemplateConfig): void {
    this.templates.set(name, template);
  }

  renderTemplate(name: string, data: any): WebhookMessage {
    const template = this.templates.get(name);
    if (!template) {
      throw new Error(`템플릿을 찾을 수 없습니다: ${name}`);
    }

    return {
      content: this.interpolate(template.content, data),
      options: {
        embeds: template.embeds?.map(embed => this.interpolateEmbed(embed, data)),
        username: template.username || this.getUsername(data),
        avatarURL: template.avatarURL || this.getAvatar(data),
      },
    };
  }

  private interpolate(template: string, data: any): string {
    return template.replace(/\{\{(\w+)\}\}/g, (match, key) => {
      return data[key] || match;
    });
  }

  private interpolateEmbed(embed: any, data: any): any {
    return {
      title: this.interpolate(embed.title || '', data),
      description: this.interpolate(embed.description || '', data),
      color: embed.color,
      fields: embed.fields?.map(field => ({
        name: this.interpolate(field.name, data),
        value: this.interpolate(field.value, data),
        inline: field.inline,
      })),
    };
  }
}

interface TemplateConfig {
  content: string;
  embeds?: any[];
  username?: string;
  avatarURL?: string;
}
```

### 3. 자동화 웹훅 시스템 (src/services/AutoWebhook.ts)
```typescript
export class AutoWebhook {
  private templates = new WebhookTemplate();
  private webhooks = new WebhookManager();

  constructor() {
    this.registerTemplates();
  }

  // CI/CD 결과 알림
  async notifyCI(result: CIResult): Promise<void> {
    await this.webhooks.sendMessage(
      'CI_CD_CHANNEL_ID',
      'ci-webhook',
      this.templates.renderTemplate('ci-notification', result)
    );
  }

  // 자동 알림 발송
  async notifyAlert(alert: AlertData): Promise<void> {
    await this.webhooks.sendMessage(
      'ALERTS_CHANNEL_ID',
      'alert-webhook',
      this.templates.renderTemplate('alert-notification', alert)
    );
  }

  // 서버 상태 업데이트
  async updateServerStatus(status: ServerStatus): Promise<void> {
    await this.webhooks.sendMessage(
      'STATUS_CHANNEL_ID',
      'status-webhook',
      this.templates.renderTemplate('status-update', status)
    );
  }

  private registerTemplates(): void {
    this.templates.registerTemplate('ci-notification', {
      content: 'CI/CD 빌드 결과: {{status}}',
      embeds: [{
        title: '빌드 알림',
        fields: [
          { name: '프로젝트', value: '{{project}}', inline: true },
          { name:브랜치', value: '{{branch}}', inline: true },
          { name: '커밋', value: '{{commit}}', inline: false },
          { name: '빌드 시간', value: '{{duration}}', inline: true },
        ],
      }],
      username: 'CI/CD Bot',
    });

    this.templates.registerTemplate('alert-notification', {
      content: '⚠️ 새로운 알림',
      embeds: [{
        title: '경고 알림',
        color: 0xff0000,
        fields: [
          { name: '레벨', value: '{{level}}', inline: true },
          { name: '서비스', value: '{{service}}', inline: true },
          { name: '메시지', value: '{{message}}', inline: false },
        ],
      }],
      username: 'Alert Bot',
    });
  }
}

interface CIResult {
  status: 'success' | 'failure';
  project: string;
  branch: string;
  commit: string;
  duration: string;
  url: string;
}

interface AlertData {
  level: 'info' | 'warning' | 'error' | 'critical';
  service: string;
  message: string;
  timestamp: number;
}

interface ServerStatus {
  server: string;
  status: 'online' | 'offline' | 'maintenance';
  cpu: number;
  memory: number;
  uptime: number;
}
```

### 4. 웹훅 모니터링 (src/utils/WebhookMonitor.ts)
```typescript
export class WebhookMonitor {
  private webhookStats = new Map<string, WebhookStats>();

  async monitorWebhook(webhookId: string): Promise<void> {
    // 웹훅 상태 모니터링
    setInterval(async () => {
      const stats = await this.getWebhookStats(webhookId);
      this.webhookStats.set(webhookId, stats);

      // 이상 감지 시 알림
      if (stats.errorRate > 0.1) {
        await this.sendAlert(webhookId, stats);
      }
    }, 60000); // 1분마다 체크
  }

  async getWebhookStats(webhookId: string): Promise<WebhookStats> {
    const client = this.getWebhookClient(webhookId);
    const recentMessages = await this.getRecentMessages(client);

    return {
      totalMessages: recentMessages.length,
      errorCount: recentMessages.filter(m => m.status === 'error').length,
      averageResponseTime: this.calculateAverageResponseTime(recentMessages),
      lastActivity: Date.now(),
    };
  }

  async sendAlert(webhookId: string, stats: WebhookStats): Promise<void> {
    const webhookName = this.getWebhookName(webhookId);
    const embed = new EmbedBuilder()
      .setTitle('웹훅 이상 감지')
      .setColor(0xff0000)
      .addFields([
        { name: '웹훅 ID', value: webhookId, inline: true },
        { name: '웹훅 이름', value: webhookName, inline: true },
        { name: '오류율', value: `${(stats.errorRate * 100).toFixed(1)}%`, inline: true },
        { name: '평균 응답 시간', value: `${stats.averageResponseTime}ms`, inline: true },
      ]);

    await this.sendAlertWebhook(embed);
  }
}

interface WebhookStats {
  totalMessages: number;
  errorCount: number;
  averageResponseTime: number;
  lastActivity: number;
  get errorRate(): number {
    return this.totalMessages > 0 ? this.errorCount / this.totalMessages : 0;
  }
}
```

## 사용 사례
- 외부 시스템 연동
- 자동 알림 발송
- CI/CD 결과 통보
- 로그 전송
- 데이터 시각화

## 구현 패턴
- 웹훅 URL 관리
- 메시지 템플릿
- 배치 전송
- 상태 추적