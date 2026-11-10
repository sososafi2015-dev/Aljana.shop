import React, { useState, useEffect, useMemo } from 'react';
import {
  Megaphone,
  Sparkles,
  Search,
  Plus,
  Calendar,
  Clock,
  CheckCircle2,
  AlertCircle,
  XCircle,
  Edit3,
  Trash2,
  Power,
  RefreshCw,
  ExternalLink,
  ArrowUpDown,
  Building2,
  TrendingUp,
  Info,
  Check,
  X,
  Sliders,
  Eye,
  MapPin,
  ChevronDown,
  FileText
} from 'lucide-react';
import { PlatformAdCampaign, AdCampaignStatus, AssociationTenant, AdCampaignRequest } from '../types';
import {
  getAllAdCampaigns,
  saveAdCampaign,
  deleteAdCampaign,
  toggleAdCampaignStatus,
  fetchAdCampaignsFromServer,
  getAdCampaignStatus,
  getCampaignTimeRemaining,
  AD_CAMPAIGNS_EVENT,
  getAllAdCampaignRequests,
  AD_CAMPAIGN_REQUESTS_EVENT,
} from '../adCampaignStorage';
import { getAllTenants, MASTER_TEMPLATE_TENANT_ID } from '../tenantStorage';
import { CampaignLaunchRequestsAdmin } from './CampaignLaunchRequestsAdmin';

interface PlatformAdCampaignsAdminProps {
  onShowToast: (msg: string, type: 'success' | 'error' | 'info') => void;
  onPreviewTenant?: (tenantId: string) => void;
  canApprove?: boolean;
}

// Helper to convert Date to YYYY-MM-DDTHH:mm format for input[type="datetime-local"]
function toDatetimeLocalString(date: Date): string {
  const pad = (n: number) => (n < 10 ? `0${n}` : `${n}`);
  const year = date.getFullYear();
  const month = pad(date.getMonth() + 1);
  const day = pad(date.getDate());
  const hours = pad(date.getHours());
  const minutes = pad(date.getMinutes());
  return `${year}-${month}-${day}T${hours}:${minutes}`;
}

// Helper to format ISO or datetime-local string to Arabic display
function formatArabicDateTime(dateStr: string): string {
  if (!dateStr) return '—';
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    return d.toLocaleString('ar-MA', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return dateStr;
  }
}

