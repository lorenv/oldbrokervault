import { Request, Response, NextFunction } from 'express';
import { ZodSchema } from 'zod';

export function validateZodSchema(schema: ZodSchema) {
  return (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = schema.safeParse(req.body);
      
      if (!result.success) {
        console.error("Validation failed for request:", {
          url: req.url,
          method: req.method,
          body: req.body,
          errors: result.error.errors
        });
        return res.status(400).json({
          error: "Validation failed",
          details: result.error.errors
        });
      }
      
      req.body = result.data;
      next();
    } catch (error) {
      console.error("Validation middleware error:", error);
      res.status(500).json({ error: "Internal validation error" });
    }
  };
}