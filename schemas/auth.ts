import { z } from "zod";

// Base schema không có confirmPassword
export const registerApiSchema = z.object({
  name: z.string().min(2, {
    message: "Tên phải có ít nhất 2 ký tự.",
  }),
  username: z.string().min(2, {
    message: "Tên đăng nhập phải có ít nhất 2 ký tự.",
  }),
  registerCode: z.string().min(1, {
    message: "Mã đăng ký là bắt buộc.",
  }),
  password: z.string().min(3, {
    message: "Mật khẩu phải có ít nhất 3 ký tự.",
  }),
});

// Form schema extend từ API schema và thêm confirmPassword + refine
export const registerFormSchema = registerApiSchema
  .extend({
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Mật khẩu không khớp",
    path: ["confirmPassword"],
  });

export const loginSchema = registerApiSchema.pick({
  username: true,
  password: true,
});

// Schema cho đổi mật khẩu
export const changePasswordApiSchema = z.object({
  password: z.string().min(3, {
    message: "Mật khẩu phải có ít nhất 3 ký tự.",
  }),
});

// Form schema cho đổi mật khẩu
export const changePasswordFormSchema = changePasswordApiSchema
  .extend({
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Mật khẩu không khớp",
    path: ["confirmPassword"],
  });
