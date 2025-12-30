import { createClient, type SupabaseClient } from "@supabase/supabase-js";

// 개발 환경에서 HMR이 발생해도 클라이언트를 재생성하지 않도록 글로벌 캐시 사용
const globalForSupabase = globalThis as unknown as {
  supabaseClient?: SupabaseClient;
};

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

if (!supabaseUrl) {
  throw new Error("NEXT_PUBLIC_SUPABASE_URL 환경변수가 설정되지 않았습니다.");
}

if (!supabaseKey) {
  throw new Error(
    "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY 환경변수가 설정되지 않았습니다."
  );
}

export const supabase: SupabaseClient =
  globalForSupabase.supabaseClient ??
  createClient(supabaseUrl, supabaseKey, {
    auth: {
      // publishable key 사용 시 보안 강화를 위해 권장 옵션 예시
      persistSession: true,
      autoRefreshToken: true,
    },
  });

if (process.env.NODE_ENV !== "production") {
  globalForSupabase.supabaseClient = supabase;
}

export type { SupabaseClient };
