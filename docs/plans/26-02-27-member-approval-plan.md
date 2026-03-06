# 멤버 승인 + 상태 관리 시스템 구현 계획

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 온보딩 완료 후 관리자 승인이 필요한 멤버 워크플로우와 5단계 상태 관리 시스템 구축

**Architecture:** shared 패키지의 MemberStatus enum을 확장하고, 온보딩 API에서 신규 유저를 `pending_approval`로 설정. UserLayout에서 상태 체크 후 차단 페이지로 리다이렉트. 관리자 멤버 관리 페이지를 탭 기반 UI로 개편하여 승인/거절/상태변경 기능 제공.

**Tech Stack:** TypeScript, Drizzle ORM, Next.js App Router, shadcn/ui, Tailwind CSS v3

---

### Task 1: shared 패키지 - MemberStatus enum 확장

**Files:**
- Modify: `packages/shared/src/db/schema.ts:21-25`

**Step 1: MemberStatus에 신규 상태 추가**

```typescript
export const MemberStatus = {
  PENDING_APPROVAL: 'pending_approval',
  ACTIVE: 'active',
  INACTIVE: 'inactive',
  DORMANT: 'dormant',
  OB: 'ob',
  WITHDRAWN: 'withdrawn',
} as const;
```

**Step 2: shared 패키지 빌드**

Run: `pnpm --filter @blog-study/shared build`
Expected: 빌드 성공

**Step 3: 커밋**

```bash
git add packages/shared/src/db/schema.ts
git commit -m "feat: MemberStatus enum 확장 (pending_approval, inactive, ob 추가)"
```

---

### Task 2: member-config 상태 설정 확장

**Files:**
- Modify: `packages/web/src/lib/member-config.ts`

**Step 1: 전체 상태 설정으로 교체**

```typescript
export const MEMBER_STATUS_CONFIG: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' | 'warning' }> = {
  pending_approval: { label: '승인대기', variant: 'warning' },
  active: { label: '활성', variant: 'default' },
  inactive: { label: '비활성', variant: 'destructive' },
  dormant: { label: '휴면', variant: 'secondary' },
  ob: { label: 'OB', variant: 'outline' },
  withdrawn: { label: '탈퇴', variant: 'destructive' },
};
```

> **Note:** Badge 컴포넌트에 `warning` variant가 없을 수 있음. 없으면 추가 필요 (노란색/주황색 계열). `packages/web/src/components/ui/badge.tsx` 확인.

**Step 2: 커밋**

```bash
git add packages/web/src/lib/member-config.ts
git commit -m "feat: member-config에 신규 상태 설정 추가"
```

---

### Task 3: Badge 컴포넌트에 warning variant 추가

**Files:**
- Modify: `packages/web/src/components/ui/badge.tsx`

**Step 1: badge variants에 warning 추가**

`badgeVariants`의 variants.variant 객체에 추가:

```typescript
warning: "border-transparent bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400",
```

**Step 2: 커밋**

```bash
git add packages/web/src/components/ui/badge.tsx
git commit -m "feat: Badge 컴포넌트에 warning variant 추가"
```

---

### Task 4: /api/auth/me에 멤버 status 필드 포함

**Files:**
- Modify: `packages/web/src/app/api/auth/me/route.ts:48-61`

**Step 1: 응답에 status 필드 추가**

기존 응답 객체에 `status` 필드 추가:

```typescript
return NextResponse.json({
  id: user.id,
  email: user.email,
  discordUsername: user.user_metadata?.full_name,
  discordName: user.user_metadata?.name,
  avatarUrl: user.user_metadata?.avatar_url,
  memberId: memberData?.id ?? null,
  profileImageUrl: memberData?.profileImageUrl ?? user.user_metadata?.avatar_url,
  name: memberData?.name ?? null,
  nickname: memberData?.nickname ?? user.user_metadata?.full_name,
  discordId,
  hasMemberRecord: !!memberData,
  onboardingCompleted: memberData?.onboardingCompleted ?? false,
  status: memberData?.status ?? null,
});
```

**Step 2: 커밋**

```bash
git add packages/web/src/app/api/auth/me/route.ts
git commit -m "feat: /api/auth/me 응답에 멤버 status 필드 추가"
```

