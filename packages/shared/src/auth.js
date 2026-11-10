"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.updateUserSchema = exports.createUserSchema = exports.roleSchema = exports.loginSchema = exports.passwordSchema = exports.usernameSchema = void 0;
const zod_1 = require("zod");
exports.usernameSchema = zod_1.z
    .string()
    .trim()
    .toLowerCase()
    .regex(/^[a-z0-9._-]{3,30}$/, 'Usá entre 3 y 30 letras, números, punto, guion o guion bajo');
exports.passwordSchema = zod_1.z.string().min(6, 'La contraseña necesita al menos 6 caracteres').max(200);
exports.loginSchema = zod_1.z.object({
    username: exports.usernameSchema,
    password: zod_1.z.string().min(1).max(200),
});
exports.roleSchema = zod_1.z.enum(['admin', 'user']);
exports.createUserSchema = zod_1.z.object({
    username: exports.usernameSchema,
    displayName: zod_1.z.string().trim().min(1).max(40),
    password: exports.passwordSchema,
    role: exports.roleSchema.default('user'),
});
exports.updateUserSchema = zod_1.z.object({
    displayName: zod_1.z.string().trim().min(1).max(40).optional(),
    password: exports.passwordSchema.optional(),
    active: zod_1.z.boolean().optional(),
});
