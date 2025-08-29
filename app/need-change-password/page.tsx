"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { changePasswordFormSchema } from "@/schemas/auth";
import { axiosClient } from "@/lib/axios";
import { toast } from "@/lib/toast";
import { useAuth } from "@/hooks/useAuth";

// Infer the type from the schema
type ChangePasswordFormValues = z.infer<typeof changePasswordFormSchema>;

export default function NeedChangePassword() {
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const { user, isLoading } = useAuth();

  // Initialize the form with react-hook-form and zod resolver
  const form = useForm<ChangePasswordFormValues>({
    resolver: zodResolver(changePasswordFormSchema),
    defaultValues: {
      password: "",
      confirmPassword: "",
    },
  });

  useEffect(() => {
    // If user data is loaded and they don't need to change password
    if (user && !user.needChangePassword) {
      router.push("/"); // Redirect to home page
    }
  }, [user, router]);

  const onSubmit = async (data: ChangePasswordFormValues) => {
    setLoading(true);
    try {
      await axiosClient.post("/auth/need-change-password", {
        password: data.password,
      });
      toast.success("Đổi mật khẩu thành công");
      // Redirect to home page after successful password change
      router.push("/");
    } catch (error: any) {
      console.error("Error:", error);
      toast.error(error.response?.data?.message || "Đổi mật khẩu thất bại");
    } finally {
      setLoading(false);
    }
  };

  // If loading user data, show loading state
  if (isLoading) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        Đang tải...
      </div>
    );
  }

  return (
    <div className="flex items-center justify-center min-h-screen bg-background">
      <Card className="w-full max-w-md border py-4 shadow-lg">
        <CardHeader>
          <CardTitle>Đổi mật khẩu</CardTitle>
          <CardDescription>
            Bạn cần đổi mật khẩu để tiếp tục sử dụng hệ thống.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="password"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Mật khẩu mới</FormLabel>
                    <FormControl>
                      <Input
                        type="password"
                        placeholder="Nhập mật khẩu mới"
                        autoComplete="new-password"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="confirmPassword"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Nhập lại mật khẩu mới</FormLabel>
                    <FormControl>
                      <Input
                        type="password"
                        placeholder="Nhập lại mật khẩu mới"
                        autoComplete="new-password"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? "Đang đổi mật khẩu..." : "Đổi mật khẩu"}
              </Button>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
}
