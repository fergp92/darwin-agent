import { useState, useEffect, useRef } from 'react';

// In Docker: nginx proxies /api/ to darwin:7761, so use relative URLs
// In dev: Vite proxy or direct access to localhost:7761
const BASE = import.meta.env.VITE_API_URL || '';

/**
 * Polls a Darwin API endpoint at a given interval.
 * @param {string} endpoint - e.g. '/api/health'
 * @param {number} interval - polling interval in ms (default 5000)
 * @returns {{ data: any, error: string|null, loading: boolean }}
 */
export function useApi(endpoint, interval = 5000) {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;

    async function fetchData() {
      try {
        const res = await fetch(`${BASE}${endpoint}`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json = await res.json();
        if (mountedRef.current) {
          setData(json);
          setError(null);
        }
      } catch (err) {
        if (mountedRef.current) {
          setError(err.message);
        }
      } finally {
        if (mountedRef.current) setLoading(false);
      }
    }

    fetchData();
    const id = setInterval(fetchData, interval);

    return () => {
      mountedRef.current = false;
      clearInterval(id);
    };
  }, [endpoint, interval]);

  return { data, error, loading };
}
