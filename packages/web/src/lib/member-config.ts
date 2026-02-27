export const MEMBER_STATUS_CONFIG: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' | 'warning' }> = {
  pending_approval: { label: '승인대기', variant: 'warning' },
  active: { label: '활성', variant: 'default' },
  inactive: { label: '비활성', variant: 'destructive' },
  dormant: { label: '휴면', variant: 'secondary' },
  ob: { label: 'OB', variant: 'outline' },
  withdrawn: { label: '탈퇴', variant: 'destructive' },
};
