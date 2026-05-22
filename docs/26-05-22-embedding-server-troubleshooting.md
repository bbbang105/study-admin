# 임베딩 서버 트러블슈팅

작성일: 2026-05-22

이번 구성은 다음 구조다.

```text
봇/로컬 개발 환경
  -> https://embedding.hozorica.com
  -> Cloudflare Access Service Token
  -> Cloudflare Tunnel
  -> GCE VM localhost:11434
  -> Ollama nomic-embed-text
```

## 1. Ollama 로컬 확인

GCE VM 안에서 먼저 확인한다.

```bash
curl http://localhost:11434/api/tags
```

정상 예시:

```json
{
  "models": [
    {
      "name": "nomic-embed-text:latest"
    }
  ]
}
```

임베딩 확인:

```bash
curl http://localhost:11434/api/embed \
  -H "Content-Type: application/json" \
  -d '{
    "model": "nomic-embed-text",
    "input": "React 성능 최적화"
  }'
```

정상 조건:

```text
embeddings[0].length = 768
```

첫 요청은 모델 로딩 때문에 10~30초 걸릴 수 있다. 두 번째 요청부터 빨라지는지 확인한다.

## 2. Cloudflare Tunnel 확인

VM에서 foreground로 테스트:

```bash
sudo cloudflared tunnel --config /etc/cloudflared/config.yml run
```

정상 로그:

```text
Registered tunnel connection
```

서비스 상태:

```bash
sudo systemctl status cloudflared --no-pager
sudo journalctl -u cloudflared -n 80 --no-pager
```

## 3. Cloudflare Access 403 확인

외부에서 service token 없이 호출하면 403이 정상이다.

```bash
curl -i https://embedding.hozorica.com/api/tags
```

service token을 붙였는데도 403이면 Cloudflare Access 정책을 확인한다.

정책 설정:

```text
Application: embedding.hozorica.com
Policy action: Service Auth
Include: Service Token
```

Cloudflare 로그 위치:

```text
Zero Trust -> Logs -> Access -> Access 인증 로그
```

주의:

- 로그 화면에서 `서비스 인증 같음 제외` 필터가 켜져 있으면 service token 요청이 숨겨진다.
- 필터를 지우고 확인한다.
- Access 로그에 `Allowed`가 뜨면 Access는 통과한 것이다.

## 4. Access는 Allowed인데 curl이 403인 경우

이 경우 Cloudflare Access가 아니라 origin인 Ollama가 막았을 가능성이 높다.

원인:

```text
Cloudflare Tunnel이 Host: embedding.hozorica.com 헤더를 origin에 전달
Ollama가 예상하지 않은 Host 헤더를 403 처리
```

해결:

```bash
sudo vim /etc/cloudflared/config.yml
```

`originRequest.httpHostHeader`를 추가한다.

```yaml
tunnel: <tunnel-id>
credentials-file: /etc/cloudflared/<tunnel-id>.json

ingress:
  - hostname: embedding.hozorica.com
    service: http://localhost:11434
    originRequest:
      httpHostHeader: localhost:11434
  - service: http_status:404
```

재시작:

```bash
sudo systemctl restart cloudflared
sudo systemctl status cloudflared --no-pager
```

확인:

```bash
curl -i https://embedding.hozorica.com/api/tags \
  -H "CF-Access-Client-Id: $EMBEDDING_ACCESS_CLIENT_ID" \
  -H "CF-Access-Client-Secret: $EMBEDDING_ACCESS_CLIENT_SECRET"
```

정상:

```text
HTTP/2 200
```

## 5. 최종 외부 임베딩 테스트

```bash
curl -i https://embedding.hozorica.com/api/embed \
  -H "CF-Access-Client-Id: $EMBEDDING_ACCESS_CLIENT_ID" \
  -H "CF-Access-Client-Secret: $EMBEDDING_ACCESS_CLIENT_SECRET" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "nomic-embed-text",
    "input": "React 성능 최적화"
  }'
```

정상 조건:

```text
HTTP 200
model = nomic-embed-text
embedding_count = 1
dimensions = 768
```

## 6. 운영 env

로컬 개발 `.env`와 운영 봇 EC2 `.env`에 같은 값이 필요하다.

```bash
EMBEDDING_PROVIDER=ollama
EMBEDDING_BASE_URL=https://embedding.hozorica.com
EMBEDDING_MODEL=nomic-embed-text
EMBEDDING_DIMENSIONS=768
EMBEDDING_ACCESS_CLIENT_ID=...
EMBEDDING_ACCESS_CLIENT_SECRET=...
```

`EMBEDDING_ACCESS_CLIENT_ID`와 `EMBEDDING_ACCESS_CLIENT_SECRET`은 Cloudflare Access service token이다. 채팅이나 로그에 노출되면 rotate한다.
