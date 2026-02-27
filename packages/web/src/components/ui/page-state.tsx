import { Skeleton } from '@/components/ui/skeleton';
import { Card, CardContent, CardHeader } from '@/components/ui/card';

// ─────────────────────────────────────────────
// Error
// ─────────────────────────────────────────────

export function PageError({ message }: { message: string }) {
  return (
    <div className="flex items-center justify-center min-h-[400px]">
      <div className="text-sm text-destructive">{message}</div>
    </div>
  );
}

// ─────────────────────────────────────────────
// Skeleton: Dashboard (user)
// ─────────────────────────────────────────────

export function DashboardSkeleton() {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="space-y-1">
        <Skeleton className="h-3 w-16" />
        <Skeleton className="h-5 w-40" />
      </div>

      {/* 4 Stat cards */}
      <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Card key={i} className="border-border/60 shadow-none">
            <CardContent className="p-4">
              <div className="flex items-start justify-between gap-2">
                <div className="space-y-2">
                  <Skeleton className="h-3 w-14" />
                  <Skeleton className="h-7 w-20" />
                  <Skeleton className="h-3 w-24" />
                </div>
                <Skeleton className="h-8 w-8 rounded-lg" />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Recent posts card */}
      <Card className="border-border/60 shadow-none">
        <CardHeader className="px-4 py-3 pb-0">
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <Skeleton className="h-3 w-12" />
              <Skeleton className="h-4 w-20" />
            </div>
            <Skeleton className="h-7 w-16 rounded-md" />
          </div>
        </CardHeader>
        <CardContent className="px-4 py-3">
          <div className="divide-y divide-border/50">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="flex items-start gap-3 py-3 first:pt-0 last:pb-0">
                <Skeleton className="h-8 w-8 rounded-full shrink-0" />
                <div className="flex-1 space-y-1.5">
                  <Skeleton className="h-4 w-full max-w-[260px]" />
                  <Skeleton className="h-3 w-32" />
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// ─────────────────────────────────────────────
// Skeleton: Board list
// ─────────────────────────────────────────────

export function BoardListSkeleton() {
  return (
    <div className="space-y-4">
      {/* Tabs + write button */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <Skeleton className="h-9 w-[360px] rounded-lg" />
        <div className="flex items-center gap-2 self-end sm:self-auto">
          <Skeleton className="h-4 w-12" />
          <Skeleton className="h-8 w-20 rounded-md" />
        </div>
      </div>

      {/* Post table */}
      <Card className="border-border/60 shadow-none overflow-hidden">
        {/* Table header */}
        <div className="hidden md:flex items-center gap-4 px-4 py-2.5 border-b border-border/60">
          <Skeleton className="h-3 w-12" />
          <Skeleton className="h-3 w-8 flex-1" />
          <Skeleton className="h-3 w-14" />
          <Skeleton className="h-3 w-10" />
        </div>
        {/* Table rows */}
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="flex items-center gap-4 px-4 py-3 border-b border-border/40 last:border-0">
            <Skeleton className="h-5 w-14 rounded-full shrink-0" />
            <Skeleton className="h-4 flex-1 max-w-[300px]" />
            <div className="hidden md:flex items-center gap-1.5">
              <Skeleton className="h-5 w-5 rounded-full" />
              <Skeleton className="h-3 w-14" />
            </div>
            <Skeleton className="hidden md:block h-3 w-16" />
          </div>
        ))}
      </Card>
    </div>
  );
}

// ─────────────────────────────────────────────
// Skeleton: Board detail
// ─────────────────────────────────────────────

