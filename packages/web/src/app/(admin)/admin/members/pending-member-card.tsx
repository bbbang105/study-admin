'use client';

import Image from 'next/image';
import { useState } from 'react';
import { ExternalLink, Check, X, ChevronDown } from 'lucide-react';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { PartBadge } from '@/components/ui/part-badge';
import { getDefaultAvatar } from '@/lib/utils';

interface PendingMember {
  id: string;
  name: string;
  nickname: string;
  part: string;
  blogUrl: string;
  profileImageUrl: string | null;
  bio: string | null;
  interests: string[] | null;
  resolution: string | null;
  joinedAt: string;
}

interface PendingMemberCardProps {
  member: PendingMember;
  onApprove: (memberId: string, targetStatus: string) => void;
  onReject: (memberId: string) => void;
}

export function PendingMemberCard({ member, onApprove, onReject }: PendingMemberCardProps) {
  const [showStatusSelect, setShowStatusSelect] = useState(false);

  return (
    <Card className="relative">
      <CardHeader className="pb-3">
        <div className="flex items-start gap-3">
          <Image
            src={member.profileImageUrl || getDefaultAvatar(member.name)}
            alt={member.name}
            width={48}
            height={48}
            unoptimized
            className="h-12 w-12 rounded-full object-cover"
          />
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <span className="font-semibold">{member.name}</span>
              <span className="text-sm text-muted-foreground">({member.nickname})</span>
            </div>
            <div className="flex items-center gap-2 mt-1">
              <PartBadge part={member.part} />
              <a
                href={member.blogUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
              >
                <ExternalLink className="h-3 w-3" />
                블로그
              </a>
            </div>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {member.bio && (
          <div>
            <p className="text-xs font-medium text-muted-foreground mb-1">자기소개</p>
            <p className="text-sm line-clamp-3">{member.bio}</p>
          </div>
        )}
        {member.interests && member.interests.length > 0 && (
          <div>
            <p className="text-xs font-medium text-muted-foreground mb-1">관심사</p>
            <div className="flex flex-wrap gap-1">
              {member.interests.map((interest) => (
                <Badge key={interest} variant="secondary" className="text-xs">
                  {interest}
                </Badge>
              ))}
            </div>
          </div>
        )}
        {member.resolution && (
          <div>
            <p className="text-xs font-medium text-muted-foreground mb-1">각오</p>
            <p className="text-sm italic text-muted-foreground">&ldquo;{member.resolution}&rdquo;</p>
          </div>
        )}
        <div className="flex items-center gap-2 pt-2 border-t">
          {showStatusSelect ? (
            <div className="flex items-center gap-2 w-full">
              <Button
                size="sm"
                onClick={() => { onApprove(member.id, 'active'); setShowStatusSelect(false); }}
                className="flex-1"
              >
                활성으로 승인
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => { onApprove(member.id, 'ob'); setShowStatusSelect(false); }}
                className="flex-1"
              >
                OB로 승인
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setShowStatusSelect(false)}
              >
                취소
              </Button>
            </div>
          ) : (
            <>
              <Button
                size="sm"
                onClick={() => setShowStatusSelect(true)}
                className="gap-1"
              >
                <Check className="h-3.5 w-3.5" />
                승인
                <ChevronDown className="h-3 w-3" />
              </Button>
              <Button
                size="sm"
                variant="destructive"
                onClick={() => onReject(member.id)}
                className="gap-1"
              >
                <X className="h-3.5 w-3.5" />
                거절
              </Button>
            </>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
