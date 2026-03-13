/**
 * Discord Webhook Error Reporter
 * 심각한 에러 발생 시 Discord 웹훅으로 알림 전송
 */

import { WebhookClient } from 'discord.js';

let webhookClient: WebhookClient | null = null;

/**
 * Initialize Discord webhook for error reporting
 */
export function initErrorWebhook(webhookUrl: string): void {
  try {
    webhookClient = new WebhookClient({ url: webhookUrl });
  } catch (error) {
    console.error('Failed to initialize error webhook:', error);
  }
}

/**
 * Send error notification to Discord webhook
 */
export async function reportError(
  error: Error,
  context: {
    location: string;
    [key: string]: unknown;
  }
): Promise<void> {
  if (!webhookClient) {
    return; // Webhook not configured, silently skip
  }

  try {
    const errorMessage = error.message || String(error);
    const errorStack = error.stack || 'No stack trace available';

    const embed = {
      title: '🚨 Bot Error',
      description: `\`\`\`${errorMessage}\`\`\``,
      color: 0xFF0000, // Red
      fields: [
        {
          name: '📍 Location',
          value: context.location,
          inline: true,
        },
        {
          name: '⏰ Time',
          value: new Date().toISOString(),
          inline: true,
        },
        {
          name: '🔧 Context',
          value: '```json\n' + JSON.stringify(context, null, 2) + '\n```',
          inline: false,
        },
      ],
    };

    // Send stack trace in a file if too long
    const stackTrace = errorStack.length > 1000
      ? `\`\`\`\n${errorStack.slice(0, 1000)}...\n\`\`\` (truncated)`
      : `\`\`\`\n${errorStack}\n\`\`\``;

    await webhookClient.send({
      username: 'Bot Error Reporter',
      avatarURL: 'https://github.githubassets.com/assets/oerror-404-77e4b2e.png',
      embeds: [embed],
      content: stackTrace,
    });
  } catch (webhookError) {
    // Don't throw errors when reporting errors (prevent infinite loop)
    console.error('Failed to send error webhook:', webhookError);
  }
}
