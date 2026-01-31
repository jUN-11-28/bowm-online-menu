# 방송 예약 기능 설정

## Supabase 테이블 생성

방송 예약 기능을 사용하려면 Supabase에 `broadcast_schedules` 테이블을 생성해야 합니다.

### SQL 쿼리

Supabase 대시보드의 SQL Editor에서 다음을 실행하세요:

```sql
-- broadcast_schedules 테이블 생성
CREATE TABLE broadcast_schedules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  broadcast_type text NOT NULL CHECK (broadcast_type IN ('vibration', 'vehicle', 'smoking', 'closing', 'custom')),
  days_of_week text[] NOT NULL,
  hour integer NOT NULL CHECK (hour >= 0 AND hour < 24),
  minute integer NOT NULL CHECK (minute >= 0 AND minute < 60),
  vibration_number text,
  vehicle_number text,
  custom_text text,
  closing_type text CHECK (closing_type IN ('floor', 'store')),
  is_active boolean DEFAULT true,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- RLS (Row Level Security) 활성화
ALTER TABLE broadcast_schedules ENABLE ROW LEVEL SECURITY;

-- 모두가 읽을 수 있는 정책
CREATE POLICY "Allow all to read" ON broadcast_schedules
  FOR SELECT USING (true);

-- 인증된 사용자만 작성 가능 (필요시 수정)
CREATE POLICY "Allow authenticated to insert" ON broadcast_schedules
  FOR INSERT WITH CHECK (true);

-- 인증된 사용자만 업데이트 가능 (필요시 수정)
CREATE POLICY "Allow authenticated to update" ON broadcast_schedules
  FOR UPDATE WITH CHECK (true);

-- 인증된 사용자만 삭제 가능 (필요시 수정)
CREATE POLICY "Allow authenticated to delete" ON broadcast_schedules
  FOR DELETE USING (true);

-- Realtime 활성화
ALTER PUBLICATION supabase_realtime ADD TABLE broadcast_schedules;
```
```

## 예약 설정 방법

1. **방송 예약** 섹션의 "+ 예약 추가" 버튼 클릭
2. 다음 정보 입력:
   - **방송 타입**: 진동벨, 차량이동, 금연, 마감, 직접입력 중 선택
   - **요일**: 월~일 선택 (복수 선택 가능)
   - **시간/분**: 방송할 시간 설정
   - **추가 정보**: 방송 타입에 따라 필요한 정보 입력
     - 진동벨: 번호
     - 차량이동: 차량번호
     - 직접입력: 방송 내용
     - 마감: 마감 타입 (3층/지하 또는 매장)
3. "예약 추가" 버튼 클릭

## 작동 방식

- **클라이언트 체크**: 시스템은 30초마다 현재 시간과 등록된 예약을 비교합니다
- **실시간 동기화**: Supabase Realtime을 통해 예약 변경 사항을 실시간으로 감지합니다
- **자동 방송**: 예약 시간이 되면 설정된 방송이 자동으로 재생됩니다

## 예약 예시

- **진동벨 예약**: 평일 12:30에 진동벨 15번 방송
- **금연 안내**: 매일 16:00에 금연 방송 재생
- **마감 안내**: 매일 17:50에 3층/지하 마감 안내
- **매장 마감**: 매일 17:55에 매장 마감 안내

## 주의사항

- 예약 시간은 정각과 5분 단위로만 설정 가능합니다
- 배경음악 재생 중에는 덕킹(볼륨 감소)이 적용됩니다
- 예약 삭제 시 실제 삭제되지 않고 `is_active`가 false로 변경됩니다
