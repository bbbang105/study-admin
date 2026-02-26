export const MEMBER_STATUS_CONFIG: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' }> = {
  active: { label: '활성', variant: 'default' },
  dormant: { label: '휴면', variant: 'secondary' },
  withdrawn: { label: '탈퇴', variant: 'destructive' },
};