---

### Task 5: UserLayout에 상태 기반 리다이렉트 추가

**Files:**
- Modify: `packages/web/src/app/(user)/layout.tsx`

**Step 1: fetchUser에서 status 체크 후 리다이렉트**

`useEffect` 내 `fetchUser` 함수에서 온보딩 체크 이후 status 체크 추가:

```typescript
// 온보딩 미완료 시 리다이렉트 (온보딩 페이지 자체는 예외)
if (!data.onboardingCompleted && pathname !== '/profile/onboarding') {
  router.push('/profile/onboarding');
  return;
}

// 상태별 차단 페이지 리다이렉트 (차단 페이지 자체는 예외)
const blockedPages = ['/pending', '/inactive'];
if (!blockedPages.includes(pathname)) {
  if (data.status === 'pending_approval') {
    router.push('/pending');
    return;
  }
  if (data.status === 'inactive') {
    router.push('/inactive');
    return;
  }
}
```

**Step 2: 커밋**

```bash
git add packages/web/src/app/(user)/layout.tsx
git commit -m "feat: UserLayout에 상태 기반 차단 페이지 리다이렉트 추가"
```

---

### Task 6: /pending 승인대기 페이지 생성

**Files:**
- Create: `packages/web/src/app/(user)/pending/page.tsx`

**Step 1: 승인대기 전용 페이지 작성**

미니멀한 일러스트 + 스카이블루 톤의 대기 화면:
- Clock 아이콘 (lucide-react)
- "관리자 승인 대기 중입니다" 제목
- "온보딩이 완료되었습니다. 관리자가 가입을 확인하면 서비스를 이용하실 수 있습니다." 설명
- "관리자에게 문의" 안내 텍스트
- 로그아웃 버튼

```tsx
'use client';

import { useRouter } from 'next/navigation';
import { Clock, LogOut } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function PendingApprovalPage() {
  const router = useRouter();

  const handleLogout = async () => {
    await fetch('/api/auth/logout', { method: 'POST' });
    router.push('/login');
    router.refresh();
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <div className="mx-auto max-w-md text-center space-y-6">
        <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-sky-100 dark:bg-sky-900/30">
          <Clock className="h-10 w-10 text-sky-500" />
        </div>
        <div className="space-y-2">
          <h1 className="text-2xl font-bold tracking-tight">
            관리자 승인 대기 중
          </h1>
          <p className="text-muted-foreground">
            온보딩이 완료되었습니다.<br />
            관리자가 가입을 확인하면 서비스를 이용하실 수 있습니다.
          </p>
        </div>
        <div className="rounded-lg border bg-muted/50 p-4">
          <p className="text-sm text-muted-foreground">
            궁금한 점이 있으시면 Discord 채널에서 관리자에게 문의해주세요.
          </p>
        </div>
        <Button variant="outline" onClick={handleLogout} className="gap-2">
          <LogOut className="h-4 w-4" />
          로그아웃
        </Button>
      </div>
    </div>
  );
}
```

**Step 2: 커밋**

```bash
git add packages/web/src/app/\(user\)/pending/page.tsx
git commit -m "feat: /pending 승인대기 페이지 생성"
```

---

### Task 7: /inactive 비활성 페이지 생성

**Files:**
- Create: `packages/web/src/app/(user)/inactive/page.tsx`

**Step 1: 비활성 전용 페이지 작성**

```tsx
'use client';

import { useRouter } from 'next/navigation';
import { ShieldX, LogOut } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function InactivePage() {
  const router = useRouter();

  const handleLogout = async () => {
    await fetch('/api/auth/logout', { method: 'POST' });
    router.push('/login');
    router.refresh();
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <div className="mx-auto max-w-md text-center space-y-6">
        <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-red-100 dark:bg-red-900/30">
          <ShieldX className="h-10 w-10 text-red-500" />
        </div>
        <div className="space-y-2">
          <h1 className="text-2xl font-bold tracking-tight">
            계정이 비활성화되었습니다
          </h1>
          <p className="text-muted-foreground">
            관리자에 의해 계정이 비활성화되었습니다.<br />
            자세한 사항은 관리자에게 문의해주세요.
          </p>
        </div>
        <div className="rounded-lg border bg-muted/50 p-4">
          <p className="text-sm text-muted-foreground">
            Discord 채널에서 관리자에게 문의하실 수 있습니다.
          </p>
        </div>
        <Button variant="outline" onClick={handleLogout} className="gap-2">
          <LogOut className="h-4 w-4" />
          로그아웃
        </Button>
      </div>
    </div>
  );
}
```

