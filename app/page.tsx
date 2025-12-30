"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { supabase } from "@/utils/supabase/client";
import type { Menu } from "@/types/menu";

export default function Home() {
  const [menus, setMenus] = useState<Menu[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchMenus = async () => {
    const { data, error } = await supabase
      .from("menus")
      .select("*")
      .eq("is_visible", true)
      .neq("category", "Bakery") // Bakery 제외
      .order("sort_order", { ascending: true });

    if (error) {
      console.error("메뉴 조회 오류:", error);
    } else {
      setMenus((data as Menu[]) ?? []);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchMenus();

    // Realtime 구독 설정
    const channel = supabase
      .channel("menus-changes")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "menus",
        },
        () => {
          fetchMenus();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  // 카테고리별 필터링
  const signatureMenus = menus.filter((menu) => menu.is_signature);
  const coffeeMenus = menus.filter(
    (menu) => menu.category === "Coffee" && !menu.is_signature
  );
  const teaMenus = menus.filter(
    (menu) => menu.category === "Tea" && !menu.is_signature
  );
  const beverageMenus = menus.filter(
    (menu) =>
      menu.category === "Beverage" && !menu.is_signature && !menu.is_seasonal
  );
  const smoothieMenus = menus.filter(
    (menu) => menu.category === "Smoothie" && !menu.is_seasonal
  );

  if (loading) {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-white font-['Pretendard',sans-serif]">
        <div className="text-[2.2vh] text-gray-800">로딩 중...</div>
      </div>
    );
  }

  return (
    <div className="flex h-screen w-screen flex-col overflow-hidden bg-white font-['Pretendard',sans-serif] px-[3vw] pb-[3vw] pt-[1vw]">
      {/* 상단 헤더 영역 */}
      <header className="relative flex h-[10vh] flex-col items-center justify-start text-center">
        <h1 className="mb-0 text-[6vh] text-gray-900">
          <span className="font-bold italic">BOWM</span>{" "}
          <span className="text-[3.5vh] font-normal">보움</span>
        </h1>
        <p className="mt-[-1.5vh] text-[2vh] font-normal tracking-widest text-gray-600">
          Boundary of Water Mass | Bottle of Warm Moment
        </p>
      </header>

      {/* 메인 컨텐츠 영역 */}
      <main className="grid h-[85vh] grid-cols-3 gap-[2vw] mt-[3vh]">
        {/* 왼쪽 컬럼: Signature Zone */}
        <div className="flex h-full flex-col gap-[1vh] overflow-hidden">
          <h2 className="mb-[1.2vh] flex-shrink-0 text-[2.8vh] font-bold text-gray-900">
            <span className="italic">SIGNATURE</span> /{" "}
            <span className="not-italic">대표</span>
          </h2>
          <div className="flex min-h-0 flex-1 flex-col overflow-visible">
            {signatureMenus.length === 0 ? (
              <div className="text-[2vh] text-gray-400">
                시그니처 메뉴가 없습니다.
              </div>
            ) : (
              signatureMenus.map((menu, index) => (
                <div key={menu.id}>
                  <div
                    className={`relative flex items-start gap-[1.5vw] py-[0.6vh] ${
                      menu.is_sold_out ? "opacity-50" : ""
                    }`}
                  >
                    {/* 이미지 영역 */}
                    {menu.image_url && (
                      <div className="relative aspect-square w-[9vw] flex-shrink-0 overflow-hidden rounded">
                        <Image
                          src={menu.image_url}
                          alt={menu.name}
                          fill
                          className="object-cover"
                        />
                      </div>
                    )}
                    {/* 텍스트 영역 */}
                    <div className="flex flex-1 flex-col gap-[1vh]">
                      <div className="flex items-center gap-[1vw]">
                        <h3 className="text-[2.2vh] font-bold text-gray-900">
                          {menu.name}
                        </h3>
                        {menu.is_sold_out && (
                          <span className="rounded-full bg-red-500 px-[0.8vw] py-[0.3vh] text-[1.2vh] font-bold text-white">
                            SOLD OUT
                          </span>
                        )}
                      </div>
                      {menu.description && (
                        <p className="text-[1.8vh] leading-relaxed text-gray-600">
                          {menu.description}
                        </p>
                      )}
                      <div className="mt-[0.3vh]">
                        <span className="text-[2vh] font-normal text-gray-900">
                          {(menu.price / 1000).toFixed(1)}
                        </span>
                      </div>
                    </div>
                  </div>
                  {/* 구분선 (마지막 아이템 제외) */}
                  {index < signatureMenus.length - 1 && (
                    <div className="border-b border-gray-200" />
                  )}
                </div>
              ))
            )}
          </div>
        </div>

        {/* [중간 컬럼] Coffee & Tea Zone */}
        <div className="flex h-full flex-col gap-[3vh]">
          {" "}
          {/* 섹션 간 간격 넉넉하게 */}
          {/* Coffee 섹션 */}
          <div className="flex flex-col shrink-0">
            <div className="mb-[1.2vh]">
              <h2 className="text-[2.8vh] font-bold text-gray-900">
                <span className="italic">COFFEE</span> /{" "}
                <span className="not-italic">커피</span>
              </h2>
              <p className="mt-[0.3vh] text-[1.8vh] text-gray-500">
                샷 추가 / 디카페인 +1000
              </p>
            </div>
            <div className="flex flex-col gap-[0.2vh]">
              {coffeeMenus.length === 0 ? (
                <div className="text-[2vh] text-gray-400">
                  커피 메뉴가 없습니다.
                </div>
              ) : (
                coffeeMenus.map((menu) => (
                  <SimpleMenuItem key={menu.id} menu={menu} />
                ))
              )}
            </div>
          </div>
          {/* Tea 섹션 (Coffee 아래에 자연스럽게 위치) */}
          <div className="flex flex-col shrink-0">
            <h2 className="mb-[1.2vh] text-[2.8vh] font-bold text-gray-900">
              <span className="italic">TEA</span> /{" "}
              <span className="not-italic">차</span>
            </h2>
            <div className="flex flex-col gap-[0.2vh]">
              {teaMenus.length === 0 ? (
                <div className="text-[2vh] text-gray-400">
                  차 메뉴가 없습니다.
                </div>
              ) : (
                teaMenus.map((menu) => (
                  <TeaMenuItem key={menu.id} menu={menu} />
                ))
              )}
            </div>
          </div>
        </div>

        {/* 오른쪽 컬럼: Beverage, Smoothie */}
        <div className="flex h-full flex-col gap-[2vh] overflow-hidden">
          {/* Beverage 섹션 */}
          {/* 수정: flex-[1.2]와 min-h-0 제거 -> flex-shrink-0 추가 (줄어들지 않게) */}
          <div className="flex flex-col flex-shrink-0">
            <div className="mb-[1.2vh]">
              <h2 className="text-[2.8vh] font-bold text-gray-900">
                <span className="italic">BEVERAGE</span> /{" "}
                <span className="not-italic">음료</span>
              </h2>
              <div className="mt-[0.3vh] text-[1.8vh] text-transparent">
                샷 추가 / 디카페인 +1000
              </div>
            </div>
            <div className="flex flex-col gap-[0.2vh]">
              {beverageMenus.length === 0 ? (
                <div className="text-[2vh] text-gray-400">
                  음료 메뉴가 없습니다.
                </div>
              ) : (
                <div className="flex flex-col gap-[0.2vh]">
                  {beverageMenus.map((menu) => (
                    <SimpleMenuItem key={menu.id} menu={menu} />
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Smoothie 섹션 */}
          {/* 수정: flex-1과 min-h-0 제거 -> 그냥 자연스럽게 아래에 붙도록 */}
          <div className="flex flex-col flex-shrink-0">
            <div className="mb-[1.2vh]">
              <h2 className="text-[2.8vh] font-bold text-gray-900">
                <span className="italic">SMOOTHIE</span> /{" "}
                <span className="not-italic">스무디</span>
              </h2>
              <p className="mt-[0.3vh] text-[1.8vh] text-gray-500">only iced</p>
            </div>
            <div className="flex flex-col gap-[0.2vh]">
              {smoothieMenus.length === 0 ? (
                <div className="text-[2vh] text-gray-400">
                  스무디 메뉴가 없습니다.
                </div>
              ) : (
                <div className="flex flex-col gap-[0.2vh]">
                  {smoothieMenus.map((menu) => (
                    <SimpleMenuItem key={menu.id} menu={menu} />
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </main>

      {/* 하단 푸터 영역 */}
      <footer className="flex h-[5vh] items-center justify-center border-t border-gray-200">
        <p className="text-[2vh] leading-relaxed text-gray-500">
          다른 성질의 바닷물이 만나는 동해바다에 영감을 받아 새로운 만남과
          공간이 조화를 이루기를 바랍니다.
        </p>
      </footer>
    </div>
  );
}

// 간단한 메뉴 아이템 컴포넌트 (텍스트 리스트 형식)
function SimpleMenuItem({ menu }: { menu: Menu }) {
  return (
    <div
      className={`flex items-center justify-between py-[0.2vh] ${
        menu.is_sold_out ? "opacity-50" : ""
      }`}
    >
      <div className="flex min-w-0 flex-1 items-center gap-[1vw]">
        <span className="text-[2.2vh] font-medium text-gray-900">
          {menu.name}
        </span>
        {menu.description && (
          <span className="text-[1.8vh] text-gray-500">
            ({menu.description})
          </span>
        )}
        {menu.is_sold_out && (
          <span className="flex-shrink-0 rounded-full bg-red-500 px-[0.8vw] py-[0.3vh] text-[1.2vh] font-bold text-white">
            SOLD OUT
          </span>
        )}
      </div>
      <span className="flex-shrink-0 text-[2vh] font-normal text-gray-900">
        {(menu.price / 1000).toFixed(1)}
      </span>
    </div>
  );
}

// Tea 메뉴 아이템 컴포넌트 (세로 배치)
function TeaMenuItem({ menu }: { menu: Menu }) {
  return (
    <div
      className={`flex flex-col gap-[0.2vh] py-[0.2vh] ${
        menu.is_sold_out ? "opacity-50" : ""
      }`}
    >
      <div className="flex items-center justify-between gap-[1vw]">
        <span className="text-[2.2vh] font-medium text-gray-900">
          {menu.name}
        </span>
        {menu.is_sold_out && (
          <span className="flex-shrink-0 rounded-full bg-red-500 px-[0.8vw] py-[0.3vh] text-[1.2vh] font-bold text-white">
            SOLD OUT
          </span>
        )}
        <span className="flex-shrink-0 text-[2vh] font-normal text-gray-900">
          {(menu.price / 1000).toFixed(1)}
        </span>
      </div>
      {menu.description && (
        <p className="text-[1.5vh] text-gray-500">{menu.description}</p>
      )}
    </div>
  );
}
