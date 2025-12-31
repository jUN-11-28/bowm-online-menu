"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { supabase } from "@/utils/supabase/client";
import type { Menu } from "@/types/menu";
import { CATEGORIES } from "@/types/menu";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

interface SortableRowProps {
  menu: Menu;
  onEdit: (menu: Menu) => void;
  onDelete: (id: number) => void;
  deletingId: number | null;
  sortOrderInputs: Record<number, number>;
  onSortOrderInputChange: (menuId: number, value: number) => void;
  onSortOrderBlur: (menuId: number, value: number) => void;
  updatingSortOrder: number | null;
}

interface MobileCardProps {
  menu: Menu;
  onEdit: (menu: Menu) => void;
  onDelete: (id: number) => void;
  deletingId: number | null;
  onMoveUp: (menuId: number) => void;
  onMoveDown: (menuId: number) => void;
  canMoveUp: boolean;
  canMoveDown: boolean;
  isMoving: boolean;
}

// 모바일용 카드 컴포넌트 (드래그앤드롭 없음, 위/아래 버튼 사용)
function MobileCard({
  menu,
  onEdit,
  onDelete,
  deletingId,
  onMoveUp,
  onMoveDown,
  canMoveUp,
  canMoveDown,
  isMoving,
}: MobileCardProps) {
  return (
    <div className="border-b border-gray-200 bg-white p-4 md:hidden">
      <div className="flex items-start gap-3">
        {/* 순서 변경 버튼 (위/아래) */}
        <div className="mt-1 flex shrink-0 flex-col gap-1">
          <button
            type="button"
            onClick={() => onMoveUp(menu.id)}
            disabled={!canMoveUp || isMoving}
            className="flex h-7 w-7 items-center justify-center rounded border border-gray-300 bg-white text-gray-600 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-40"
            aria-label="위로 이동"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={2}
              stroke="currentColor"
              className="h-4 w-4"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M4.5 15.75l7.5-7.5 7.5 7.5"
              />
            </svg>
          </button>
          <button
            type="button"
            onClick={() => onMoveDown(menu.id)}
            disabled={!canMoveDown || isMoving}
            className="flex h-7 w-7 items-center justify-center rounded border border-gray-300 bg-white text-gray-600 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-40"
            aria-label="아래로 이동"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={2}
              stroke="currentColor"
              className="h-4 w-4"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M19.5 8.25l-7.5 7.5-7.5-7.5"
              />
            </svg>
          </button>
        </div>

        {/* 이미지 */}
        <div className="shrink-0">
          {menu.image_url ? (
            <div className="relative h-16 w-16 overflow-hidden rounded-md border border-gray-200">
              <Image
                src={menu.image_url}
                alt={menu.name}
                fill
                className="object-cover"
              />
            </div>
          ) : (
            <div className="flex h-16 w-16 items-center justify-center rounded-md border border-dashed border-gray-300 text-[10px] text-gray-400">
              이미지 없음
            </div>
          )}
        </div>

        {/* 메뉴 정보 */}
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <div className="flex-1 min-w-0">
              <h3 className="text-sm font-semibold text-gray-900 truncate">
                {menu.name}
              </h3>
              <div className="mt-1 flex flex-wrap items-center gap-2">
                <span className="text-xs text-gray-600">{menu.category}</span>
                <span className="text-xs font-medium text-gray-900">
                  {menu.price.toLocaleString()}원
                </span>
              </div>
            </div>
          </div>

          {/* 뱃지들 */}
          <div className="mt-2 flex flex-wrap gap-1.5">
            {menu.is_sold_out && (
              <span className="inline-flex items-center rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-800">
                품절
              </span>
            )}
            {menu.is_seasonal && (
              <span className="inline-flex items-center rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-800">
                시즌
              </span>
            )}
            {menu.is_signature && (
              <span className="inline-flex items-center rounded-full bg-yellow-100 px-2 py-0.5 text-xs font-medium text-yellow-800">
                시그니처
              </span>
            )}
            {menu.is_visible ? (
              <span className="inline-flex items-center rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-800">
                표시
              </span>
            ) : (
              <span className="inline-flex items-center rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-600">
                숨김
              </span>
            )}
          </div>

          {/* 액션 버튼 */}
          <div className="mt-3 flex gap-2">
            <button
              type="button"
              onClick={() => onEdit(menu)}
              className="flex-1 rounded-md border border-blue-200 bg-blue-50 px-3 py-1.5 text-xs font-semibold text-blue-600 hover:bg-blue-100"
            >
              수정
            </button>
            <button
              type="button"
              onClick={() => onDelete(menu.id)}
              disabled={deletingId === menu.id}
              className="flex-1 rounded-md border border-red-200 bg-red-50 px-3 py-1.5 text-xs font-semibold text-red-600 hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {deletingId === menu.id ? "삭제 중..." : "삭제"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function SortableRow({
  menu,
  onEdit,
  onDelete,
  deletingId,
  sortOrderInputs,
  onSortOrderInputChange,
  onSortOrderBlur,
  updatingSortOrder,
}: SortableRowProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: menu.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <tr ref={setNodeRef} style={style} {...attributes}>
      <td className="px-4 py-3 text-center">
        <div className="flex items-center justify-center gap-2">
          <button
            type="button"
            {...listeners}
            className="cursor-grab active:cursor-grabbing text-gray-400 hover:text-gray-600"
            aria-label="드래그"
          >
            ⋮⋮
          </button>
          <input
            type="number"
            min={1}
            value={
              sortOrderInputs[menu.id] !== undefined
                ? sortOrderInputs[menu.id]
                : menu.sort_order ?? 0
            }
            onChange={(e) => {
              const newOrder = parseInt(e.target.value, 10);
              if (!isNaN(newOrder)) {
                onSortOrderInputChange(menu.id, newOrder);
              }
            }}
            onBlur={(e) => {
              const newOrder = parseInt(e.target.value, 10);
              if (!isNaN(newOrder) && newOrder >= 1) {
                onSortOrderBlur(menu.id, newOrder);
              }
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.currentTarget.blur();
              }
            }}
            disabled={updatingSortOrder === menu.id}
            className="w-16 rounded-md border border-gray-300 px-2 py-1 text-center text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:cursor-not-allowed disabled:opacity-60"
          />
        </div>
      </td>
      <td className="px-4 py-3">
        {menu.image_url ? (
          <div className="relative h-12 w-12 overflow-hidden rounded-md border border-gray-200">
            <Image
              src={menu.image_url}
              alt={menu.name}
              fill
              className="object-cover"
            />
          </div>
        ) : (
          <div className="flex h-12 w-12 items-center justify-center rounded-md border border-dashed border-gray-300 text-[10px] text-gray-400">
            이미지 없음
          </div>
        )}
      </td>
      <td className="px-4 py-3 text-sm text-gray-900">{menu.name}</td>
      <td className="px-4 py-3 text-sm text-gray-600">{menu.category}</td>
      <td className="px-4 py-3 text-right text-sm font-medium text-gray-900">
        {menu.price.toLocaleString()}원
      </td>
      <td className="px-4 py-3 text-center">
        {menu.is_sold_out ? (
          <span className="inline-flex items-center rounded-full bg-red-100 px-2 py-1 text-xs font-medium text-red-800">
            품절
          </span>
        ) : (
          <span className="text-xs text-gray-400">-</span>
        )}
      </td>
      <td className="px-4 py-3 text-center">
        {menu.is_seasonal ? (
          <span className="inline-flex items-center rounded-full bg-green-100 px-2 py-1 text-xs font-medium text-green-800">
            시즌
          </span>
        ) : (
          <span className="text-xs text-gray-400">-</span>
        )}
      </td>
      <td className="px-4 py-3 text-center">
        {menu.is_signature ? (
          <span className="inline-flex items-center rounded-full bg-yellow-100 px-2 py-1 text-xs font-medium text-yellow-800">
            시그니처
          </span>
        ) : (
          <span className="text-xs text-gray-400">-</span>
        )}
      </td>
      <td className="px-4 py-3 text-center">
        {menu.is_visible ? (
          <span className="inline-flex items-center rounded-full bg-green-100 px-2 py-1 text-xs font-medium text-green-800">
            표시
          </span>
        ) : (
          <span className="inline-flex items-center rounded-full bg-gray-100 px-2 py-1 text-xs font-medium text-gray-600">
            숨김
          </span>
        )}
      </td>
      <td className="px-4 py-3 text-center">
        <div className="flex items-center justify-center gap-2">
          <button
            type="button"
            onClick={() => onEdit(menu)}
            className="rounded-md border border-blue-200 px-2 py-1 text-xs font-semibold text-blue-600 hover:bg-blue-50"
          >
            수정
          </button>
          <button
            type="button"
            onClick={() => onDelete(menu.id)}
            disabled={deletingId === menu.id}
            className="rounded-md border border-red-200 px-2 py-1 text-xs font-semibold text-red-600 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {deletingId === menu.id ? "삭제 중..." : "삭제"}
          </button>
        </div>
      </td>
    </tr>
  );
}

