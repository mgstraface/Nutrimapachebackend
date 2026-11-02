import { z } from 'zod';

export const usernameSchema = z
  .string()
  .trim()
  .toLowerCase()
  .regex(/^[a-z0-9._-]{3,30}$/, 'Usá entre 3 y 30 letras, números, punto, guion o guion bajo');

export const passwordSchema = z.string().min(6, 'La contraseña necesita al menos 6 caracteres').max(200);

export const loginSchema = z.object({
  username: usernameSchema,
  password: z.string().min(1).max(200),
});

export const roleSchema = z.enum(['admin', 'user']);
export type Role = z.infer<typeof roleSchema>;

export const createUserSchema = z.object({
  username: usernameSchema,
  displayName: z.string().trim().min(1).max(40),
  password: passwordSchema,
  role: roleSchema.default('user'),
});
export type CreateUserInput = z.infer<typeof createUserSchema>;

export const updateUserSchema = z.object({
  displayName: z.string().trim().min(1).max(40).optional(),
  password: passwordSchema.optional(),
  active: z.boolean().optional(),
});
export type UpdateUserInput = z.infer<typeof updateUserSchema>;

export interface SessionUser {
  id: string;
  username: string;
  displayName: string;
  role: Role;
}

export interface AdminUserRow extends SessionUser {
  active: boolean;
  hasProfile: boolean;
  mealCount: number;
  lastMealAt: string | null;
  createdAt: string;
}