export function BoardDetailSkeleton() {
  return (
    <div className="mx-auto max-w-3xl space-y-6">
      {/* Header */}
      <div className="space-y-0.5">
        <Skeleton className="h-3 w-20" />
        <div className="flex items-center gap-3">
          <Skeleton className="h-8 w-8 rounded-md" />
          <Skeleton className="h-6 w-16" />
        </div>
      </div>

      {/* Post card */}
      <div className="rounded-xl border border-border/60 overflow-hidden">
        <div className="px-6 pt-6 pb-4 border-b border-border/40 space-y-4">
          <Skeleton className="h-5 w-14 rounded-full" />
          <Skeleton className="h-6 w-3/4" />
          <div className="flex items-center gap-2.5">
            <Skeleton className="h-8 w-8 rounded-full" />
            <div className="space-y-1">
              <Skeleton className="h-4 w-20" />
              <Skeleton className="h-3 w-16" />
            </div>
          </div>
        </div>
        <div className="px-6 py-6 space-y-3">
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-5/6" />
          <Skeleton className="h-4 w-4/6" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-3/4" />
        </div>
      </div>

      {/* Comments */}
      <div className="rounded-xl border border-border/60 overflow-hidden">
        <div className="flex items-center gap-2 px-6 py-4 border-b border-border/40">
          <Skeleton className="h-4 w-4" />
          <Skeleton className="h-4 w-10" />
        </div>
        <div className="px-6 py-4 space-y-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="flex items-start gap-2.5">
              <Skeleton className="h-7 w-7 rounded-full shrink-0" />
              <div className="flex-1 space-y-1.5">
                <Skeleton className="h-3 w-20" />
                <Skeleton className="h-4 w-full max-w-[200px]" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// Skeleton: Board write / edit form
// ─────────────────────────────────────────────

export function BoardFormSkeleton() {
  return (
    <div className="mx-auto max-w-3xl space-y-6">
      {/* Header */}
      <div className="space-y-0.5">
        <Skeleton className="h-3 w-20" />
        <div className="flex items-center gap-3">
          <Skeleton className="h-8 w-8 rounded-md" />
          <Skeleton className="h-6 w-28" />
        </div>
      </div>

      {/* Form card */}
      <Card className="border-border/60 shadow-none">
        <CardContent className="pt-6 space-y-5">
          {/* Category */}
          <div className="space-y-1.5">
            <Skeleton className="h-4 w-16" />
            <Skeleton className="h-10 w-48 rounded-md" />
          </div>
          {/* Title */}
          <div className="space-y-1.5">
            <Skeleton className="h-4 w-8" />
            <Skeleton className="h-10 w-full rounded-md" />
          </div>
          {/* Editor */}
          <div className="space-y-1.5">
            <Skeleton className="h-4 w-8" />
            <Skeleton className="h-[200px] w-full rounded-md" />
          </div>
          {/* Secret toggle */}
          <Skeleton className="h-14 w-full rounded-lg" />
        </CardContent>
      </Card>

      {/* Action buttons */}
      <div className="flex justify-end gap-3 pb-8">
        <Skeleton className="h-10 w-20 rounded-md" />
        <Skeleton className="h-10 w-24 rounded-md" />
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// Skeleton: Ranking
// ─────────────────────────────────────────────

export function RankingSkeleton() {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="space-y-1">
        <Skeleton className="h-3 w-14" />
        <Skeleton className="h-6 w-12" />
        <Skeleton className="h-4 w-48" />
      </div>

      {/* Podium */}
      <div className="grid grid-cols-3 items-end gap-2 sm:gap-3">
        <Skeleton className="h-[170px] sm:h-[220px] rounded-xl" />
        <Skeleton className="h-[200px] sm:h-[280px] rounded-xl" />
        <Skeleton className="h-[150px] sm:h-[190px] rounded-xl" />
      </div>

      {/* Sort tabs */}
      <Skeleton className="h-9 w-56 rounded-lg" />

      {/* Table */}
      <Card className="rounded-xl border-border/60 shadow-none">
        <CardHeader className="pb-3 pt-5 px-5">
          <div className="flex items-center justify-between">
            <Skeleton className="h-4 w-20" />
            <Skeleton className="h-3 w-14" />
          </div>
        </CardHeader>
        <CardContent className="px-4 pb-4">
          {Array.from({ length: 7 }).map((_, i) => (
            <div key={i} className="flex items-center gap-3 py-2.5 border-b border-border/40 last:border-0">
              <Skeleton className="h-7 w-7 rounded-full" />
              <Skeleton className="h-7 w-7 rounded-full" />
              <Skeleton className="h-4 flex-1 max-w-[120px]" />
              <Skeleton className="h-4 w-12 ml-auto" />
              <Skeleton className="hidden sm:block h-2.5 w-24" />
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}

// ─────────────────────────────────────────────
// Skeleton: Profile
// ─────────────────────────────────────────────

export function ProfileSkeleton() {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="space-y-1">
        <Skeleton className="h-3 w-14" />
        <Skeleton className="h-6 w-24" />
      </div>

      {/* Account card */}
      <Card className="border-border/60 shadow-none">
        <CardHeader className="px-4 py-3 pb-0">
          <div className="flex items-center gap-2">
            <Skeleton className="h-8 w-8 rounded-lg" />
            <Skeleton className="h-4 w-20" />
          </div>
        </CardHeader>
        <CardContent className="px-4 py-4">
          <div className="flex items-center gap-4">
            <Skeleton className="h-14 w-14 rounded-full" />
            <div className="space-y-1.5">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-3 w-32" />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Member info card */}
      <Card className="border-border/60 shadow-none">
        <CardHeader className="px-4 py-3 pb-0">
          <div className="flex items-center gap-2">
            <Skeleton className="h-8 w-8 rounded-lg" />
            <Skeleton className="h-4 w-28" />
          </div>
        </CardHeader>
        <CardContent className="px-4 py-4">
          <div className="grid gap-4 md:grid-cols-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="space-y-1">
                <Skeleton className="h-3 w-14" />
                <Skeleton className="h-4 w-28" />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Stats */}
      <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Card key={i} className="border-border/60 shadow-none">
            <CardContent className="p-4">
              <div className="flex items-start justify-between">
                <div className="space-y-2">
                  <Skeleton className="h-3 w-14" />
                  <Skeleton className="h-7 w-16" />
                </div>
                <Skeleton className="h-8 w-8 rounded-lg" />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// Skeleton: Members list
// ─────────────────────────────────────────────

export function MembersListSkeleton() {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="space-y-1">
        <Skeleton className="h-3 w-16" />
        <Skeleton className="h-6 w-32" />
      </div>

      {/* Filter */}
      <div className="flex flex-wrap gap-1">
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-7 w-14 rounded-md" />
        ))}
      </div>

      {/* Grid */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <Card key={i} className="border-border/60 shadow-none">
            <CardContent className="p-4">
              <div className="flex items-start gap-3">
                <Skeleton className="h-11 w-11 rounded-full shrink-0" />
                <div className="space-y-1.5 flex-1">
                  <Skeleton className="h-4 w-20" />
                  <Skeleton className="h-3 w-28" />
                </div>
              </div>
              <Skeleton className="mt-3 h-3 w-full" />
              <div className="mt-3 flex gap-1.5">
                <Skeleton className="h-5 w-14 rounded-full" />
                <Skeleton className="h-5 w-16 rounded-full" />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// Skeleton: Member detail
// ─────────────────────────────────────────────

export function MemberDetailSkeleton() {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Skeleton className="h-10 w-10 rounded-md shrink-0" />
        <div className="space-y-1">
          <Skeleton className="h-7 w-36" />
          <Skeleton className="h-4 w-24" />
        </div>
      </div>

      {/* Profile card */}
      <Card>
        <CardHeader>
          <Skeleton className="h-5 w-16" />
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:gap-6">
            <Skeleton className="h-20 w-20 sm:h-24 sm:w-24 rounded-full shrink-0" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-6 w-28" />
              <Skeleton className="h-4 w-20" />
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-5 w-16 rounded-full" />
            </div>
          </div>
          <Skeleton className="h-px w-full" />
          <div className="space-y-2">
            <Skeleton className="h-3 w-14" />
            <Skeleton className="h-4 w-full max-w-[300px]" />
          </div>
        </CardContent>
      </Card>

      {/* Recent posts card */}
      <Card>
        <CardHeader>
          <Skeleton className="h-5 w-24" />
        </CardHeader>
        <CardContent>
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="py-3 border-b last:border-0 space-y-1">
              <Skeleton className="h-4 w-full max-w-[280px]" />
              <Skeleton className="h-3 w-20" />
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}

// ─────────────────────────────────────────────
// Skeleton: Posts list
// ─────────────────────────────────────────────

export function PostsListSkeleton() {
  return (
    <Card className="border-border/60 shadow-none">
      <CardHeader className="pb-3 pt-5 px-6">
        <div className="flex items-center justify-between">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-4 w-14" />
        </div>
      </CardHeader>
      <CardContent className="px-6 pb-5">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="flex items-center gap-4 py-3 border-b border-border/40 last:border-0">
            <Skeleton className="h-4 flex-1 max-w-[280px]" />
            <Skeleton className="hidden md:block h-3 w-20" />
            <Skeleton className="hidden md:block h-5 w-14 rounded-full" />
            <Skeleton className="hidden md:block h-3 w-16" />
            <Skeleton className="hidden md:block h-3 w-20" />
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

// ─────────────────────────────────────────────
// Skeleton: Onboarding / Profile edit (form)
// ─────────────────────────────────────────────

export function FormPageSkeleton() {
  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="space-y-1">
        <Skeleton className="h-7 w-40" />
        <Skeleton className="h-4 w-64" />
      </div>
      <Card>
        <CardContent className="pt-6 space-y-5">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="space-y-1.5">
              <Skeleton className="h-4 w-16" />
              <Skeleton className="h-10 w-full rounded-md" />
            </div>
          ))}
          <Skeleton className="h-24 w-full rounded-md" />
        </CardContent>
      </Card>
      <div className="flex justify-end gap-3">
        <Skeleton className="h-10 w-20 rounded-md" />
        <Skeleton className="h-10 w-24 rounded-md" />
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// Skeleton: Admin dashboard
// ─────────────────────────────────────────────

export function AdminDashboardSkeleton() {
  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <Skeleton className="h-3 w-12" />
        <Skeleton className="h-7 w-32" />
        <Skeleton className="h-4 w-48" />
      </div>

      {/* Stat cards */}
      <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Card key={i} className="border-border/60 shadow-none">
            <CardContent className="p-4">
              <div className="flex items-start justify-between gap-2">
                <div className="space-y-2">
                  <Skeleton className="h-3 w-14" />
                  <Skeleton className="h-7 w-16" />
                  <Skeleton className="h-3 w-24" />
                </div>
                <Skeleton className="h-8 w-8 rounded-lg" />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Table card */}
      <Card className="border-border/60 shadow-none">
        <CardHeader className="px-4 py-3">
          <Skeleton className="h-5 w-28" />
        </CardHeader>
        <CardContent className="px-4">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="flex items-center gap-4 py-3 border-b border-border/40 last:border-0">
              <Skeleton className="h-4 w-20" />
              <Skeleton className="h-4 flex-1 max-w-[200px]" />
              <Skeleton className="h-5 w-12 rounded-full" />
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}

// ─────────────────────────────────────────────
// Skeleton: Admin members
// ─────────────────────────────────────────────

export function AdminMembersSkeleton() {
  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-1">
          <Skeleton className="h-7 w-32" />
          <Skeleton className="h-4 w-48" />
        </div>
        <Skeleton className="h-10 w-28 rounded-md" />
      </div>

      {/* Tabs */}
      <Skeleton className="h-10 w-full max-w-[500px] rounded-lg" />

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="flex items-center gap-4 px-4 py-3 border-b border-border/40 last:border-0">
              <Skeleton className="h-8 w-8 rounded-full" />
              <Skeleton className="h-4 flex-1 max-w-[140px]" />
              <Skeleton className="h-5 w-14 rounded-full" />
              <Skeleton className="hidden md:block h-3 w-24" />
              <Skeleton className="h-8 w-8 rounded-md ml-auto" />
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}

// ─────────────────────────────────────────────
// Skeleton: Admin scores
// ─────────────────────────────────────────────

export function AdminScoresSkeleton() {
  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <Skeleton className="h-7 w-24" />
        <Skeleton className="h-4 w-64" />
      </div>

      {/* Top members */}
      <Card>
        <CardHeader className="pb-3">
          <Skeleton className="h-5 w-28" />
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="rounded-lg border p-3 space-y-2">
                <Skeleton className="h-8 w-8 rounded-full mx-auto" />
                <Skeleton className="h-3 w-16 mx-auto" />
                <Skeleton className="h-4 w-12 mx-auto" />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Score form + history */}
      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <Skeleton className="h-5 w-24" />
          </CardHeader>
          <CardContent className="space-y-4">
            <Skeleton className="h-10 w-full rounded-md" />
            <Skeleton className="h-10 w-full rounded-md" />
            <Skeleton className="h-20 w-full rounded-md" />
            <Skeleton className="h-10 w-full rounded-md" />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <Skeleton className="h-5 w-24" />
          </CardHeader>
          <CardContent>
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="flex items-center gap-3 py-3 border-b last:border-0">
                <Skeleton className="h-4 w-20" />
                <Skeleton className="h-4 flex-1 max-w-[140px]" />
                <Skeleton className="h-4 w-12 ml-auto" />
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// Skeleton: Admin settings
// ─────────────────────────────────────────────

export function AdminSettingsSkeleton() {
  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <Skeleton className="h-7 w-28" />
        <Skeleton className="h-4 w-56" />
      </div>

      {Array.from({ length: 3 }).map((_, i) => (
        <Card key={i}>
          <CardHeader>
            <Skeleton className="h-5 w-24" />
          </CardHeader>
          <CardContent className="space-y-4">
            {Array.from({ length: 3 }).map((_, j) => (
              <div key={j} className="space-y-1.5">
                <Skeleton className="h-4 w-20" />
                <Skeleton className="h-10 w-full rounded-md" />
              </div>
            ))}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

// ─────────────────────────────────────────────
// Skeleton: Admin fines
// ─────────────────────────────────────────────

export function AdminFinesSkeleton() {
  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <Skeleton className="h-7 w-28" />
        <Skeleton className="h-4 w-48" />
      </div>

      {/* Summary cards */}
      <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Card key={i}>
            <CardContent className="p-4">
              <div className="space-y-2">
                <Skeleton className="h-3 w-14" />
                <Skeleton className="h-7 w-20" />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Fines table */}
      <Card>
        <CardContent className="p-0">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="flex items-center gap-4 px-4 py-3 border-b border-border/40 last:border-0">
              <Skeleton className="h-4 w-20" />
              <Skeleton className="h-4 flex-1 max-w-[100px]" />
              <Skeleton className="h-4 w-16" />
              <Skeleton className="h-5 w-14 rounded-full" />
              <Skeleton className="h-8 w-8 rounded-md ml-auto" />
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
