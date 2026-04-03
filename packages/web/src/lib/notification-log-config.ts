export const NotificationLogType = {
  // Bot Channel
  ROUND_REPORT: 'round_report',
  ROUND_START: 'round_start',
  WEEKLY_RANKING: 'weekly_ranking',
  CURATION: 'curation',
  NEW_POST: 'new_post',
  FINE_PAYMENT: 'fine_payment',
  // Bot DM
  DEADLINE_REMINDER: 'deadline_reminder',
  FINE_NOTIFICATION: 'fine_notification',
  FINE_REMINDER: 'fine_reminder',
  GRACE_NUDGE: 'grace_nudge',
  POLL_REMINDER: 'poll_reminder',
  // Web Channel
  BOARD_NOTICE: 'board_notice',
  POST_REGISTER: 'post_register',
  MEMBER_APPROVAL: 'member_approval',
  ANNOUNCEMENT: 'announcement',
} as const;

export type NotificationLogTypeValue = (typeof NotificationLogType)[keyof typeof NotificationLogType];

export interface NotificationLogTypeMeta {
  label: string;
  color: string;
  isDM: boolean;
}

export const notificationLogTypeConfig: Record<NotificationLogTypeValue, NotificationLogTypeMeta> = {
  round_report: {
    label: '회차 리포트',
    color: 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900/30 dark:text-indigo-400',
    isDM: false,
  },
  round_start: {
    label: '회차 시작',
    color: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400',
    isDM: false,
  },
  weekly_ranking: {
    label: '주간 랭킹',
    color: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400',
    isDM: false,
  },
  curation: {
    label: '큐레이션',
    color: 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400',
    isDM: false,
  },
  new_post: {
    label: '새 글 알림',
    color: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
    isDM: false,
  },
  fine_payment: {
    label: '벌금 확인',
    color: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
    isDM: false,
  },
  deadline_reminder: {
    label: '마감 리마인더',
    color: 'bg-rose-100 text-rose-800 dark:bg-rose-900/30 dark:text-rose-400',
    isDM: true,
  },
  fine_notification: {
    label: '벌금 알림',
    color: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
    isDM: true,
  },
  fine_reminder: {
    label: '벌금 독촉',
    color: 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400',
    isDM: true,
  },
  grace_nudge: {
    label: '지각 독촉',
    color: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400',
    isDM: true,
  },
  poll_reminder: {
    label: '투표 리마인더',
    color: 'bg-cyan-100 text-cyan-800 dark:bg-cyan-900/30 dark:text-cyan-400',
    isDM: true,
  },
  board_notice: {
    label: '게시판 공지',
    color: 'bg-sky-100 text-sky-800 dark:bg-sky-900/30 dark:text-sky-400',
    isDM: false,
  },
  post_register: {
    label: '수동 등록',
    color: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400',
    isDM: false,
  },
  member_approval: {
    label: '가입 승인',
    color: 'bg-teal-100 text-teal-800 dark:bg-teal-900/30 dark:text-teal-400',
    isDM: false,
  },
  announcement: {
    label: '공지 알림',
    color: 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400',
    isDM: false,
  },
};

const fallbackMeta: NotificationLogTypeMeta = {
  label: '알 수 없음',
  color: 'bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400',
  isDM: false,
};

export function getLogTypeMeta(type: string): NotificationLogTypeMeta {
  return notificationLogTypeConfig[type as NotificationLogTypeValue] ?? fallbackMeta;
}