**Step 2: 커밋**

```bash
git add packages/web/src/app/\(user\)/inactive/page.tsx
git commit -m "feat: /inactive 비활성 페이지 생성"
```

---

### Task 8: 온보딩 API - 신규 유저 status를 pending_approval로 변경

**Files:**
- Modify: `packages/web/src/app/api/profile/onboarding/route.ts:191`

**Step 1: 신규 유저 INSERT 시 status 변경**

```typescript
// 기존: status: 'active',
// 변경:
status: 'pending_approval',
```

**Step 2: 커밋**

```bash
git add packages/web/src/app/api/profile/onboarding/route.ts
git commit -m "feat: 온보딩 완료 시 신규 유저를 pending_approval 상태로 설정"
```

---

### Task 9: OAuth 콜백 - 상태별 리다이렉트 추가

**Files:**
- Modify: `packages/web/src/app/auth/callback/route.ts:54-68`

**Step 1: 멤버 조회 시 status도 가져와서 분기**

```typescript
const [memberData] = await database
  .select({
    onboardingCompleted: members.onboardingCompleted,
    status: members.status,
  })
  .from(members)
  .where(eq(members.discordId, discordId))
  .limit(1);

// 멤버 레코드가 없거나 온보딩 미완료 → 온보딩으로
if (!memberData || !memberData.onboardingCompleted) {
  return NextResponse.redirect(`${origin}/profile/onboarding`);
}

// 상태별 리다이렉트
if (memberData.status === 'pending_approval') {
  return NextResponse.redirect(`${origin}/pending`);
}
if (memberData.status === 'inactive') {
  return NextResponse.redirect(`${origin}/inactive`);
}
```

**Step 2: 커밋**

```bash
git add packages/web/src/app/auth/callback/route.ts
git commit -m "feat: OAuth 콜백에서 멤버 상태별 리다이렉트 처리"
```

---

### Task 10: 관리자 API - validStatuses 확장 + 그룹핑 확장

**Files:**
- Modify: `packages/web/src/app/api/admin/members/route.ts:65-118`
- Modify: `packages/web/src/app/api/admin/members/[id]/route.ts:91`

**Step 1: GET 응답의 grouped/counts에 신규 상태 추가**

`route.ts`의 GET 핸들러에서:

```typescript
const groupedMembers = {
  pending_approval: [] as typeof result,
  active: [] as typeof result,
  inactive: [] as typeof result,
  dormant: [] as typeof result,
  ob: [] as typeof result,
  withdrawn: [] as typeof result,
};

// Group by status
result.forEach((member) => {
  const status = member.status as keyof typeof groupedMembers;
  if (groupedMembers[status]) {
    groupedMembers[status].push(member);
  }
});

return NextResponse.json({
  members: result,
  grouped: groupedMembers,
  counts: {
    pending_approval: groupedMembers.pending_approval.length,
    active: groupedMembers.active.length,
    inactive: groupedMembers.inactive.length,
    dormant: groupedMembers.dormant.length,
    ob: groupedMembers.ob.length,
    withdrawn: groupedMembers.withdrawn.length,
    total: result.length,
  },
});
```

**Step 2: [id]/route.ts의 validStatuses 확장**

```typescript
const validStatuses = [
  MemberStatus.PENDING_APPROVAL,
  MemberStatus.ACTIVE,
  MemberStatus.INACTIVE,
  MemberStatus.DORMANT,
  MemberStatus.OB,
  MemberStatus.WITHDRAWN,
];
```

**Step 3: 커밋**

```bash
git add packages/web/src/app/api/admin/members/route.ts packages/web/src/app/api/admin/members/\[id\]/route.ts
git commit -m "feat: 관리자 API에 신규 멤버 상태 지원 추가"
```

