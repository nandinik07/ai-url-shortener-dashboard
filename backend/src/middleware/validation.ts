import { Request, Response, NextFunction } from "express";
import { z, ZodError } from "zod";

// Schema for link creation
export const createLinkSchema = z.object({
  title: z.string().trim().min(1, "Title is required").max(100, "Title is too long"),
  original_url: z.string().trim().url("Must be a valid URL (starting with http:// or https://)"),
  custom_alias: z
    .string()
    .trim()
    .min(3, "Custom alias must be at least 3 characters")
    .max(50, "Custom alias is too long")
    .regex(/^[a-zA-Z0-9_-]+$/, "Alias can only contain letters, numbers, dashes, and underscores")
    .nullable()
    .optional()
    .transform(val => val === "" ? null : val),
  expires_at: z
    .string()
    .datetime({ message: "Invalid expiration date format" })
    .nullable()
    .optional()
    .refine((val) => {
      if (!val) return true;
      return new Date(val) > new Date();
    }, "Expiration date must be in the future")
    .transform(val => val ? new Date(val) : null)
});

// Schema for link update
export const updateLinkSchema = z.object({
  title: z.string().trim().min(1, "Title is required").max(100, "Title is too long").optional(),
  original_url: z.string().trim().url("Must be a valid URL (starting with http:// or https://)").optional(),
  custom_alias: z
    .string()
    .trim()
    .min(3, "Custom alias must be at least 3 characters")
    .max(50, "Custom alias is too long")
    .regex(/^[a-zA-Z0-9_-]+$/, "Alias can only contain letters, numbers, dashes, and underscores")
    .nullable()
    .optional()
    .transform(val => val === "" ? null : val),
  expires_at: z
    .string()
    .datetime({ message: "Invalid expiration date format" })
    .nullable()
    .optional()
    .refine((val) => {
      if (!val) return true;
      return new Date(val) > new Date();
    }, "Expiration date must be in the future")
    .transform(val => val ? new Date(val) : null),
  is_active: z.boolean().optional()
});

// Helper validation middleware generator
export const validate = (schema: z.ZodSchema) => {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      req.body = await schema.parseAsync(req.body);
      next();
    } catch (error) {
      if (error instanceof ZodError) {
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
