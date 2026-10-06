import { z } from "zod";
import { ROLES } from "@/lib/db/types";
import { strings } from "@/lib/i18n/strings";

export const loginSchema = z.object({
  username: z
    .string()
    .min(1, strings.required)
    .trim()
    .toLowerCase(),
  password: z
    .string()
    .min(1, strings.required),
});

export const createUserSchema = z.object({
  name: z
    .string()
    .min(1, strings.required)
    .max(100, strings.maxLength(strings.name, 100))
    .transform((v) => v.trim()),
  username: z
    .string()
    .min(3, strings.minLength(strings.username, 3))
    .max(30, strings.maxLength(strings.username, 30))
    .regex(/^[a-z0-9_.-]+$/i, strings.invalidUsername)
    .trim()
    .toLowerCase(),
  password: z
    .string()
    .min(6, strings.passwordMinLength),
  phone: z
    .string()
    .max(20, strings.maxLength(strings.phone, 20))
    .optional()
    .or(z.literal(""))
    .transform((v) => (v ? v.trim() : v)),
  jawatanInfo: z
    .string()
    .max(100, strings.maxLength(strings.jawatanInfo, 100))
    .optional()
    .or(z.literal(""))
    .transform((v) => (v ? v.trim() : v)),
  role: z.enum(ROLES, {
    errorMap: () => ({ message: strings.required }),
  }),
  jabatanId: z.string().optional().or(z.literal("")),
  unitId: z.string().optional().or(z.literal("")),
  status: z.enum(["active", "inactive"]).default("active"),
});

export const updateUserSchema = createUserSchema
  .omit({ password: true })
  .extend({
    password: z.string().optional().or(z.literal("")),
  });

/**
 * Self-service profile edit: deliberately limited to name and phone, with
 * the same bounds as the admin path (a raw body.name must never reach the DB).
 */
export const updateProfileSchema = z.object({
  name: z
    .string()
    .min(1, strings.required)
    .max(100, strings.maxLength(strings.name, 100))
    .transform((v) => v.trim()),
  phone: z
    .string()
    .max(20, strings.maxLength(strings.phone, 20))
    .optional()
    .or(z.literal(""))
    .transform((v) => (v ? v.trim() : v)),
});

export const createFloorSchema = z.object({
  name: z
    .string()
    .min(1, strings.required)
    .max(50, strings.maxLength(strings.floorName, 50))
    .trim(),
});

export const updateFloorSchema = createFloorSchema;

export const createJabatanSchema = z.object({
  name: z
    .string()
    .min(1, strings.required)
    .max(100, strings.maxLength(strings.jabatan, 100))
    .trim(),
});

export const createUnitSchema = z.object({
  name: z
    .string()
    .min(1, strings.required)
    .max(100, strings.maxLength(strings.unit, 100))
    .trim(),
  jabatanId: z.string().min(1, strings.required),
  homeFloorId: z.string().optional().or(z.literal("")),
});

export const visitorCheckInSchema = z.object({
  visitorName: z
    .string()
    .min(1, strings.required)
    .max(100, strings.maxLength(strings.visitorName, 100))
    .trim(),
  visitorPhone: z
    .string()
    .max(20, strings.maxLength(strings.visitorPhone, 20))
    .optional()
    .or(z.literal("")),
  floorId: z.string().min(1, strings.required),
  /**
   * The floor's rotating qrToken, taken from the `?token=` of the scanned
   * visitor QR. Required: this endpoint is public, and the token is the only
   * proof the caller actually scanned a current QR for this floor.
   */
  token: z
    .string({ required_error: strings.qrInvalid, invalid_type_error: strings.qrInvalid })
    .min(1, strings.qrInvalid),
});

export const visitorCheckOutSchema = z.object({
  attendanceId: z.string().min(1, strings.required),
  /** Same capability token the visitor checked in with. */
  token: z
    .string({ required_error: strings.qrInvalid, invalid_type_error: strings.qrInvalid })
    .min(1, strings.qrInvalid),
});

/** Admin-initiated password reset for another user. */
export const resetPasswordSchema = z.object({
  password: z.string().min(6, strings.passwordMinLength),
});

export const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, strings.required),
    newPassword: z.string().min(6, strings.passwordMinLength),
    confirmPassword: z.string().min(1, strings.required),
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    message: strings.passwordMismatch,
    path: ["confirmPassword"],
  });

export const manualCheckInSchema = z.object({
  userId: z.string().min(1, strings.required),
  floorId: z.string().min(1, strings.required),
});

export const reportFilterSchema = z.object({
  fromDate: z.string().optional(),
  toDate: z.string().optional(),
  floorId: z.string().optional().or(z.literal("")),
  type: z.enum(["employee", "visitor", "all"]).default("all"),
});

export type LoginInput = z.infer<typeof loginSchema>;
export type CreateUserInput = z.infer<typeof createUserSchema>;
export type UpdateUserInput = z.infer<typeof updateUserSchema>;
export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;
export type CreateFloorInput = z.infer<typeof createFloorSchema>;
export type VisitorCheckInInput = z.infer<typeof visitorCheckInSchema>;
export type VisitorCheckOutInput = z.infer<typeof visitorCheckOutSchema>;
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;
export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;
export type ManualCheckInInput = z.infer<typeof manualCheckInSchema>;
export type ReportFilterInput = z.infer<typeof reportFilterSchema>;