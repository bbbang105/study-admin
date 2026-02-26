'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { UsersRound, ExternalLink, Github, Linkedin, Instagram } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { PART_OPTIONS } from '@/lib/part-config';
import { getDefaultAvatar } from '@/lib/utils';
import { PageLoading, PageError } from '@/components/ui/page-state';
import { PartBadge } from '@/components/ui/part-badge';

interface Member {
  id: string;
  name: string;
  nickname: string;
  discordUsername: string;
  part: string;
  blogUrl: string;
  profileImageUrl: string | null;
  bio: string | null;
  status: string;
  githubUrl: string | null;
  linkedinUrl: string | null;
  instagramUrl: string | null;
  postCount: number;
  attendanceRate: number;
  joinedAt: string;
}

interface MembersData {
  members: Member[];
  total: number;
}

export default function MembersPage() {
  const [data, setData] = useState<MembersData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filterPart, setFilterPart] = useState<string | null>(null);

  useEffect(() => {
    const fetchMembers = async () => {
      try {
        const response = await fetch('/api/members?status=active');
        if (!response.ok) {
          throw new Error('Failed to fetch members');
        }
        const result = await response.json();
        setData(result);
      } catch (err) {
        setError('스터디원 목록을 불러오는데 실패했습니다.');
        console.error(err);
      } finally {
        setLoading(false);
      }
    };

    fetchMembers();
  }, []);

  if (loading) {
    return <PageLoading />;
  }

  if (error) {
    return <PageError message={error} />;
  }

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div className="space-y-0.5">
        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
          Members
        </p>
        <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
          <h1 className="text-xl font-semibold tracking-tight">스터디원 목록</h1>
          <span className="text-sm text-muted-foreground">
            {filterPart
              ? `${data?.members.filter((m) => m.part === filterPart).length ?? 0}명`
              : `총 ${data?.total ?? 0}명`}
          </span>
        </div>
      </div>

      {/* Part filter */}
      {data?.members && data.members.length > 0 && (
        <div className="flex flex-wrap items-center gap-1">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setFilterPart(null)}
            className={`h-7 px-3 text-xs ${
              filterPart === null
                ? 'bg-muted text-foreground font-medium'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            전체
          </Button>
          {PART_OPTIONS
            .filter((opt) => data.members.some((m) => m.part === opt.value))
            .map((opt) => (
              <Button
                key={opt.value}
                variant="ghost"
                size="sm"
                onClick={() => setFilterPart(opt.value)}
                className={`h-7 px-3 text-xs ${
                  filterPart === opt.value
                    ? 'bg-muted text-foreground font-medium'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                {opt.label}
              </Button>
            ))}
        </div>
      )}

      {/* Members grid */}
      {data?.members && data.members.length > 0 ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {data.members.filter((m) => !filterPart || m.part === filterPart).map((member) => {
            const socialLinks = [
              { url: member.blogUrl, icon: ExternalLink, label: '블로그' },
              { url: member.githubUrl, icon: Github, label: 'GitHub' },
              { url: member.linkedinUrl, icon: Linkedin, label: 'LinkedIn' },
              { url: member.instagramUrl, icon: Instagram, label: 'Instagram' },
            ].filter((link) => link.url);

            return (
              <Link key={member.id} href={`/members/${member.id}`}>
                <Card className="border-border/60 shadow-none hover:border-border hover:bg-muted/30 transition-colors cursor-pointer h-full">
                  <CardContent className="p-4">
                    {/* Top: Avatar + Name + Part */}
                    <div className="flex items-start gap-3">
                      <Avatar className="h-11 w-11 ring-2 ring-border ring-offset-1 ring-offset-background shrink-0">
                        <AvatarImage src={member.profileImageUrl || getDefaultAvatar(member.nickname)} />
                        <AvatarFallback className="bg-primary/10 text-primary text-sm font-semibold">
                          {member.nickname.slice(0, 2).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-semibold truncate">
                          {member.nickname}
                        </p>
                        <div className="flex items-center gap-1.5">
                          <p className="text-xs text-muted-foreground truncate">
                            @{member.discordUsername.replace(/#0$/, '')}
                          </p>
                          <PartBadge part={member.part} size="sm" />
                        </div>
                      </div>
                    </div>

                    {/* Bio */}
                    {member.bio && (
                      <p className="mt-3 text-xs text-muted-foreground line-clamp-2 leading-relaxed">
                        {member.bio}
                      </p>
                    )}

                    {/* Social link chips */}
                    {socialLinks.length > 0 && (
                      <div className="mt-3 flex flex-wrap gap-1.5">
                        {socialLinks.map((link) => {
                          const Icon = link.icon;
                          return (
                            <span
                              key={link.label}
                              role="link"
                              tabIndex={0}
                              className="inline-flex items-center gap-1 rounded-full border border-border/60 bg-muted/40 px-2 py-0.5 text-[10px] font-medium text-muted-foreground hover:text-foreground hover:bg-muted transition-colors cursor-pointer"
                              onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                window.open(link.url!, '_blank', 'noopener,noreferrer');
                              }}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter' || e.key === ' ') {
                                  e.preventDefault();
                                  e.stopPropagation();
                                  window.open(link.url!, '_blank', 'noopener,noreferrer');
                                }
                              }}
                            >
                              <Icon className="h-3 w-3" />
                              {link.label}
                            </span>
                          );
                        })}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </Link>
            );
          })}
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center py-16 gap-2">
          <UsersRound className="h-8 w-8 text-muted-foreground/40" />
          <p className="text-sm text-muted-foreground">아직 등록된 스터디원이 없습니다.</p>
        </div>
      )}
    </div>
  );
}
