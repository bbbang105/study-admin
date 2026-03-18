import { ImageResponse } from 'next/og';

export const runtime = 'edge';
export const alt = '큐스팅 4th · 블로그 스터디 자동화 플랫폼';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

export default function OGImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'row',
          background: '#000000',
          position: 'relative',
          overflow: 'hidden',
          padding: '60px 80px',
        }}
      >
        {/* Gradient glow */}
        <div
          style={{
            position: 'absolute',
            top: '-150px',
            left: '300px',
            width: '800px',
            height: '500px',
            borderRadius: '50%',
            background:
              'radial-gradient(ellipse at center, rgba(0,145,255,0.18) 0%, rgba(0,77,255,0.06) 50%, transparent 70%)',
            display: 'flex',
          }}
        />

        {/* Left: Text */}
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
            flex: 1,
            zIndex: 10,
            paddingRight: '40px',
          }}
        >
          {/* Logo + badge */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '14px',
              marginBottom: '32px',
            }}
          >
            <svg width="44" height="44" viewBox="0 0 512 512">
              <rect width="512" height="512" rx="108" fill="#0a0a0a" />
              <defs>
                <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
                  <stop offset="0%" stopColor="#0091FF" />
                  <stop offset="100%" stopColor="#004DFF" />
                </linearGradient>
              </defs>
              <g fill="url(#g)">
                <rect x="136" y="120" width="48" height="272" rx="8" />
                <polygon points="184,268 184,228 340,120 356,120 356,152" />
                <polygon points="184,268 184,308 340,392 356,392 356,360" />
                <circle cx="348" cy="392" r="10" />
              </g>
            </svg>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                borderRadius: '999px',
                border: '1px solid rgba(255,255,255,0.1)',
                background: 'rgba(255,255,255,0.05)',
                padding: '6px 16px',
                fontSize: '15px',
                color: '#a1a1aa',
              }}
            >
              <div
                style={{
                  width: '8px',
                  height: '8px',
                  borderRadius: '50%',
                  background: '#34d399',
                  display: 'flex',
                }}
              />
              큐스팅 4th
            </div>
          </div>

          {/* Headline */}
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              fontSize: '52px',
              fontWeight: 700,
              lineHeight: 1.2,
              letterSpacing: '-0.03em',
            }}
          >
            <span style={{ color: '#ffffff' }}>함께 쓰고,</span>
            <span
              style={{
                color: '#0078E5',
              }}
            >
              함께 성장하다.
            </span>
          </div>

          {/* Subtext */}
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              marginTop: '20px',
              fontSize: '18px',
              lineHeight: 1.6,
              color: '#71717a',
            }}
          >
            <span>2주에 한 편, 서로의 글에 응원을 나누며</span>
            <span>꾸준함을 만들어가는 블로그 스터디</span>
          </div>
        </div>

        {/* Right: Mock UI cards */}
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
            gap: '14px',
            width: '380px',
            zIndex: 10,
          }}
        >
          {/* Ranking card */}
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: '10px',
              borderRadius: '16px',
              border: '1px solid rgba(255,255,255,0.08)',
              background: 'rgba(255,255,255,0.04)',
              padding: '20px',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontSize: '14px' }}>🏆</span>
              <span style={{ fontSize: '14px', fontWeight: 600, color: '#ffffff' }}>랭킹</span>
            </div>
            {[
              { rank: 1, name: 'alice', score: 420, bg: '#fbbf24' },
              { rank: 2, name: 'bob', score: 385, bg: '#94a3b8' },
              { rank: 3, name: 'charlie', score: 310, bg: '#fb923c' },
            ].map((r) => (
              <div
                key={r.rank}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px',
                  borderRadius: '10px',
                  background: 'rgba(255,255,255,0.04)',
                  padding: '10px 12px',
                }}
              >
                <div
                  style={{
                    width: '24px',
                    height: '24px',
                    borderRadius: '50%',
                    background: r.bg,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '12px',
                    fontWeight: 700,
                    color: '#000',
                  }}
                >
                  {r.rank}
                </div>
                <span style={{ fontSize: '14px', color: '#fff', flex: 1 }}>{r.name}</span>
                <span style={{ fontSize: '14px', fontWeight: 600, color: '#60a5fa' }}>
                  {r.score}pt
                </span>
              </div>
            ))}
          </div>

          {/* Posts card */}
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: '10px',
              borderRadius: '16px',
              border: '1px solid rgba(255,255,255,0.08)',
              background: 'rgba(255,255,255,0.04)',
              padding: '20px',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontSize: '14px' }}>📝</span>
              <span style={{ fontSize: '14px', fontWeight: 600, color: '#ffffff' }}>
                최근 포스트
              </span>
            </div>
            {[
              { title: 'React 19의 새로운 기능 정리', author: 'alice' },
              { title: 'Docker 멀티스테이지 빌드 최적화', author: 'bob' },
            ].map((p) => (
              <div
                key={p.author}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px',
                  borderRadius: '10px',
                  background: 'rgba(255,255,255,0.04)',
                  padding: '10px 12px',
                }}
              >
                <div
                  style={{
                    width: '24px',
                    height: '24px',
                    borderRadius: '50%',
                    background: 'rgba(96,165,250,0.2)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '11px',
                    color: '#60a5fa',
                  }}
                >
                  {p.author.charAt(0).toUpperCase()}
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', flex: 1 }}>
                  <span style={{ fontSize: '13px', color: '#fff' }}>{p.title}</span>
                  <span style={{ fontSize: '11px', color: '#52525b' }}>by {p.author}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Bottom URL */}
        <div
          style={{
            position: 'absolute',
            bottom: '24px',
            left: '0',
            right: '0',
            display: 'flex',
            justifyContent: 'center',
            fontSize: '14px',
            color: '#3f3f46',
          }}
        >
          cusiting.com
        </div>
      </div>
    ),
    { ...size },
  );
}
