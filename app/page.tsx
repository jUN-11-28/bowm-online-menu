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
    (menu) => menu.category === "Beverage" && !menu.is_signature && !menu.is_seasonal
  );
  const smoothieMenus = menus.filter(
    (menu) => menu.category === "Smoothie" && !menu.is_seasonal
  );
  const seasonMenus = menus.filter((menu) => menu.is_seasonal);

  if (loading) {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-white font-['Pretendard',sans-serif]">
        <div className="text-2xl text-gray-800">로딩 중...</div>
      </div>
    );
  }

  return (
    <div className="h-screen w-screen overflow-hidden bg-white font-['Pretendard',sans-serif] px-6 pt-6">
      {/* 상단 헤더 영역 */}
      <header className="relative flex h-[12%] flex-col items-center justify-center border-b border-gray-200 text-center">
        <h1 className="mb-1 text-6xl md:text-7xl lg:text-8xl text-gray-900">
          <span className="font-bold italic">BOWM</span>{" "}
          <span className="text-4xl md:text-5xl lg:text-6xl font-normal">보움</span>
        </h1>
        <p className="text-base md:text-lg font-light tracking-widest text-gray-600">
          Boundary of Water Mass | Bottle of Warm Moment
        </p>
      </header>

      {/* 메인 컨텐츠 영역 */}
      <main className="grid h-[83%] grid-cols-3 gap-8 md:gap-10 lg:gap-12 p-6">
        {/* 왼쪽 컬럼: Signature Zone */}
        <div className="flex flex-col gap-2 overflow-hidden">
          <h2 className="text-xl md:text-2xl font-bold italic text-gray-900">SIGNATURE / 대표</h2>
          <div className="flex flex-1 flex-col overflow-y-auto">
            {signatureMenus.length === 0 ? (
              <div className="text-base md:text-lg text-gray-400">시그니처 메뉴가 없습니다.</div>
            ) : (
              signatureMenus.map((menu, index) => (
                <div key={menu.id}>
                  <div
                    className={`relative flex items-start gap-3 md:gap-4 py-3 ${
                      menu.is_sold_out ? "opacity-50" : ""
                    }`}
                  >
                    {/* 이미지 영역 */}
                    {menu.image_url && (
                      <div className="relative h-28 w-28 md:h-36 md:w-36 lg:h-40 lg:w-40 flex-shrink-0 overflow-hidden rounded">
                        <Image
                          src={menu.image_url}
                          alt={menu.name}
                          fill
                          className="object-cover"
                        />
                      </div>
                    )}
                    {/* 텍스트 영역 */}
                    <div className="flex flex-1 flex-col gap-1.5">
                      <div className="flex items-center gap-2">
                        <h3 className="text-lg md:text-xl font-bold text-gray-900">
                          {menu.name}
                        </h3>
                        {menu.is_sold_out && (
                          <span className="rounded-full bg-red-500 px-2 py-1 text-xs font-bold text-white">
                            SOLD OUT
                          </span>
                        )}
                      </div>
                      {menu.description && (
                        <p className="text-base md:text-lg leading-relaxed text-gray-600">
                          {menu.description}
                        </p>
                      )}
                      <div className="mt-0.5">
                        <span className="text-base md:text-lg font-normal text-gray-900">
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

        {/* 중간 컬럼: Coffee & Tea Zone */}
        <div className="flex flex-col gap-4 overflow-hidden">
          {/* Coffee 섹션 */}
          <div className="flex flex-[1.2] flex-col">
            <div className="mb-2">
              <h2 className="text-xl md:text-2xl font-bold italic text-gray-900">COFFEE / 커피</h2>
              <p className="mt-0.5 text-base md:text-lg text-gray-500">샷 추가 / 디카페인 +1000</p>
            </div>
            <div className="flex flex-1 flex-col gap-1 overflow-hidden">
              {coffeeMenus.length === 0 ? (
                <div className="text-lg text-gray-400">커피 메뉴가 없습니다.</div>
              ) : (
                <div className="flex flex-1 flex-col gap-1 overflow-y-auto">
                  {coffeeMenus.map((menu) => (
                    <SimpleMenuItem key={menu.id} menu={menu} />
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Tea 섹션 */}
          <div className="flex flex-1 flex-col">
            <h2 className="mb-2 text-xl md:text-2xl font-bold italic text-gray-900">TEA / 차</h2>
            <div className="flex flex-1 flex-col gap-2 overflow-hidden">
              {teaMenus.length === 0 ? (
                <div className="text-lg text-gray-400">차 메뉴가 없습니다.</div>
              ) : (
                <div className="flex flex-1 flex-col gap-2 overflow-y-auto">
                  {teaMenus.map((menu) => (
                    <TeaMenuItem key={menu.id} menu={menu} />
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* 오른쪽 컬럼: Season Menu, Beverage, Smoothie */}
        <div className="flex flex-col gap-4 overflow-hidden">
          {/* Season Menu 섹션 */}
          {seasonMenus.length > 0 && (
            <div className="flex flex-col">
              <h2 className="mb-2 text-xl md:text-2xl font-bold italic text-gray-900">SEASON MENU</h2>
              <div className="flex flex-col gap-1">
                {seasonMenus.map((menu) => (
                  <SimpleMenuItem key={menu.id} menu={menu} />
                ))}
              </div>
            </div>
          )}

          {/* Beverage 섹션 */}
          <div className="flex flex-col">
            <div className="mb-2">
              <h2 className="text-xl md:text-2xl font-bold italic text-gray-900">BEVERAGE / 음료</h2>
              <div className="mt-0.5 text-base md:text-lg text-transparent">샷 추가 / 디카페인 +1000</div>
            </div>
            <div className="flex flex-1 flex-col gap-1 overflow-hidden">
              {beverageMenus.length === 0 ? (
                <div className="text-base md:text-lg text-gray-400">음료 메뉴가 없습니다.</div>
              ) : (
                <div className="flex flex-1 flex-col gap-1 overflow-y-auto">
                  {beverageMenus.map((menu) => (
                    <SimpleMenuItem key={menu.id} menu={menu} />
                  ))}
                </div>
              )}
            </div>

            {/* Smoothie 섹션 */}
            <div className="mt-4 flex flex-col">
              <div className="mb-2">
                <h2 className="text-xl md:text-2xl font-bold italic text-gray-900">SMOOTHIE / 스무디</h2>
                <p className="mt-0.5 text-base md:text-lg text-gray-500">only iced</p>
              </div>
              <div className="flex flex-col gap-1 overflow-hidden">
                {smoothieMenus.length === 0 ? (
                  <div className="text-base md:text-lg text-gray-400">스무디 메뉴가 없습니다.</div>
                ) : (
                  <div className="flex flex-col gap-1">
                    {smoothieMenus.map((menu) => (
                      <SimpleMenuItem key={menu.id} menu={menu} />
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* 하단 푸터 */}
      <footer className="flex h-[5%] items-center justify-center border-t border-gray-200">
        <p className="text-lg md:text-xl text-gray-600">Have a great day at BOWM!</p>
      </footer>
    </div>
  );
}

// 간단한 메뉴 아이템 컴포넌트 (텍스트 리스트 형식)
function SimpleMenuItem({ menu }: { menu: Menu }) {
  return (
    <div
      className={`flex items-center justify-between py-2 ${
        menu.is_sold_out ? "opacity-50" : ""
      }`}
    >
      <div className="flex min-w-0 flex-1 items-center gap-2">
        <span className="text-lg md:text-xl font-medium text-gray-900">{menu.name}</span>
        {menu.description && (
          <span className="text-base md:text-lg text-gray-500">({menu.description})</span>
        )}
        {menu.is_sold_out && (
          <span className="flex-shrink-0 rounded-full bg-red-500 px-2 py-1 text-xs md:text-sm font-bold text-white">
            SOLD OUT
          </span>
        )}
      </div>
      <span className="flex-shrink-0 text-lg md:text-xl font-normal text-gray-900">
        {(menu.price / 1000).toFixed(1)}
      </span>
    </div>
  );
}

// Tea 메뉴 아이템 컴포넌트 (세로 배치)
function TeaMenuItem({ menu }: { menu: Menu }) {
  return (
    <div
      className={`flex flex-col gap-1 py-2 ${
        menu.is_sold_out ? "opacity-50" : ""
      }`}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="text-lg md:text-xl font-medium text-gray-900">{menu.name}</span>
        {menu.is_sold_out && (
          <span className="flex-shrink-0 rounded-full bg-red-500 px-2 py-1 text-xs md:text-sm font-bold text-white">
            SOLD OUT
          </span>
        )}
        <span className="flex-shrink-0 text-lg md:text-xl font-normal text-gray-900">
          {(menu.price / 1000).toFixed(1)}
        </span>
      </div>
      {menu.description && (
        <p className="text-sm md:text-base text-gray-500">{menu.description}</p>
      )}
    </div>
  );
}
