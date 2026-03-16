# 알림 정책

> **최종 수정:** 2026-03-16
> **버전:** 1.0.0

이 문서는 큐스팅 4th 스터디 플랫폼에서 제공하는 푸시 알림의 정책과 동작 방식을 설명합니다.

---

## 1. 알림 개요

### 1.1 알림 제공 방식

- **방식:** Firebase Cloud Messaging (FCM) 기반 웹 푸시 알림
- **대상:** PWA 설치 및 알림 권한 허용 유저
- **비용:** 완전 무료 (Google Firebase FCM 활용)
- **제한:** 없음 (무제한 전송 가능)

### 1.2 알림 수신 조건

1. **PWA 설치:** 브라우저에 웹 앱 설치
2. **알림 권한 허용:** 브라우저 알림 권한 `granted` 상태
3. **FCM 토큰 등록:** Firebase Cloud Messaging 토큰 발급 완료

### 1.3 알림 설정

- **설정 페이지:** `/profile/notifications`
- **기능:**
  - 알림 켜기/끄기 (전체 토글)
  - 알림 타입별 개별 설정 (토글 스위치)
    - 게시판 댓글
    - 게시판 답글
    - 포스트 댓글
    - 포스트 답글
    - 공지사항
  - 브라우저 알림 권한 관리
  - FCM 토큰 구독/구독 취소

**기본값:** 모든 알림 타입 기본 켜짐 (`enabled: true`)

---

## 2. 알림 유형별 정책

### 2.1 게시판 (Board)

#### 2.1.1 댓글 알림

| 항목 | 내용 |
|------|------|
| **트리거** | 게시판 글에 댓글 작성 시 |
| **수신자** | 게시글 작성자 |
| **제외** | 댓글 작성자 본인 |
| **중복** | 매 댓글마다 알림 (무제한) |
| **타이틀** | "새 댓글이 달렸습니다" |
| **본문** | 댓글 내용 일부 (최대 50자 + ...) |
| **클릭 동작** | 해당 게시글로 이동 |

**정책:**
- ✅ 내가 쓴 글에 남이 댓글을 달면 무조건 알림
- ✅ 다른 사람들이 댓글을 달아도 모두 알림
- ❌ 내가 쓴 댓글은 알림 없음

#### 2.1.2 답글 알림

| 항목 | 내용 |
|------|------|
| **트리거** | 댓글에 대댓글 작성 시 |
| **수신자** | 원댓글 작성자 |
| **제외** | 답글 작성자 본인 |
| **타이틀** | "💬 답글이 달렸습니다" |
| **본문** | 답글 내용 일부 (최대 50자 + ...) |
| **클릭 동작** | 해당 게시글로 이동 |

**정책:**
- ✅ 내 댓글에 답글이 달리면 무조건 알림
- ✅ 내가 쓴 글에 대댓글이 달려도, 원댓글이 내 것이라면 알림
- ❌ 내가 쓴 답글은 알림 없음

---

### 2.2 포스트 (Blog)

#### 2.2.1 댓글 알림

| 항목 | 내용 |
|------|------|
| **트리거** | 블로그 글에 댓글 작성 시 |
| **수신자** | 포스트 작성자 |
| **제외** | 댓글 작성자 본인 |
| **중복** | 매 댓글마다 알림 (무제한) |
| **타이틀** | "새 댓글이 달렸습니다" |
| **본문** | 댓글 내용 일부 (최대 50자 + ...) |
| **클릭 동작** | 해당 포스트로 이동 |

**정책:**
- ✅ 내가 쓴 포스트에 남이 댓글을 달면 무조건 알림
- ✅ 다른 사람들이 댓글을 달아도 모두 알림
- ❌ 내가 쓴 댓글은 알림 없음

#### 2.2.2 답글 알림

| 항목 | 내용 |
|------|------|
| **트리거** | 댓글에 대댓글 작성 시 |
| **수신자** | 원댓글 작성자 |
| **제외** | 답글 작성자 본인 |
| **타이틀** | "💬 답글이 달렸습니다" |
| **본문** | 답글 내용 일부 (최대 50자 + ...) |
| **클릭 동작** | 해당 포스트로 이동 |

**정책:**
- ✅ 내 댓글에 답글이 달리면 무조건 알림
- ✅ 내가 쓴 글에 대댓글이 달려도, 원댓글이 내 것이라면 알림
- ❌ 내가 쓴 답글은 알림 없음

---

### 2.3 공지사항

#### 2.3.1 전체 알림

| 항목 | 내용 |
|------|------|
| **트리거** | 게시판 공지사항 글 작성 시 |
| **수신자** | 활성 상태(`active`)인 모든 멤버 |
| **제외** | 없음 (공지사항 작성자 포함 전체) |
| **타이틀** | "📢 새 공지사항" |
| **본문** | 공지사항 제목 전체 |
| **클릭 동작** | 해당 공지사항으로 이동 |

**정책:**
- ✅ 관리자가 공지사항을 작성하면 활성 멤버 전체에게 알림
- ✅ 카테고리가 `notice`인 게시글만 해당
- ✅ 활동 점수와 별도로 운영

---

## 3. 알림 동작 방식

### 3.1 포그라운드 알림

- **정의:** 사용자가 사이트를 이용 중인 상태
- **표현:** 브라우저 내부 토스트 메시지 (sonner)
- **동작:**
  1. FCM 메시지 수신
  2. 우측 상단에 토스트 팝업 표시
  3. 클릭 시 해당 페이지로 이동

### 3.2 백그라운드 알림

