'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft, ExternalLink, FileText, Github, Instagram, Linkedin, User } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Separator } from '@/components/ui/separator';
import { getDefaultAvatar } from '@/lib/utils';
import { MemberDetailSkeleton, PageError } from '@/components/ui/page-state';
import { PartBadge } from '@/components/ui/part-badge';

interface MemberInfo {
  id: string;
  discordUsername: string;
  name: string;
  nickname: string;
  part: string;
  blogs: { id: string; label: string | null; blogUrl: string }[];
  profileImageUrl: string | null;
  bio: string | null;
  interests: string[] | null;
  resolution: string | null;
  status: string;
  joinedAt: string;
  githubUrl: string | null;
  linkedinUrl: string | null;
  instagramUrl: string | null;
}

interface Post {
  id: string;
  title: string;
  url: string;
  publishedAt: string;
}

interface MemberProfileData {
  member: MemberInfo;
  recentPosts: Post[];
}

export default function MemberProfilePage() {
  const params = useParams();
  const router = useRouter();
  const [data, setData] = useState<MemberProfileData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchMember = async () => {
      try {
        const response = await fetch(`/api/members/${params.id}`);
        if (!response.ok) {
          if (response.status === 404) {
            setError('멤버를 찾을 수 없습니다.');
          } else {
            throw new Error('Failed to fetch member');
          }
          return;
        }
        const result = await response.json();
        setData(result.data);
      } catch (err) {
        setError('프로필 정보를 불러오는데 실패했습니다.');
        console.error(err);
      } finally {
        setLoading(false);
      }
    };

    if (params.id) {
      fetchMember();
    }
  }, [params.id]);

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'active':
        return <Badge variant="success">활동중</Badge>;
      case 'dormant':
        return <Badge variant="warning">휴면</Badge>;
      case 'withdrawn':
        return <Badge variant="destructive">탈퇴</Badge>;
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  if (loading) {
    return <MemberDetailSkeleton />;
  }

  if (error || !data) {
    return (
      <div className="space-y-4">
        <Button variant="ghost" size="icon" aria-label="뒤로 가기" onClick={() => router.back()}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <PageError message={error || '데이터를 불러올 수 없습니다.'} />
      </div>
    );
  }

  const { member, recentPosts } = data;

  const socialLinks = [
    ...member.blogs.map((b) => ({
      url: b.blogUrl,
      icon: ExternalLink,
      label: b.label || '블로그',
    })),
    { url: member.githubUrl, icon: Github, label: 'GitHub' },
    { url: member.linkedinUrl, icon: Linkedin, label: 'LinkedIn' },
    { url: member.instagramUrl, icon: Instagram, label: 'Instagram' },
  ].filter((link) => link.url);

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Button
          variant="ghost"
          size="icon"
          className="shrink-0"
          aria-label="뒤로 가기"
          onClick={() => router.back()}
        >
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className="min-w-0">
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight truncate">
            {member.nickname}
          </h1>
          <p className="text-muted-foreground text-sm">스터디원 프로필</p>
        </div>
      </div>

      {/* Profile Card */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <User className="h-5 w-5" />
              <CardTitle>프로필</CardTitle>
            </div>
            {getStatusBadge(member.status)}
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:gap-6">
            <Avatar className="h-20 w-20 sm:h-24 sm:w-24 shrink-0">
              <AvatarImage src={member.profileImageUrl || getDefaultAvatar(member.nickname)} />
              <AvatarFallback className="text-2xl">
                {member.nickname.slice(0, 2).toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1 space-y-2 min-w-0">
              <div>
                <p className="text-xl sm:text-2xl font-semibold">{member.nickname}</p>
                <p className="text-sm text-muted-foreground">{member.name}</p>
                <p className="text-muted-foreground text-sm">
                  @{member.discordUsername.replace(/#0$/, '')}
                </p>
              </div>
              <PartBadge part={member.part} />
            </div>
          </div>

          {member.bio && (
            <>
              <Separator />
              <div>
                <p className="text-sm text-muted-foreground mb-1">자기소개</p>
                <p>{member.bio}</p>
              </div>
            </>
          )}

          {member.interests && member.interests.length > 0 && (
            <div>
              <p className="text-sm text-muted-foreground mb-2">관심 분야</p>
              <div className="flex flex-wrap gap-2">
                {member.interests.map((interest, idx) => (
                  <Badge key={idx} variant="secondary">
                    {interest}
                  </Badge>
                ))}
              </div>
            </div>
          )}

          {member.resolution && (
            <div>
              <p className="text-sm text-muted-foreground mb-1">다짐</p>
              <p className="italic">&ldquo;{member.resolution}&rdquo;</p>
            </div>
          )}

          <Separator />

          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <p className="text-sm text-muted-foreground">가입일</p>
              <p className="font-medium">{new Date(member.joinedAt).toLocaleDateString('ko-KR')}</p>
            </div>
          </div>

          {/* Social Links */}
          {socialLinks.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {socialLinks.map((link, i) => {
                const Icon = link.icon;
                return (
                  <a
                    key={`${link.label}-${i}`}
                    href={link.url!}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 rounded-full border border-border bg-muted/50 px-3 py-1.5 text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                  >
                    <Icon className="h-3.5 w-3.5" />
                    {link.label}
                  </a>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Recent Posts */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            <CardTitle>최근 포스트</CardTitle>
          </div>
          <CardDescription>최근 작성한 블로그 글</CardDescription>
        </CardHeader>
        <CardContent>
          {recentPosts.length > 0 ? (
            <div className="space-y-4">
              {recentPosts.map((post) => (
                <div
                  key={post.id}
                  className="flex flex-col gap-0.5 border-b pb-4 last:border-0 last:pb-0 sm:flex-row sm:items-start sm:justify-between"
                >
                  <div className="space-y-1 min-w-0 flex-1">
                    <a
                      href={post.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="font-medium hover:underline flex items-start gap-1 text-sm leading-snug"
                    >
                      <span className="line-clamp-2">{post.title}</span>
                      <ExternalLink className="h-3 w-3 shrink-0 mt-0.5" />
                    </a>
                    <p className="text-sm text-muted-foreground whitespace-nowrap">
                      {new Date(post.publishedAt).toLocaleDateString('ko-KR')}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              아직 작성한 포스트가 없습니다.
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
