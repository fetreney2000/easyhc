/**
 * Shared SWR fetcher.
 *
 * The old per-page fetcher was `fetch(url).then(r => r.json())`, which
 * treated *any* response as data. A 401/500 JSON body such as
 * `{ error: "..." }` therefore reached `.map(...)` calls as if it were a
 * list (crash), and real errors looked like empty results. This version
 * throws on non-2xx, so SWR populates `error` and clears `data`.
 */
export class ApiError extends Error {
  readonly status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

export async function fetcher<T>(url: string): Promise<T> {
  const res = await fetch(url, { credentials: "same-origin" });

  if (!res.ok) {
    let message = `HTTP ${res.status}`;
    try {
      const body = (await res.json()) as { error?: string };
      if (body && typeof body.error === "string") {
        message = body.error;
      }
    } catch {
      // Non-JSON error body (proxy/HTML 500 page) → keep the HTTP status
    }
    throw new ApiError(message, res.status);
  }

  return (await res.json()) as T;
}