- **정의:** 사용자가 사이트를 이용하지 않는 상태
- **표현:** 운영체제 알림 센터
- **동작:**
  1. 서비스 워커가 FCM 메시지 수신
  2. 시스템 알림으로 표시
  3. 클릭 시 브라우저 열리며 해당 페이지로 이동

### 3.3 알림 클릭 동작

1. **게시판 알림:** `/board/{postId}`로 이동
2. **포스트 알림:** `/posts/{postId}`로 이동
3. **공지사항 알림:** `/board/{postId}`로 이동 (게시판 공지)

---

## 4. 알림 데이터 구조

### 4.1 FCM 토큰 저장

```sql
CREATE TABLE fcm_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id UUID NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  token TEXT NOT NULL,
  device_info TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  last_used_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(member_id, token)
);
```

### 4.2 알림 페이로드

```typescript
{
  notification: {
    title: string,    // 알림 제목
    body: string,      // 알림 내용
  },
  data: {
    type: string,     // 'board_comment', 'board_reply', 'post_comment', 'post_reply', 'board_notice'
    postId: string,   // 게시글/포스트 ID
    commentId?: string, // 댓글 ID (선택)
    clickUrl: string,  // 이동할 URL
  }
}
```

---

## 5. 기술 구현

### 5.1 Firebase Cloud Messaging

- **Client SDK:** Firebase JavaScript SDK (브라우저)
- **Admin SDK:** Firebase Admin Node.js SDK (서버)
- **서비스 워커:** `/public/firebase-messaging-sw.js`

### 5.2 알림 전송 흐름

```
[사용자 액션]
    ↓ (댓글/답글/공지 작성)
[Next.js API Route]
    ↓ (대상자 추출)
[Firebase Admin SDK]
    ↓ (FCM 토큰 조회)
[FCM 서버]
    ↓ (메시지 전송)
[브라우저 서비스 워커]
    ↓ (메시지 수신)
[사용자 기기]
    ↓ (알림 표시)
```

### 5.3 자동 정리

- **만료 토큰 삭제:** FCM 전송 실패 시 자동 삭제
- **마지막 사용 시간 업데이트:** 알림 전송 성공 시 갱신
- **중복 토큰 방지:** (member_id, token) 유니크 제약조건

---

## 6. 브라우저 지원

### 6.1 지원 브라우저

| 브라우저 | 지원 버전 | 비고 |
|----------|-----------|------|
| Chrome | 42+ | ✅ 완전 지원 |
| Firefox | 44+ | ✅ 완전 지원 |
| Edge | 42+ | ✅ 완전 지원 |
| Safari (macOS) | 16.4+ | ✅ 지원 |
| Safari (iOS) | 16.4+ | ⚠️ 홈 화면 추가 필요 |
| Samsung Internet | 최신 버전 | ✅ 완전 지원 |

### 6.2 미지원 브라우저

- **iOS 16.4 미만:** 푸시 알림 미지원
- **일부 안드로이드 브라우저:** Web Push API 미지원
- **Internet Explorer:** 지원 종료

---

## 7. 개인정보 보호

### 7.1 데이터 수집

- **FCM 토큰:** 디바이스 식별자 (Firebase 발급)
- **디바이스 정보:** User-Agent 문자열 (선택)
- **저장 위치:** Supabase PostgreSQL (fcm_tokens 테이블)

### 7.2 데이터 보호

- **암호화:** HTTPS 통신 (TLS 1.3+)
- **인증:** FCM 토큰 요청 시 회원 인증 필수
- **접근 제어:** 서비스 계정 키 base64 인코딩 (환경변수)
- **보관:** 회원 탈퇴 시 자동 삭제 (ON DELETE CASCADE)

### 7.3 권한 관리

- **알림 권한:** 사용자 동의 필수 (Notification API)
- **언제든 취소:** 브라우저 설정에서 언제든 차단 가능
- **구독 취소:** `/settings/notifications`에서 토큰 삭제 가능

---

## 8. 문제 해결

### 8.1 알림이 안 올 때

1. **알림 권한 확인**
   - 브라우저 설정 → 사이트 설정 → 알림 권한
   - `chrome://settings/content/notifications`

2. **FCM 토큰 확인**
   - 개발자 도구 → Application → Service Workers
   - `/firebase-messaging-sw.js` 등록 확인

3. **CSP 에러 확인**
   - 개발자 도구 → Console
   - `Connecting to ... violates CSP` 에러 없는지 확인

### 8.2 서버 에러

1. **Firebase Admin SDK 초기화 실패**
   - Service Account Key 파일 확인
   - `/firebase-service-account.json` 존재 확인

2. **FCM 전송 실패**
   - 토큰 만료: 자동 삭제됨
   - 잘못된 토큰: 자동 정리됨
   - 할당량 초과: 없음 (FCM 무제한)

### 8.3 고객 지원

- **이슈 트래커:** GitHub Issues
- **문서:** `/docs/26-03-16-pwa-push-notification.md`
- **테스트:** 실제 알림 전송으로 확인

---

## 9. 변경 이력

| 버전 | 날짜 | 변경 내용 | 작성자 |
|------|------|----------|--------|
| 1.0.0 | 2026-03-16 | 초기 알림 정책 문서 작성 | Claude |

---

## 10. 참고 자료

- [Firebase Cloud Messaging](https://firebase.google.com/docs/cloud-messaging)
- [Web Push API](https://developer.mozilla.org/en-US/docs/Web/API/Push_API)
- [Notification API](https://developer.mozilla.org/en-US/docs/Web/API/Notifications_API)
- [PWA 푸시 알림 구현 계획](/home/choiho/study-admin/docs/plans/26-03-16-pwa-push-notification.md)
