import type { NextFunction, Request, RequestHandler, Response } from "express";

export function asyncHandler(fn: RequestHandler): RequestHandler {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

export function errorHandler(
  err: unknown,
  _req: Request,
  res: Response,
  _next: NextFunction
): void {
  void _next;
  const message = err instanceof Error ? err.message : "Unknown error";
  res.status(500).json({ error: "server_error", message });
}
