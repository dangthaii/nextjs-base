"use client";

import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { useRouter } from "next/navigation";

export default function Header() {
  const { user, logout } = useAuth();
  const router = useRouter();

  return (
    <header className="flex justify-between items-center py-3 px-6 border-b">
      <h1
        className="text-xl font-bold cursor-pointer"
        onClick={() => router.push("/")}
      >
        Reading App
      </h1>
      <div className="flex items-center gap-4">
        {user && (
          <>
            <span className="text-sm">{user?.name || user?.username}</span>
            <Button variant="outline" size="sm" onClick={() => logout()}>
              Đăng xuất
            </Button>
          </>
        )}
      </div>
    </header>
  );
}