---

### Task 11: 관리자 멤버 관리 페이지 - 탭 기반 UI 개편

**Files:**
- Modify: `packages/web/src/app/(admin)/admin/members/page.tsx`

**Step 1: MemberCounts 인터페이스 확장**

```typescript
interface MemberCounts {
  pending_approval: number;
  active: number;
  inactive: number;
  dormant: number;
  ob: number;
  withdrawn: number;
  total: number;
}
```

**Step 2: Stats Cards를 6개 상태 + 전체로 확장**

기존 4개 카드 → 탭 스타일 필터 버튼으로 변경:

```tsx
{/* Status Filter Tabs */}
<div className="flex flex-wrap gap-2">
  {[
    { key: 'all', label: '전체', count: data?.counts.total, icon: Users },
    { key: 'pending_approval', label: '승인대기', count: data?.counts.pending_approval, icon: Clock },
    { key: 'active', label: '활성', count: data?.counts.active, icon: UserCheck },
    { key: 'ob', label: 'OB', count: data?.counts.ob, icon: GraduationCap },
    { key: 'dormant', label: '휴면', count: data?.counts.dormant, icon: Moon },
    { key: 'inactive', label: '비활성', count: data?.counts.inactive, icon: UserX },
  ].map((tab) => (
    <button
      key={tab.key}
      onClick={() => setStatusFilter(tab.key)}
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-medium transition-colors',
        statusFilter === tab.key
          ? 'bg-primary text-primary-foreground'
          : 'bg-muted text-muted-foreground hover:bg-muted/80'
      )}
    >
      <tab.icon className="h-3.5 w-3.5" />
      {tab.label}
      <span className={cn(
        'ml-0.5 rounded-full px-1.5 py-0.5 text-xs',
        statusFilter === tab.key
          ? 'bg-primary-foreground/20 text-primary-foreground'
          : 'bg-background text-foreground'
      )}>
        {tab.count ?? 0}
      </span>
    </button>
  ))}
</div>
```

lucide-react imports에 `Clock`, `UserCheck`, `GraduationCap` 추가.

**Step 3: 승인대기 탭일 때 카드 뷰 표시**

`statusFilter === 'pending_approval'`일 때 테이블 대신 카드 그리드:

```tsx
{statusFilter === 'pending_approval' && filteredMembers.length > 0 ? (
  <div className="grid gap-4 md:grid-cols-2">
    {filteredMembers.map((member) => (
      <PendingMemberCard
        key={member.id}
        member={member}
        onApprove={handleApproveMember}
        onReject={handleRejectMember}
      />
    ))}
  </div>
) : (
  // 기존 테이블 렌더링
)}
```

**Step 4: 승인/거절 핸들러 추가**

```typescript
const handleApproveMember = async (memberId: string, targetStatus: string) => {
  try {
    const response = await fetch(`/api/admin/members/${memberId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: targetStatus }),
    });
    if (response.ok) fetchMembers();
  } catch (err) {
    console.error('Approve failed:', err);
  }
};

