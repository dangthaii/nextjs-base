"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { axiosClient } from "@/lib/axios";
import { toast } from "@/lib/toast";
import { useRouter } from "next/navigation";

export type User = {
  id: string;
  username: string;
  name: string | null;
  needChangePassword?: boolean;
  role?: string; // "admin" or null
  // Thêm các trường khác nếu cần
};

export const useAuth = () => {
  const queryClient = useQueryClient();
  const router = useRouter();

  // Query để lấy thông tin người dùng
  const { data: user, isLoading } = useQuery({
    queryKey: ["user"],
    queryFn: async () => {
      try {
        const response = await axiosClient.get("/auth/me");
        return response?.data?.data;
      } catch (error) {
        // Không hiển thị lỗi khi người dùng chưa đăng nhập
        return null;
      }
    },
    staleTime: 0,
  });

  // Mutation để đăng xuất
  const logout = useMutation({
    mutationFn: async () => {
      return await axiosClient.post("/auth/logout");
    },
    onSuccess: () => {
      queryClient.setQueryData(["user"], null);
      toast.success("Đăng xuất thành công");
      router.push("/login");
    },
  });

  return {
    user,
    isLoading,
    isAuthenticated: !!user,
    logout: logout.mutate,
  };
};
