import type { Instrumentation } from "next";

/** Structured log for every unhandled server error (pages, route handlers, server actions). */
export const onRequestError: Instrumentation.onRequestError = async (error, request, context) => {
  const err = error as Error & { digest?: string };
  console.error(
    JSON.stringify({
      level: "error",
      message: "unhandled request error",
      time: new Date().toISOString(),
      digest: err.digest,
      error: { name: err.name, message: err.message, stack: err.stack },
      path: request.path,
      method: request.method,
      routePath: context.routePath,
      routeType: context.routeType,
    }),
  );
};
