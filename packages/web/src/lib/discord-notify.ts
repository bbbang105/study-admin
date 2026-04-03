/**
 * Discord REST API를 통한 채널 메시지 전송 유틸
 * 봇 의존 없이 웹에서 직접 Discord 채널에 메시지를 보낼 때 사용
 */

const DISCORD_API_BASE = 'https://discord.com/api/v10';
const SNOWFLAKE_RE = /^\d{17,20}$/;

interface EmbedField {
  name: string;
  value: string;
  inline?: boolean;
}

interface DiscordEmbed {
  title?: string;
  url?: string;
  description?: string;
  color?: number;
  fields?: EmbedField[];
  image?: { url: string };
  thumbnail?: { url: string };
  author?: { name: string; icon_url?: string };
  timestamp?: string;
  footer?: { text: string };
}

interface DiscordButton {
  type: 2;
  style: 5;
  label: string;
  url: string;
  emoji?: { name: string };
}

interface DiscordActionRow {
  type: 1;
  components: DiscordButton[];
}

interface SendChannelMessageOptions {
  channelId: string;
  content?: string;
  embeds?: DiscordEmbed[];
  components?: DiscordActionRow[];
  allowEveryone?: boolean;
}

/**
 * Discord Markdown 특수문자 이스케이프
 * 사용자 입력을 embed에 넣기 전에 적용하여 마크다운 인젝션 방지
 */
function escapeDiscordMarkdown(text: string): string {
  return text.replace(/([*_~|`>[\]()@\\])/g, '\\$1');
}

/**
 * Discord 채널에 메시지 전송 (REST API)
 * DISCORD_TOKEN 환경변수 필요
 */
export async function sendDiscordChannelMessage(
  options: SendChannelMessageOptions
): Promise<{ success: boolean; messageId?: string; error?: string }> {
  const token = process.env.DISCORD_TOKEN;
  if (!token) {
    const error = 'DISCORD_TOKEN이 설정되지 않았습니다.';
    console.error('[discord-notify]', error);
    return { success: false, error };
  }

  if (!SNOWFLAKE_RE.test(options.channelId)) {
    const error = `유효하지 않은 channelId: ${options.channelId}`;
    console.error('[discord-notify]', error);
    return { success: false, error };
  }

  try {
    const response = await fetch(
      `${DISCORD_API_BASE}/channels/${options.channelId}/messages`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bot ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          content: options.content,
          embeds: options.embeds,
          components: options.components,
          allowed_mentions: { parse: options.allowEveryone ? ['everyone'] : [] },
        }),
      }
    );

    if (!response.ok) {
      const error = `메시지 전송 실패 (${response.status})`;
      console.error('[discord-notify]', error);
      return { success: false, error };
    }

    const data = await response.json() as { id?: string };
    return { success: true, messageId: data.id };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error('[discord-notify] 메시지 전송 중 오류:', error);
    return { success: false, error: message };
  }
}

/** 큐시즘 블루 (#0091FF) → Discord embed 색상 */
const CUSISM_BLUE = 0x0091ff;

/**
 * 신규 가입 승인대기 알림을 관리자 채널에 전송
 */
export async function notifyNewMemberPendingApproval(opts: {
  channelId: string;
  nickname: string;
  name: string;
  discordUsername: string;
  part: string;
  blogUrl: string;
  bio: string;
  adminDashboardUrl?: string;
}): Promise<boolean> {
  const { channelId, nickname, name, discordUsername, part, blogUrl, bio, adminDashboardUrl } = opts;

  const safeName = escapeDiscordMarkdown(name);
  const safeNickname = escapeDiscordMarkdown(nickname);
  const safeUsername = escapeDiscordMarkdown(discordUsername);
  const safePart = escapeDiscordMarkdown(part);
  const safeBio = escapeDiscordMarkdown(bio.length > 100 ? `${bio.slice(0, 100)}…` : bio);

  const fields: EmbedField[] = [
    { name: '닉네임', value: safeNickname, inline: true },
    { name: '이름', value: safeName, inline: true },
    { name: 'Discord', value: `@${safeUsername}`, inline: true },
    { name: '분야', value: safePart, inline: true },
    { name: '블로그', value: blogUrl, inline: false },
    { name: '자기소개', value: safeBio || '-', inline: false },
  ];

  if (adminDashboardUrl) {
    fields.push({
      name: '승인하러 가기',
      value: `[관리자 대시보드 →](${adminDashboardUrl})`,
      inline: false,
    });
  }

  const result = await sendDiscordChannelMessage({
    channelId,
    embeds: [
      {
        title: '🆕 새로운 스터디원이 가입했어요!',
        description: `**${safeNickname}** 님이 온보딩을 완료하고 승인을 기다리고 있습니다.`,
        color: CUSISM_BLUE,
        fields,
        timestamp: new Date().toISOString(),
        footer: { text: '큐스팅 블로그 스터디' },
      },
    ],
  });
  return result.success;
}