export default function AdminPage() {
  const router = useRouter();
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);
  const [menus, setMenus] = useState<Menu[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [name, setName] = useState("");
  const [price, setPrice] = useState("");
  const [category, setCategory] = useState("");
  const [description, setDescription] = useState("");
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [isSoldOut, setIsSoldOut] = useState(false);
  const [isSeasonal, setIsSeasonal] = useState(false);
  const [isSignature, setIsSignature] = useState(false);
  const [isVisible, setIsVisible] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [updatingSortOrder, setUpdatingSortOrder] = useState<number | null>(
    null
  );
  const [sortOrderInputs, setSortOrderInputs] = useState<
    Record<number, number>
  >({});
  const [selectedCategory, setSelectedCategory] = useState<string>("전체");
  const [editingMenu, setEditingMenu] = useState<Menu | null>(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [movingMenuId, setMovingMenuId] = useState<number | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8, // 8px 이동해야 드래그 시작 (모바일 터치 개선)
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  // 카테고리별 base sort_order 계산
  const getCategoryBaseSortOrder = (category: string): number => {
    const categoryIndex = CATEGORIES.findIndex((cat) => cat === category);
    if (categoryIndex === -1) return 0;
    return categoryIndex * 100 + 1; // Coffee: 1, Beverage: 101, Tea: 201, Bakery: 301, Smoothie: 401
  };

  // 카테고리별 최대 sort_order 계산
  const getCategoryMaxSortOrder = (category: string): number => {
    const base = getCategoryBaseSortOrder(category);
    return base + 99; // 각 카테고리는 100개까지
  };

  // 인증 상태 확인
  useEffect(() => {
    const checkAuth = async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session) {
        router.push("/login");
      } else {
        setIsAuthenticated(true);
      }
    };

    checkAuth();

    // 인증 상태 변경 감지
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!session) {
        router.push("/login");
      } else {
        setIsAuthenticated(true);
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [router]);

  const fetchMenus = async () => {
    setLoading(true);
    setError(null);
    const { data, error } = await supabase
      .from("menus")
      .select("*")
      .order("sort_order", { ascending: true });

    if (error) {
      console.error(error);
      setError("메뉴 목록을 불러오는 중 오류가 발생했습니다.");
    } else {
      const menuData = (data as Menu[]) ?? [];
      setMenus(menuData);
      // sortOrderInputs 초기화
      const initialInputs: Record<number, number> = {};
      menuData.forEach((menu) => {
        initialInputs[menu.id] = menu.sort_order ?? 0;
      });
      setSortOrderInputs(initialInputs);
    }
    setLoading(false);
  };

  useEffect(() => {
    if (isAuthenticated) {
      fetchMenus();
    }
  }, [isAuthenticated]);

  const resetForm = () => {
    setName("");
    setPrice("");
    setCategory("");
    setDescription("");
    setImageFile(null);
    setIsSoldOut(false);
    setIsSeasonal(false);
    setIsSignature(false);
    setIsVisible(true);
    setEditingMenu(null);
  };

  const fillEditForm = (menu: Menu) => {
    setName(menu.name);
    setPrice(menu.price.toString());
    setCategory(menu.category);
    setDescription(menu.description ?? "");
    setIsSoldOut(menu.is_sold_out);
    setIsSeasonal(menu.is_seasonal);
    setIsSignature(menu.is_signature);
    setIsVisible(menu.is_visible);
    setImageFile(null); // 이미지는 새로 업로드해야 함
    setEditingMenu(menu);
  };

  const handleAddMenu = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !price.trim() || !category.trim()) {
      alert("이름, 가격, 카테고리를 모두 입력해주세요.");
      return;
    }

    const numericPrice = Number(price);
    if (Number.isNaN(numericPrice) || numericPrice < 0) {
      alert("가격은 0 이상 숫자로 입력해주세요.");
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      let imageUrl: string | null = null;

      if (imageFile) {
        const ext = imageFile.name.split(".").pop() ?? "jpg";
        const filePath = `menu-${Date.now()}-${Math.random()
          .toString(36)
          .slice(2)}.${ext}`;

        const { error: uploadError } = await supabase.storage
          .from("menu-images")
          .upload(filePath, imageFile, {
            cacheControl: "3600",
            upsert: false,
          });

        if (uploadError) {
          console.error(uploadError);
          if (
            uploadError.message?.includes("Bucket not found") ||
            uploadError.message?.includes("bucket")
          ) {
            throw new Error(
              "이미지 업로드에 실패했습니다. Supabase Storage에 'menu-images' 버킷을 생성해주세요."
            );
          }
          if (uploadError.message?.includes("row-level security")) {
            throw new Error(
              "이미지 업로드에 실패했습니다. Supabase Storage의 'menu-images' 버킷에 RLS 정책을 설정해주세요."
            );
          }
          throw new Error("이미지 업로드에 실패했습니다.");
        }

        const {
          data: { publicUrl },
        } = supabase.storage.from("menu-images").getPublicUrl(filePath);

        imageUrl = publicUrl;
      }

      // 해당 카테고리의 최대 sort_order 찾기
      const categoryMenus = menus.filter((m) => m.category === category);
      const baseSortOrder = getCategoryBaseSortOrder(category);
      const maxSortOrder =
        categoryMenus.length > 0
          ? Math.max(...categoryMenus.map((m) => m.sort_order ?? baseSortOrder))
          : baseSortOrder - 1;
      const newSortOrder = maxSortOrder + 1;

      // 카테고리 범위를 초과하지 않도록 체크
      if (newSortOrder > getCategoryMaxSortOrder(category)) {
        throw new Error(
          `${category} 카테고리는 최대 100개까지 등록할 수 있습니다.`
        );
      }

      const { error: insertError } = await supabase.from("menus").insert({
        name,
        price: numericPrice,
        category,
        description: description.trim() || null,
        image_url: imageUrl,
        is_sold_out: isSoldOut,
        is_seasonal: isSeasonal,
        is_signature: isSignature,
        is_visible: isVisible,
        sort_order: newSortOrder,
      });

      if (insertError) {
        console.error(insertError);
        if (insertError.message?.includes("row-level security")) {
          throw new Error(
            "메뉴 추가에 실패했습니다. Supabase에서 menus 테이블의 RLS 정책을 설정해주세요."
          );
        }
        throw new Error("메뉴 추가에 실패했습니다.");
      }

      await fetchMenus();
      resetForm();
      setIsModalOpen(false);
    } catch (err) {
      console.error(err);
      setError(
        err instanceof Error ? err.message : "메뉴 추가 중 오류가 발생했습니다."
      );
    } finally {
      setSubmitting(false);
    }
  };

  const handleUpdateMenu = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingMenu || !name.trim() || !price.trim() || !category.trim()) {
      alert("이름, 가격, 카테고리를 모두 입력해주세요.");
      return;
    }

    const numericPrice = Number(price);
    if (Number.isNaN(numericPrice) || numericPrice < 0) {
      alert("가격은 0 이상 숫자로 입력해주세요.");
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      let imageUrl: string | null = editingMenu.image_url;

      if (imageFile) {
        const ext = imageFile.name.split(".").pop() ?? "jpg";
        const filePath = `menu-${Date.now()}-${Math.random()
          .toString(36)
          .slice(2)}.${ext}`;

        const { error: uploadError } = await supabase.storage
          .from("menu-images")
          .upload(filePath, imageFile, {
            cacheControl: "3600",
            upsert: false,
          });

        if (uploadError) {
          console.error(uploadError);
          if (
            uploadError.message?.includes("Bucket not found") ||
            uploadError.message?.includes("bucket")
          ) {
            throw new Error(
              "이미지 업로드에 실패했습니다. Supabase Storage에 'menu-images' 버킷을 생성해주세요."
            );
          }
          if (uploadError.message?.includes("row-level security")) {
            throw new Error(
              "이미지 업로드에 실패했습니다. Supabase Storage의 'menu-images' 버킷에 RLS 정책을 설정해주세요."
            );
          }
          throw new Error("이미지 업로드에 실패했습니다.");
        }

        const {
          data: { publicUrl },
        } = supabase.storage.from("menu-images").getPublicUrl(filePath);

        imageUrl = publicUrl;
      }

      // 카테고리가 변경된 경우 sort_order 재계산
      let newSortOrder = editingMenu.sort_order;
      if (category !== editingMenu.category) {
        const categoryMenus = menus.filter((m) => m.category === category);
        const baseSortOrder = getCategoryBaseSortOrder(category);
        const maxSortOrder =
          categoryMenus.length > 0
            ? Math.max(
                ...categoryMenus.map((m) => m.sort_order ?? baseSortOrder)
              )
            : baseSortOrder - 1;
        newSortOrder = maxSortOrder + 1;

        if (newSortOrder > getCategoryMaxSortOrder(category)) {
          throw new Error(
            `${category} 카테고리는 최대 100개까지 등록할 수 있습니다.`
          );
        }
      }

      const { error: updateError } = await supabase
        .from("menus")
        .update({
          name,
          price: numericPrice,
          category,
          description: description.trim() || null,
          image_url: imageUrl,
          is_sold_out: isSoldOut,
          is_seasonal: isSeasonal,
          is_signature: isSignature,
          is_visible: isVisible,
          sort_order: newSortOrder,
        })
        .eq("id", editingMenu.id);

      if (updateError) {
        console.error(updateError);
        throw new Error("메뉴 수정에 실패했습니다.");
      }

      await fetchMenus();
      resetForm();
      setIsEditModalOpen(false);
    } catch (err) {
      console.error(err);
      setError(
        err instanceof Error ? err.message : "메뉴 수정 중 오류가 발생했습니다."
      );
    } finally {
      setSubmitting(false);
    }
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;

    if (!over || active.id === over.id) {
      return;
    }

    // 드래그한 메뉴와 드롭한 메뉴 찾기
    const activeMenu = menus.find((m) => m.id === active.id);
    const overMenu = menus.find((m) => m.id === over.id);

    if (!activeMenu || !overMenu) {
      return;
    }

    // 같은 카테고리 내에서만 드래그 앤 드롭 가능
    if (activeMenu.category !== overMenu.category) {
      return;
    }

    // 필터된 목록(같은 카테고리)에서 순서 변경
    const categoryMenus = filteredMenus.filter(
      (m) => m.category === activeMenu.category
    );
    const oldIndex = categoryMenus.findIndex((m) => m.id === active.id);
    const newIndex = categoryMenus.findIndex((m) => m.id === over.id);

    if (oldIndex === -1 || newIndex === -1) {
      return;
    }

    // 카테고리 내에서 순서 변경
    const reorderedCategoryMenus = arrayMove(categoryMenus, oldIndex, newIndex);

    // DB 업데이트 - 해당 카테고리 내에서만 sort_order 재정렬
    try {
      const baseSortOrder = getCategoryBaseSortOrder(activeMenu.category);
      for (let i = 0; i < reorderedCategoryMenus.length; i++) {
        const newSortOrder = baseSortOrder + i;
        await supabase
          .from("menus")
          .update({ sort_order: newSortOrder })
          .eq("id", reorderedCategoryMenus[i].id);
      }

      // 전체 목록도 업데이트
      await fetchMenus();
    } catch (err) {
      console.error(err);
      setError("순서 변경 중 오류가 발생했습니다.");
      await fetchMenus();
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm("정말 이 메뉴를 삭제하시겠습니까?")) return;

    setDeletingId(id);
    setError(null);

    const { error } = await supabase.from("menus").delete().eq("id", id);

    if (error) {
      console.error(error);
      setError("메뉴 삭제 중 오류가 발생했습니다.");
    } else {
      // 삭제 후 재정렬
      await fetchMenus();
      await reorderMenus();
    }

    setDeletingId(null);
  };

  // 모바일용 위/아래 이동 핸들러
  const handleMoveUp = async (menuId: number) => {
    const menu = menus.find((m) => m.id === menuId);
    if (!menu) return;

    const categoryMenus = filteredMenus.filter(
      (m) => m.category === menu.category
    );
    const currentIndex = categoryMenus.findIndex((m) => m.id === menuId);

    if (currentIndex <= 0) return; // 첫 번째 항목이면 이동 불가

    const prevMenu = categoryMenus[currentIndex - 1];
    if (!prevMenu) return;

    setMovingMenuId(menuId);
    setError(null);

    try {
      // 두 메뉴의 sort_order 교환
      const tempSortOrder = menu.sort_order;
      await supabase
        .from("menus")
        .update({ sort_order: prevMenu.sort_order })
        .eq("id", menuId);
      await supabase
        .from("menus")
        .update({ sort_order: tempSortOrder })
        .eq("id", prevMenu.id);

      await fetchMenus();
    } catch (err) {
      console.error(err);
      setError("순서 변경 중 오류가 발생했습니다.");
    } finally {
      setMovingMenuId(null);
    }
  };

  const handleMoveDown = async (menuId: number) => {
    const menu = menus.find((m) => m.id === menuId);
    if (!menu) return;

    const categoryMenus = filteredMenus.filter(
      (m) => m.category === menu.category
    );
    const currentIndex = categoryMenus.findIndex((m) => m.id === menuId);

    if (currentIndex < 0 || currentIndex >= categoryMenus.length - 1) return; // 마지막 항목이면 이동 불가

    const nextMenu = categoryMenus[currentIndex + 1];
    if (!nextMenu) return;

    setMovingMenuId(menuId);
    setError(null);

    try {
      // 두 메뉴의 sort_order 교환
      const tempSortOrder = menu.sort_order;
      await supabase
        .from("menus")
        .update({ sort_order: nextMenu.sort_order })
        .eq("id", menuId);
      await supabase
        .from("menus")
        .update({ sort_order: tempSortOrder })
        .eq("id", nextMenu.id);

      await fetchMenus();
    } catch (err) {
      console.error(err);
      setError("순서 변경 중 오류가 발생했습니다.");
    } finally {
      setMovingMenuId(null);
    }
  };

  const handleSortOrderChange = async (
    menuId: number,
    newSortOrder: number
  ) => {
    const menu = menus.find((m) => m.id === menuId);
    if (!menu) return;

    const baseSortOrder = getCategoryBaseSortOrder(menu.category);
    const maxSortOrder = getCategoryMaxSortOrder(menu.category);

    // 카테고리 범위 내에서만 변경 가능
    if (newSortOrder < baseSortOrder || newSortOrder > maxSortOrder) {
      alert(
        `${menu.category} 카테고리는 ${baseSortOrder}부터 ${maxSortOrder}까지의 순서만 사용할 수 있습니다.`
      );
      // 원래 값으로 복구
      setSortOrderInputs((prev) => ({
        ...prev,
        [menuId]: menu.sort_order ?? baseSortOrder,
      }));
      return;
    }

    setUpdatingSortOrder(menuId);
    setError(null);

    try {
      const { error: updateError } = await supabase
        .from("menus")
        .update({ sort_order: newSortOrder })
        .eq("id", menuId);

      if (updateError) {
        console.error(updateError);
        setError("순서 변경 중 오류가 발생했습니다.");
        await fetchMenus(); // 실패 시 원래 상태로 복구
      } else {
        // 성공 시 해당 카테고리 내에서만 재정렬
        await reorderMenus();
      }
    } catch (err) {
      console.error(err);
      setError("순서 변경 중 오류가 발생했습니다.");
      await fetchMenus();
    } finally {
      setUpdatingSortOrder(null);
    }
  };

  const reorderMenus = async () => {
    // 최신 메뉴 목록을 다시 가져옴
    const { data: latestMenus, error: fetchError } = await supabase
      .from("menus")
      .select("*")
      .order("sort_order", { ascending: true });

    if (fetchError || !latestMenus) {
      console.error("메뉴 목록 조회 실패:", fetchError);
      return;
    }

    // 카테고리별로 그룹화하여 재정렬
    for (const category of CATEGORIES) {
      const categoryMenus = latestMenus
        .filter((m) => m.category === category)
        .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0));

      const baseSortOrder = getCategoryBaseSortOrder(category);

      // 해당 카테고리 내에서만 재정렬
      for (let i = 0; i < categoryMenus.length; i++) {
        const newSortOrder = baseSortOrder + i;
        await supabase
          .from("menus")
          .update({ sort_order: newSortOrder })
          .eq("id", categoryMenus[i].id);
      }
    }

    await fetchMenus();
  };

  const filteredMenus =
    selectedCategory === "전체"
      ? menus
      : menus.filter((menu) => menu.category === selectedCategory);

  // 인증 확인 중이면 로딩 표시
  if (isAuthenticated === null) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-lg text-gray-600">인증 확인 중...</div>
      </div>
    );
  }

  // 인증되지 않았으면 아무것도 렌더링하지 않음 (리다이렉트 중)
  if (!isAuthenticated) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="mx-auto max-w-5xl px-4 py-4 md:px-4 md:py-8">
        <header className="mb-4 flex flex-col gap-4 md:mb-8 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-xl font-bold text-gray-900 md:text-2xl">
              메뉴 관리
            </h1>
            <p className="mt-1 text-xs text-gray-500 md:text-sm">
              메뉴를 추가·수정·삭제할 수 있는 관리자 페이지입니다.
            </p>
          </div>
          <button
            type="button"
            onClick={() => {
              resetForm();
              // 선택된 카테고리가 "전체"가 아니면 해당 카테고리로 미리 선택
              if (selectedCategory !== "전체") {
                setCategory(selectedCategory);
              }
              setIsModalOpen(true);
            }}
            className="w-full rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 md:w-auto"
          >
            메뉴 추가
          </button>
        </header>

        {error && (
          <div className="mb-4 rounded-md bg-red-50 p-3 text-sm text-red-700">
            {error}
          </div>
        )}

        {/* 카테고리 필터 */}
        <div className="mb-4 flex flex-wrap gap-2">
          {["전체", ...CATEGORIES].map((cat) => (
            <button
              key={cat}
              type="button"
              onClick={() => setSelectedCategory(cat)}
              className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors md:px-4 md:py-2 md:text-sm ${
                selectedCategory === cat
                  ? "bg-blue-600 text-white"
                  : "bg-white text-gray-700 hover:bg-gray-100"
              }`}
            >
              {cat}
            </button>
          ))}
        </div>

        <div className="overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm">
          <div className="flex items-center justify-between border-b border-gray-200 px-3 py-2 md:px-4 md:py-3">
            <h2 className="text-xs font-semibold text-gray-700 md:text-sm">
              메뉴 목록
            </h2>
            <button
              type="button"
              onClick={fetchMenus}
              className="text-xs text-gray-500 hover:text-gray-700"
            >
              새로고침
            </button>
          </div>

          {loading ? (
            <div className="flex items-center justify-center px-4 py-10 text-sm text-gray-500">
              로딩 중입니다...
            </div>
          ) : filteredMenus.length === 0 ? (
            <div className="flex items-center justify-center px-4 py-10 text-sm text-gray-500">
              {selectedCategory === "전체"
                ? "등록된 메뉴가 없습니다."
                : `${selectedCategory} 카테고리에 등록된 메뉴가 없습니다.`}
            </div>
          ) : (
            <>
              {/* 모바일 카드 뷰 (드래그앤드롭 없음) */}
              <div className="md:hidden max-h-[calc(100vh-280px)] overflow-y-auto">
                {filteredMenus.map((menu) => {
                  const categoryMenus = filteredMenus.filter(
                    (m) => m.category === menu.category
                  );
                  const currentIndex = categoryMenus.findIndex(
                    (m) => m.id === menu.id
                  );
                  const canMoveUp = currentIndex > 0;
                  const canMoveDown =
                    currentIndex >= 0 &&
                    currentIndex < categoryMenus.length - 1;

                  return (
                    <MobileCard
                      key={menu.id}
                      menu={menu}
                      onEdit={(menu) => {
                        fillEditForm(menu);
                        setIsEditModalOpen(true);
                      }}
                      onDelete={handleDelete}
                      deletingId={deletingId}
                      onMoveUp={handleMoveUp}
                      onMoveDown={handleMoveDown}
                      canMoveUp={canMoveUp}
                      canMoveDown={canMoveDown}
                      isMoving={movingMenuId === menu.id}
                    />
                  );
                })}
              </div>

              {/* 데스크톱 테이블 뷰 (드래그앤드롭 있음) */}
              <DndContext
                sensors={sensors}
                collisionDetection={closestCenter}
                onDragEnd={handleDragEnd}
              >
                <SortableContext
                  items={filteredMenus.map((m) => m.id)}
                  strategy={verticalListSortingStrategy}
                >
                  <div className="hidden overflow-x-auto md:block">
                    <table className="min-w-full divide-y divide-gray-200 text-sm">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-4 py-2 text-center text-xs font-medium uppercase tracking-wider text-gray-500">
                            순서
                          </th>
                          <th className="px-4 py-2 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                            이미지
                          </th>
                          <th className="px-4 py-2 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                            이름
                          </th>
                          <th className="px-4 py-2 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                            카테고리
                          </th>
                          <th className="px-4 py-2 text-right text-xs font-medium uppercase tracking-wider text-gray-500">
                            가격
                          </th>
                          <th className="px-4 py-2 text-center text-xs font-medium uppercase tracking-wider text-gray-500">
                            품절
                          </th>
                          <th className="px-4 py-2 text-center text-xs font-medium uppercase tracking-wider text-gray-500">
                            시즌
                          </th>
                          <th className="px-4 py-2 text-center text-xs font-medium uppercase tracking-wider text-gray-500">
                            시그니처
                          </th>
                          <th className="px-4 py-2 text-center text-xs font-medium uppercase tracking-wider text-gray-500">
                            화면 표시
                          </th>
                          <th className="px-4 py-2 text-center text-xs font-medium uppercase tracking-wider text-gray-500">
                            액션
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-200 bg-white">
                        {filteredMenus.map((menu) => (
                          <SortableRow
                            key={menu.id}
                            menu={menu}
                            onEdit={(menu) => {
                              fillEditForm(menu);
                              setIsEditModalOpen(true);
                            }}
                            onDelete={handleDelete}
                            deletingId={deletingId}
                            sortOrderInputs={sortOrderInputs}
                            onSortOrderInputChange={(menuId, value) => {
                              setSortOrderInputs((prev) => ({
                                ...prev,
                                [menuId]: value,
                              }));
                            }}
                            onSortOrderBlur={handleSortOrderChange}
                            updatingSortOrder={updatingSortOrder}
                          />
                        ))}
                      </tbody>
                    </table>
                  </div>
                </SortableContext>
              </DndContext>
            </>
          )}
        </div>
      </div>

      {/* 수정 모달 */}
      {isEditModalOpen && editingMenu && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4 md:items-center md:p-0">
          <div className="w-full max-w-md rounded-t-lg bg-white p-4 shadow-xl md:rounded-lg md:p-6">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-gray-900">메뉴 수정</h2>
              <button
                type="button"
                onClick={() => {
                  setIsEditModalOpen(false);
                  resetForm();
                }}
                className="text-sm text-gray-400 hover:text-gray-600"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleUpdateMenu} className="space-y-4">
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">
                  이름
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="block w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  placeholder="예) 김치찌개"
                  required
                />
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">
                  가격
                </label>
                <input
                  type="number"
                  min={0}
                  value={price}
                  onChange={(e) => setPrice(e.target.value)}
                  className="block w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  placeholder="예) 9000"
                  required
                />
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">
                  카테고리
                </label>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className="block w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  required
                >
                  <option value="">카테고리를 선택하세요</option>
                  {CATEGORIES.map((cat) => (
                    <option key={cat} value={cat}>
                      {cat}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">
                  설명 <span className="text-gray-400 text-xs">(선택사항)</span>
                </label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={3}
                  className="block w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  placeholder="메뉴에 대한 설명을 입력하세요"
                />
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">
                  이미지
                </label>
                {editingMenu.image_url && (
                  <div className="mb-2 relative h-24 w-24 overflow-hidden rounded-md border border-gray-200">
                    <Image
                      src={editingMenu.image_url}
                      alt={editingMenu.name}
                      fill
                      className="object-cover"
                    />
                  </div>
                )}
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) =>
                    setImageFile(e.target.files ? e.target.files[0] : null)
                  }
                  className="block w-full text-sm text-gray-700 file:mr-3 file:cursor-pointer file:rounded-md file:border-0 file:bg-gray-100 file:px-3 file:py-2 file:text-sm file:font-medium file:text-gray-700 hover:file:bg-gray-200"
                />
                <p className="mt-1 text-xs text-gray-400">
                  새 이미지를 선택하면 기존 이미지가 교체됩니다.
                </p>
              </div>

              <div className="space-y-3">
                <div className="flex items-center space-x-4">
                  <label className="flex items-center space-x-2">
                    <input
                      type="checkbox"
                      checked={isSoldOut}
                      onChange={(e) => setIsSoldOut(e.target.checked)}
                      className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    />
                    <span className="text-sm font-medium text-gray-700">
                      품절
                    </span>
                  </label>
                  <label className="flex items-center space-x-2">
                    <input
                      type="checkbox"
                      checked={isSeasonal}
                      onChange={(e) => setIsSeasonal(e.target.checked)}
                      className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    />
                    <span className="text-sm font-medium text-gray-700">
                      시즌 메뉴
                    </span>
                  </label>
                  <label className="flex items-center space-x-2">
                    <input
                      type="checkbox"
                      checked={isSignature}
                      onChange={(e) => setIsSignature(e.target.checked)}
                      className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    />
                    <span className="text-sm font-medium text-gray-700">
                      시그니처 메뉴
                    </span>
                  </label>
                  <label className="flex items-center space-x-2">
                    <input
                      type="checkbox"
                      checked={isVisible}
                      onChange={(e) => setIsVisible(e.target.checked)}
                      className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    />
                    <span className="text-sm font-medium text-gray-700">
                      화면 표시
                    </span>
                  </label>
                </div>
              </div>

              <div className="mt-4 flex justify-end space-x-2">
                <button
                  type="button"
                  onClick={() => {
                    setIsEditModalOpen(false);
                    resetForm();
                  }}
                  className="rounded-md border border-gray-200 px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50"
                >
                  취소
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {submitting ? "수정 중..." : "수정"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 추가 모달 */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4 md:items-center md:p-0">
          <div className="w-full max-w-md rounded-t-lg bg-white p-4 shadow-xl md:rounded-lg md:p-6">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-gray-900">메뉴 추가</h2>
              <button
                type="button"
                onClick={() => {
                  setIsModalOpen(false);
                  resetForm();
                }}
                className="text-sm text-gray-400 hover:text-gray-600"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleAddMenu} className="space-y-4">
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">
                  이름
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="block w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  placeholder="예) 김치찌개"
                  required
                />
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">
                  가격
                </label>
                <input
                  type="number"
                  min={0}
                  value={price}
                  onChange={(e) => setPrice(e.target.value)}
                  className="block w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  placeholder="예) 9000"
                  required
                />
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">
                  카테고리
                </label>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className="block w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  required
                >
                  <option value="">카테고리를 선택하세요</option>
                  {CATEGORIES.map((cat) => (
                    <option key={cat} value={cat}>
                      {cat}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">
                  설명 <span className="text-gray-400 text-xs">(선택사항)</span>
                </label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={3}
                  className="block w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  placeholder="메뉴에 대한 설명을 입력하세요"
                />
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">
                  이미지
                </label>
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) =>
                    setImageFile(e.target.files ? e.target.files[0] : null)
                  }
                  className="block w-full text-sm text-gray-700 file:mr-3 file:cursor-pointer file:rounded-md file:border-0 file:bg-gray-100 file:px-3 file:py-2 file:text-sm file:font-medium file:text-gray-700 hover:file:bg-gray-200"
                />
                <p className="mt-1 text-xs text-gray-400">
                  선택하지 않으면 이미지 없이 메뉴가 등록됩니다.
                </p>
              </div>

              <div className="space-y-3">
                <div className="flex items-center space-x-4">
                  <label className="flex items-center space-x-2">
                    <input
                      type="checkbox"
                      checked={isSoldOut}
                      onChange={(e) => setIsSoldOut(e.target.checked)}
                      className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    />
                    <span className="text-sm font-medium text-gray-700">
                      품절
                    </span>
                  </label>
                  <label className="flex items-center space-x-2">
                    <input
                      type="checkbox"
                      checked={isSeasonal}
                      onChange={(e) => setIsSeasonal(e.target.checked)}
                      className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    />
                    <span className="text-sm font-medium text-gray-700">
                      시즌 메뉴
                    </span>
                  </label>
                  <label className="flex items-center space-x-2">
                    <input
                      type="checkbox"
                      checked={isSignature}
                      onChange={(e) => setIsSignature(e.target.checked)}
                      className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    />
                    <span className="text-sm font-medium text-gray-700">
                      시그니처 메뉴
                    </span>
                  </label>
                  <label className="flex items-center space-x-2">
                    <input
                      type="checkbox"
                      checked={isVisible}
                      onChange={(e) => setIsVisible(e.target.checked)}
                      className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    />
                    <span className="text-sm font-medium text-gray-700">
                      화면 표시
                    </span>
                  </label>
                </div>
              </div>

              <div className="mt-4 flex justify-end space-x-2">
                <button
                  type="button"
                  onClick={() => {
                    setIsModalOpen(false);
                    resetForm();
                  }}
                  className="rounded-md border border-gray-200 px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50"
                >
                  취소
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {submitting ? "등록 중..." : "등록"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
