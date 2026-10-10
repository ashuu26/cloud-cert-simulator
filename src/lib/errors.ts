/** Errors with an HTTP status, safe to show to the user. No server-only imports so tests can use them. */
export class HttpError extends Error {
  retryAfter?: number;
  constructor(
    public status: number,
    public code: string,
    message: string,
  ) {
    super(message);
  }
}

export const errors = {
  unauthorized: () => new HttpError(401, "unauthorized", "Please sign in to continue."),
  forbidden: (msg = "You don't have access to this.") => new HttpError(403, "forbidden", msg),
  premiumRequired: () => new HttpError(402, "premium_required", "This feature needs an active Premium subscription."),
  notFound: (what = "Resource") => new HttpError(404, "not_found", `${what} not found.`),
  badRequest: (msg: string) => new HttpError(400, "bad_request", msg),
  conflict: (code: string, msg: string) => new HttpError(409, code, msg),
};
