# BOWM Menu Management System

온라인 메뉴 관리 및 방송 시스템입니다.

## 기능

- **메뉴 관리**: 메뉴 조회, 추가, 수정, 삭제
- **보움 방송**: TTS를 활용한 점내 방송 시스템
  - 진동벨 안내
  - 차량이동 안내
  - 금연 안내
  - 마감 안내
  - 직접 입력 방송

## 환경 설정

### 1. Gemini API 키 설정

Google AI Studio에서 API 키를 발급받으세요:
https://aistudio.google.com/app/apikeys

`.env.local` 파일에 다음을 추가:
```bash
NEXT_PUBLIC_GEMINI_API_KEY=your_key_here
```

## 음성 파일 설정 가이드

### 금연 방송 & 마감 방송 음성 파일 설정

반복되는 방송(금연, 마감)은 사전 녹음된 MP3 파일을 사용하면 더 효율적입니다.

#### 음성 파일 위치

```
/public/audio/
├── smoking.mp3           # 금연 안내 방송
├── closing-floor.mp3     # 3층과 지하 마감 안내
└── closing-store.mp3     # 보움 매장 마감 안내
```

#### 파일 업로드 방법

1. 음성 파일(MP3)을 준비합니다
2. `/public/audio/` 폴더에 다음 이름으로 저장합니다:
   - `smoking.mp3` - 금연 안내
   - `closing-floor.mp3` - 3층/지하 마감
   - `closing-store.mp3` - 매장 마감

#### 음성 파일 수정 방법

나중에 음성을 변경하려면:

1. 새로운 MP3 파일을 같은 이름으로 준비
2. `/public/audio/` 폴더의 기존 파일을 새 파일로 교체
3. 브라우저 캐시 삭제 (Ctrl+Shift+Delete or Cmd+Shift+Delete)

**주의**: 파일명이 정확히 일치해야 합니다!

### 동적 방송 (진동벨, 차량이동, 직접입력)

이 방송들은 입력값에 따라 실시간으로 Gemini 2.5 Flash TTS로 음성을 생성합니다.

## 배경음악 (BGM) 플레이리스트 추가

방송 시스템의 배경음악을 관리할 수 있습니다.

### 플레이리스트 추가 방법

1. **음악 파일 업로드**
   - Supabase 대시보드에 로그인
   - Storage → `bowm-bgm` 버켓으로 이동
   - 음악 파일(MP3, WAV 등)을 업로드

2. **데이터베이스에 등록**
   - Supabase 대시보드에서 Table Editor 열기
   - `playlists` 테이블로 이동
   - 새로운 행 추가:
     - `title`: 곡 제목
     - `file_path`: Storage에 업로드한 파일 경로
     - `duration`: 곡 길이 (초 단위, 선택사항)

**예시**:
```sql
INSERT INTO playlists (title, file_path, duration)
VALUES ('Cafe BGM 1', 'bgm/cafe-music-1.mp3', 180);
```

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser.

## 페이지 구조

- `/` - 메뉴 조회 페이지
- `/broadcast` - 보움 방송 페이지
- `/admin` - 메뉴 관리 페이지
- `/login` - 관리자 로그인 페이지

## 다음에 해야할 것

- [ ] 예약방송 제대로 안되는 이슈 발생 - 예약된 시간에 방송이 실행되지 않는 문제 해결 필요

## 기술 스택

- Next.js 16.1.1
- React 19.2.3
- TypeScript
- Tailwind CSS
- Supabase (데이터베이스)
- Google Gemini/Cloud TTS (음성 합성)

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
