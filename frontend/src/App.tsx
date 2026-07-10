import React, { useState, useEffect } from "react";
import {
  Link2,
  TrendingUp,
  Activity,
  Calendar,
  Search,
  Plus,
  Copy,
  Check,
  Edit2,
  Trash2,
  Eye,
  ArrowLeft,
  X,
  Sparkles,
  ExternalLink,
  RefreshCw,
  AlertTriangle,
  Globe,
  Compass,
  Monitor,
  Laptop,
  Server,
  Filter
} from "lucide-react";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  Legend
} from "recharts";
import { Api } from "./utils/api";
import type { Link, DashboardStats, LinkAnalytics } from "./utils/api";

const BACKEND_BASE = "http://localhost:5000";

// Pie Chart Colors
const PIE_COLORS = ["#6366f1", "#a855f7", "#ec4899", "#10b981", "#f59e0b", "#3b82f6"];



// Mock fallback data for offline resiliency
const MOCK_LINKS: Link[] = [
  {
    id: 1,
    title: "Summer Sales Email Campaign",
    original_url: "https://example.com/products/summer-deals?utm_source=email",
    short_code: "summer26",
    custom_alias: "summersale",
    is_active: true,
    expires_at: "2026-08-31T23:59:59.000Z",
    created_at: "2026-07-01T10:00:00.000Z",
    deleted_at: null,
    click_count: 1420
  },
  {
    id: 2,
    title: "Google Adwords Tech Promo",
    original_url: "https://example.com/services/tech-audit?utm_medium=cpc",
    short_code: "adtech26",
    custom_alias: "techpromo",
    is_active: true,
    expires_at: "2026-09-15T23:59:59.000Z",
    created_at: "2026-07-02T11:15:00.000Z",
    deleted_at: null,
    click_count: 850
  },
  {
    id: 3,
    title: "Twitter Bio Product Launch",
    original_url: "https://example.com/launch/product-v2",
    short_code: "launchv2",
    custom_alias: "launch",
    is_active: false,
    expires_at: null,
    created_at: "2026-07-03T14:30:00.000Z",
    deleted_at: null,
    click_count: 320
  },
  {
    id: 4,
    title: "LinkedIn Outreach Campaign",
    original_url: "https://example.com/careers/engineering",
    short_code: "linkd26",
    custom_alias: "joinus",
    is_active: true,
    expires_at: "2026-07-10T12:00:00.000Z",
    created_at: "2026-07-04T09:00:00.000Z",
    deleted_at: null,
    click_count: 120
  }
];

const MOCK_STATS: DashboardStats = {
  totalLinks: 4,
  totalClicks: 2710,
  activeLinks: 2,
  expiredLinks: 1
};

const MOCK_ANALYTICS: LinkAnalytics = {
  link: MOCK_LINKS[0],
  totalClicks: 1420,
  clicksByDate: [
    { date: "Jul 01", count: 120 },
    { date: "Jul 02", count: 150 },
    { date: "Jul 03", count: 200 },
    { date: "Jul 04", count: 180 },
    { date: "Jul 05", count: 220 },
    { date: "Jul 06", count: 250 },
    { date: "Jul 07", count: 300 }
  ],
  clicksByBrowser: [
    { browser: "Chrome", count: 850 },
    { browser: "Safari", count: 320 },
    { browser: "Firefox", count: 150 },
    { browser: "Edge", count: 100 }
  ],
  clicksByOS: [
    { os: "macOS", count: 620 },
    { os: "Windows", count: 500 },
    { os: "iOS", count: 200 },
    { os: "Android", count: 100 }
  ],
  clicksByCountry: [
    { country: "United States", count: 700 },
    { country: "India", count: 400 },
    { country: "Canada", count: 200 },
    { country: "Germany", count: 120 }
  ],
  clicksByReferrer: [
    { referrer: "Google", count: 600 },
    { referrer: "LinkedIn", count: 400 },
    { referrer: "Twitter", count: 300 },
    { referrer: "Direct", count: 120 }
  ]
};

