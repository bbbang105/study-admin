# Bot QA Sheet

**작성일:** 2026-03-11  
**대상:** `packages/bot`  
**목적:** 디스코드 봇의 주요 동작을 기능 단위로 수동 점검하기 위한 QA 시트

---

## 사용 방법

- 각 항목은 `사전조건 -> 실행 -> 기대결과` 순서로 확인한다.
- 가능하면 테스트 서버/테스트 채널/테스트 계정으로 수행한다.
- 결과 기록은 아래 상태값 중 하나를 사용한다.
  - `PASS`: 기대결과와 동일
  - `FAIL`: 재현 가능한 문제 확인
  - `N/A`: 현재 데이터나 권한상 확인 불가

### 기록 템플릿

| ID | 결과 | 비고 |
|---|---|---|
| B-BOOT-01 | PASS |  |

---

## 1. 봇 기동 / 기본 상태

| ID | 동작 | 사전조건 | 실행 | 기대결과 |
|---|---|---|---|---|
| B-BOOT-01 | 봇 기동 | 환경변수 정상 | `pnpm --filter @blog-study/bot dev` 또는 운영 기동 | 프로세스가 정상 시작되고 즉시 종료되지 않는다 |
| B-BOOT-02 | Discord 연결 | 봇 토큰 유효 | 기동 로그 확인 | Discord 로그인 성공 로그가 보인다 |
| B-BOOT-03 | 핸들러 등록 | 봇 기동 완료 | 메시지/리액션 이벤트 대기 | activity handler, DM handler 등 주요 핸들러가 정상 등록된다 |
| B-BOOT-04 | 스케줄러 등록 | 봇 기동 완료 | 시작 로그 확인 | RSS, 출석, 벌금 리마인드, 라운드 리포트, 주간 랭킹, 큐레이션 크롤러가 등록된다 |
| B-BOOT-05 | 중복 실행 방지 | 동일 잡 중복 트리거 가능 | 같은 작업을 연속 호출 | `already in progress` 류 방어가 동작해 중복 처리되지 않는다 |

---

## 2. RSS 수집 / 포스트 반영

| ID | 동작 | 사전조건 | 실행 | 기대결과 |
|---|---|---|---|---|
| B-RSS-01 | active 멤버만 RSS 대상 포함 | active/inactive/pending 멤버 혼재 | RSS poll 실행 | active 이면서 RSS URL 있는 멤버만 수집 대상이 된다 |
| B-RSS-02 | RSS 미동의 제외 | rssConsent=false 멤버 존재 | RSS poll 실행 | 미동의 멤버는 제외된다 |
| B-RSS-03 | 피드 수집 성공 | 유효 RSS URL 보유 멤버 존재 | `pnpm --filter @blog-study/bot test-rss-poll` 또는 실제 poll | 새 글이 감지되고 처리 결과가 로그에 남는다 |
| B-RSS-04 | 중복 글 방지 | 동일 글이 이미 저장됨 | RSS poll 재실행 | 기존 글이 중복 생성되지 않는다 |
| B-RSS-05 | 일부 피드 실패 허용 | 실패하는 RSS URL 포함 | RSS poll 실행 | 실패한 피드만 에러로 기록되고 나머지는 계속 처리된다 |
| B-RSS-06 | 글 저장 후 출석 연동 | 현재 라운드 기간 중 새 글 존재 | RSS poll 실행 | 포스트 저장 후 출석 상태가 적절히 갱신된다 |
| B-RSS-07 | 지각 처리 | grace period 내 제출 글 존재 | RSS poll 실행 | 출석이 `late`로 기록되고 관련 후속 동작이 이어진다 |

---

## 3. 출석 / 벌금 연동

| ID | 동작 | 사전조건 | 실행 | 기대결과 |
|---|---|---|---|---|
| B-ATT-01 | 정시 제출 출석 처리 | 라운드 진행 중, 제출 글 존재 | RSS 또는 서비스 호출 | 출석이 `submitted`로 기록된다 |
| B-ATT-02 | 지각 제출 출석 처리 | grace period 내 제출 | RSS 또는 서비스 호출 | 출석이 `late`로 기록된다 |
| B-ATT-03 | grace period 종료 체크 | pending 출석 존재 | `pnpm --filter @blog-study/bot test-attendance` 또는 스케줄 실행 | pending 이 `absent`로 바뀐다 |
| B-ATT-04 | 결석 벌금 생성 | 결석 처리 대상 존재 | 출석 체크 실행 | 5,000원 벌금이 생성된다 |
| B-ATT-05 | 지각 벌금 생성 | 지각 처리 대상 존재 | 지각 제출 반영 | 3,000원 벌금이 생성된다 |
| B-ATT-06 | 동일 회차 중복 벌금 방지 | 이미 벌금 존재 | 동일 상태 재처리 | 중복 벌금이 새로 생기지 않는다 |
| B-ATT-07 | 수동 출석 변경 연계 | 관리자에서 상태 수정 | admin attendance 후 DB 확인 | 벌금 생성/갱신/면제 상태가 논리적으로 일치한다 |

