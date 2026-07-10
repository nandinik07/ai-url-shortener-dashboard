const API_BASE = "http://localhost:5000";

export interface Link {
  id: number;
  title: string;
  original_url: string;
  short_code: string;
  custom_alias: string | null;
  is_active: boolean;
  expires_at: string | null;
  created_at: string;
  deleted_at: string | null;
  click_count?: number;
}

export interface DashboardStats {
  totalLinks: number;
  totalClicks: number;
  activeLinks: number;
  expiredLinks: number;
}

export interface LinkAnalytics {
  link: Link;
  totalClicks: number;
  clicksByDate: { date: string; count: number }[];
  clicksByBrowser: { browser: string; count: number }[];
  clicksByOS: { os: string; count: number }[];
  clicksByCountry: { country: string; count: number }[];
  clicksByReferrer: { referrer: string; count: number }[];
}

export interface PaginatedResponse {
  links: Link[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    pages: number;
  };
}

export class Api {
  static async getDashboardStats(): Promise<DashboardStats> {
    const res = await fetch(`${API_BASE}/api/analytics/dashboard`);
    if (!res.ok) throw new Error("Failed to fetch dashboard stats");
    const json = await res.json();
    return json.data;
  }

  static async listLinks(page: number = 1, limit: number = 10, search?: string): Promise<PaginatedResponse> {
    const params = new URLSearchParams({
      page: page.toString(),
      limit: limit.toString()
    });
    if (search) params.append("search", search);

    const res = await fetch(`${API_BASE}/api/links?${params.toString()}`);
    if (!res.ok) throw new Error("Failed to fetch links");
    const json = await res.json();
    return json.data;
  }

  static async getLink(id: number): Promise<Link> {
    const res = await fetch(`${API_BASE}/api/links/${id}`);
    if (!res.ok) throw new Error("Failed to fetch link details");
    const json = await res.json();
    return json.data;
  }

  static async createLink(data: {
    title: string;
    original_url: string;
    custom_alias?: string | null;
    expires_at?: string | null;
  }): Promise<Link> {
    const res = await fetch(`${API_BASE}/api/links`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data)
    });

    const json = await res.json();
    if (!res.ok) {
      const errorMsg = json.errors ? json.errors.map((e: any) => e.message).join(", ") : json.message;
      throw new Error(errorMsg || "Failed to create link");
    }
    return json.data;
  }

  static async updateLink(
    id: number,
    data: {
      title?: string;
      original_url?: string;
      custom_alias?: string | null;
      expires_at?: string | null;
      is_active?: boolean;
    }
  ): Promise<Link> {
    const res = await fetch(`${API_BASE}/api/links/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data)
    });

    const json = await res.json();
    if (!res.ok) {
      const errorMsg = json.errors ? json.errors.map((e: any) => e.message).join(", ") : json.message;
      throw new Error(errorMsg || "Failed to update link");
    }
    return json.data;
  }

  static async deleteLink(id: number): Promise<void> {
    const res = await fetch(`${API_BASE}/api/links/${id}`, {
      method: "DELETE"
    });
    if (!res.ok) {
      const json = await res.json();
      throw new Error(json.message || "Failed to delete link");
    }
  }

  static async getLinkAnalytics(linkId: number): Promise<LinkAnalytics> {
    const res = await fetch(`${API_BASE}/api/analytics/links/${linkId}`);
    if (!res.ok) throw new Error("Failed to fetch link analytics");
    const json = await res.json();
    return json.data;
  }

  static async suggestAliases(original_url: string, title: string): Promise<string[]> {
    const res = await fetch(`${API_BASE}/api/links/suggest-aliases`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ original_url, title })
    });
    if (!res.ok) throw new Error("Failed to fetch AI Suggestions");
    const json = await res.json();
    return json.data.suggestions;
  }
}
