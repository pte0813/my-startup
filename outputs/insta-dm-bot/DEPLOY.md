# Cloud Run 배포 가이드

비밀 값(토큰 등)은 이미지나 저장소에 넣지 않고 **Secret Manager**에 저장해서 주입합니다.
아래 `PROJECT_ID`, `REGION`은 본인 값으로 바꾸세요. (`asia-northeast3` = 서울)

## 0. 사전 준비

1. [Google Cloud](https://console.cloud.google.com) 프로젝트를 만들고 결제를 연결합니다. (소규모 사용은 무료 한도 안에서 거의 비용이 들지 않습니다.)
2. `gcloud` CLI를 설치하고 로그인합니다.

```bash
gcloud auth login
gcloud config set project PROJECT_ID
gcloud services enable run.googleapis.com cloudbuild.googleapis.com secretmanager.googleapis.com artifactregistry.googleapis.com
```

## 1. 비밀 값 등록

```bash
cd outputs/insta-dm-bot
for NAME in VERIFY_TOKEN APP_SECRET ACCESS_TOKEN; do
  read -rsp "$NAME: " VALUE; echo
  printf '%s' "$VALUE" | gcloud secrets create $NAME --data-file=-
done
```

Cloud Run 서비스 계정에 읽기 권한을 줍니다. (기본 Compute 서비스 계정 기준)

```bash
PROJECT_NUMBER=$(gcloud projects describe PROJECT_ID --format='value(projectNumber)')
for NAME in VERIFY_TOKEN APP_SECRET ACCESS_TOKEN; do
  gcloud secrets add-iam-policy-binding $NAME \
    --member="serviceAccount:${PROJECT_NUMBER}-compute@developer.gserviceaccount.com" \
    --role="roles/secretmanager.secretAccessor"
done
```

## 2. 배포

소스에서 바로 빌드해 배포합니다. (Dockerfile 사용)

```bash
gcloud run deploy insta-dm-bot \
  --source . \
  --region REGION \
  --allow-unauthenticated \
  --max-instances 1 \
  --set-secrets VERIFY_TOKEN=VERIFY_TOKEN:latest,APP_SECRET=APP_SECRET:latest,ACCESS_TOKEN=ACCESS_TOKEN:latest \
  --set-env-vars IG_USER_ID=내_인스타_계정_ID,KEYWORD=정보 \
  --set-env-vars "^@^INFO_TEXT=보낼 상세 내용@TARGET_MEDIA_ID="
```

옵션 설명:

- `--allow-unauthenticated`: Meta 서버가 로그인 없이 웹훅을 호출해야 하므로 필요합니다. 대신 서버가 `X-Hub-Signature-256` 서명을 검증해 위조 요청을 막습니다.
- `--max-instances 1`: 중복 발송 방지(`handledComments`)가 메모리에만 있어서, 인스턴스가 여러 개로 늘어나면 같은 댓글에 DM이 중복될 수 있습니다. DB를 붙이기 전까지는 1로 고정하세요.
- `INFO_TEXT`처럼 쉼표나 줄바꿈이 들어가는 값은 위처럼 구분자를 `@`로 바꿔서(`^@^`) 넣습니다.

배포가 끝나면 서비스 URL(`https://insta-dm-bot-xxxx.run.app`)이 출력됩니다.

## 3. 동작 확인

```bash
URL=https://insta-dm-bot-xxxx.run.app
# 올바른 토큰이면 abc가 그대로 돌아와야 함
curl "$URL/webhook?hub.mode=subscribe&hub.verify_token=내_VERIFY_TOKEN&hub.challenge=abc"
# 로그 확인
gcloud run services logs read insta-dm-bot --region REGION --limit 50
```

## 4. Meta에 연결

- 콜백 URL: `https://insta-dm-bot-xxxx.run.app/webhook`
- 확인 토큰: 1단계에 넣은 `VERIFY_TOKEN` 값
- 이후 `README.md`의 연동 순서 5번(필드 구독, 계정 구독)을 진행합니다.

## 운영 메모

- **토큰 갱신**: 액세스 토큰은 만료됩니다. 새 값을 `gcloud secrets versions add ACCESS_TOKEN --data-file=-`로 올린 뒤 서비스를 다시 배포하거나 재시작하세요.
- **문구 변경**: `gcloud run services update insta-dm-bot --region REGION --update-env-vars KEYWORD=새키워드`
- **중지/삭제**: `gcloud run services delete insta-dm-bot --region REGION`
- **cold start**: 트래픽이 없으면 인스턴스가 0으로 줄어 첫 요청이 느릴 수 있습니다. Meta는 웹훅 실패 시 재시도하지만, 신경 쓰이면 `--min-instances 1`을 추가하세요(소액 과금).
- **다른 플랫폼**: Railway나 Render는 이 `Dockerfile`을 그대로 인식합니다. 환경변수는 해당 서비스 화면에서 입력하면 됩니다.
- **이 문서의 한계**: 이 배포 설정은 이 환경에서 실제 배포나 Docker 빌드로 검증하지 못했습니다. `gcloud` 옵션은 첫 배포 때 에러 메시지에 따라 조정이 필요할 수 있습니다.
