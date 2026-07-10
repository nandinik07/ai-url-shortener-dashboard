"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.validate = exports.updateLinkSchema = exports.createLinkSchema = void 0;
const zod_1 = require("zod");
// Schema for link creation
exports.createLinkSchema = zod_1.z.object({
    title: zod_1.z.string().trim().min(1, "Title is required").max(100, "Title is too long"),
    original_url: zod_1.z.string().trim().url("Must be a valid URL (starting with http:// or https://)"),
    custom_alias: zod_1.z
        .string()
        .trim()
        .min(3, "Custom alias must be at least 3 characters")
        .max(50, "Custom alias is too long")
        .regex(/^[a-zA-Z0-9_-]+$/, "Alias can only contain letters, numbers, dashes, and underscores")
        .nullable()
        .optional()
        .transform(val => val === "" ? null : val),
    expires_at: zod_1.z
        .string()
        .datetime({ message: "Invalid expiration date format" })
        .nullable()
        .optional()
        .refine((val) => {
        if (!val)
            return true;
        return new Date(val) > new Date();
    }, "Expiration date must be in the future")
        .transform(val => val ? new Date(val) : null)
});
// Schema for link update
exports.updateLinkSchema = zod_1.z.object({
    title: zod_1.z.string().trim().min(1, "Title is required").max(100, "Title is too long").optional(),
    original_url: zod_1.z.string().trim().url("Must be a valid URL (starting with http:// or https://)").optional(),
    custom_alias: zod_1.z
        .string()
        .trim()
        .min(3, "Custom alias must be at least 3 characters")
        .max(50, "Custom alias is too long")
        .regex(/^[a-zA-Z0-9_-]+$/, "Alias can only contain letters, numbers, dashes, and underscores")
        .nullable()
        .optional()
        .transform(val => val === "" ? null : val),
    expires_at: zod_1.z
        .string()
        .datetime({ message: "Invalid expiration date format" })
        .nullable()
        .optional()
        .refine((val) => {
        if (!val)
            return true;
        return new Date(val) > new Date();
    }, "Expiration date must be in the future")
        .transform(val => val ? new Date(val) : null),
    is_active: zod_1.z.boolean().optional()
});
// Helper validation middleware generator
const validate = (schema) => {
    return async (req, res, next) => {
        try {
            req.body = await schema.parseAsync(req.body);
            next();
        }
        catch (error) {
            if (error instanceof zod_1.ZodError) {
                const errorMessages = error.errors.map((err) => ({
                    field: err.path.join("."),
                    message: err.message
                }));
                return res.status(400).json({
                    status: "fail",
                    message: "Validation failed",
                    errors: errorMessages
                });
            }
            return res.status(500).json({
                status: "error",
                message: "Internal server validation error"
            });
        }
    };
};
exports.validate = validate;
