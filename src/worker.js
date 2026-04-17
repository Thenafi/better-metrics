/**
 * Cloudflare Worker — Better Metrics
 *
 * Routes:
 *   POST /api/reservations  →  proxies to Hospitable API (handles pagination)
 *   *                       →  serves static assets from public/
 */

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    // ── API route ──────────────────────────────────────────────
    if (url.pathname === '/api/reservations' && request.method === 'POST') {
      return handleReservations(request);
    }

    // ── Static assets (fallthrough) ───────────────────────────
    return env.ASSETS.fetch(request);
  }
};

// ── Helpers ─────────────────────────────────────────────────────

const HOSPITABLE_API = 'https://api.hospitable.com/metrics/public/views';

const PROXY_HEADERS = {
  'Accept': 'application/json, text/plain, */*',
  'Content-Type': 'application/json',
  'Origin': 'https://share.hospitable.com',
  'Referer': 'https://share.hospitable.com/',
  'User-Agent':
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/147.0.0.0 Safari/537.36',
};

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

/**
 * POST /api/reservations
 * Body: { uuid, start, end }
 */
async function handleReservations(request) {
  // Handle CORS preflight
  if (request.method === 'OPTIONS') {
    return new Response(null, { headers: CORS });
  }

  try {
    const { uuid, start, end } = await request.json();

    if (!uuid || !start || !end) {
      return jsonResponse(400, { error: 'Missing required fields: uuid, start, end' });
    }

    const allData = await fetchAllPages(uuid, start, end);
    return jsonResponse(200, { data: allData });
  } catch (err) {
    return jsonResponse(502, {
      error: 'Failed to fetch from Hospitable API',
      details: err.message,
    });
  }
}

/**
 * Walk through every page of results from the Hospitable API.
 */
async function fetchAllPages(uuid, start, end) {
  const LIMIT = 100;
  let offset = 0;
  let allData = [];
  let hasMore = true;

  while (hasMore) {
    const result = await fetchPage(uuid, start, end, LIMIT, offset);
    allData = allData.concat(result.data || []);

    const pagination = result.meta?.pagination;
    if (pagination) {
      const totalPages = pagination.page_numbers?.total_pages || 1;
      const currentPage = pagination.page_numbers?.this_page || 1;
      hasMore = currentPage < totalPages;
      offset += LIMIT;
    } else {
      hasMore = false;
    }
  }

  return allData;
}

/**
 * Fetch a single page from the Hospitable public views API.
 */
async function fetchPage(uuid, start, end, limit, offset) {
  const apiUrl = `${HOSPITABLE_API}/${encodeURIComponent(uuid)}/details?limit=${limit}&offset=${offset}`;

  const body = JSON.stringify({
    one_file_per_property: false,
    filters: {
      date: {
        column: 'check_out',
        strategy: 'custom',
        interval_type: 'day',
        interval_length: 7,
        start,
        end,
      },
    },
  });

  const resp = await fetch(apiUrl, {
    method: 'POST',
    headers: PROXY_HEADERS,
    body,
  });

  if (!resp.ok) {
    const text = await resp.text();
    throw new Error(`Hospitable API ${resp.status}: ${text.substring(0, 300)}`);
  }

  return resp.json();
}

/** Tiny helper to build JSON responses with CORS headers. */
function jsonResponse(status, data) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', ...CORS },
  });
}
