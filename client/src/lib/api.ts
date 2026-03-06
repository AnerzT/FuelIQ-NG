export function authFetch(token: string | null) {
  return async ({ queryKey }: { queryKey: readonly unknown[] }) => {
    const url = queryKey.join("/");
    const headers: Record<string, string> = {};
    if (token) {
      headers["Authorization"] = `Bearer ${token}`;
    }
    const res = await fetch(url, { headers, credentials: "include" });
    if (res.status === 401) {
      localStorage.removeItem("fueliq_token");
      window.location.href = "/login";
      return null;
    }
    if (!res.ok) {
      const text = (await res.text()) || res.statusText;
      throw new Error(`${res.status}: ${text}`);
    }
    const json = await res.json();
    return json.data !== undefined ? json.data : json;
  };
}
