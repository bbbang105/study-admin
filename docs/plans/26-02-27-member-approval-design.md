# 멤버 승인 + 상태 관리 시스템 설계

## 개요

온보딩 완료 후 관리자 승인이 필요한 멤버 승인 워크플로우와 5단계 상태 관리 시스템.

## 상태 정의

| 상태 | 값 | 플랫폼 접근 | 출석/벌금 |
|------|---|------------|----------|
| 승인대기 | `pending_approval` | 차단 | X |
| 활성 | `active` | 전체 | O |
| 비활성 | `inactive` | 차단 | X |
| 휴면 | `dormant` | 전체 | X |
| OB | `ob` | 전체 | X |
| 탈퇴 | `withdrawn` | 차단 | X |

## 상태 전환

```
온보딩 완료 → pending_approval
pending_approval → active / ob (관리자 승인)
pending_approval → withdrawn (관리자 거절)
active ↔ dormant (휴면 전환)
active → inactive (관리자 비활성화)
active → ob (관리자 OB 전환)
active → withdrawn (탈퇴)
```

## 인증/라우팅 흐름

```
로그인 → 온보딩 미완료? → /profile/onboarding
       → pending_approval? → /pending (대기 화면)
       → inactive? → /inactive (비활성 화면)
       → active/dormant/ob? → /dashboard
```

## 차단 화면

### /pending (승인대기)
- "관리자 승인 대기 중입니다" 메시지
- 관리자 문의 안내
- 로그아웃 버튼
- 미니멀 일러스트 + 스카이블루 톤

### /inactive (비활성)
- "계정이 비활성화되었습니다" 메시지
- 관리자 문의 안내
- 로그아웃 버튼

## 관리자 멤버 관리 페이지

### 탭 필터링
`전체` | `승인대기` (뱃지: 대기 수) | `활성` | `OB` | `휴면` | `비활성`

### 승인대기 전용 UX
- 카드 형태로 신규 가입자 정보 (이름, 파트, 블로그, 자기소개, 각오)
- "승인" → active / ob 선택 드롭다운
- "거절" → withdrawn 처리

### 상태별 뱃지 색상
- 승인대기: warning (노란색)
- 활성: default (기본)
- OB: outline (보라색)
- 휴면: secondary (회색)
- 비활성: destructive (빨간색)

## 변경 범위

### DB
- `MemberStatus`에 `pending_approval`, `inactive`, `ob` 추가
- 기존 `withdrawn` 유지

### 온보딩 API
- 완료 시 `status: 'active'` → `status: 'pending_approval'`

### 미들웨어
- 상태 체크 로직 추가 → 차단 상태 시 전용 페이지 리다이렉트

### 관리자 API
- 멤버 상태 변경 API 확장 (validStatuses 업데이트)

### 프론트엔드
- `/pending`, `/inactive` 페이지 신규
- 관리자 멤버 페이지 탭 + 카드 UI 개편
- `member-config.ts` 상태 설정 확장