export const PlatformAdCampaignsAdmin: React.FC<PlatformAdCampaignsAdminProps> = ({
  onShowToast,
  onPreviewTenant,
  canApprove = true,
}) => {
  const [campaigns, setCampaigns] = useState<PlatformAdCampaign[]>(getAllAdCampaigns);
  const [requests, setRequests] = useState<AdCampaignRequest[]>(getAllAdCampaignRequests);
  const [tenants, setTenants] = useState<AssociationTenant[]>(getAllTenants);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [activeSubTab, setActiveSubTab] = useState<'launch_requests' | 'active_campaigns'>('launch_requests');

  // Search and Filter states
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'scheduled' | 'expired' | 'disabled'>('all');
  const [sortBy, setSortBy] = useState<'priority' | 'startDate' | 'endDate' | 'newest'>('priority');

  // Create / Edit Modal state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingCampaignId, setEditingCampaignId] = useState<string | null>(null);
  const [selectedTenantId, setSelectedTenantId] = useState<string>('');
  const [modalCountry, setModalCountry] = useState<string>('all');
  const [modalCity, setModalCity] = useState<string>('all');
  const [priorityOrder, setPriorityOrder] = useState<number>(1);
  const [startDateStr, setStartDateStr] = useState<string>('');
  const [endDateStr, setEndDateStr] = useState<string>('');
  const [campaignTitle, setCampaignTitle] = useState<string>('');
  const [campaignNotes, setCampaignNotes] = useState<string>('');
  const [isEnabled, setIsEnabled] = useState<boolean>(true);
  const [formError, setFormError] = useState<string | null>(null);

  // Delete Confirmation state
  const [deletingCampaign, setDeletingCampaign] = useState<PlatformAdCampaign | null>(null);

  // Live clock tick to update remaining times every 30s
  const [currentTick, setCurrentTick] = useState<Date>(new Date());
  useEffect(() => {
    const timer = setInterval(() => setCurrentTick(new Date()), 30000);
    return () => clearInterval(timer);
  }, []);

  // Listen to changes in campaigns and tenants
  useEffect(() => {
    const handleCampaignsChange = (e: any) => {
      if (e?.detail?.campaigns) {
        setCampaigns(e.detail.campaigns);
      } else {
        setCampaigns(getAllAdCampaigns());
      }
    };

    const handleTenantsChange = () => {
      setTenants(getAllTenants());
    };

    const handleRequestsChange = (e: any) => {
      if (e?.detail?.requests) {
        setRequests(e.detail.requests);
      } else {
        setRequests(getAllAdCampaignRequests());
      }
    };

    window.addEventListener(AD_CAMPAIGNS_EVENT, handleCampaignsChange as EventListener);
    window.addEventListener(AD_CAMPAIGN_REQUESTS_EVENT, handleRequestsChange as EventListener);
    window.addEventListener('chayef-tenants-changed', handleTenantsChange);

    // Initial server fetch to ensure persistent DB sync
    fetchAdCampaignsFromServer().then((data) => {
      setCampaigns(data);
    });

    return () => {
      window.removeEventListener(AD_CAMPAIGNS_EVENT, handleCampaignsChange as EventListener);
      window.removeEventListener(AD_CAMPAIGN_REQUESTS_EVENT, handleRequestsChange as EventListener);
      window.removeEventListener('chayef-tenants-changed', handleTenantsChange);
    };
  }, []);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      const data = await fetchAdCampaignsFromServer();
      setCampaigns(data);
      setTenants(getAllTenants());
      onShowToast('تم تحديث قائمة الحملات الإعلانية بنجاح', 'success');
    } catch {
      onShowToast('تعذر تحديث البيانات من الخادم', 'error');
    } finally {
      setIsRefreshing(false);
    }
  };

  // Available countries derived dynamically from all tenants
  const modalAvailableCountries = useMemo(() => {
    const set = new Set<string>();
    tenants.forEach((t) => {
      if (t.country && t.country.trim()) {
        set.add(t.country.trim());
      }
    });
    const list = Array.from(set);
    list.sort((a, b) => {
      if (a === 'المغرب') return -1;
      if (b === 'المغرب') return 1;
      return a.localeCompare(b, 'ar');
    });
    return list;
  }, [tenants]);

  // Available cities derived dynamically from tenants matching chosen country
  const modalAvailableCities = useMemo(() => {
    const set = new Set<string>();
    tenants
      .filter((t) => modalCountry === 'all' || t.country === modalCountry)
      .forEach((t) => {
        if (t.city && t.city.trim()) {
          set.add(t.city.trim());
        }
      });
    return Array.from(set).sort((a, b) => a.localeCompare(b, 'ar'));
  }, [tenants, modalCountry]);

  // Filtered tenants for the modal based on Country and City filters
  const modalFilteredTenants = useMemo(() => {
    return tenants.filter((t) => {
      if (modalCountry !== 'all' && t.country !== modalCountry) {
        return false;
      }
      if (modalCity !== 'all' && t.city !== modalCity) {
        return false;
      }
      return true;
    });
  }, [tenants, modalCountry, modalCity]);

  // Handle Country Filter Change in Modal
  const handleModalCountryChange = (country: string) => {
    setModalCountry(country);
    setModalCity('all');
    
    // Automatically select the first association that matches the new country filter
    const matching = tenants.filter((t) => (country === 'all' || t.country === country));
    if (matching.length > 0) {
      if (!matching.some((t) => t.id === selectedTenantId)) {
        setSelectedTenantId(matching[0].id);
      }
    } else {
      setSelectedTenantId('');
    }
  };

  // Handle City Filter Change in Modal
  const handleModalCityChange = (city: string) => {
    setModalCity(city);

    // Automatically select the first association that matches the new country & city filter
    const matching = tenants.filter(
      (t) => (modalCountry === 'all' || t.country === modalCountry) && (city === 'all' || t.city === city)
    );
    if (matching.length > 0) {
      if (!matching.some((t) => t.id === selectedTenantId)) {
        setSelectedTenantId(matching[0].id);
      }
    } else {
      setSelectedTenantId('');
    }
  };

  // Open Create Modal
  const handleOpenCreate = () => {
    setEditingCampaignId(null);
    setModalCountry('all');
    setModalCity('all');
    const firstTenant = tenants[0]?.id || MASTER_TEMPLATE_TENANT_ID;
    setSelectedTenantId(firstTenant);

    // Default priority: next available rank or 1
    const maxPriority = campaigns.reduce((max, c) => Math.max(max, c.priorityOrder || 0), 0);
    setPriorityOrder(maxPriority > 0 ? maxPriority + 1 : 1);

    const now = new Date();
    const future = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000); // 14 days default

    setStartDateStr(toDatetimeLocalString(now));
    setEndDateStr(toDatetimeLocalString(future));
    setCampaignTitle('');
    setCampaignNotes('');
    setIsEnabled(true);
    setFormError(null);
    setIsModalOpen(true);
  };

  // Open Edit Modal
  const handleOpenEdit = (campaign: PlatformAdCampaign) => {
    setEditingCampaignId(campaign.id);
    const matchedTenant = tenants.find((t) => t.id === campaign.tenantId);
    if (matchedTenant) {
      setModalCountry(matchedTenant.country || 'all');
      setModalCity(matchedTenant.city || 'all');
    } else {
      setModalCountry('all');
      setModalCity('all');
    }
    setSelectedTenantId(campaign.tenantId);
    setPriorityOrder(campaign.priorityOrder || 1);
    
    try {
      setStartDateStr(toDatetimeLocalString(new Date(campaign.startDate)));
    } catch {
      setStartDateStr(campaign.startDate);
    }

    try {
      setEndDateStr(toDatetimeLocalString(new Date(campaign.endDate)));
    } catch {
      setEndDateStr(campaign.endDate);
    }

    setCampaignTitle(campaign.title || '');
    setCampaignNotes(campaign.notes || '');
    setIsEnabled(campaign.enabled !== false);
    setFormError(null);
    setIsModalOpen(true);
  };

  // Save Modal (Create / Edit)
  const handleSaveCampaign = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (!selectedTenantId) {
      setFormError('يرجى اختيار الجمعية المراد ترويجها');
      return;
    }

    if (!startDateStr || !endDateStr) {
      setFormError('يرجى تحديد تاريخ ووقت البداية وتاريخ ووقت النهاية');
      return;
    }

    const startTs = new Date(startDateStr).getTime();
    const endTs = new Date(endDateStr).getTime();

    if (isNaN(startTs) || isNaN(endTs)) {
      setFormError('صيغة التاريخ والوقت غير صحيحة');
      return;
    }

    if (endTs <= startTs) {
      setFormError('يجب أن يكون تاريخ ووقت نهاية الحملة بعد تاريخ ووقت البداية');
      return;
    }

    if (!priorityOrder || priorityOrder < 1) {
      setFormError('يجب أن يكون ترتيب الظهور رقمًا موجبًا (1، 2، 3...)');
      return;
    }

    const matchedTenant = tenants.find((t) => t.id === selectedTenantId);

    try {
      const saved = saveAdCampaign({
        id: editingCampaignId || undefined,
        tenantId: selectedTenantId,
        tenantName: matchedTenant?.name || 'جمعية',
        tenantSlug: matchedTenant?.slug,
        tenantLogoUrl: matchedTenant?.logoUrl,
        tenantCity: matchedTenant?.city,
        tenantCountry: matchedTenant?.country,
        priorityOrder: Number(priorityOrder),
        startDate: new Date(startDateStr).toISOString(),
        endDate: new Date(endDateStr).toISOString(),
        title: campaignTitle.trim(),
        notes: campaignNotes.trim(),
        enabled: isEnabled,
      });

      setCampaigns(getAllAdCampaigns());
      setIsModalOpen(false);

      if (editingCampaignId) {
        onShowToast(`تم تحديث الحملة الإعلانية لـ «${saved.tenantName}» بنجاح`, 'success');
      } else {
        onShowToast(`تم تدشين الحملة الإعلانية وترتيب الظهور (#${saved.priorityOrder}) بنجاح`, 'success');
      }
    } catch (err: any) {
      setFormError(err.message || 'حدث خطأ أثناء حفظ الحملة الإعلانية');
    }
  };

  // Toggle Campaign Enabled / Paused
  const handleToggleStatus = (campaign: PlatformAdCampaign) => {
    const updated = toggleAdCampaignStatus(campaign.id);
    if (updated) {
      setCampaigns(getAllAdCampaigns());
      if (updated.enabled) {
        onShowToast(`تم تفعيل الحملة الإعلانية لـ «${campaign.tenantName}»`, 'success');
      } else {
        onShowToast(`تم إيقاف الحملة الإعلانية لـ «${campaign.tenantName}» مؤقتاً`, 'info');
      }
    }
  };

  // Confirm Delete
  const handleConfirmDelete = () => {
    if (!deletingCampaign) return;
    const success = deleteAdCampaign(deletingCampaign.id);
    if (success) {
      setCampaigns(getAllAdCampaigns());
      onShowToast(`تم إلغاء وحذف الحملة الإعلانية لـ «${deletingCampaign.tenantName}» بنجاح`, 'success');
    }
    setDeletingCampaign(null);
  };

  // Quick Preset Helper for Duration Buttons
  const handleSetDurationPreset = (days: number) => {
    const start = startDateStr ? new Date(startDateStr) : new Date();
    const end = new Date(start.getTime() + days * 24 * 60 * 60 * 1000);
    setEndDateStr(toDatetimeLocalString(end));
  };

  // Calculate Statistics
  const stats = useMemo(() => {
    let active = 0;
    let scheduled = 0;
    let expired = 0;
    let disabled = 0;

    const tenantIdsSet = new Set<string>();

    campaigns.forEach((c) => {
      tenantIdsSet.add(c.tenantId);
      if (!c.enabled) {
        disabled++;
      }
      const st = getAdCampaignStatus(c, currentTick);
      if (st === 'active') active++;
      else if (st === 'scheduled') scheduled++;
      else if (st === 'expired') expired++;
    });

    return {
      total: campaigns.length,
      active,
      scheduled,
      expired,
      disabled,
      uniqueTenants: tenantIdsSet.size,
    };
  }, [campaigns, currentTick]);

  const pendingRequestsCount = useMemo(() => {
    return requests.filter((r) => r.status === 'paid_pending_review' || r.status === 'under_review').length;
  }, [requests]);

  // Filtered & Sorted Campaigns
  const filteredCampaigns = useMemo(() => {
    return campaigns.filter((c) => {
      // 1. Status Filter
      if (statusFilter === 'disabled') {
        if (c.enabled) return false;
      } else if (statusFilter !== 'all') {
        const status = getAdCampaignStatus(c, currentTick);
        if (status !== statusFilter) return false;
      }

      // 2. Search Query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchName = (c.tenantName || '').toLowerCase().includes(q);
        const matchTitle = (c.title || '').toLowerCase().includes(q);
        const matchCity = (c.tenantCity || '').toLowerCase().includes(q);
        const matchCountry = (c.tenantCountry || '').toLowerCase().includes(q);
        const matchNotes = (c.notes || '').toLowerCase().includes(q);
        if (!matchName && !matchTitle && !matchCity && !matchCountry && !matchNotes) return false;
      }

      return true;
    }).sort((a, b) => {
      if (sortBy === 'priority') {
        return (a.priorityOrder || 1) - (b.priorityOrder || 1);
      }
      if (sortBy === 'startDate') {
        return new Date(a.startDate).getTime() - new Date(b.startDate).getTime();
      }
      if (sortBy === 'endDate') {
        return new Date(a.endDate).getTime() - new Date(b.endDate).getTime();
      }
      if (sortBy === 'newest') {
        return new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime();
      }
      return 0;
    });
  }, [campaigns, statusFilter, searchQuery, sortBy, currentTick]);

  return (
    <div className="space-y-6" dir="rtl">
      {/* ================= TOP HEADER & ACTIONS ================= */}
      <div className="bg-white p-5 sm:p-6 rounded-2xl border border-slate-200 shadow-sm flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="flex items-start gap-3.5">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-amber-500 to-orange-500 text-white flex items-center justify-center font-black shadow-md shadow-amber-500/20 shrink-0">
            <Megaphone className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-black text-slate-900 tracking-tight">
                إدارة الحملات الإعلانية وترتيب الظهور
              </h2>
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black bg-amber-100 text-amber-800 border border-amber-200">
                قسم التبرعات والمشاريع
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-1 max-w-2xl leading-relaxed">
              تحكم بمرونة كاملة في أولوية وترتيب ظهور الجمعيات في الصفحات الأولى لقسم «تبرع وشارك في مشاريع التنمية» مع ضبط دقيق لتاريخ ووقت البداية والنهاية واستعادة الترتيب التلقائي عند انتهاء المدة.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2.5 w-full md:w-auto shrink-0">
          <button
            onClick={handleRefresh}
            disabled={isRefreshing}
            className="p-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl transition-all border border-slate-200 flex items-center justify-center cursor-pointer disabled:opacity-50"
            title="تحديث البيانات"
          >
            <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin text-emerald-600' : ''}`} />
          </button>

          {activeSubTab === 'active_campaigns' && (
            <button
              id="btn-create-ad-campaign"
              onClick={handleOpenCreate}
              className="px-4 py-2.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white rounded-xl text-xs sm:text-sm font-black transition-all shadow-md shadow-emerald-600/20 flex items-center justify-center gap-2 cursor-pointer active:scale-95 flex-1 md:flex-initial"
            >
              <Plus className="w-4 h-4 stroke-[3]" />
              <span>تدشين حملة مباشرة</span>
            </button>
          )}
        </div>
      </div>

      {/* ================= SUB-NAVIGATION TABS ================= */}
      <div className="flex items-center gap-2 p-1.5 bg-slate-100/90 rounded-2xl border border-slate-200/80 w-full sm:w-fit">
        <button
          id="tab-campaign-requests"
          type="button"
          onClick={() => setActiveSubTab('launch_requests')}
          className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs sm:text-sm font-black transition-all cursor-pointer ${
            activeSubTab === 'launch_requests'
              ? 'bg-white text-indigo-700 shadow-xs border border-slate-200/80'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/50'
          }`}
        >
          <FileText className="w-4 h-4" />
          <span>طلبات تدشين حملة جديدة</span>
          {pendingRequestsCount > 0 ? (
            <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-indigo-600 text-white animate-pulse">
              {pendingRequestsCount} جديد
            </span>
          ) : (
            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-200 text-slate-700">
              {requests.length}
            </span>
          )}
        </button>

        <button
          id="tab-active-campaigns"
          type="button"
          onClick={() => setActiveSubTab('active_campaigns')}
          className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs sm:text-sm font-black transition-all cursor-pointer ${
            activeSubTab === 'active_campaigns'
              ? 'bg-white text-emerald-700 shadow-xs border border-slate-200/80'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/50'
          }`}
        >
          <Megaphone className="w-4 h-4" />
          <span>الحملات الإعلانية وترتيب الظهور</span>
          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-200 text-slate-700">
            {campaigns.length}
          </span>
        </button>
      </div>

      {/* ================= TAB 1: CAMPAIGN LAUNCH REQUESTS ================= */}
      {activeSubTab === 'launch_requests' && (
        <CampaignLaunchRequestsAdmin
          onShowToast={onShowToast}
          onPreviewTenant={onPreviewTenant}
          canApprove={canApprove}
          onCampaignActivated={(campaign) => {
            setCampaigns(getAllAdCampaigns());
            setActiveSubTab('active_campaigns');
          }}
        />
      )}

      {/* ================= TAB 2: ACTIVE CAMPAIGNS & LIVE SPONSOR RANKING ================= */}
      {activeSubTab === 'active_campaigns' && (
        <div className="space-y-6">
          {/* ================= STATS OVERVIEW CARDS ================= */}
          <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
        {/* Card 1: Total Campaigns */}
        <div className="bg-white p-4 rounded-2xl shadow-xs border border-slate-200/80">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-bold">إجمالي الحملات</span>
            <Megaphone className="w-4 h-4 text-slate-600" />
          </div>
          <div className="text-2xl font-black text-slate-900">{stats.total}</div>
          <div className="text-[11px] text-slate-400 mt-1">حملة مسجلة بالنظام</div>
        </div>

        {/* Card 2: Active Campaigns */}
        <div className="bg-white p-4 rounded-2xl shadow-xs border border-emerald-200/80 bg-gradient-to-br from-white to-emerald-50/30">
          <div className="flex items-center justify-between text-emerald-700 mb-2">
            <span className="text-xs font-bold flex items-center gap-1.5">
              <span>الحملات النشطة الآن</span>
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
            </span>
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="text-2xl font-black text-emerald-700">{stats.active}</div>
          <div className="text-[11px] text-emerald-600/80 mt-1">تتصدر الصفحات الأولى حالياً</div>
        </div>

        {/* Card 3: Scheduled Campaigns */}
        <div className="bg-white p-4 rounded-2xl shadow-xs border border-blue-200/80 bg-gradient-to-br from-white to-blue-50/30">
          <div className="flex items-center justify-between text-blue-700 mb-2">
            <span className="text-xs font-bold">الحملات المجدولة</span>
            <Calendar className="w-4 h-4 text-blue-600" />
          </div>
          <div className="text-2xl font-black text-blue-700">{stats.scheduled}</div>
          <div className="text-[11px] text-blue-600/80 mt-1">ستبدأ تلقائيًا في موعدها</div>
        </div>

        {/* Card 4: Expired Campaigns */}
        <div className="bg-white p-4 rounded-2xl shadow-xs border border-slate-200/80">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-bold">الحملات المنتهية</span>
            <Clock className="w-4 h-4 text-slate-400" />
          </div>
          <div className="text-2xl font-black text-slate-700">{stats.expired}</div>
          <div className="text-[11px] text-slate-400 mt-1">عادت للترتيب التلقائي العادي</div>
        </div>
      </div>

      {/* ================= INFO NOTICE BANNER ================= */}
      <div className="bg-amber-50/80 border border-amber-200 rounded-2xl p-4 flex items-start gap-3.5 text-xs text-amber-900 shadow-xs">
        <Sparkles className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
        <div className="space-y-1">
          <p className="font-black text-amber-950">
            كيف يعمل نظام الترتيب الإعلاني في قسم «تبرع وشارك في مشاريع التنمية»؟
          </p>
          <p className="text-amber-800 leading-relaxed">
            عند تفعيل حملة إعلانية لجمعية ما وتحديد ترتيبها (مثلاً: <strong>#1</strong> أو <strong>#2</strong>)، يتم رفع ظهورها تلقائيًا لتتصدر قائمة الجمعيات في واجهة التبرعات طوال الفترة المحددة بين تاريخ ووقت البداية والنهاية. وفور انقضاء التاريخ والوقت المحددين، يتوقف التأثير فورًا وتعود الجمعية لترتيبها الاعتيادي دون أي تدخل يدوي ودون التأثير على بيانات الجمعية.
          </p>
        </div>
      </div>

      {/* ================= FILTERS, SEARCH & SORT ================= */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex flex-col lg:flex-row items-center justify-between gap-3">
        {/* Search Input */}
        <div className="relative flex-1 w-full">
          <div className="absolute inset-y-0 right-0 pr-3.5 flex items-center pointer-events-none text-slate-400">
            <Search className="w-4 h-4" />
          </div>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="ابحث باسم الجمعية، عنوان الحملة، المدينة، أو الملاحظات..."
            className="w-full pl-4 pr-10 py-2.5 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-amber-500 outline-none transition-all"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute inset-y-0 left-0 pl-3 flex items-center text-slate-400 hover:text-slate-600"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Filter & Sort Controls */}
        <div className="flex flex-wrap items-center gap-2.5 w-full lg:w-auto">
          {/* Status Filter */}
          <div className="flex items-center gap-1.5 text-xs text-slate-600">
            <span className="font-bold hidden sm:inline">الحالة:</span>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as any)}
              className="px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-amber-500 font-bold text-slate-700 cursor-pointer"
            >
              <option value="all">كل الحالات ({campaigns.length})</option>
              <option value="active">🟢 نشطة فقط ({stats.active})</option>
              <option value="scheduled">⏳ مجدولة فقط ({stats.scheduled})</option>
              <option value="expired">⚪ منتهية فقط ({stats.expired})</option>
              <option value="disabled">⏸️ معطلة يدوياً ({stats.disabled})</option>
            </select>
          </div>

          {/* Sort By */}
          <div className="flex items-center gap-1.5 text-xs text-slate-600">
            <span className="font-bold hidden sm:inline">الترتيب حسب:</span>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
              className="px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-amber-500 font-bold text-slate-700 cursor-pointer"
            >
              <option value="priority">⭐ الترتيب الإعلاني (الأول أولاً)</option>
              <option value="startDate">📅 تاريخ البداية</option>
              <option value="endDate">⏳ تاريخ النهاية</option>
              <option value="newest">🆕 الأحدث إنشاءً</option>
            </select>
          </div>
        </div>
      </div>

      {/* ================= CAMPAIGNS LIST / CARDS ================= */}
      {filteredCampaigns.length === 0 ? (
        <div className="bg-white rounded-3xl border border-dashed border-slate-300 p-12 text-center space-y-4">
          <div className="w-16 h-16 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center mx-auto shadow-inner">
            <Megaphone className="w-8 h-8 stroke-[1.5]" />
          </div>
          <div className="space-y-1">
            <h3 className="text-base font-black text-slate-800">
              {campaigns.length === 0 ? 'لا توجد حملات إعلانية مسجلة حتى الآن' : 'لا توجد نتائج مطابقة لبحثك'}
            </h3>
            <p className="text-xs text-slate-500 max-w-md mx-auto">
              {campaigns.length === 0
                ? 'يمكنك تدشين أول حملة إعلانية واختيار أي جمعية لتتصدر الصفحة الأولى في قسم مشاريع التبرع.'
                : 'جرب تغيير معايير البحث أو تصفية الحالة لعرض الحملات الأخرى.'}
            </p>
          </div>
          {campaigns.length === 0 && (
            <button
              onClick={handleOpenCreate}
              className="px-5 py-2.5 bg-gradient-to-r from-emerald-600 to-teal-600 text-white text-xs font-black rounded-xl shadow-md cursor-pointer hover:opacity-95"
            >
              + إضافة أول حملة إعلانية الآن
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-3.5">
          {filteredCampaigns.map((campaign) => {
            const status = getAdCampaignStatus(campaign, currentTick);
            const timeInfo = getCampaignTimeRemaining(campaign, currentTick);
            const matchedTenant = tenants.find((t) => t.id === campaign.tenantId);

            return (
              <div
                key={campaign.id}
                id={`ad-campaign-card-${campaign.id}`}
                className={`bg-white rounded-2xl border transition-all duration-200 overflow-hidden shadow-xs hover:shadow-md ${
                  status === 'active'
                    ? 'border-emerald-300 ring-1 ring-emerald-400/30'
                    : status === 'scheduled'
                    ? 'border-blue-200'
                    : !campaign.enabled
                    ? 'border-slate-200 opacity-75'
                    : 'border-slate-200'
                }`}
              >
                <div className="p-4 sm:p-5 flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4">
                  {/* Left (RTL Right): Priority Badge & Association Details */}
                  <div className="flex items-start sm:items-center gap-3.5 min-w-0 flex-1">
                    {/* Priority Order Rank Visual Badge */}
                    <div
                      className={`w-14 h-14 rounded-2xl flex flex-col items-center justify-center shrink-0 font-black shadow-xs ${
                        campaign.priorityOrder === 1
                          ? 'bg-gradient-to-tr from-amber-500 to-yellow-400 text-amber-950 ring-2 ring-amber-400/50'
                          : campaign.priorityOrder === 2
                          ? 'bg-gradient-to-tr from-slate-200 to-slate-100 text-slate-800 border border-slate-300'
                          : campaign.priorityOrder === 3
                          ? 'bg-gradient-to-tr from-amber-700 to-amber-600 text-white'
                          : 'bg-emerald-50 text-emerald-900 border border-emerald-200'
                      }`}
                      title={`ترتيب الظهور: المركز رقم ${campaign.priorityOrder}`}
                    >
                      <span className="text-[10px] font-bold uppercase tracking-wider opacity-80">
                        المركز
                      </span>
                      <span className="text-xl font-black leading-none">
                        #{campaign.priorityOrder}
                      </span>
                    </div>

                    {/* Logo & Association Info */}
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-12 h-12 rounded-xl bg-slate-100 border border-slate-200 overflow-hidden flex items-center justify-center shrink-0">
                        {campaign.tenantLogoUrl ? (
                          <img
                            src={campaign.tenantLogoUrl}
                            alt={campaign.tenantName}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <Building2 className="w-6 h-6 text-slate-400" />
                        )}
                      </div>

                      <div className="min-w-0 space-y-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <h4 className="text-sm font-black text-slate-900 truncate">
                            {campaign.tenantName}
                          </h4>
                          {matchedTenant?.isTemplate && (
                            <span className="px-2 py-0.5 rounded-full text-[9px] font-black bg-emerald-100 text-emerald-800">
                              القالب الأساسي
                            </span>
                          )}
                          {/* Live Status Badge */}
                          {status === 'active' && campaign.enabled && (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-black bg-emerald-500 text-white shadow-xs">
                              <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
                              نشطة الآن
                            </span>
                          )}
                          {status === 'scheduled' && campaign.enabled && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-black bg-blue-100 text-blue-800 border border-blue-200">
                              <Calendar className="w-3 h-3" />
                              مجدولة
                            </span>
                          )}
                          {status === 'expired' && campaign.enabled && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-black bg-slate-100 text-slate-600 border border-slate-200">
                              <Clock className="w-3 h-3" />
                              منتهية
                            </span>
                          )}
                          {!campaign.enabled && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-black bg-rose-100 text-rose-700 border border-rose-200">
                              <Power className="w-3 h-3" />
                              معطلة يدوياً
                            </span>
                          )}
                        </div>

                        {/* Subtitle / Campaign Title / City */}
                        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500">
                          {campaign.title && (
                            <span className="font-bold text-amber-900 bg-amber-50 px-2 py-0.5 rounded-md border border-amber-200/60">
                              {campaign.title}
                            </span>
                          )}
                          {(campaign.tenantCity || campaign.tenantCountry) && (
                            <span className="flex items-center gap-1 text-[11px]">
                              <MapPin className="w-3 h-3 text-slate-400" />
                              <span>{campaign.tenantCity || ''} {campaign.tenantCountry ? `(${campaign.tenantCountry})` : ''}</span>
                            </span>
                          )}
                          {campaign.notes && (
                            <span className="text-[11px] text-slate-400 truncate max-w-xs" title={campaign.notes}>
                              ملاحظة: {campaign.notes}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Middle / Right: Dates, Remaining Time & Action Buttons */}
                  <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between lg:justify-end gap-3.5 w-full lg:w-auto border-t lg:border-t-0 pt-3 lg:pt-0 border-slate-100">
                    {/* Time & Dates Container */}
                    <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-200/80 text-[11px] space-y-1 min-w-[210px]">
                      <div className="flex items-center justify-between gap-2 text-slate-600">
                        <span className="font-bold flex items-center gap-1">
                          <Calendar className="w-3 h-3 text-emerald-600" />
                          البداية:
                        </span>
                        <span className="font-mono text-slate-800" dir="ltr">
                          {formatArabicDateTime(campaign.startDate)}
                        </span>
                      </div>
                      <div className="flex items-center justify-between gap-2 text-slate-600">
                        <span className="font-bold flex items-center gap-1">
                          <Clock className="w-3 h-3 text-rose-500" />
                          النهاية:
                        </span>
                        <span className="font-mono text-slate-800" dir="ltr">
                          {formatArabicDateTime(campaign.endDate)}
                        </span>
                      </div>
                      {/* Time remaining indicator */}
                      <div className="pt-1 border-t border-slate-200/60 flex items-center justify-between gap-1">
                        <span className="text-[10px] text-slate-400">المدة / الوقت:</span>
                        <span className={`text-[10px] font-black ${
                          status === 'active' ? 'text-emerald-700' : status === 'scheduled' ? 'text-blue-700' : 'text-slate-500'
                        }`}>
                          {timeInfo.label}
                        </span>
                      </div>
                    </div>

                    {/* Action Buttons */}
                    <div className="flex items-center gap-1.5 shrink-0 self-end sm:self-center">
                      {/* Toggle Active / Paused */}
                      <button
                        onClick={() => handleToggleStatus(campaign)}
                        className={`p-2 rounded-xl transition-all cursor-pointer border ${
                          campaign.enabled
                            ? 'bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border-emerald-200'
                            : 'bg-slate-100 hover:bg-slate-200 text-slate-500 border-slate-300'
                        }`}
                        title={campaign.enabled ? 'إيقاف الحملة مؤقتاً' : 'تفعيل الحملة'}
                      >
                        <Power className="w-4 h-4" />
                      </button>

                      {/* Edit Button */}
                      <button
                        onClick={() => handleOpenEdit(campaign)}
                        className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-all border border-slate-200 flex items-center gap-1.5 cursor-pointer"
                        title="تعديل الحملة الإعلانية وتواريخها"
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                        <span>تعديل</span>
                      </button>

                      {/* Delete / Cancel Button */}
                      <button
                        onClick={() => setDeletingCampaign(campaign)}
                        className="p-2 bg-rose-50 hover:bg-rose-100 text-rose-600 rounded-xl transition-all border border-rose-200 cursor-pointer"
                        title="إلغاء وحذف الحملة الإعلانية"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ================= CREATE / EDIT MODAL ================= */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div
            className="bg-white rounded-3xl max-w-xl w-full max-h-[90vh] overflow-y-auto shadow-2xl border border-slate-200 animate-in fade-in zoom-in-95 duration-150"
            dir="rtl"
          >
            {/* Modal Header */}
            <div className="p-5 sm:p-6 border-b border-slate-100 flex items-center justify-between sticky top-0 bg-white z-10">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-amber-100 text-amber-800 flex items-center justify-center font-black">
                  <Megaphone className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-black text-slate-900">
                    {editingCampaignId ? 'تعديل الحملة الإعلانية وترتيب الظهور' : 'تدشين حملة إعلانية جديدة'}
                  </h3>
                  <p className="text-xs text-slate-500">
                    حدد الجمعية، ترتيب ظهورها في الصفحات الأولى، وفترة الصلاحية
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsModalOpen(false)}
                className="p-2 text-slate-400 hover:text-slate-600 rounded-xl hover:bg-slate-100 transition-all cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Form */}
            <form onSubmit={handleSaveCampaign} className="p-5 sm:p-6 space-y-5">
              {formError && (
                <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-700 flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{formError}</span>
                </div>
              )}

              {/* Geographic Filters: Country & City */}
              <div className="p-3.5 bg-slate-50 border border-slate-200/90 rounded-2xl space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5 text-xs font-black text-slate-800">
                    <MapPin className="w-3.5 h-3.5 text-amber-600" />
                    <span>تصفية الجمعيات حسب النطاق الجغرافي</span>
                  </div>
                  {(modalCountry !== 'all' || modalCity !== 'all') && (
                    <button
                      type="button"
                      onClick={() => {
                        handleModalCountryChange('all');
                      }}
                      className="text-[11px] text-amber-600 hover:text-amber-700 font-bold hover:underline cursor-pointer flex items-center gap-1"
                    >
                      <RefreshCw className="w-3 h-3" />
                      <span>إلغاء الفلترة وعرض الكل</span>
                    </button>
                  )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {/* 1. فلتر الدولة */}
                  <div className="space-y-1">
                    <label htmlFor="campaign-filter-country" className="block text-[11px] font-black text-slate-700">
                      فلتر الدولة
                    </label>
                    <div className="relative">
                      <select
                        id="campaign-filter-country"
                        value={modalCountry}
                        onChange={(e) => handleModalCountryChange(e.target.value)}
                        className="w-full px-3 py-2 text-xs bg-white border border-slate-200 rounded-xl focus:border-amber-500 outline-none font-bold text-slate-800 appearance-none pr-3 pl-8 cursor-pointer shadow-2xs"
                      >
                        <option value="all">🌍 جميع الدول ({modalAvailableCountries.length})</option>
                        {modalAvailableCountries.map((country) => (
                          <option key={country} value={country}>
                            {country}
                          </option>
                        ))}
                      </select>
                      <div className="absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400">
                        <ChevronDown className="w-3.5 h-3.5" />
                      </div>
                    </div>
                  </div>

                  {/* 2. فلتر المدينة */}
                  <div className="space-y-1">
                    <label htmlFor="campaign-filter-city" className="block text-[11px] font-black text-slate-700">
                      فلتر المدينة
                    </label>
                    <div className="relative">
                      <select
                        id="campaign-filter-city"
                        value={modalCity}
                        onChange={(e) => handleModalCityChange(e.target.value)}
                        disabled={modalAvailableCities.length === 0}
                        className="w-full px-3 py-2 text-xs bg-white border border-slate-200 rounded-xl focus:border-amber-500 outline-none font-bold text-slate-800 appearance-none pr-3 pl-8 cursor-pointer shadow-2xs disabled:opacity-50 disabled:bg-slate-100"
                      >
                        <option value="all">
                          🏙️ {modalCountry === 'all' ? 'جميع المدن' : `جميع مدن ${modalCountry}`} ({modalAvailableCities.length})
                        </option>
                        {modalAvailableCities.map((city) => (
                          <option key={city} value={city}>
                            {city}
                          </option>
                        ))}
                      </select>
                      <div className="absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400">
                        <ChevronDown className="w-3.5 h-3.5" />
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* 1. Select Association */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label htmlFor="campaign-select-tenant" className="block text-xs font-black text-slate-700">
                    اختر الجمعية المراد ترويجها <span className="text-rose-500">*</span>
                  </label>
                  <span className="text-[11px] text-slate-400 font-bold">
                    ({modalFilteredTenants.length} جمعية متاحة)
                  </span>
                </div>
                <select
                  id="campaign-select-tenant"
                  value={selectedTenantId}
                  onChange={(e) => setSelectedTenantId(e.target.value)}
                  className="w-full px-3.5 py-2.5 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-amber-500 outline-none font-bold text-slate-800"
                  required
                >
                  {modalFilteredTenants.length === 0 ? (
                    <option value="" disabled>
                      لا توجد جمعيات تطابق الفلاتر المحددة
                    </option>
                  ) : (
                    modalFilteredTenants.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.name} {t.city ? `(${t.city} - ${t.country})` : `(${t.country})`} {t.isTemplate ? '• [القالب الأساسي]' : ''}
                      </option>
                    ))
                  )}
                </select>
                {modalFilteredTenants.length === 0 ? (
                  <p className="text-[11px] text-amber-600 font-medium">
                    ⚠️ لا توجد جمعيات مسجلة تطابق الدولة أو المدينة المختارة. يمكنك تغيير الفلتر لعرض الجمعيات.
                  </p>
                ) : (
                  <p className="text-[11px] text-slate-400">
                    تظهر الجمعيات المطابقة للفلاتر المختارة تلقائياً مع دعم جميع الجمعيات الحالية والجديدة
                  </p>
                )}
              </div>

              {/* 2. Priority Order Rank */}
              <div className="space-y-1.5">
                <label className="block text-xs font-black text-slate-700">
                  ترتيب الظهور في الصفحات الأولى (المركز الإعلاني) <span className="text-rose-500">*</span>
                </label>
                <div className="grid grid-cols-5 gap-2">
                  {[1, 2, 3, 4, 5].map((rank) => (
                    <button
                      type="button"
                      key={rank}
                      onClick={() => setPriorityOrder(rank)}
                      className={`py-2 px-1 rounded-xl text-xs font-black border transition-all cursor-pointer ${
                        priorityOrder === rank
                          ? 'bg-amber-500 text-white border-amber-500 shadow-sm shadow-amber-500/30'
                          : 'bg-slate-50 hover:bg-slate-100 text-slate-700 border-slate-200'
                      }`}
                    >
                      المركز #{rank}
                    </button>
                  ))}
                </div>
                <div className="flex items-center gap-2 pt-1">
                  <span className="text-xs text-slate-500">أو حدد رقمًا مخصصًا:</span>
                  <input
                    type="number"
                    min="1"
                    max="100"
                    value={priorityOrder}
                    onChange={(e) => setPriorityOrder(Math.max(1, parseInt(e.target.value) || 1))}
                    className="w-24 px-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg text-center font-black outline-none focus:border-amber-500"
                  />
                </div>
                <p className="text-[11px] text-emerald-700 font-medium">
                  💡 الرقم 1 يمنح الجمعية الصدارة في المركز الأول، والرقم 2 يضعها بعد المركز الأول مباشرة.
                </p>
              </div>

              {/* 3. Campaign Title (Optional) */}
              <div className="space-y-1.5">
                <label className="block text-xs font-black text-slate-700">
                  عنوان أو وسم الحملة (اختياري)
                </label>
                <input
                  type="text"
                  value={campaignTitle}
                  onChange={(e) => setCampaignTitle(e.target.value)}
                  placeholder="مثال: راعي ماسي لمشاريع الأيتام / حملة ترويجية لشهر رمضان"
                  className="w-full px-3.5 py-2.5 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-amber-500 outline-none"
                />
              </div>

              {/* 4. Dates & Times (Start and End) */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Start Date & Time */}
                <div className="space-y-1.5">
                  <label className="block text-xs font-black text-slate-700 flex items-center gap-1.5">
                    <Calendar className="w-3.5 h-3.5 text-emerald-600" />
                    <span>تاريخ ووقت بداية الظهور</span>
                    <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="datetime-local"
                    value={startDateStr}
                    onChange={(e) => setStartDateStr(e.target.value)}
                    className="w-full px-3.5 py-2.5 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-amber-500 outline-none font-mono"
                    required
                  />
                  <div className="flex gap-1.5">
                    <button
                      type="button"
                      onClick={() => setStartDateStr(toDatetimeLocalString(new Date()))}
                      className="text-[10px] text-emerald-700 hover:underline cursor-pointer"
                    >
                      الآن فوراً
                    </button>
                    <span className="text-[10px] text-slate-300">•</span>
                    <button
                      type="button"
                      onClick={() => {
                        const d = new Date();
                        d.setDate(d.getDate() + 1);
                        d.setHours(0, 0, 0, 0);
                        setStartDateStr(toDatetimeLocalString(d));
                      }}
                      className="text-[10px] text-blue-700 hover:underline cursor-pointer"
                    >
                      غداً صباحاً
                    </button>
                  </div>
                </div>

                {/* End Date & Time */}
                <div className="space-y-1.5">
                  <label className="block text-xs font-black text-slate-700 flex items-center gap-1.5">
                    <Clock className="w-3.5 h-3.5 text-rose-500" />
                    <span>تاريخ ووقت نهاية الظهور</span>
                    <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="datetime-local"
                    value={endDateStr}
                    onChange={(e) => setEndDateStr(e.target.value)}
                    className="w-full px-3.5 py-2.5 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-amber-500 outline-none font-mono"
                    required
                  />
                  {/* Quick Preset Durations */}
                  <div className="flex flex-wrap gap-1.5 pt-0.5">
                    <button
                      type="button"
                      onClick={() => handleSetDurationPreset(7)}
                      className="px-2 py-0.5 rounded bg-slate-100 hover:bg-slate-200 text-[10px] font-bold text-slate-700 cursor-pointer"
                    >
                      + أسبوع
                    </button>
                    <button
                      type="button"
                      onClick={() => handleSetDurationPreset(14)}
                      className="px-2 py-0.5 rounded bg-slate-100 hover:bg-slate-200 text-[10px] font-bold text-slate-700 cursor-pointer"
                    >
                      + أسبوعين
                    </button>
                    <button
                      type="button"
                      onClick={() => handleSetDurationPreset(30)}
                      className="px-2 py-0.5 rounded bg-slate-100 hover:bg-slate-200 text-[10px] font-bold text-slate-700 cursor-pointer"
                    >
                      + شهر
                    </button>
                    <button
                      type="button"
                      onClick={() => handleSetDurationPreset(90)}
                      className="px-2 py-0.5 rounded bg-slate-100 hover:bg-slate-200 text-[10px] font-bold text-slate-700 cursor-pointer"
                    >
                      + 3 أشهر
                    </button>
                  </div>
                </div>
              </div>

              {/* 5. Admin Notes */}
              <div className="space-y-1.5">
                <label className="block text-xs font-black text-slate-700">
                  ملاحظات الإدارة العامة (اختياري)
                </label>
                <textarea
                  value={campaignNotes}
                  onChange={(e) => setCampaignNotes(e.target.value)}
                  placeholder="مثال: تم سداد رسوم الحملة برقم تحويل بنكي #1234..."
                  rows={2}
                  className="w-full px-3.5 py-2.5 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-amber-500 outline-none resize-none"
                />
              </div>

              {/* 6. Enabled Toggle Switch */}
              <div className="flex items-center justify-between p-3.5 bg-slate-50 rounded-xl border border-slate-200">
                <div>
                  <p className="text-xs font-black text-slate-800">تفعيل الحملة</p>
                  <p className="text-[11px] text-slate-500">
                    عند التفعيل، يبدأ تطبيق الترتيب تلقائيًا بمجرد حلول تاريخ البداية
                  </p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={isEnabled}
                    onChange={(e) => setIsEnabled(e.target.checked)}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-slate-300 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:right-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-600"></div>
                </label>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2.5 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 text-xs font-bold transition-all cursor-pointer"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white rounded-xl text-xs font-black transition-all shadow-md shadow-emerald-600/20 cursor-pointer active:scale-95 flex items-center gap-1.5"
                >
                  <Check className="w-4 h-4 stroke-[3]" />
                  <span>{editingCampaignId ? 'حفظ التعديلات' : 'تأكيد تدشين الحملة'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ================= DELETE CONFIRMATION MODAL ================= */}
      {deletingCampaign && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-200 space-y-4" dir="rtl">
            <div className="w-12 h-12 rounded-2xl bg-rose-100 text-rose-600 flex items-center justify-center mx-auto">
              <Trash2 className="w-6 h-6" />
            </div>

            <div className="text-center space-y-1.5">
              <h3 className="text-base font-black text-slate-900">
                هل أنت متأكد من إلغاء وحذف هذه الحملة الإعلانية؟
              </h3>
              <p className="text-xs text-slate-500">
                سيتم إزالة الترتيب الإعلاني (#{deletingCampaign.priorityOrder}) المخصص لـ «{deletingCampaign.tenantName}»، وستعود الجمعية فوراً إلى الترتيب الاعتيادي. لن تتأثر أي بيانات خاصة بالجمعية.
              </p>
            </div>

            <div className="flex items-center gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setDeletingCampaign(null)}
                className="flex-1 py-2.5 rounded-xl border border-slate-200 text-slate-700 hover:bg-slate-50 text-xs font-bold transition-all cursor-pointer"
              >
                تراجع
              </button>
              <button
                type="button"
                onClick={handleConfirmDelete}
                className="flex-1 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-black shadow-md shadow-rose-600/20 transition-all cursor-pointer active:scale-95"
              >
                تأكيد الحذف والإلغاء
              </button>
            </div>
          </div>
        </div>
      )}
        </div>
      )}
    </div>
  );
};
