'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft, User, FileText, CheckCircle, Calendar, ExternalLink } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Separator } from '@/components/ui/separator';

interface MemberInfo {
  id: string;
  discordUsername: string;
  name: string;
  part: string;
  blogUrl: string;
  profileImageUrl: string | null;
  bio: string | null;
  interests: string[] | null;
  resolution: string | null;
  status: string;
  joinedAt: string;
}

interface Stats {
  postCount: number;
  totalRounds: number;
  submittedRounds: number;
  lateRounds: number;
  absentRounds: number;
  attendanceRate: number;
}

interface Post {
  id: string;
  title: string;
  url: string;
  publishedAt: string;
}

interface MemberProfileData {
  member: MemberInfo;
  stats: Stats;
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
        setData(result);
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
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-muted-foreground">로딩 중...</div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="space-y-4">
        <Button variant="ghost" size="icon" onClick={() => router.back()}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className="flex items-center justify-center min-h-[300px]">
          <div className="text-destructive">{error || '데이터를 불러올 수 없습니다.'}</div>
        </div>
      </div>
    );
  }

  const { member, stats, recentPosts } = data;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => router.back()}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div>
          <h1 className="text-3xl font-bold tracking-tight">{member.name}</h1>
          <p className="text-muted-foreground">스터디원 프로필</p>
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
          <div className="flex items-start gap-6">
            <Avatar className="h-24 w-24">
              <AvatarImage src={member.profileImageUrl || undefined} />
              <AvatarFallback className="text-2xl">
                {member.name.slice(0, 2).toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1 space-y-2">
              <div>
                <p className="text-2xl font-semibold">{member.name}</p>
                <p className="text-muted-foreground">@{member.discordUsername}</p>
              </div>
              <Badge variant="outline">{member.part}</Badge>
            </div>
          </div>

          {member.bio && (
            <>
              <Separator />
              <div>
                <p className="text-sm text-muted-foreground mb-1">한줄 소개</p>
                <p>{member.bio}</p>
              </div>
            </>
          )}

          {member.interests && member.interests.length > 0 && (
            <div>
              <p className="text-sm text-muted-foreground mb-2">관심 분야</p>
              <div className="flex flex-wrap gap-2">
                {member.interests.map((interest, idx) => (
                  <Badge key={idx} variant="secondary">{interest}</Badge>
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
              <p className="text-sm text-muted-foreground">블로그</p>
              <a
                href={member.blogUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="font-medium text-primary hover:underline flex items-center gap-1"
              >
                {member.blogUrl}
                <ExternalLink className="h-3 w-3" />
              </a>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">가입일</p>
              <p className="font-medium">
                {new Date(member.joinedAt).toLocaleDateString('ko-KR')}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">작성 글</CardTitle>
            <FileText className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.postCount}개</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">출석률</CardTitle>
            <CheckCircle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.attendanceRate}%</div>
            <p className="text-xs text-muted-foreground">
              {stats.submittedRounds}/{stats.totalRounds}회
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">지각/결석</CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {stats.lateRounds + stats.absentRounds}회
            </div>
            <p className="text-xs text-muted-foreground">
              지각 {stats.lateRounds}회 / 결석 {stats.absentRounds}회
            </p>
          </CardContent>
        </Card>
      </div>

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
                  className="flex items-start justify-between border-b pb-4 last:border-0 last:pb-0"
                >
                  <div className="space-y-1">
                    <a
                      href={post.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="font-medium hover:underline flex items-center gap-1"
                    >
                      {post.title}
                      <ExternalLink className="h-3 w-3" />
                    </a>
                    <p className="text-sm text-muted-foreground">
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