---

## 4. 벌금 알림 / 납부 확인

| ID | 동작 | 사전조건 | 실행 | 기대결과 |
|---|---|---|---|---|
| B-FINE-01 | 벌금 DM 발송 | 벌금 생성 대상, DM 수신 가능 계정 | 벌금 생성 플로우 실행 | 유저 DM으로 벌금 금액/사유/안내가 발송된다 |
| B-FINE-02 | 리마인드 발송 | unpaid 벌금 존재 | `pnpm --filter @blog-study/bot test-fine-reminder` 또는 스케줄 실행 | 미납 사용자에게 리마인드 DM이 발송된다 |
| B-FINE-03 | pending confirmation 설정 | 납부 확인 버튼 포함 DM 발송 | DM 발송 직후 DB 확인 | `pendingConfirmation` 이 true로 설정된다 |
| B-FINE-04 | DM 버튼으로 납부 처리 | 테스트 계정으로 DM 수신 | `납부 확인` 버튼 클릭 | 벌금 상태가 paid 로 바뀌고 pending confirmation 이 해제된다 |
| B-FINE-05 | 잘못된 확인 버튼 방어 | 만료/잘못된 fineId 사용 | 임의 interaction 시도 | 잘못된 요청은 거부되고 다른 벌금에 영향이 없다 |
| B-FINE-06 | 이미 처리된 벌금 재확인 방어 | paid 또는 waived 벌금 존재 | 동일 fine 재확인 시도 | 중복 처리되지 않고 안전하게 종료된다 |
| B-FINE-07 | DM 실패 처리 | DM 차단 사용자 존재 | 알림 또는 리마인드 실행 | 실패 로그는 남지만 전체 작업은 중단되지 않는다 |

---

## 5. 활동 점수

| ID | 동작 | 사전조건 | 실행 | 기대결과 |
|---|---|---|---|---|
| B-SCORE-01 | 일반 메시지 점수 | active 멤버가 일반 채널에서 메시지 작성 | 테스트 메시지 전송 | `DISCORD_MESSAGE` 점수가 적립된다 |
| B-SCORE-02 | 스레드 메시지 점수 | active 멤버가 스레드에 메시지 작성 | 테스트 메시지 전송 | `DISCORD_THREAD` 점수가 적립된다 |
| B-SCORE-03 | 리액션 점수 | active 멤버가 메시지에 리액션 | 테스트 리액션 추가 | `DISCORD_REACTION` 점수가 적립된다 |
| B-SCORE-04 | 비회원/매핑 실패 방어 | discordId 미매핑 사용자 | 메시지/리액션 발생 | 전체 프로세스가 죽지 않고 해당 사용자만 무시된다 |
| B-SCORE-05 | 점수 누적 일관성 | 동일 사용자가 여러 액션 수행 | 메시지/스레드/리액션 반복 | 랭킹/점수 요약과 논리적으로 일치하는 누적값이 기록된다 |

---

## 6. 랭킹 / 리포트 알림

| ID | 동작 | 사전조건 | 실행 | 기대결과 |
|---|---|---|---|---|
| B-RANK-01 | 주간 랭킹 생성 | 점수 데이터 존재 | `pnpm --filter @blog-study/bot test-weekly-ranking` 또는 스케줄 실행 | 주간 랭킹 메시지가 정상 생성된다 |
| B-RANK-02 | 라운드 리포트 생성 | 라운드/출석 데이터 존재 | `pnpm --filter @blog-study/bot test-round-report` 또는 스케줄 실행 | 제출/지각/결석/MVP 정보가 포함된 리포트가 생성된다 |
| B-RANK-03 | 랭킹 수치 정합성 | 충분한 테스트 데이터 | 결과 메시지와 DB 비교 | 순위, 점수, 활동 수치가 DB 기준과 일치한다 |
| B-RANK-04 | 데이터 없음 처리 | 대상 데이터 없음 | 리포트/랭킹 실행 | 비정상 종료 없이 빈 상태 또는 안내 메시지로 처리된다 |

