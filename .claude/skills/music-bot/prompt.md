# Music Bot Architect

Discord.js v14.25.1 뮤직 봇 기능을 설계하는 전문 스킬.

## 사용 방법
`/music-bot [뮤직 봇 요구사항]`으로 호출

## 제공하는 코드 템플릿

### 1. MusicPlayer 클래스 (src/player/MusicPlayer.ts)
```typescript
import {
  VoiceChannel,
  AudioPlayer,
  AudioResource,
  StreamType,
  createAudioPlayer,
  createAudioResource,
  joinVoiceChannel,
  NoSubscriberBehavior,
} from '@discordjs/voice';
import { YouTubeExtractor } from '../extractors/YouTubeExtractor';
import { SpotifyExtractor } from '../extractors/SpotifyExtractor';

export class MusicPlayer {
  private audioPlayer: AudioPlayer;
  private currentResource: AudioResource | null = null;
  private queue: QueueItem[] = [];
  private isPlaying = false;
  private repeatMode: 'off' | 'track' | 'queue' = 'off';

  constructor() {
    this.audioPlayer = createAudioPlayer({
      behaviors: {
        noSubscriber: NoSubscriberBehavior.Pause,
      },
    });
  }

  async play(channel: VoiceChannel, url: string): Promise<void> {
    const extractor = this.getExtractor(url);
    const stream = await extractor.extract(url);

    const resource = createAudioResource(stream, {
      inputType: StreamType.Arbitrary,
      metadata: { title: stream.title },
    });

    const connection = joinVoiceChannel({
      channelId: channel.id,
      guildId: channel.guild.id,
      adapterCreator: channel.guild.voiceAdapterCreator,
    });

    connection.subscribe(this.audioPlayer);

    this.audioPlayer.play(resource);
    this.currentResource = resource;
    this.isPlaying = true;
  }

  pause(): void {
    this.audioPlayer.pause();
    this.isPlaying = false;
  }

  resume(): void {
    this.audioPlayer.unpause();
    this.isPlaying = true;
  }

  stop(): void {
    this.audioPlayer.stop();
    this.queue = [];
    this.isPlaying = false;
  }

  addQueue(url: string): void {
    this.queue.push({ url, requestedBy: this.getLastRequester() });
  }

  next(): void {
    if (this.queue.length === 0) {
      this.stop();
      return;
    }

    if (this.repeatMode === 'track' && this.currentResource) {
      this.playQueueItem(this.queue[0]);
    } else {
      this.queue.shift();
      if (this.queue.length > 0) {
        this.playQueueItem(this.queue[0]);
      }
    }
  }

  private playQueueItem(item: QueueItem): void {
    // 재생 로직 구현
  }

  private getExtractor(url: string): Extractor {
    if (url.includes('youtube.com') || url.includes('youtu.be')) {
      return new YouTubeExtractor();
    } else if (url.includes('spotify.com')) {
      return new SpotifyExtractor();
    }
    throw new Error('지원되지 않는 플랫폼입니다.');
  }
}

interface QueueItem {
  url: string;
  requestedBy: string;
}
```

### 2. 음악 검색 엔진 (src/SearchEngine.ts)
```typescript
import { YouTubeExtractor } from './extractors/YouTubeExtractor';
import { SpotifyExtractor } from './extractors/SpotifyExtractor';

export class SearchEngine {
  private youtube = new YouTubeExtractor();
  private spotify = new SpotifyExtractor();

  async search(query: string, source: 'youtube' | 'spotify' = 'youtube'): Promise<SearchResult[]> {
    switch (source) {
      case 'youtube':
        return await this.youtube.search(query);
      case 'spotify':
        return await this.spotify.search(query);
      default:
        throw new Error('지원되지 않는 소스입니다.');
    }
  }

  async getPlaylist(url: string): Promise<PlaylistItem[]> {
    const extractor = this.getExtractor(url);
    return await extractor.getPlaylist(url);
  }

  private getExtractor(url: string): Extractor {
    if (url.includes('youtube.com') || url.includes('youtu.be')) {
      return this.youtube;
    } else if (url.includes('spotify.com')) {
      return this.spotify;
    }
    throw new Error('지원되지 않는 플랫폼입니다.');
  }
}

interface SearchResult {
  title: string;
  url: string;
  duration: number;
  thumbnail: string;
  author: string;
}

interface PlaylistItem {
  title: string;
  url: string;
  duration: number;
}
```

### 3. 커맨드 핸들러 (src/commands/MusicCommands.ts)
```typescript
export const playCommand: Command = {
  name: 'play',
  description: '음악을 재생합니다.',
  options: [
    {
      name: '검색어',
      type: 'STRING',
      required: true,
      description: 'YouTube URL 또는 검색어',
    },
  ],
  async execute(interaction: ChatInputCommandInteraction): Promise<void> {
    const member = interaction.member as GuildMember;
    const voiceChannel = member.voice.channel;

    if (!voiceChannel) {
      return await interaction.reply({ content: '음성 채널에 참여해주세요.', ephemeral: true });
    }

    const query = interaction.options.getString('검색어')!;
    const musicPlayer = MusicPlayer.getInstance();

    await musicPlayer.play(voiceChannel, query);
    await interaction.reply(`재생 중: ${query}`);
  },
};

export const queueCommand: Command = {
  name: 'queue',
  description: '현재 재생 목록을 보여줍니다.',
  async execute(interaction: ChatInputCommandInteraction): Promise<void> {
    const musicPlayer = MusicPlayer.getInstance();
    const queue = musicPlayer.getQueue();

    if (queue.length === 0) {
      return await interaction.reply('재생 목록이 비어있습니다.');
    }

    const queueEmbed = new EmbedBuilder()
      .setTitle('재생 목록')
      .setDescription(queue.map((item, index) => `${index + 1}. ${item.title}`).join('\n'));

    await interaction.reply({ embeds: [queueEmbed] });
  },
};
```

### 4. 환경 설정 (src/config/MusicConfig.ts)
```typescript
export const MusicConfig = {
  // YouTube API 설정
  youtube: {
    apiKey: process.env.YOUTUBE_API_KEY,
    maxResults: 25,
    quality: 'highest',
  },

  // Spotify 설정
  spotify: {
    clientId: process.env.SPOTIFY_CLIENT_ID,
    clientSecret: process.env.SPOTIFY_CLIENT_SECRET,
    refreshToken: process.env.SPOTIFY_REFRESH_TOKEN,
  },

  // 음질 설정
  quality: {
    bitrate: 128000,
    sampleRate: 48000,
  },

  // 재생 설정
  playback: {
    volume: 0.5,
    autoplay: true,
    timeout: 300000, // 5분
  },
};
```

## 필수 라이브러리
- @discordjs/voice
- ffmpeg-static
- ytdl-core
- spotify-api.js

## 성능 최적화
- 음성 연결 관리
- 메모리 누수 방지
- 스트리밍 버퍼링
- 에러 복구 메커니즘

## 구조 패턴
- Player 클래스
- Queue 시스템
- Search Engine
- 음질 최적화