const handleRejectMember = async (memberId: string) => {
  try {
    const response = await fetch(`/api/admin/members/${memberId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'withdrawn' }),
    });
    if (response.ok) fetchMembers();
  } catch (err) {
    console.error('Reject failed:', err);
  }
};
```

**Step 5: 커밋**

```bash
git add packages/web/src/app/\(admin\)/admin/members/page.tsx
git commit -m "feat: 관리자 멤버 페이지 탭 기반 UI로 개편 + 승인/거절 기능"
```

---

### Task 12: PendingMemberCard 컴포넌트 생성

**Files:**
- Create: `packages/web/src/app/(admin)/admin/members/pending-member-card.tsx`

**Step 1: 승인대기 멤버 카드 컴포넌트 작성**

카드에 표시할 정보: 이름, 닉네임, 파트, 블로그 URL, 자기소개(bio), 관심사(interests), 각오(resolution), 가입일.
하단에 "승인" 드롭다운(active/ob 선택) + "거절" 버튼.

> **Note:** 현재 GET API가 bio, interests, resolution을 반환하지 않음. API에서 이 필드들도 포함하도록 수정 필요 (Task 10에서 함께 처리하거나 여기서 추가).

멤버 API 응답에 `nickname`, `bio`, `interests`, `resolution` 필드 추가 필요:
- `packages/web/src/app/api/admin/members/route.ts`의 result 매핑에 추가

```tsx
'use client';

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
          <img
            src={member.profileImageUrl || getDefaultAvatar(member.name)}
            alt={member.name}
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
```

**Step 2: 커밋**

```bash
git add packages/web/src/app/\(admin\)/admin/members/pending-member-card.tsx
git commit -m "feat: PendingMemberCard 승인대기 멤버 카드 컴포넌트 생성"
```

---

### Task 13: 관리자 API - 멤버 응답에 프로필 필드 추가

**Files:**
- Modify: `packages/web/src/app/api/admin/members/route.ts:77-96`

**Step 1: result 매핑에 nickname, bio, interests, resolution 추가**

```typescript
return {
  id: member.id,
  discordId: member.discordId,
  discordUsername: member.discordUsername,
  name: member.name,
  nickname: member.nickname,
  part: member.part,
  blogUrl: member.blogUrl,
  rssUrl: member.rssUrl,
  profileImageUrl: member.profileImageUrl,
  bio: member.bio,
  interests: member.interests,
  resolution: member.resolution,
  rssConsent: member.rssConsent ?? true,
  status: member.status,
  onboardingCompleted: member.onboardingCompleted,
  dormantUsed: member.dormantUsed,
  dormantStartRound: member.dormantStartRound,
  postCount,
  attendanceRate,
  attendanceStats: attStats,
  joinedAt: member.joinedAt?.toISOString(),
  updatedAt: member.updatedAt?.toISOString(),
};
```

**Step 2: 커밋**

```bash
git add packages/web/src/app/api/admin/members/route.ts
git commit -m "feat: 관리자 멤버 API 응답에 프로필 필드(bio, interests, resolution) 추가"
```

---

### Task 14: 관리자 멤버 페이지 - Member 인터페이스 확장 + MemberFormDialog에 상태 필드 추가

**Files:**
- Modify: `packages/web/src/app/(admin)/admin/members/page.tsx` (Member 인터페이스)
- Modify: `packages/web/src/app/(admin)/admin/members/member-form-dialog.tsx` (상태 변경 select 추가)

**Step 1: Member 인터페이스에 신규 필드 추가**

```typescript
interface Member {
  id: string;
  discordId: string;
  discordUsername: string;
  name: string;
  nickname: string;
  part: string;
  blogUrl: string;
  rssUrl: string | null;
  rssConsent: boolean;
  profileImageUrl: string | null;
  bio: string | null;
  interests: string[] | null;
  resolution: string | null;
  status: string;
  onboardingCompleted: boolean;
  dormantUsed: boolean;
  dormantStartRound: number | null;
  postCount: number;
  attendanceRate: number;
  attendanceStats: AttendanceStats;
  joinedAt: string;
  updatedAt: string;
}
```

**Step 2: MemberFormDialog에 상태 변경 select 추가 (편집 모드일 때만)**

편집 모드에서 상태를 변경할 수 있는 드롭다운 추가. `MEMBER_STATUS_CONFIG`를 import하여 옵션 렌더링.

**Step 3: 커밋**

```bash
git add packages/web/src/app/\(admin\)/admin/members/page.tsx packages/web/src/app/\(admin\)/admin/members/member-form-dialog.tsx
git commit -m "feat: 멤버 인터페이스 확장 + 폼 다이얼로그에 상태 변경 추가"
```

---

### Task 15: 빌드 검증 및 최종 테스트

**Step 1: shared 패키지 빌드**

Run: `pnpm --filter @blog-study/shared build`
Expected: 성공

**Step 2: 웹 빌드**

Run: `pnpm --filter @blog-study/web build`
Expected: 성공

**Step 3: 타입 체크**

Run: `pnpm typecheck`
Expected: 에러 없음

**Step 4: 린트**

Run: `pnpm lint`
Expected: 에러 없음

**Step 5: 커밋 (빌드 수정 사항 있을 경우)**

```bash
git commit -m "fix: 빌드 에러 수정"
```