---

## 7. 큐레이션 크롤링

| ID | 동작 | 사전조건 | 실행 | 기대결과 |
|---|---|---|---|---|
| B-CUR-01 | 소스 전체 크롤링 | 활성 큐레이션 소스 존재 | `pnpm --filter @blog-study/bot test-curation` 또는 스케줄 실행 | 각 소스를 순회하며 아이템을 수집한다 |
| B-CUR-02 | relevance score 계산 | 키워드 데이터 존재 | 크롤링 실행 | 아이템별 relevance score 가 계산된다 |
| B-CUR-03 | 중복 아이템 방지 | 기존 수집 항목 존재 | 크롤링 재실행 | 동일 아이템이 중복 저장되지 않는다 |
| B-CUR-04 | 일부 소스 실패 허용 | 오류 나는 소스 포함 | 크롤링 실행 | 실패 소스만 기록되고 나머지 소스는 계속 처리된다 |
| B-CUR-05 | Discord 요약 전송 | Discord client 연결 | 크롤링 실행 | 신규 수집 결과가 지정 채널/메시지 포맷으로 전달된다 |

---

## 8. 알림 / 메시지 전달

| ID | 동작 | 사전조건 | 실행 | 기대결과 |
|---|---|---|---|---|
| B-NOTI-01 | Discord 메시지 전송 테스트 | 테스트 채널 접근 가능 | `pnpm --filter @blog-study/bot test-discord-message` | 지정 채널에 메시지가 도착한다 |
| B-NOTI-02 | 사용자 식별 실패 방어 | 잘못된 discordId | DM 발송 함수 실행 | 예외는 로그로 남고 프로세스 전체는 유지된다 |
| B-NOTI-03 | 메시지 포맷 안정성 | 한글/링크/금액 포함 데이터 | 알림 발송 | 줄바꿈, 링크, 버튼, embed 필드가 깨지지 않는다 |

---

## 9. 운영 스크립트

| ID | 동작 | 사전조건 | 실행 | 기대결과 |
|---|---|---|---|---|
| B-OPS-01 | 테스트 데이터 시드 | 테스트 DB | `pnpm --filter @blog-study/bot seed-test-data` | QA에 필요한 데이터가 생성된다 |
| B-OPS-02 | 키워드 시드 | 키워드 테이블 준비 | `pnpm --filter @blog-study/bot seed-keywords` | 기본 키워드 데이터가 입력된다 |
| B-OPS-03 | relevance 재계산 | 큐레이션 아이템 존재 | `pnpm --filter @blog-study/bot recalculate-relevance` | relevance score 가 재계산된다 |
| B-OPS-04 | 수동 RSS 수집 | 유효 RSS 데이터 | `pnpm --filter @blog-study/bot rss-collect` | 수집 결과가 기록되고 글 반영이 정상 수행된다 |

---

## 10. 회귀 체크 묶음

배포 전 최소 확인 세트:

| 묶음 | 포함 항목 |
|---|---|
| 수집 핵심 | `B-RSS-01`, `B-RSS-03`, `B-RSS-04`, `B-RSS-05` |
| 출석/벌금 핵심 | `B-ATT-03`, `B-ATT-04`, `B-FINE-01`, `B-FINE-04` |
| 알림 핵심 | `B-NOTI-01`, `B-RANK-01`, `B-RANK-02`, `B-CUR-05` |
| 점수 핵심 | `B-SCORE-01`, `B-SCORE-02`, `B-SCORE-03`, `B-SCORE-05` |

---

## 11. 버그 기록 예시

| 항목 | 내용 |
|---|---|
| ID | B-FINE-04 |
| 환경 | 테스트 디스코드 서버, 테스트 계정 |
| 재현 절차 | 벌금 DM 수신 -> 납부 확인 버튼 클릭 |
| 실제 결과 | 버튼 응답 후 DB 상태 변화 없음 |
| 기대 결과 | 벌금 상태가 paid 로 갱신되고 pending confirmation 이 해제되어야 함 |
| 로그 | interaction 처리 로그 또는 stack trace 첨부 |

