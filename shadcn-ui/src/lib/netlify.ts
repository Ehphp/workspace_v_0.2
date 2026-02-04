const stripTrailingSlash = (url: string) => url.replace(/\/+$/, '');

const NETLIFY_DEV_PORT =
  import.meta.env.VITE_NETLIFY_DEV_PORT?.toString().trim() || '8888';

/**
 * Build the full URL for a Netlify function, handling local dev fallbacks.
 * - Honors an explicit override or VITE_FUNCTIONS_BASE_URL when provided.
 * - When running the raw Vite dev server on port 5173, it targets the Netlify
 *   dev proxy on port 8888 so functions are reachable.
 */
export function buildFunctionUrl(
  functionName: string,
  overrideBaseUrl?: string
): string {
  const explicitBase =
    overrideBaseUrl?.trim() ||
    import.meta.env.VITE_FUNCTIONS_BASE_URL?.toString().trim();

  if (explicitBase) {
    return `${stripTrailingSlash(explicitBase)}/.netlify/functions/${functionName}`;
  }

  if (typeof window !== 'undefined') {
    if (window.location.port === '5173') {
      return `http://localhost:${NETLIFY_DEV_PORT}/.netlify/functions/${functionName}`;
    }

    return `${window.location.origin}/.netlify/functions/${functionName}`;
  }

  // SSR/test fallback
  return `/.netlify/functions/${functionName}`;
}