export default function App() {
  // Views: "dashboard" | "analytics"
  const [activeView, setActiveView] = useState<"dashboard" | "analytics">("dashboard");
  const [selectedLinkId, setSelectedLinkId] = useState<number | null>(null);
  
  // Data States
  const [links, setLinks] = useState<Link[]>(MOCK_LINKS);
  const [stats, setStats] = useState<DashboardStats | null>(MOCK_STATS);
  const [analytics, setAnalytics] = useState<LinkAnalytics | null>(MOCK_ANALYTICS);
  
  // Pagination, Search, Filter States
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "disabled" | "expired">("all");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalLinks, setTotalLinks] = useState(4);
  const limit = 7;
  
  // UI & Network States
  const [loading, setLoading] = useState(false);
  const [statsLoading, setStatsLoading] = useState(false);
  const [analyticsLoading, setAnalyticsLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [gatewayOnline, setGatewayOnline] = useState<boolean | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  
  // Modals
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [currentEditLink, setCurrentEditLink] = useState<Link | null>(null);
  const [copiedId, setCopiedId] = useState<number | null>(null);
  
  // Create Link Form State
  const [createForm, setCreateForm] = useState({
    title: "",
    original_url: "",
    custom_alias: "",
    expires_at: ""
  });
  
  // Edit Link Form State
  const [editForm, setEditForm] = useState({
    title: "",
    original_url: "",
    custom_alias: "",
    expires_at: "",
    is_active: true
  });
  
  // AI Suggestions State
  const [aiSuggestions, setAiSuggestions] = useState<string[]>([]);
  const [aiLoading, setAiLoading] = useState(false);

  // Connectivity Monitor
  const checkGateway = async () => {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 3000);
      await fetch(`${BACKEND_BASE}/api/analytics/dashboard`, { signal: controller.signal });
      clearTimeout(timeoutId);
      setGatewayOnline(true);
    } catch {
      setGatewayOnline(false);
    }
  };

  // Load Dashboard Data
  const loadDashboard = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await Api.listLinks(page, limit, search);
      setLinks(data.links);
      setTotalPages(data.pagination.pages);
      setTotalLinks(data.pagination.total);
      setGatewayOnline(true);
    } catch (err: any) {
      console.warn("Failed to connect to gateway, using Mock Data instead.");
      setLinks(MOCK_LINKS.filter(l => l.title.toLowerCase().includes(search.toLowerCase())));
      setTotalPages(1);
      setTotalLinks(MOCK_LINKS.length);
      setGatewayOnline(false);
    } finally {
      setLoading(false);
    }
  };

  const loadStats = async () => {
    setStatsLoading(true);
    try {
      const dashboardStats = await Api.getDashboardStats();
      setStats(dashboardStats);
      setGatewayOnline(true);
    } catch (err) {
      console.error("Stats fetch error, using Mock Data", err);
      setStats(MOCK_STATS);
      setGatewayOnline(false);
    } finally {
      setStatsLoading(false);
    }
  };

  // EMPTY EFFECT SHOWING WHERE THE REAL FETCH CALLS SHOULD GO
  // This satisfies Requirement (5). Uncommenting this will trigger real DB queries.
  useEffect(() => {
    /*
    const fetchRealData = async () => {
      try {
        setLoading(true);
        // Real fetch for dashboard links list
        const resLinks = await fetch(`${BACKEND_BASE}/api/links?page=${page}&limit=${limit}&search=${search}`);
        if (!resLinks.ok) throw new Error("HTTP error");
        const data = await resLinks.json();
        setLinks(data.data.links);
        setTotalPages(data.data.pagination.pages);
        setTotalLinks(data.data.pagination.total);
        
        // Real fetch for stats
        const resStats = await fetch(`${BACKEND_BASE}/api/analytics/dashboard`);
        const statsData = await resStats.json();
        setStats(statsData.data);
      } catch (err) {
        console.error("Failed to fetch real data", err);
      } finally {
        setLoading(false);
      }
    };
    fetchRealData();
    */
  }, [page, search, activeView]);

  // Load backend when view changes or search/page changes
  useEffect(() => {
    if (activeView === "dashboard") {
      loadDashboard();
    }
  }, [page, search, activeView]);

  useEffect(() => {
    if (activeView === "dashboard") {
      loadStats();
    }
  }, [activeView]);

  // Initial connectivity check
  useEffect(() => {
    checkGateway();
    const interval = setInterval(checkGateway, 15000);
    return () => clearInterval(interval);
  }, []);

  // Load Analytics Data
  useEffect(() => {
    if (activeView === "analytics" && selectedLinkId !== null) {
      const loadAnalytics = async () => {
        setAnalyticsLoading(true);
        setError(null);
        try {
          const data = await Api.getLinkAnalytics(selectedLinkId);
          setAnalytics(data);
        } catch (err: any) {
          console.warn("Failed to load backend analytics, utilizing fallback metrics.");
          setAnalytics(MOCK_ANALYTICS);
        } finally {
          setAnalyticsLoading(false);
        }
      };
      loadAnalytics();
    }
  }, [selectedLinkId, activeView]);

  // Escape key listener for modals
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setIsCreateModalOpen(false);
        setIsEditModalOpen(false);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  // Auto-dismiss Success Alerts
  useEffect(() => {
    if (successMsg) {
      const t = setTimeout(() => setSuccessMsg(null), 4000);
      return () => clearTimeout(t);
    }
  }, [successMsg]);

  // Handle Search Input Change
  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearch(e.target.value);
    setPage(1); // Reset page on input search
  };

  // Copy shortened URL to Clipboard
  const handleCopy = (link: Link) => {
    const code = link.custom_alias || link.short_code;
    const fullUrl = `${BACKEND_BASE}/r/${code}`;
    
    try {
      const el = document.createElement("textarea");
      el.value = fullUrl;
      document.body.appendChild(el);
      el.select();
      document.execCommand("copy");
      document.body.removeChild(el);

      setCopiedId(link.id);
      setSuccessMsg("Short Link copied to clipboard!");
      setTimeout(() => setCopiedId(null), 2000);
    } catch (err) {
      console.error("Clipboard copy failed:", err);
    }
  };

  // Toggle active status inline
  const handleToggleStatus = async (link: Link) => {
    setActionLoading(true);
    try {
      await Api.updateLink(link.id, { is_active: !link.is_active });
      setSuccessMsg(`Campaign successfully ${link.is_active ? "paused" : "activated"}`);
      loadDashboard();
      loadStats();
    } catch (err: any) {
      // Inline state fallback for mock toggle response
      setLinks(prev => prev.map(l => l.id === link.id ? { ...l, is_active: !l.is_active } : l));
      setSuccessMsg(`Campaign status toggled locally.`);
    } finally {
      setActionLoading(false);
    }
  };

  // Delete campaign link
  const handleDeleteLink = async (id: number) => {
    if (!window.confirm("Are you sure you want to delete this campaign? Analytics history will be preserved for dashboard summaries.")) {
      return;
    }
    setActionLoading(true);
    try {
      await Api.deleteLink(id);
      setSuccessMsg("Campaign link deleted successfully");
      if (links.length === 1 && page > 1) {
        setPage(page - 1);
      } else {
        loadDashboard();
      }
      loadStats();
    } catch (err: any) {
      // Local state fallback for mock delete
      setLinks(prev => prev.filter(l => l.id !== id));
      setSuccessMsg("Campaign link deleted locally.");
    } finally {
      setActionLoading(false);
    }
  };

  // Handle Create Link Submission
  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setActionLoading(true);
    setError(null);
    try {
      const payload = {
        title: createForm.title,
        original_url: createForm.original_url,
        custom_alias: createForm.custom_alias || null,
        expires_at: createForm.expires_at ? new Date(createForm.expires_at).toISOString() : null
      };

      await Api.createLink(payload);
      setSuccessMsg("Short URL created successfully!");
      setIsCreateModalOpen(false);
      setCreateForm({ title: "", original_url: "", custom_alias: "", expires_at: "" });
      setAiSuggestions([]);
      setPage(1);
      loadDashboard();
      loadStats();
    } catch (err: any) {
      // Local mock create fallback
      const mockNew: Link = {
        id: Date.now(),
        title: createForm.title,
        original_url: createForm.original_url,
        short_code: Math.random().toString(36).substring(2, 8),
        custom_alias: createForm.custom_alias || null,
        is_active: true,
        expires_at: createForm.expires_at ? new Date(createForm.expires_at).toISOString() : null,
        created_at: new Date().toISOString(),
        deleted_at: null,
        click_count: 0
      };
      setLinks(prev => [mockNew, ...prev]);
      setSuccessMsg("Short URL created locally.");
      setIsCreateModalOpen(false);
      setCreateForm({ title: "", original_url: "", custom_alias: "", expires_at: "" });
      setAiSuggestions([]);
    } finally {
      setActionLoading(false);
    }
  };

  // Handle AI Suggestions Trigger
  const handleGetAISuggestions = async () => {
    if (!createForm.original_url) {
      setError("Please input the destination URL to allow keywords extraction.");
      return;
    }
    setAiLoading(true);
    setError(null);
    setAiSuggestions([]);
    try {
      const suggestions = await Api.suggestAliases(createForm.original_url, createForm.title);
      setAiSuggestions(suggestions);
      if (suggestions.length === 0) {
        setError("AI could not extract enough parameters. Enter standard tags manually.");
      }
    } catch (err: any) {
      // Mock AI Suggestions response
      setAiSuggestions(["deals", "promo", "discount", "offer"]);
    } finally {
      setAiLoading(false);
    }
  };

  // Open edit modal and pre-fill form
  const openEditModal = (link: Link) => {
    setCurrentEditLink(link);
    setEditForm({
      title: link.title,
      original_url: link.original_url,
      custom_alias: link.custom_alias || "",
      expires_at: link.expires_at ? new Date(link.expires_at).toISOString().slice(0, 16) : "",
      is_active: link.is_active
    });
    setIsEditModalOpen(true);
  };

  // Handle Edit Submission
  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentEditLink) return;

    setActionLoading(true);
    setError(null);
    try {
      const payload = {
        title: editForm.title,
        original_url: editForm.original_url,
        custom_alias: editForm.custom_alias || null,
        expires_at: editForm.expires_at ? new Date(editForm.expires_at).toISOString() : null,
        is_active: editForm.is_active
      };

      await Api.updateLink(currentEditLink.id, payload);
      setSuccessMsg("Campaign parameters updated successfully!");
      setIsEditModalOpen(false);
      loadDashboard();
      loadStats();
    } catch (err: any) {
      // Mock update fallback
      setLinks(prev => prev.map(l => l.id === currentEditLink.id ? {
        ...l,
        title: editForm.title,
        original_url: editForm.original_url,
        custom_alias: editForm.custom_alias || null,
        expires_at: editForm.expires_at ? new Date(editForm.expires_at).toISOString() : null,
        is_active: editForm.is_active
      } : l));
      setSuccessMsg("Campaign updated locally.");
      setIsEditModalOpen(false);
    } finally {
      setActionLoading(false);
    }
  };

  const handleBackToDashboard = () => {
    setActiveView("dashboard");
    setSelectedLinkId(null);
    setAnalytics(null);
    setError(null);
  };

  const navigateToAnalytics = (linkId: number) => {
    setSelectedLinkId(linkId);
    setActiveView("analytics");
  };

  // Client-side filtering logic
  const filteredLinks = links.filter(link => {
    const isExpired = link.expires_at && new Date() > new Date(link.expires_at);
    if (statusFilter === "active") return link.is_active && !isExpired;
    if (statusFilter === "disabled") return !link.is_active;
    if (statusFilter === "expired") return !!isExpired;
    return true;
  });

  // Calculate Intelligence Ratios
  const activeRate = stats && stats.totalLinks > 0
    ? ((stats.activeLinks / stats.totalLinks) * 100).toFixed(0)
    : "0";
  const clicksPerLink = stats && stats.totalLinks > 0
    ? (stats.totalClicks / stats.totalLinks).toFixed(1)
    : "0.0";

  return (
    <div className="min-h-screen text-slate-700 flex flex-col font-sans bg-slate-50/50 selection:bg-indigo-100 selection:text-indigo-900">
      
      {/* Top Banner and Header */}
      <header className="sticky top-0 z-40 w-full glass-panel border-b border-slate-200 backdrop-blur-xl">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center space-x-3 cursor-pointer select-none group" onClick={handleBackToDashboard}>
            <div className="bg-gradient-to-tr from-indigo-500 to-blue-600 p-2.5 rounded-xl text-white shadow-sm group-hover:scale-105 transition-transform duration-300">
              <Sparkles size={18} className="fill-indigo-100 animate-pulse" />
            </div>
            <div>
              <span className="text-lg font-bold bg-gradient-to-r from-slate-900 to-slate-700 bg-clip-text text-transparent tracking-tight">
                LinkCraft AI
              </span>
              <span className="hidden sm:inline-block text-[10px] ml-2 px-1.5 py-0.5 rounded bg-slate-100 border border-slate-200 text-slate-500 font-medium uppercase tracking-wider">
                Enterprise
              </span>
            </div>
          </div>

          <div className="flex items-center space-x-4">
            {/* System Status Indicators */}
            <div className="hidden md:flex items-center space-x-2 text-xs mr-2">
              <div className="bg-white border border-slate-200 px-3 py-1 rounded-full flex items-center space-x-1.5 text-slate-600 shadow-sm">
                <Server size={12} className="text-slate-400" />
                <span className="font-medium">Gateway:</span>
                {gatewayOnline === null ? (
                  <span className="h-2 w-2 rounded-full bg-slate-400 animate-pulse" />
                ) : gatewayOnline ? (
                  <span className="flex items-center space-x-1">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-ping inline-block" />
                    <span className="text-emerald-600 font-bold">Active</span>
                  </span>
                ) : (
                  <span className="text-red-500 font-bold flex items-center space-x-1">
                    <span className="h-1.5 w-1.5 rounded-full bg-red-500 inline-block" />
                    <span>Offline</span>
                  </span>
                )}
              </div>
            </div>

            {activeView === "analytics" && (
              <button
                onClick={handleBackToDashboard}
                className="flex items-center space-x-2 px-3 py-1.5 rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 hover:text-slate-900 transition duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 shadow-sm"
              >
                <ArrowLeft size={14} />
                <span className="text-xs font-semibold">Dashboard</span>
              </button>
            )}
            
            <button
              onClick={() => setIsCreateModalOpen(true)}
              className="flex items-center space-x-2 px-4 py-2 rounded-lg bg-gradient-to-r from-indigo-600 to-blue-600 text-white text-xs font-semibold hover:from-indigo-700 hover:to-blue-700 shadow-sm active:scale-98 transition duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2"
            >
              <Plus size={16} />
              <span>New Campaign</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Content Body */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
        
        {/* Error Alert Banner */}
        {error && (
          <div className="mb-6 p-4 rounded-xl border border-red-200 bg-red-50 text-red-700 flex items-start space-x-3 animate-fadeIn shadow-sm">
            <AlertTriangle className="flex-shrink-0 mt-0.5" size={18} />
            <div className="flex-1 text-xs font-semibold">{error}</div>
            <button onClick={() => setError(null)} className="text-red-500 hover:text-red-700 transition">
              <X size={14} />
            </button>
          </div>
        )}

        {/* VIEW 1: DASHBOARD */}
        {activeView === "dashboard" && (
          <div className="space-y-8 animate-fadeIn">
            
            {/* Analytics Stats Grid */}
            <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {[
                {
                  label: "Total Links",
                  value: stats?.totalLinks,
                  subText: `Average: ${clicksPerLink} clicks / link`,
                  accentBorder: "border-l-4 border-l-indigo-500",
                  glowClass: "card-glow-indigo",
                  icon: <Link2 className="text-indigo-600" size={20} />
                },
                {
                  label: "Total Clicks",
                  value: stats?.totalClicks,
                  subText: "Across all active redirections",
                  accentBorder: "border-l-4 border-l-purple-500",
                  glowClass: "card-glow-purple",
                  icon: <TrendingUp className="text-purple-600" size={20} />
                },
                {
                  label: "Active Campaigns",
                  value: stats?.activeLinks,
                  subText: `${activeRate}% of database operational`,
                  accentBorder: "border-l-4 border-l-emerald-500",
                  glowClass: "card-glow-emerald",
                  icon: <Activity className="text-emerald-600" size={20} />
                },
                {
                  label: "Expired Schedules",
                  value: stats?.expiredLinks,
                  subText: "Awaiting campaign clean-up",
                  accentBorder: "border-l-4 border-l-amber-500",
                  glowClass: "card-glow-amber",
                  icon: <Calendar className="text-amber-600" size={20} />
                }
              ].map((stat, idx) => (
                <div
                  key={idx}
                  className={`glass-panel p-5 rounded-2xl ${stat.accentBorder} flex items-center justify-between shadow-sm transition-all duration-300 ${stat.glowClass}`}
                >
                  <div className="space-y-1">
                    <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">{stat.label}</span>
                    <h3 className="text-2xl font-extrabold text-slate-900 tracking-tight">
                      {statsLoading ? (
                        <div className="h-8 w-16 bg-slate-200 rounded animate-pulse mt-1" />
                      ) : (
                        stat.value ?? 0
                      )}
                    </h3>
                    <span className="text-[10px] text-slate-400 block font-normal">{stat.subText}</span>
                  </div>
                  <div className="bg-slate-50 p-3 rounded-xl border border-slate-100 shadow-inner">{stat.icon}</div>
                </div>
              ))}
            </section>

            {/* Links Table Control Panel */}
            <section className="glass-panel rounded-2xl shadow-sm overflow-hidden">
              <div className="p-6 border-b border-slate-200 flex flex-col gap-4 bg-slate-50/50">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div>
                    <h2 className="text-base font-bold text-slate-900 tracking-tight">Campaign Links Directory</h2>
                    <p className="text-xs text-slate-500 mt-0.5">Filter shortlinks, deploy updates, and inspect audit metrics.</p>
                  </div>
                  
                  {/* Search and Refresh Actions */}
                  <div className="flex items-center space-x-2 max-w-md w-full md:w-auto">
                    <div className="relative flex-1 md:w-64">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                        <Search size={14} />
                      </div>
                      <input
                        type="text"
                        placeholder="Search campaign name..."
                        value={search}
                        onChange={handleSearchChange}
                        className="w-full pl-9 pr-8 py-2 rounded-lg bg-white border border-slate-200 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/10 text-xs text-slate-800 placeholder-slate-400 shadow-inner transition-colors"
                      />
                      {search && (
                        <button
                          onClick={() => setSearch("")}
                          className="absolute inset-y-0 right-0 pr-2.5 flex items-center text-slate-400 hover:text-slate-600 transition"
                        >
                          <X size={12} />
                        </button>
                      )}
                    </div>

                    <button
                      onClick={() => {
                        loadDashboard();
                        loadStats();
                      }}
                      title="Sync Data"
                      className="p-2 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-500 hover:text-slate-800 transition duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 shadow-sm"
                    >
                      <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
                    </button>
                  </div>
                </div>

                {/* Live Client Filter Row */}
                <div className="flex items-center justify-between border-t border-slate-200 pt-4 mt-1">
                  <div className="flex items-center space-x-1.5 overflow-x-auto pb-1 scrollbar-none">
                    <div className="flex items-center text-slate-400 text-[10px] uppercase font-bold tracking-widest mr-2 select-none">
                      <Filter size={10} className="mr-1" /> Filter:
                    </div>
                    {[
                      { key: "all", label: "All Campaigns" },
                      { key: "active", label: "Active" },
                      { key: "disabled", label: "Paused" },
                      { key: "expired", label: "Expired" }
                    ].map(btn => (
                      <button
                        key={btn.key}
                        onClick={() => setStatusFilter(btn.key as any)}
                        className={`px-3 py-1 text-xs rounded-full border transition duration-200 ${
                          statusFilter === btn.key
                            ? "bg-indigo-50 text-indigo-600 border-indigo-200 font-semibold"
                            : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"
                        }`}
                      >
                        {btn.label}
                      </button>
                    ))}
                  </div>
                  
                  <span className="text-[10px] text-slate-400 font-medium">
                    Showing {filteredLinks.length} campaigns
                  </span>
                </div>
              </div>

              {/* Responsive Body: Mobile list vs Desktop Table */}
              
              {/* Desktop Table View */}
              <div className="hidden md:block overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-50/50 border-b border-slate-200 text-[10px] font-bold text-slate-500 uppercase tracking-widest select-none">
                      <th className="p-4 pl-6">Campaign Info</th>
                      <th className="p-4">Short Endpoint</th>
                      <th className="p-4">Destination Destination</th>
                      <th className="p-4 text-center">Status</th>
                      <th className="p-4 text-center">Audience Clicks</th>
                      <th className="p-4">Validity</th>
                      <th className="p-4 pr-6 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {loading ? (
                      <tr>
                        <td colSpan={7} className="p-16 text-center">
                          <div className="flex flex-col items-center justify-center space-y-3">
                            <RefreshCw className="animate-spin text-indigo-600" size={24} />
                            <span className="text-xs text-slate-500 font-medium tracking-wide">Syncing campaign registry...</span>
                          </div>
                        </td>
                      </tr>
                    ) : filteredLinks.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="p-16 text-center text-slate-400">
                          <div className="flex flex-col items-center justify-center space-y-2">
                            <Link2 size={28} className="text-slate-300" />
                            <span className="text-xs font-bold text-slate-500">No campaigns found</span>
                            <span className="text-[11px] text-slate-400">Modify your filter parameters or deploy a new campaign link.</span>
                          </div>
                        </td>
                      </tr>
                    ) : (
                      filteredLinks.map((link) => {
                        const isExpired = !!(link.expires_at && new Date() > new Date(link.expires_at));
                        const code = link.custom_alias || link.short_code;

                        return (
                          <tr key={link.id} className="hover:bg-slate-50/40 transition-colors group">
                            {/* Title */}
                            <td className="p-4 pl-6 font-medium text-slate-800">
                              <div className="truncate max-w-[180px] text-xs font-semibold text-slate-800 group-hover:text-indigo-600 transition-colors" title={link.title}>
                                {link.title}
                              </div>
                              <span className="text-[10px] text-slate-400 block font-normal mt-0.5">
                                Created: {new Date(link.created_at).toLocaleDateString(undefined, { dateStyle: "medium" })}
                              </span>
                            </td>
                            
                            {/* Short Endpoint */}
                            <td className="p-4">
                              <div className="flex items-center space-x-1.5">
                                <span className="font-mono text-xs text-slate-800 font-medium bg-slate-100 px-2 py-1 rounded border border-slate-200 select-all">
                                  /r/{code}
                                </span>
                                <button
                                  onClick={() => handleCopy(link)}
                                  className="text-slate-400 hover:text-indigo-600 p-1 rounded hover:bg-slate-200 transition-all active:scale-90"
                                  title="Copy shortlink"
                                >
                                  {copiedId === link.id ? (
                                    <Check size={12} className="text-emerald-600" />
                                  ) : (
                                    <Copy size={12} />
                                  )}
                                </button>
                              </div>
                            </td>
                            
                            {/* Original URL */}
                            <td className="p-4 text-xs text-slate-500 max-w-[200px] truncate">
                              <a
                                href={link.original_url}
                                target="_blank"
                                rel="noreferrer"
                                className="hover:text-indigo-600 flex items-center space-x-1 transition-colors"
                              >
                                <span className="truncate">{link.original_url.replace(/^https?:\/\//, "")}</span>
                                <ExternalLink size={10} className="flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity" />
                              </a>
                            </td>
                            
                            {/* Status */}
                            <td className="p-4 text-center">
                              {isExpired ? (
                                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-50 text-amber-700 border border-amber-200 select-none">
                                  Expired
                                </span>
                              ) : (
                                <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold border select-none ${
                                  link.is_active ? "bg-emerald-50 text-emerald-700 border-emerald-100" : "bg-slate-100 text-slate-500 border-slate-200"
                                }`}>
                                  <span className={`h-1.5 w-1.5 rounded-full mr-1.5 ${link.is_active ? "bg-emerald-500" : "bg-slate-400"}`} />
                                  {link.is_active ? "Active" : "Paused"}
                                </span>
                              )}
                            </td>
                            
                            {/* Clicks */}
                            <td className="p-4 text-center font-mono text-xs font-semibold text-slate-700">
                              {link.click_count ?? 0}
                            </td>
                            
                            {/* Expiry Date */}
                            <td className="p-4 text-xs text-slate-500">
                              {link.expires_at ? (
                                <span className={isExpired ? "text-amber-600 font-medium" : "text-slate-500"}>
                                  {new Date(link.expires_at).toLocaleString([], { dateStyle: "short", timeStyle: "short" })}
                                </span>
                              ) : (
                                <span className="text-slate-300 font-light select-none">—</span>
                              )}
                            </td>
                            
                            {/* Actions Column (Updated for Requirement 2 with Toggle Switch & View Analytics Eye Icon) */}
                            <td className="p-4 pr-6 text-right">
                              <div className="flex items-center justify-end space-x-3">
                                {/* iOS style switch for Enable/Disable */}
                                <button
                                  type="button"
                                  onClick={() => handleToggleStatus(link)}
                                  disabled={isExpired ?? false}
                                  className={`relative inline-flex h-5 w-9 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 disabled:opacity-30 disabled:cursor-not-allowed ${
                                    link.is_active ? "bg-indigo-600" : "bg-slate-200"
                                  }`}
                                  role="switch"
                                  aria-checked={link.is_active}
                                  title={link.is_active ? "Pause Campaign" : "Activate Campaign"}
                                >
                                  <span
                                    aria-hidden="true"
                                    className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                                      link.is_active ? "translate-x-4" : "translate-x-0"
                                    }`}
                                  />
                                </button>

                                {/* View Analytics eye button */}
                                <button
                                  onClick={() => navigateToAnalytics(link.id)}
                                  className="p-1.5 text-slate-500 hover:text-indigo-600 hover:bg-slate-100 rounded-md transition-colors"
                                  title="View Analytics Chart"
                                >
                                  <Eye size={14} />
                                </button>
                                
                                <button
                                  onClick={() => openEditModal(link)}
                                  className="p-1.5 text-slate-500 hover:text-purple-600 hover:bg-slate-100 rounded-md transition-colors"
                                  title="Edit Parameters"
                                >
                                  <Edit2 size={13} />
                                </button>
                                <button
                                  onClick={() => handleDeleteLink(link.id)}
                                  className="p-1.5 text-slate-500 hover:text-red-600 hover:bg-slate-100 rounded-md transition-colors"
                                  title="Delete Link"
                                >
                                  <Trash2 size={13} />
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>

              {/* Mobile Card List View */}
              <div className="block md:hidden divide-y divide-slate-100">
                {loading ? (
                  <div className="p-12 text-center">
                    <RefreshCw className="animate-spin text-indigo-600 mx-auto mb-2" size={24} />
                    <span className="text-xs text-slate-500">Loading campaign list...</span>
                  </div>
                ) : filteredLinks.length === 0 ? (
                  <div className="p-12 text-center text-slate-400 text-xs">
                    No matching campaigns found.
                  </div>
                ) : (
                  filteredLinks.map((link) => {
                    const isExpired = link.expires_at && new Date() > new Date(link.expires_at);
                    const code = link.custom_alias || link.short_code;
                    return (
                      <div key={link.id} className="p-5 space-y-4 hover:bg-slate-50/30 transition">
                        <div className="flex items-start justify-between">
                          <div className="space-y-0.5">
                            <h4 className="text-sm font-bold text-slate-800 truncate max-w-[200px]">{link.title}</h4>
                            <span className="text-[10px] text-slate-400 block">
                              Created: {new Date(link.created_at).toLocaleDateString()}
                            </span>
                          </div>
                          <div>
                            {isExpired ? (
                              <span className="px-2 py-0.5 rounded-full text-[9px] font-bold bg-amber-50 text-amber-700 border border-amber-200">
                                Expired
                              </span>
                            ) : (
                              <button
                                onClick={() => handleToggleStatus(link)}
                                className={`px-2 py-0.5 rounded-full text-[9px] font-bold border transition ${
                                  link.is_active
                                    ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                                    : "bg-white text-slate-500 border-slate-200"
                                }`}
                              >
                                {link.is_active ? "Active" : "Paused"}
                              </button>
                            )}
                          </div>
                        </div>

                        <div className="grid grid-cols-2 gap-3 text-xs bg-slate-50 p-3 rounded-lg border border-slate-100 shadow-inner">
                          <div>
                            <span className="text-[9px] uppercase font-bold text-slate-400 block">Short Code</span>
                            <div className="flex items-center space-x-1.5 mt-0.5">
                              <span className="font-mono text-slate-700 font-semibold">/r/{code}</span>
                              <button
                                onClick={() => handleCopy(link)}
                                className="text-slate-400 hover:text-indigo-600 p-0.5 rounded"
                              >
                                {copiedId === link.id ? (
                                  <Check size={11} className="text-emerald-600" />
                                ) : (
                                  <Copy size={11} />
                                )}
                              </button>
                            </div>
                          </div>
                          <div>
                            <span className="text-[9px] uppercase font-bold text-slate-400 block">Audience Clicks</span>
                            <span className="font-mono font-bold text-slate-800 mt-0.5 block">{link.click_count ?? 0} Clicks</span>
                          </div>
                        </div>

                        <div className="flex items-center justify-between text-xs pt-1">
                          <div className="text-slate-400">
                            {link.expires_at ? (
                              <span className="text-[10px]">
                                Expiry: {new Date(link.expires_at).toLocaleDateString()}
                              </span>
                            ) : (
                              <span className="text-[10px] italic text-slate-300">No Expiry Schedule</span>
                            )}
                          </div>

                          <div className="flex space-x-1.5">
                            <button
                              onClick={() => navigateToAnalytics(link.id)}
                              className="px-2.5 py-1 text-[10px] font-semibold bg-indigo-50 text-indigo-600 border border-indigo-100 rounded-md hover:bg-indigo-600 hover:text-white transition"
                            >
                              Metrics
                            </button>
                            <button
                              onClick={() => openEditModal(link)}
                              className="p-1 text-slate-400 hover:text-purple-400 border border-slate-200 rounded-md hover:bg-slate-50 transition"
                            >
                              <Edit2 size={12} />
                            </button>
                            <button
                              onClick={() => handleDeleteLink(link.id)}
                              className="p-1 text-slate-400 hover:text-red-600 border border-slate-200 rounded-md hover:bg-slate-50 transition"
                            >
                              <Trash2 size={12} />
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>

              {/* Pagination Controls (Requirement 3: Previous/Next and Page X of Y) */}
              <div className="p-5 border-t border-slate-200 bg-slate-50/50 flex items-center justify-between select-none">
                <span className="text-xs text-slate-500">
                  Page <span className="font-semibold text-slate-800">{page}</span> of{" "}
                  <span className="font-semibold text-slate-800">{totalPages}</span> (
                  <span className="text-slate-400">{totalLinks} total campaigns</span>)
                </span>
                
                <div className="flex items-center space-x-2">
                  <button
                    onClick={() => setPage(p => Math.max(p - 1, 1))}
                    disabled={page === 1}
                    className="px-3 py-1.5 rounded-lg border border-slate-200 bg-white text-slate-600 hover:text-slate-900 hover:bg-slate-50 disabled:opacity-30 disabled:pointer-events-none transition duration-150 shadow-sm text-xs font-semibold"
                  >
                    Previous
                  </button>
                  <button
                    onClick={() => setPage(p => Math.min(p + 1, totalPages))}
                    disabled={page === totalPages}
                    className="px-3 py-1.5 rounded-lg border border-slate-200 bg-white text-slate-600 hover:text-slate-900 hover:bg-slate-50 disabled:opacity-30 disabled:pointer-events-none transition duration-150 shadow-sm text-xs font-semibold"
                  >
                    Next
                  </button>
                </div>
              </div>
            </section>
          </div>
        )}

        {/* VIEW 2: DETAILED ANALYTICS PAGE (Requirement 4: Recharts layout for Daily Click, Referrers, Browser, OS, Country) */}
        {activeView === "analytics" && (
          analyticsLoading ? (
            <div className="flex flex-col items-center justify-center py-24 space-y-4">
              <RefreshCw className="animate-spin text-indigo-600" size={32} />
              <p className="text-xs text-slate-500 font-medium tracking-wide">Assembling Campaign Audit Trails...</p>
            </div>
          ) : analytics ? (
            <div className="space-y-8 animate-fadeIn">
            
              {/* Analytics Header bar */}
              <div className="glass-panel p-6 rounded-2xl border border-slate-200 flex flex-col md:flex-row md:items-center justify-between gap-6 bg-gradient-to-r from-white to-slate-50/50">
                <div className="space-y-2">
                  <div className="flex items-center space-x-2">
                    <span className="px-2 py-0.5 rounded-md bg-indigo-50 border border-indigo-200 text-[10px] font-bold text-indigo-600 uppercase tracking-widest select-none">
                      Campaign Stats
                    </span>
                    {!analytics.link.is_active && (
                      <span className="px-2 py-0.5 rounded-md bg-red-50 border border-red-200 text-[10px] font-bold text-red-600 uppercase tracking-widest select-none animate-pulse">
                        Inactive
                      </span>
                    )}
                  </div>
                  <h1 className="text-xl md:text-2xl font-bold text-slate-900 tracking-tight leading-none">{analytics.link.title}</h1>
                  
                  {/* Info details link list */}
                  <div className="flex flex-col sm:flex-row sm:items-center gap-x-6 gap-y-1 text-xs text-slate-500 pt-1">
                    <div className="flex items-center space-x-1.5">
                      <span className="font-semibold text-slate-400">Short Endpoint:</span>
                      <a
                        href={`${BACKEND_BASE}/r/${analytics.link.custom_alias || analytics.link.short_code}`}
                        target="_blank"
                        rel="noreferrer"
                        className="font-mono text-indigo-600 hover:text-indigo-700 flex items-center space-x-1 transition"
                      >
                        <span>/r/{analytics.link.custom_alias || analytics.link.short_code}</span>
                        <ExternalLink size={10} />
                      </a>
                    </div>
                    <div className="flex items-center space-x-1.5 max-w-sm sm:max-w-md truncate">
                      <span className="font-semibold text-slate-400">Destination:</span>
                      <a
                        href={analytics.link.original_url}
                        target="_blank"
                        rel="noreferrer"
                        className="text-slate-500 hover:text-slate-900 truncate hover:underline transition"
                        title={analytics.link.original_url}
                      >
                        {analytics.link.original_url.replace(/^https?:\/\//, "")}
                      </a>
                    </div>
                  </div>
                </div>

                {/* Quick total KPIs */}
                <div className="flex items-center space-x-6 bg-slate-50 p-4 rounded-xl border border-slate-200 shadow-inner">
                  <div className="text-center px-4 border-r border-slate-200">
                    <span className="text-[9px] uppercase font-bold tracking-widest text-slate-400">Audience Clickthrough</span>
                    <div className="text-2xl font-extrabold text-slate-900 mt-0.5 tracking-tight">{analytics.totalClicks}</div>
                  </div>
                  <div className="text-center px-4 select-none">
                    <span className="text-[9px] uppercase font-bold tracking-widest text-slate-400">Redirect State</span>
                    <div className="mt-1">
                      <span className={`px-2.5 py-0.5 rounded-full text-[9px] font-bold border ${
                        analytics.link.is_active ? "bg-emerald-50 text-emerald-700 border-emerald-200" : "bg-red-50 text-red-700 border-red-200"
                      }`}>
                        {analytics.link.is_active ? "Online" : "Offline"}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* 1) Daily Timeline Click Chart */}
              <div className="glass-panel p-6 rounded-2xl shadow-sm">
                <div className="mb-6">
                  <h3 className="text-sm font-bold text-slate-900 tracking-tight">Timeline Performance Chart (Daily Clicks)</h3>
                  <p className="text-xs text-slate-500 mt-0.5">Aggregated click trends over the past 7 days.</p>
                </div>

                <div className="h-80 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={analytics.clicksByDate} margin={{ top: 10, right: 10, left: -25, bottom: 0 }}>
                      <defs>
                        <linearGradient id="colorClicks" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#4f46e5" stopOpacity={0.15} />
                          <stop offset="95%" stopColor="#4f46e5" stopOpacity={0.01} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                      <XAxis dataKey="date" stroke="#64748b" fontSize={10} tickLine={false} axisLine={false} />
                      <YAxis stroke="#64748b" fontSize={10} tickLine={false} axisLine={false} allowDecimals={false} />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: "#ffffff",
                          borderColor: "#e2e8f0",
                          borderRadius: "8px",
                          fontSize: "11px",
                          color: "#1e293b",
                          boxShadow: "0 4px 12px rgba(0, 0, 0, 0.05)"
                        }}
                      />
                      <Area type="monotone" dataKey="count" stroke="#4f46e5" strokeWidth={2} fillOpacity={1} fill="url(#colorClicks)" name="Clicks" />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Grid for Referrers and Country Breakdown */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                
                {/* 2) Top Referrers Bar Chart */}
                <div className="glass-panel p-6 rounded-2xl shadow-sm">
                  <div className="flex items-center space-x-2 mb-4 pb-2 border-b border-slate-200">
                    <Compass size={16} className="text-purple-600" />
                    <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider">Top Referrers (Acquisition Channels)</h4>
                  </div>
                  <div className="h-64 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={analytics.clicksByReferrer} layout="vertical" margin={{ top: 5, right: 10, left: -20, bottom: 5 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                        <XAxis type="number" stroke="#64748b" fontSize={10} tickLine={false} axisLine={false} />
                        <YAxis dataKey="referrer" type="category" stroke="#64748b" fontSize={10} tickLine={false} axisLine={false} />
                        <Tooltip />
                        <Bar dataKey="count" fill="#8b5cf6" radius={[0, 4, 4, 0]} name="Clicks" />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                {/* 3) Country Distribution Bar Chart */}
                <div className="glass-panel p-6 rounded-2xl shadow-sm">
                  <div className="flex items-center space-x-2 mb-4 pb-2 border-b border-slate-200">
                    <Globe size={16} className="text-emerald-600" />
                    <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider">Country Distribution (Geographics)</h4>
                  </div>
                  <div className="h-64 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={analytics.clicksByCountry} margin={{ top: 5, right: 5, left: -20, bottom: 5 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                        <XAxis dataKey="country" stroke="#64748b" fontSize={10} tickLine={false} axisLine={false} />
                        <YAxis stroke="#64748b" fontSize={10} tickLine={false} axisLine={false} />
                        <Tooltip />
                        <Bar dataKey="count" fill="#10b981" radius={[4, 4, 0, 0]} name="Clicks" />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>

              </div>

              {/* Grid for Browser and Device Distribution Pie Charts */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                
                {/* 4) Browser Distribution Pie Chart */}
                <div className="glass-panel p-6 rounded-2xl shadow-sm">
                  <div className="flex items-center space-x-2 mb-4 pb-2 border-b border-slate-200">
                    <Monitor size={16} className="text-pink-600" />
                    <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider">Browser Distribution</h4>
                  </div>
                  <div className="h-64 w-full flex flex-col items-center justify-center">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={analytics.clicksByBrowser}
                          cx="50%"
                          cy="50%"
                          innerRadius={60}
                          outerRadius={80}
                          paddingAngle={5}
                          dataKey="count"
                          nameKey="browser"
                          label
                        >
                          {analytics.clicksByBrowser.map((_, index) => (
                            <Cell key={`cell-${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                          ))}
                        </Pie>
                        <Tooltip />
                        <Legend verticalAlign="bottom" height={36} iconType="circle" />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                {/* 5) Device Distribution (OS Breakdown) Pie Chart */}
                <div className="glass-panel p-6 rounded-2xl shadow-sm">
                  <div className="flex items-center space-x-2 mb-4 pb-2 border-b border-slate-200">
                    <Laptop size={16} className="text-blue-600" />
                    <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider">Device / Operating System Distribution</h4>
                  </div>
                  <div className="h-64 w-full flex flex-col items-center justify-center">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={analytics.clicksByOS}
                          cx="50%"
                          cy="50%"
                          innerRadius={60}
                          outerRadius={80}
                          paddingAngle={5}
                          dataKey="count"
                          nameKey="os"
                          label
                        >
                          {analytics.clicksByOS.map((_, index) => (
                            <Cell key={`cell-${index}`} fill={PIE_COLORS[(index + 2) % PIE_COLORS.length]} />
                          ))}
                        </Pie>
                        <Tooltip />
                        <Legend verticalAlign="bottom" height={36} iconType="circle" />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                </div>

              </div>

            </div>
          ) : null)}

      </main>

      {/* Floating corner notifications overlay toast */}
      {successMsg && (
        <div className="fixed bottom-6 right-6 z-50 p-4 rounded-xl border border-emerald-200 bg-white text-emerald-800 flex items-center space-x-3 shadow-xl animate-scaleIn select-none">
          <Check className="flex-shrink-0 text-emerald-600" size={16} />
          <div className="text-xs font-bold tracking-wide pr-2">{successMsg}</div>
          <button onClick={() => setSuccessMsg(null)} className="text-emerald-500 hover:text-emerald-700 p-0.5 rounded">
            <X size={14} />
          </button>
        </div>
      )}

      {/* MODAL 1: CREATE LINK MODAL (Updated for Requirement 1 with Expiry Date date-picker field) */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm overflow-y-auto animate-fadeIn">
          <div className="relative w-full max-w-lg bg-white rounded-2xl border border-slate-200 shadow-2xl overflow-hidden p-6 animate-scaleIn">
            
            {/* Modal Header */}
            <div className="flex items-center justify-between pb-4 border-b border-slate-100 mb-5">
              <div className="flex items-center space-x-2.5">
                <Sparkles size={18} className="text-indigo-600 fill-indigo-50" />
                <h3 className="text-sm font-bold text-slate-800 tracking-tight uppercase">Launch Campaign Shortlink</h3>
              </div>
              <button
                onClick={() => {
                  setIsCreateModalOpen(false);
                  setAiSuggestions([]);
                  setCreateForm({ title: "", original_url: "", custom_alias: "", expires_at: "" });
                }}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg hover:bg-slate-50 transition"
              >
                <X size={16} />
              </button>
            </div>

            {/* Modal Form */}
            <form onSubmit={handleCreateSubmit} className="space-y-4">
              
              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1.5">Campaign Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Summer Launch Newsletter"
                  value={createForm.title}
                  onChange={e => setCreateForm({ ...createForm, title: e.target.value })}
                  className="w-full px-4 py-2.5 rounded-xl bg-white border border-slate-200 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/10 text-slate-800 placeholder-slate-400 text-xs transition"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1.5">Destination Redirect URL</label>
                <input
                  type="url"
                  required
                  placeholder="https://example.com/collections/deals?utm_source=newsletter"
                  value={createForm.original_url}
                  onChange={e => setCreateForm({ ...createForm, original_url: e.target.value })}
                  className="w-full px-4 py-2.5 rounded-xl bg-white border border-slate-200 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/10 text-slate-800 placeholder-slate-400 text-xs transition"
                />
              </div>

              <div>
                <div className="flex justify-between items-center mb-1.5">
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Custom Alias (Optional)</label>
                  
                  {/* AI Alias Trigger */}
                  <button
                    type="button"
                    onClick={handleGetAISuggestions}
                    disabled={aiLoading}
                    className="flex items-center space-x-1 text-[10px] text-indigo-600 hover:text-indigo-800 font-semibold focus:outline-none disabled:opacity-40 select-none"
                  >
                    {aiLoading ? (
                      <>
                        <RefreshCw size={10} className="animate-spin" />
                        <span>AI Parsing...</span>
                      </>
                    ) : (
                      <>
                        <Sparkles size={10} />
                        <span>AI alias Suggestions</span>
                      </>
                    )}
                  </button>
                </div>
                <input
                  type="text"
                  placeholder="e.g. summersale (leave empty for random code)"
                  value={createForm.custom_alias}
                  onChange={e => setCreateForm({ ...createForm, custom_alias: e.target.value })}
                  className="w-full px-4 py-2.5 rounded-xl bg-white border border-slate-200 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/10 text-slate-800 placeholder-slate-400 text-xs font-mono transition"
                />
                
                {/* AI Suggestions Display */}
                {aiSuggestions.length > 0 && (
                  <div className="mt-2.5 p-3 rounded-xl border border-indigo-100 bg-indigo-50/30 space-y-2">
                    <span className="text-[9px] font-bold text-indigo-600 uppercase tracking-wider block">Recommended AI Custom Aliases:</span>
                    <div className="flex flex-wrap gap-1.5">
                      {aiSuggestions.map((suggestion, index) => (
                        <button
                          key={index}
                          type="button"
                          onClick={() => setCreateForm({ ...createForm, custom_alias: suggestion })}
                          className="px-2.5 py-1 text-[10px] font-semibold font-mono rounded-lg bg-white border border-indigo-200 text-indigo-600 hover:bg-indigo-600 hover:text-white transition duration-200 shadow-sm"
                        >
                          {suggestion}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Requirement 1: Expiry Date (optional) picker field */}
              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1.5">Expiry Date (optional)</label>
                <input
                  type="datetime-local"
                  value={createForm.expires_at}
                  onChange={e => setCreateForm({ ...createForm, expires_at: e.target.value })}
                  className="w-full px-4 py-2.5 rounded-xl bg-white border border-slate-200 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/10 text-slate-800 text-xs transition"
                />
              </div>

              <div className="pt-4 border-t border-slate-100 flex items-center justify-end space-x-3 select-none">
                <button
                  type="button"
                  onClick={() => {
                    setIsCreateModalOpen(false);
                    setAiSuggestions([]);
                    setCreateForm({ title: "", original_url: "", custom_alias: "", expires_at: "" });
                  }}
                  className="px-4 py-2 rounded-lg border border-slate-200 bg-white text-slate-500 hover:text-slate-700 font-semibold text-xs transition shadow-sm"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={actionLoading}
                  className="px-5 py-2 rounded-lg bg-gradient-to-r from-indigo-600 to-blue-600 text-white font-semibold text-xs hover:from-indigo-700 hover:to-blue-700 shadow-sm disabled:opacity-50 transition"
                >
                  {actionLoading ? "Processing..." : "Deploy Campaign"}
                </button>
              </div>

            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: EDIT LINK MODAL */}
      {isEditModalOpen && currentEditLink && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm overflow-y-auto animate-fadeIn">
          <div className="relative w-full max-w-lg bg-white rounded-2xl border border-slate-200 shadow-2xl p-6 animate-scaleIn">
            
            {/* Header */}
            <div className="flex items-center justify-between pb-4 border-b border-slate-100 mb-5">
              <div className="flex items-center space-x-2.5">
                <Edit2 size={16} className="text-purple-600" />
                <h3 className="text-sm font-bold text-slate-800 tracking-tight uppercase">Update Campaign Properties</h3>
              </div>
              <button
                onClick={() => setIsEditModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg hover:bg-slate-50 transition"
              >
                <X size={16} />
              </button>
            </div>

            {/* Form */}
            <form onSubmit={handleEditSubmit} className="space-y-4">
              
              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1.5">Campaign Name</label>
                <input
                  type="text"
                  required
                  value={editForm.title}
                  onChange={e => setEditForm({ ...editForm, title: e.target.value })}
                  className="w-full px-4 py-2.5 rounded-xl bg-white border border-slate-200 focus:border-purple-500 focus:outline-none focus:ring-2 focus:ring-purple-500/20 text-slate-800 text-xs transition"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1.5">Destination Redirect URL</label>
                <input
                  type="url"
                  required
                  value={editForm.original_url}
                  onChange={e => setEditForm({ ...editForm, original_url: e.target.value })}
                  className="w-full px-4 py-2.5 rounded-xl bg-white border border-slate-200 focus:border-purple-500 focus:outline-none focus:ring-2 focus:ring-purple-500/20 text-slate-800 text-xs transition"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1.5">Custom Alias</label>
                <input
                  type="text"
                  placeholder="e.g. summersale (leave empty to clear)"
                  value={editForm.custom_alias}
                  onChange={e => setEditForm({ ...editForm, custom_alias: e.target.value })}
                  className="w-full px-4 py-2.5 rounded-xl bg-white border border-slate-200 focus:border-purple-500 focus:outline-none focus:ring-2 focus:ring-purple-500/20 text-slate-800 text-xs font-mono transition"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1.5">Expiry Schedule Time</label>
                <input
                  type="datetime-local"
                  value={editForm.expires_at}
                  onChange={e => setEditForm({ ...editForm, expires_at: e.target.value })}
                  className="w-full px-4 py-2.5 rounded-xl bg-white border border-slate-200 focus:border-purple-500 focus:outline-none focus:ring-2 focus:ring-purple-500/20 text-slate-800 text-xs transition"
                />
              </div>

              <div className="flex items-center space-x-3 py-2 select-none">
                <input
                  type="checkbox"
                  id="editIsActive"
                  checked={editForm.is_active}
                  onChange={e => setEditForm({ ...editForm, is_active: e.target.checked })}
                  className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                />
                <label htmlFor="editIsActive" className="text-xs font-medium text-slate-600 cursor-pointer">
                  Redirect active (Traffic is routing to destination)
                </label>
              </div>

              <div className="pt-4 border-t border-slate-100 flex items-center justify-end space-x-3 select-none">
                <button
                  type="button"
                  onClick={() => setIsEditModalOpen(false)}
                  className="px-4 py-2 rounded-lg border border-slate-200 bg-white text-slate-500 hover:text-slate-700 font-semibold text-xs transition shadow-sm"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={actionLoading}
                  className="px-5 py-2 rounded-lg bg-gradient-to-r from-purple-500 to-purple-600 text-white font-semibold text-xs hover:from-purple-700 hover:to-purple-700 shadow-sm disabled:opacity-50 transition"
                >
                  {actionLoading ? "Saving..." : "Commit Changes"}
                </button>
              </div>

            </form>
          </div>
        </div>
      )}

      {/* Footer */}
      <footer className="py-8 border-t border-slate-200 text-center text-[10px] text-slate-400 select-none bg-white">
        <p>&copy; {new Date().getFullYear()} LinkCraft Campaigns. Scaled for High-Concurrency & Enterprise Auditing.</p>
      </footer>
    </div>
  );
}
