import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { ArrowLeft, Archive, Ban, Check, CheckCheck, CircleUserRound, FileText, MessageCircle, Paperclip, Search, Send, ShieldCheck, UserPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Navbar } from "@/components/navbar";
import { useAuth } from "@/lib/auth";
import { queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

type Business = {
  id: string;
  userId: string;
  displayName: string;
  businessName?: string;
  businessCategory: string;
  stationName?: string;
  terminalName?: string;
  state?: string;
  lga?: string;
  city?: string;
  products: string[];
  businessVerified: boolean;
  customerVerified?: boolean;
};
type RequestItem = {
  id: string;
  senderUserId: string;
  isIncoming: boolean;
  message?: string;
  createdAt: string;
  senderDisplayName: string;
  senderBusinessName?: string;
  senderBusinessCategory: string;
};
type Conversation = {
  id: string;
  otherUserId: string;
  displayName: string;
  businessName?: string;
  businessCategory: string;
  businessVerified: boolean;
  state?: string;
  city?: string;
  products?: string[];
  lastMessage?: string;
  lastMessageAt?: string;
  unreadCount: number;
  archivedAt?: string;
};
type Attachment = { id: string; fileName: string; mimeType: string; sizeBytes: number };
type Message = {
  id: string;
  senderUserId: string;
  replyToMessageId?: string;
  body: string;
  editedAt?: string;
  deletedAt?: string;
  createdAt: string;
  delivered: boolean;
  read: boolean;
  attachments: Attachment[];
};
type Notification = { id: string; type: string; conversationId?: string; readAt?: string; createdAt: string };
type BusinessProfileForm = {
  displayName: string;
  businessName: string;
  businessCategory: string;
  stationName: string;
  terminalName: string;
  state: string;
  lga: string;
  city: string;
  products: string;
};

const categories = [
  ["station_operator", "Station operator"], ["terminal_operator", "Terminal operator"],
  ["fuel_marketer", "Fuel marketer"], ["distributor", "Distributor"],
  ["supplier", "Supplier"], ["transport_logistics", "Transport & logistics"], ["other", "Other"],
];
const productOptions = ["PMS", "AGO", "DPK", "LPG"];
const initialProfile: BusinessProfileForm = {
  displayName: "", businessName: "", businessCategory: "other", stationName: "", terminalName: "",
  state: "", lga: "", city: "", products: "",
};

async function request<T>(url: string, method: string, token: string, body?: unknown): Promise<T> {
  const response = await fetch(url, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      ...(body === undefined ? {} : { "Content-Type": "application/json" }),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
    credentials: "include",
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(result.message || "Messaging request failed.");
  return result.data as T;
}

function time(value?: string) {
  if (!value) return "";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "" : date.toLocaleString("en-NG", { dateStyle: "short", timeStyle: "short" });
}

function categoryName(value: string) {
  return categories.find(([key]) => key === value)?.[1] || value;
}

export default function MessagingPage() {
  const { user, token } = useAuth();
  const { toast } = useToast();
  const [query, setQuery] = useState("");
  const [stateFilter, setStateFilter] = useState("");
  const [lgaFilter, setLgaFilter] = useState("");
  const [cityFilter, setCityFilter] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [productFilter, setProductFilter] = useState("");
  const [verifiedOnly, setVerifiedOnly] = useState(false);
  const [selectedBusiness, setSelectedBusiness] = useState<Business | null>(null);
  const [activeConversationId, setActiveConversationId] = useState(() => new URLSearchParams(window.location.search).get("conversationId") || "");
  const [messageText, setMessageText] = useState("");
  const [messageSearch, setMessageSearch] = useState("");
  const [replyTargetId, setReplyTargetId] = useState("");
  const [showArchived, setShowArchived] = useState(false);
  const [showConnections, setShowConnections] = useState(false);
  const [showProfileEditor, setShowProfileEditor] = useState(false);
  const [profileForm, setProfileForm] = useState(initialProfile);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [typingUserIds, setTypingUserIds] = useState<string[]>([]);
  const [enquiryOpen, setEnquiryOpen] = useState(false);
  const [enquiry, setEnquiry] = useState({ productType: "PMS", quantity: "", proposedPrice: "", deliveryLocation: "", preferredDeliveryDate: "", requirements: "" });
  const messageEnd = useRef<HTMLDivElement>(null);

  const discovery = useQuery<Business[]>({
    queryKey: ["messaging-discovery", query, stateFilter, lgaFilter, cityFilter, categoryFilter, productFilter, verifiedOnly],
    enabled: !!token && query.trim().length >= 2,
    queryFn: async () => {
      const params = new URLSearchParams({ q: query.trim() });
      if (stateFilter) params.set("state", stateFilter);
      if (lgaFilter) params.set("lga", lgaFilter);
      if (cityFilter) params.set("city", cityFilter);
      if (categoryFilter) params.set("category", categoryFilter);
      if (productFilter) params.set("product", productFilter);
      if (verifiedOnly) params.set("verified", "true");
      return request(`/api/messaging/discovery?${params}`, "GET", token!);
    },
  });
  const connectionData = useQuery<{ connections: Business[]; requests: RequestItem[] }>({
    queryKey: ["messaging-connections"],
    enabled: !!token,
    queryFn: () => request("/api/messaging/connections", "GET", token!),
  });
  const conversations = useQuery<Conversation[]>({
    queryKey: ["messaging-conversations"],
    enabled: !!token,
    queryFn: () => request("/api/messaging/conversations", "GET", token!),
    refetchInterval: 15_000,
  });
  const myProfile = useQuery<Record<string, unknown> | null>({
    queryKey: ["messaging-business-profile"],
    enabled: !!token,
    queryFn: () => request("/api/messaging/business-profile/me", "GET", token!),
  });
  const notifications = useQuery<Notification[]>({
    queryKey: ["messaging-notifications"],
    enabled: !!token,
    queryFn: () => request("/api/messaging/notifications", "GET", token!),
  });
  const dashboardSummary = useQuery<Record<string, number>>({
    queryKey: ["messaging-dashboard"],
    enabled: !!token,
    queryFn: () => request("/api/messaging/dashboard", "GET", token!),
  });
  const preferences = useQuery<{ notificationsEnabled: boolean; showMessagePreviews: boolean }>({
    queryKey: ["messaging-preferences"],
    enabled: !!token,
    queryFn: () => request("/api/messaging/preferences", "GET", token!),
  });
  const messages = useQuery<{ messages: Message[]; participants: string[] }>({
    queryKey: ["messaging-messages", activeConversationId, messageSearch],
    enabled: !!token && !!activeConversationId,
    queryFn: () => {
      const params = new URLSearchParams();
      if (messageSearch.trim()) params.set("q", messageSearch.trim());
      return request(`/api/messaging/conversations/${activeConversationId}/messages?${params}`, "GET", token!);
    },
    refetchInterval: 15_000,
  });
  const blockedUsers = useQuery<Array<{ userId: string; displayName: string; businessName?: string }>>({
    queryKey: ["messaging-blocks"],
    enabled: !!token,
    queryFn: () => request("/api/messaging/blocks", "GET", token!),
  });
  const activeConversation = conversations.data?.find((item) => item.id === activeConversationId);
  const visibleConversations = (conversations.data || []).filter((item) => Boolean(item.archivedAt) === showArchived);
  const unreadTotal = (conversations.data || []).reduce((total, item) => total + item.unreadCount, 0);

  useEffect(() => {
    if (!token) return;
    const abort = new AbortController();
    void (async () => {
      while (!abort.signal.aborted) {
        try {
          const response = await fetch("/api/messaging/events", {
            headers: { Authorization: `Bearer ${token}` },
            signal: abort.signal,
          });
          if (!response.ok || !response.body) throw new Error("Live updates are unavailable.");
          const reader = response.body.getReader();
          const decoder = new TextDecoder();
          let pending = "";
          while (!abort.signal.aborted) {
            const { value, done } = await reader.read();
            if (done) break;
            pending += decoder.decode(value, { stream: true });
            const frames = pending.split("\n\n");
            pending = frames.pop() || "";
            for (const frame of frames) {
              const event = frame.match(/^event: ([^\r\n]+)/m)?.[1];
              const dataLine = frame.match(/^data: (.+)$/m)?.[1];
              if (event === "typing" && dataLine) {
                const payload = JSON.parse(dataLine) as { conversationId: string; userId: string; isTyping: boolean };
                if (payload.conversationId === activeConversationId) {
                  setTypingUserIds((existing) => payload.isTyping
                    ? Array.from(new Set([...existing, payload.userId]))
                    : existing.filter((id) => id !== payload.userId));
                }
              }
              if (event) {
                void queryClient.invalidateQueries({ queryKey: ["messaging-conversations"] });
                void queryClient.invalidateQueries({ queryKey: ["messaging-notifications"] });
                if (activeConversationId) void queryClient.invalidateQueries({ queryKey: ["messaging-messages", activeConversationId] });
              }
            }
          }
        } catch {
          if (abort.signal.aborted) return;
        }
        await new Promise((resolve) => window.setTimeout(resolve, 3000));
      }
    })();
    return () => abort.abort();
  }, [token, activeConversationId]);

  useEffect(() => {
    if (!activeConversationId || !token) return;
    void request(`/api/messaging/conversations/${activeConversationId}/read`, "POST", token).then(() => {
      void queryClient.invalidateQueries({ queryKey: ["messaging-conversations"] });
    }).catch(() => undefined);
  }, [activeConversationId, token]);

  useEffect(() => {
    messageEnd.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.data?.messages.length, activeConversationId]);

  useEffect(() => {
    const profile = myProfile.data;
    if (!profile) return;
    setProfileForm({
      displayName: String(profile.display_name || ""), businessName: String(profile.business_name || ""),
      businessCategory: String(profile.business_category || "other"), stationName: String(profile.station_name || ""),
      terminalName: String(profile.terminal_name || ""), state: String(profile.state || ""),
      lga: String(profile.lga || ""), city: String(profile.city || ""),
      products: Array.isArray(profile.products) ? profile.products.join(", ") : "",
    });
  }, [myProfile.data]);

  const refreshMessaging = () => {
    void queryClient.invalidateQueries({ queryKey: ["messaging-conversations"] });
    void queryClient.invalidateQueries({ queryKey: ["messaging-connections"] });
    void queryClient.invalidateQueries({ queryKey: ["messaging-notifications"] });
  };
  const mutation = useMutation({
    mutationFn: ({ url, method, body }: { url: string; method: string; body?: unknown }) => request(url, method, token!, body),
    onSuccess: refreshMessaging,
    onError: (error) => toast({ title: "Messaging action failed", description: (error as Error).message, variant: "destructive" }),
  });
  const sendMutation = useMutation({
    mutationFn: async () => {
      const sent = await request<Message>(`/api/messaging/conversations/${activeConversationId}/messages`, "POST", token!, {
        body: messageText.trim() || "Shared an attachment",
        replyToMessageId: replyTargetId || undefined,
      });
      if (selectedFile) {
        const upload = await fetch(`/api/messaging/attachments/${sent.id}`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/octet-stream",
            "X-File-Name": selectedFile.name,
            "X-File-Type": selectedFile.type,
          },
          body: selectedFile,
        });
        const uploaded = await upload.json().catch(() => ({}));
        if (!upload.ok) throw new Error(uploaded.message || "Attachment upload failed.");
      }
    },
    onSuccess: () => {
      setMessageText("");
      setReplyTargetId("");
      setSelectedFile(null);
      void queryClient.invalidateQueries({ queryKey: ["messaging-messages", activeConversationId] });
      refreshMessaging();
    },
    onError: (error) => toast({ title: "Message could not be sent", description: (error as Error).message, variant: "destructive" }),
  });

  const startConversation = async (targetUserId: string) => {
    try {
      const conversation = await request<{ id: string }>("/api/messaging/conversations", "POST", token!, { targetUserId });
      refreshMessaging();
      setActiveConversationId(conversation.id);
      setShowConnections(false);
    } catch (error) {
      toast({ title: "Could not open conversation", description: (error as Error).message, variant: "destructive" });
    }
  };

  const currentUserId = user?.id || "";
  const productList = (raw: string) => raw.split(",").map((item) => item.trim().toUpperCase()).filter((item) => productOptions.includes(item));
  const profileMutation = useMutation({
    mutationFn: () => request("/api/messaging/business-profile", "PUT", token!, {
      displayName: profileForm.displayName, businessName: profileForm.businessName || undefined,
      businessCategory: profileForm.businessCategory, stationName: profileForm.stationName || undefined,
      terminalName: profileForm.terminalName || undefined, state: profileForm.state || undefined,
      lga: profileForm.lga || undefined, city: profileForm.city || undefined, products: productList(profileForm.products),
      businessContactPublic: false,
    }),
    onSuccess: () => {
      toast({ title: "Business profile saved" });
      void queryClient.invalidateQueries({ queryKey: ["messaging-business-profile"] });
      setShowProfileEditor(false);
    },
    onError: (error) => toast({ title: "Profile could not be saved", description: (error as Error).message, variant: "destructive" }),
  });
  const preferencesMutation = useMutation({
    mutationFn: (body: { notificationsEnabled?: boolean; showMessagePreviews?: boolean }) => request("/api/messaging/preferences", "PATCH", token!, body),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["messaging-preferences"] }),
    onError: (error) => toast({ title: "Preference could not be saved", description: (error as Error).message, variant: "destructive" }),
  });
  const enquiryMutation = useMutation({
    mutationFn: () => request(`/api/messaging/conversations/${activeConversationId}/enquiries`, "POST", token!, {
      productType: enquiry.productType,
      quantity: enquiry.quantity ? Number(enquiry.quantity) : undefined,
      proposedPrice: enquiry.proposedPrice ? Number(enquiry.proposedPrice) : undefined,
      deliveryLocation: enquiry.deliveryLocation || undefined,
      preferredDeliveryDate: enquiry.preferredDeliveryDate || undefined,
      requirements: enquiry.requirements || undefined,
    }),
    onSuccess: () => {
      setEnquiryOpen(false);
      void queryClient.invalidateQueries({ queryKey: ["messaging-messages", activeConversationId] });
      refreshMessaging();
    },
    onError: (error) => toast({ title: "Enquiry could not be sent", description: (error as Error).message, variant: "destructive" }),
  });

  const typingTimer = useRef<number | undefined>(undefined);
  const sendTyping = (isTyping: boolean) => {
    if (!activeConversationId || !token) return;
    if (typingTimer.current) window.clearTimeout(typingTimer.current);
    void request(`/api/messaging/conversations/${activeConversationId}/typing`, "POST", token, { isTyping }).catch(() => undefined);
    if (isTyping) typingTimer.current = window.setTimeout(() => sendTyping(false), 3500);
  };
  const typingLabel = useMemo(() => typingUserIds.length ? "A connection is typing…" : "", [typingUserIds]);

  if (!token) {
    return <><Navbar /><main className="mx-auto max-w-xl px-5 pt-28 text-center text-slate-200">Sign in with a verified customer account to use business messaging.</main></>;
  }

  return (
    <>
    <Navbar />
    <main className="mx-auto min-h-[calc(100vh-5rem)] max-w-7xl px-3 pb-5 pt-24 text-slate-100 sm:px-6">
      <header className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div><p className="text-xs font-semibold uppercase tracking-[0.2em] text-sky-300">Customer network</p><h1 className="mt-1 text-2xl font-bold">Business messaging</h1><p className="mt-1 text-sm text-slate-400">Connect with verified FuelIQ customers. Private contact details are never listed.</p></div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" className="border-white/10" onClick={() => { setShowProfileEditor((show) => !show); setShowConnections(false); }}><CircleUserRound className="mr-2 h-4 w-4" />My business profile</Button>
          <Button variant="outline" className="border-white/10" onClick={() => { setShowConnections((show) => !show); setShowProfileEditor(false); }}><UserPlus className="mr-2 h-4 w-4" />Connections <span className="ml-1 rounded bg-sky-500/20 px-1.5">{connectionData.data?.requests.length || 0}</span></Button>
        </div>
      </header>
      {(connectionData.isError || conversations.isError || dashboardSummary.isError) && <div role="alert" className="mb-4 rounded-lg border border-red-400/20 bg-red-400/[0.06] p-3 text-sm text-red-200">{(connectionData.error || conversations.error || dashboardSummary.error as Error)?.message || "Messaging data could not be loaded."}</div>}

      {showProfileEditor && (
        <section className="mb-5 rounded-2xl border border-white/10 bg-slate-900/80 p-4">
          <div className="mb-3 flex items-center justify-between"><h2 className="font-semibold">Public business profile</h2><span className="text-xs text-slate-400">No personal phone or email is published</span></div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Input placeholder="Display name" value={profileForm.displayName} onChange={(e) => setProfileForm({ ...profileForm, displayName: e.target.value })} maxLength={100} />
            <Input placeholder="Business name" value={profileForm.businessName} onChange={(e) => setProfileForm({ ...profileForm, businessName: e.target.value })} maxLength={160} />
            <select className="rounded-md border border-white/10 bg-slate-950 px-3 text-sm" value={profileForm.businessCategory} onChange={(e) => setProfileForm({ ...profileForm, businessCategory: e.target.value })}>{categories.map(([id, label]) => <option key={id} value={id}>{label}</option>)}</select>
            <Input placeholder="Fuel products (PMS, AGO…)" value={profileForm.products} onChange={(e) => setProfileForm({ ...profileForm, products: e.target.value })} />
            <Input placeholder="Station name" value={profileForm.stationName} onChange={(e) => setProfileForm({ ...profileForm, stationName: e.target.value })} />
            <Input placeholder="Terminal name" value={profileForm.terminalName} onChange={(e) => setProfileForm({ ...profileForm, terminalName: e.target.value })} />
            <Input placeholder="State" value={profileForm.state} onChange={(e) => setProfileForm({ ...profileForm, state: e.target.value })} />
            <Input placeholder="LGA" value={profileForm.lga} onChange={(e) => setProfileForm({ ...profileForm, lga: e.target.value })} />
            <Input placeholder="City" value={profileForm.city} onChange={(e) => setProfileForm({ ...profileForm, city: e.target.value })} />
          </div>
          <div className="mt-3 flex justify-end"><Button onClick={() => profileMutation.mutate()} disabled={profileMutation.isPending || !profileForm.displayName.trim()}>{profileMutation.isPending ? "Saving…" : "Save profile"}</Button></div>
        </section>
      )}

      {showConnections && (
        <section className="mb-5 grid gap-4 lg:grid-cols-2">
          <div className="rounded-2xl border border-white/10 bg-slate-900/80 p-4">
            <h2 className="mb-3 font-semibold">Pending requests</h2>
            {!connectionData.data?.requests.length && <p className="text-sm text-slate-500">No pending connection requests.</p>}
            <div className="space-y-2">{connectionData.data?.requests.map((item) => (
              <article key={item.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-black/20 p-3">
                <div><p className="font-medium">{item.senderBusinessName || item.senderDisplayName}</p><p className="text-xs text-slate-400">{categoryName(item.senderBusinessCategory)} · {time(item.createdAt)}</p>{item.message && <p className="mt-1 text-sm">{item.message}</p>}</div>
                <div className="flex gap-2">{item.isIncoming ? <><Button size="sm" onClick={() => mutation.mutate({ url: `/api/messaging/connections/requests/${item.id}`, method: "PATCH", body: { action: "accept" } })}><Check className="mr-1 h-4 w-4" />Accept</Button><Button size="sm" variant="outline" onClick={() => mutation.mutate({ url: `/api/messaging/connections/requests/${item.id}`, method: "PATCH", body: { action: "reject" } })}>Decline</Button></> : <Button size="sm" variant="outline" onClick={() => mutation.mutate({ url: `/api/messaging/connections/requests/${item.id}`, method: "PATCH", body: { action: "cancel" } })}>Cancel request</Button>}</div>
              </article>
            ))}</div>
          </div>
          <div className="rounded-2xl border border-white/10 bg-slate-900/80 p-4">
            <h2 className="mb-3 font-semibold">Business connections</h2>
            {!connectionData.data?.connections.length && <p className="text-sm text-slate-500">Accepted connections appear here.</p>}
            <div className="space-y-2">{connectionData.data?.connections.map((connection) => (
              <article key={connection.userId} className="flex items-center justify-between gap-3 rounded-xl bg-black/20 p-3">
                <div><p className="font-medium">{connection.businessName || connection.displayName}</p><p className="text-xs text-slate-400">{categoryName(connection.businessCategory)} · {[connection.city, connection.state].filter(Boolean).join(", ")}</p></div>
                <Button size="sm" onClick={() => void startConversation(connection.userId)}><MessageCircle className="mr-1 h-4 w-4" />Message</Button>
              </article>
            ))}</div>
          </div>
          <div className="rounded-2xl border border-white/10 bg-slate-900/80 p-4 lg:col-span-2">
            <h2 className="mb-3 font-semibold">Blocked accounts</h2>
            <div className="flex flex-wrap gap-2">{blockedUsers.data?.length ? blockedUsers.data.map((blocked) => <Button key={blocked.userId} size="sm" variant="outline" onClick={() => mutation.mutate({ url: "/api/messaging/blocks", method: "DELETE", body: { targetUserId: blocked.userId } })}>Unblock {blocked.businessName || blocked.displayName}</Button>) : <p className="text-sm text-slate-500">No blocked accounts.</p>}</div>
          </div>
        </section>
      )}

      <section className="mb-5 rounded-2xl border border-white/10 bg-slate-900/80 p-4">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2"><div><h2 className="font-semibold">Discover business customers</h2><p className="text-xs text-slate-400">Search public profiles. Contact details remain private.</p></div></div>
        <div className="mb-4 grid grid-cols-2 gap-2 md:grid-cols-3 xl:grid-cols-6">
          {[
            ["Conversations", dashboardSummary.data?.totalConversations || 0],
            ["Unread", dashboardSummary.data?.unreadMessages || 0],
            ["Connections", dashboardSummary.data?.acceptedConnections || 0],
            ["Pending requests", dashboardSummary.data?.pendingRequests || 0],
            ["Enquiries sent", dashboardSummary.data?.enquiriesSent || 0],
            ["Enquiries received", dashboardSummary.data?.enquiriesReceived || 0],
          ].map(([label, count]) => <div key={label} className="rounded-lg bg-black/20 px-3 py-2"><p className="text-lg font-semibold">{count}</p><p className="text-[11px] text-slate-400">{label}</p></div>)}
        </div>
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
          <div className="relative"><Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-500" /><Input className="pl-9" placeholder="Business, person, station, terminal or location" value={query} onChange={(e) => setQuery(e.target.value)} /></div>
          <Input placeholder="State" value={stateFilter} onChange={(e) => setStateFilter(e.target.value)} />
          <Input placeholder="LGA" value={lgaFilter} onChange={(e) => setLgaFilter(e.target.value)} />
          <Input placeholder="City" value={cityFilter} onChange={(e) => setCityFilter(e.target.value)} />
          <select className="rounded-md border border-white/10 bg-slate-950 px-3 text-sm" value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)}><option value="">All business categories</option>{categories.map(([id, label]) => <option key={id} value={id}>{label}</option>)}</select>
          <select className="rounded-md border border-white/10 bg-slate-950 px-3 text-sm" value={productFilter} onChange={(e) => setProductFilter(e.target.value)}><option value="">Any fuel product</option>{productOptions.map((item) => <option key={item}>{item}</option>)}</select>
        </div>
        <label className="mt-2 inline-flex items-center gap-2 text-xs text-slate-400"><input type="checkbox" checked={verifiedOnly} onChange={(e) => setVerifiedOnly(e.target.checked)} />Verified businesses only</label>
        {discovery.isError && <p className="mt-3 text-sm text-red-300">{(discovery.error as Error).message}</p>}
        {query.trim().length >= 2 && <div className="mt-3 grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
          {discovery.isLoading ? <p className="text-sm text-slate-400">Searching registered business profiles…</p>
            : discovery.data?.length ? discovery.data.map((business) => (
              <article key={business.userId} className="rounded-xl border border-white/[0.08] bg-black/20 p-3">
                <div className="flex items-start justify-between gap-2"><div><p className="font-medium">{business.businessName || business.displayName}</p><p className="text-xs text-slate-400">{categoryName(business.businessCategory)}</p></div><div className="flex gap-1">{business.customerVerified && <span title="Verified customer"><ShieldCheck className="h-4 w-4 text-sky-300" /></span>}{business.businessVerified && <span title="Verified business"><CheckCheck className="h-4 w-4 text-emerald-300" /></span>}</div></div>
                <p className="mt-2 text-xs text-slate-400">{[business.stationName, business.terminalName, business.city, business.lga, business.state].filter(Boolean).join(" · ") || "Location not listed"}</p>
                <p className="mt-1 text-xs text-slate-500">Products: {business.products?.join(", ") || "Not listed"} · Verified business is distinct from official NNPC authorisation.</p>
                <div className="mt-3 flex justify-between gap-2"><Button size="sm" variant="ghost" onClick={() => void request<Business>(`/api/messaging/business-profile/${business.userId}`, "GET", token!).then(setSelectedBusiness).catch((error) => toast({ title: "Profile unavailable", description: error.message, variant: "destructive" }))}>View profile</Button><Button size="sm" onClick={() => mutation.mutate({ url: "/api/messaging/connections/requests", method: "POST", body: { targetUserId: business.userId } })}><UserPlus className="mr-1 h-4 w-4" />Connect</Button></div>
              </article>
            )) : <p className="text-sm text-slate-500">No matching verified business profiles. Customers appear after opting in with a public business profile.</p>}
        </div>}
        {selectedBusiness && <article className="mt-4 rounded-xl border border-sky-400/20 bg-sky-400/[0.04] p-4">
          <div className="flex items-start justify-between gap-3"><div><h3 className="font-semibold">{selectedBusiness.businessName || selectedBusiness.displayName}</h3><p className="text-xs text-slate-400">{categoryName(selectedBusiness.businessCategory)}{selectedBusiness.businessVerified ? " · Verified business" : ""}</p></div><Button size="sm" variant="ghost" onClick={() => setSelectedBusiness(null)}>Close</Button></div>
          <p className="mt-2 text-sm text-slate-300">{[selectedBusiness.stationName, selectedBusiness.terminalName, selectedBusiness.city, selectedBusiness.lga, selectedBusiness.state].filter(Boolean).join(" · ") || "No public location provided"}</p>
          <p className="mt-1 text-xs text-slate-400">Products handled: {selectedBusiness.products?.join(", ") || "Not specified"}. Only an administrator can verify a business. No official NNPC authorisation is implied.</p>
        </article>}
      </section>

      <section className="mb-4 flex flex-wrap items-center gap-x-6 gap-y-2 rounded-xl border border-white/[0.07] bg-slate-900/50 px-4 py-3 text-xs text-slate-300">
        <span className="font-medium">Messaging preferences</span>
        <label className="inline-flex items-center gap-2"><input type="checkbox" checked={preferences.data?.notificationsEnabled ?? true} onChange={(e) => preferencesMutation.mutate({ notificationsEnabled: e.target.checked })} />In-app notifications</label>
        <label className="inline-flex items-center gap-2"><input type="checkbox" checked={preferences.data?.showMessagePreviews ?? false} onChange={(e) => preferencesMutation.mutate({ showMessagePreviews: e.target.checked })} />Show last-message previews in inbox</label>
        <span className="text-slate-500">Notification cards never include message content.</span>
      </section>

      {notifications.data?.some((item) => !item.readAt) && <div className="mb-4 flex flex-wrap gap-2">{notifications.data.filter((item) => !item.readAt).slice(0, 4).map((item) => <button key={item.id} onClick={() => mutation.mutate({ url: `/api/messaging/notifications/${item.id}/read`, method: "PATCH" })} className="rounded-lg border border-sky-400/20 bg-sky-400/[0.06] px-3 py-2 text-xs text-sky-100">{item.type.replaceAll("_", " ")} · {time(item.createdAt)} · mark read</button>)}</div>}

      <section className="grid min-h-[560px] overflow-hidden rounded-2xl border border-white/10 bg-slate-900/70 lg:grid-cols-[340px_1fr]">
        <aside className={`${activeConversationId ? "hidden lg:block" : ""} border-b border-white/10 lg:border-b-0 lg:border-r`}>
          <div className="flex items-center justify-between border-b border-white/10 p-3"><h2 className="font-semibold">{showArchived ? "Archived" : "Inbox"}</h2><Button size="sm" variant="ghost" onClick={() => setShowArchived((show) => !show)}><Archive className="mr-1 h-4 w-4" />{showArchived ? "Inbox" : "Archived"}</Button></div>
          <div className="max-h-[600px] divide-y divide-white/[0.06] overflow-y-auto">
            {visibleConversations.length ? visibleConversations.map((conversation) => <button key={conversation.id} onClick={() => setActiveConversationId(conversation.id)} className={`w-full px-3 py-3 text-left hover:bg-white/[0.04] ${activeConversationId === conversation.id ? "bg-sky-400/[0.07]" : ""}`}>
              <div className="flex items-center justify-between gap-2"><p className="truncate text-sm font-medium">{conversation.businessName || conversation.displayName}</p><span className="shrink-0 text-[10px] text-slate-500">{time(conversation.lastMessageAt)}</span></div>
              <p className="truncate text-xs text-slate-400">{conversation.lastMessage || categoryName(conversation.businessCategory)}</p>
              {conversation.unreadCount > 0 && <span className="mt-1 inline-block rounded-full bg-sky-500 px-2 py-0.5 text-[10px] font-semibold text-slate-950">{conversation.unreadCount} unread</span>}
            </button>) : <p className="p-5 text-sm text-slate-500">No conversations yet. Connect with a business customer to start one.</p>}
          </div>
        </aside>
        <div className={`${activeConversationId ? "" : "hidden lg:flex"} min-w-0 flex-col`}>
          {activeConversation ? <>
            <header className="flex flex-wrap items-center justify-between gap-2 border-b border-white/10 p-3">
              <div className="flex items-center gap-2"><Button className="lg:hidden" size="icon" variant="ghost" onClick={() => setActiveConversationId("")}><ArrowLeft className="h-4 w-4" /></Button><div><p className="font-semibold">{activeConversation.businessName || activeConversation.displayName}</p><p className="text-xs text-slate-400">{categoryName(activeConversation.businessCategory)}{activeConversation.businessVerified ? " · Verified business" : ""} · {[activeConversation.city, activeConversation.state].filter(Boolean).join(", ")}</p><p className="text-[11px] text-slate-500">Products: {activeConversation.products?.join(", ") || "Not specified"} · No official NNPC status is implied.</p></div><Button size="sm" variant="ghost" onClick={() => void request<Business>(`/api/messaging/business-profile/${activeConversation.otherUserId}`, "GET", token!).then(setSelectedBusiness).catch((error) => toast({ title: "Profile unavailable", description: error.message, variant: "destructive" }))}>View business profile</Button></div>
              <div className="flex gap-1"><Button size="sm" variant="ghost" onClick={() => mutation.mutate({ url: `/api/messaging/conversations/${activeConversationId}/state`, method: "PATCH", body: { archived: !activeConversation.archivedAt } })}><Archive className="mr-1 h-4 w-4" />{activeConversation.archivedAt ? "Unarchive" : "Archive"}</Button><Button size="sm" variant="ghost" onClick={() => mutation.mutate({ url: `/api/messaging/conversations/${activeConversationId}/state`, method: "PATCH", body: { muteUntil: activeConversation.mutedUntil && new Date(activeConversation.mutedUntil) > new Date() ? null : new Date(Date.now() + 24 * 60 * 60_000).toISOString() } })}>{activeConversation.mutedUntil && new Date(activeConversation.mutedUntil) > new Date() ? "Unmute" : "Mute 24h"}</Button><Button size="sm" variant="ghost" onClick={() => mutation.mutate({ url: "/api/messaging/blocks", method: "POST", body: { targetUserId: activeConversation.otherUserId } })}><Ban className="mr-1 h-4 w-4" />Block</Button><Button size="sm" variant="ghost" onClick={() => mutation.mutate({ url: "/api/messaging/reports", method: "POST", body: { reportedUserId: activeConversation.otherUserId, conversationId: activeConversationId, reason: "Reported for inappropriate business messaging." } })}>Report</Button></div>
            </header>
            <div className="flex flex-wrap items-center gap-2 border-b border-white/[0.06] p-2">
              <Input className="h-8 max-w-sm" placeholder="Search in conversation" value={messageSearch} onChange={(e) => setMessageSearch(e.target.value)} />
              <Button size="sm" variant="outline" onClick={() => setEnquiryOpen((show) => !show)}>Business enquiry</Button>
            </div>
            {enquiryOpen && <form className="grid gap-2 border-b border-white/[0.06] bg-black/20 p-3 sm:grid-cols-3" onSubmit={(e) => { e.preventDefault(); enquiryMutation.mutate(); }}>
              <select className="rounded-md border border-white/10 bg-slate-950 px-3 text-sm" value={enquiry.productType} onChange={(e) => setEnquiry({ ...enquiry, productType: e.target.value })}>{productOptions.map((item) => <option key={item}>{item}</option>)}</select>
              <Input placeholder="Quantity" type="number" min="0" step="any" value={enquiry.quantity} onChange={(e) => setEnquiry({ ...enquiry, quantity: e.target.value })} />
              <Input placeholder="Proposed price (₦)" type="number" min="0" step="any" value={enquiry.proposedPrice} onChange={(e) => setEnquiry({ ...enquiry, proposedPrice: e.target.value })} />
              <Input placeholder="Delivery or collection location" value={enquiry.deliveryLocation} onChange={(e) => setEnquiry({ ...enquiry, deliveryLocation: e.target.value })} />
              <Input type="date" value={enquiry.preferredDeliveryDate} onChange={(e) => setEnquiry({ ...enquiry, preferredDeliveryDate: e.target.value })} />
              <Input placeholder="Additional requirements" value={enquiry.requirements} onChange={(e) => setEnquiry({ ...enquiry, requirements: e.target.value })} />
              <div className="sm:col-span-3"><Button size="sm" type="submit" disabled={enquiryMutation.isPending}>{enquiryMutation.isPending ? "Sending…" : "Send enquiry"}</Button></div>
            </form>}
            <div className="flex-1 space-y-3 overflow-y-auto p-4">
              {messages.isLoading && <p className="text-sm text-slate-400">Loading conversation…</p>}
              {messages.isError && <p className="text-sm text-red-300">{(messages.error as Error).message}</p>}
              {!messages.isLoading && !messages.data?.messages.length && <div className="grid h-full place-items-center text-center"><div><MessageCircle className="mx-auto h-8 w-8 text-slate-600" /><p className="mt-2 text-sm text-slate-400">This is the beginning of your private business conversation.</p></div></div>}
              {messages.data?.messages.map((message) => {
                const own = message.senderUserId === currentUserId;
                const repliedTo = messages.data?.messages.find((item) => item.id === message.replyToMessageId);
                return <article key={message.id} className={`max-w-[90%] rounded-2xl px-3 py-2 sm:max-w-[75%] ${own ? "ml-auto bg-sky-500/15" : "bg-black/30"}`}>
                  {repliedTo && <p className="mb-1 border-l-2 border-sky-300/50 pl-2 text-xs text-slate-400">{repliedTo.body}</p>}
                  <p className="whitespace-pre-wrap break-words text-sm">{message.body}</p>
                  {message.attachments?.map((attachment) => <button key={attachment.id} className="mt-2 flex items-center gap-2 rounded-lg bg-black/20 p-2 text-xs text-sky-200" onClick={() => void request<{ url: string }>(`/api/messaging/attachments/${attachment.id}`, "GET", token!).then(({ url }) => window.open(url, "_blank", "noopener,noreferrer")).catch((error) => toast({ title: "Attachment unavailable", description: error.message, variant: "destructive" }))}><FileText className="h-4 w-4" />{attachment.fileName}</button>)}
                  <div className="mt-1 flex items-center justify-end gap-1 text-[10px] text-slate-500"><span>{time(message.createdAt)}{message.editedAt ? " · edited" : ""}</span>{own && (message.read ? <CheckCheck className="h-3 w-3 text-sky-300" /> : message.delivered ? <CheckCheck className="h-3 w-3" /> : <Check className="h-3 w-3" />)}</div>
                  {!message.deletedAt && <div className="mt-1 flex justify-end gap-2">{!own && <button className="text-[10px] text-slate-500" onClick={() => setReplyTargetId(message.id)}>Reply</button>}{own && <><button className="text-[10px] text-slate-500" onClick={() => { const replacement = window.prompt("Edit message", message.body); if (replacement) mutation.mutate({ url: `/api/messaging/messages/${message.id}`, method: "PATCH", body: { body: replacement } }); }}>Edit</button><button className="text-[10px] text-slate-500" onClick={() => mutation.mutate({ url: `/api/messaging/messages/${message.id}`, method: "DELETE" })}>Delete</button></>}</div>}
                </article>;
              })}
              <div ref={messageEnd} />
            </div>
            <div className="min-h-5 px-4 text-xs text-slate-400">{typingLabel}</div>
            <form className="flex flex-wrap items-end gap-2 border-t border-white/10 p-3" onSubmit={(e) => { e.preventDefault(); if (messageText.trim() || selectedFile) sendMutation.mutate(); }}>
              <label className="grid h-10 w-10 cursor-pointer place-items-center rounded-md border border-white/10 text-slate-400 hover:text-white" title="Attach image or PDF"><Paperclip className="h-4 w-4" /><input className="hidden" type="file" accept="image/jpeg,image/png,image/webp,application/pdf" onChange={(e) => setSelectedFile(e.target.files?.[0] || null)} /></label>
              <div className="min-w-[160px] flex-1">{replyTargetId && <p className="mb-1 flex items-center justify-between text-xs text-sky-200">Replying to {messages.data?.messages.find((message) => message.id === replyTargetId)?.body.slice(0, 80)}<button type="button" onClick={() => setReplyTargetId("")}>Cancel</button></p>}{selectedFile && <p className="mb-1 text-xs text-sky-200">{selectedFile.name} · {(selectedFile.size / 1024 / 1024).toFixed(1)} MB</p>}<textarea className="min-h-10 w-full resize-y rounded-md border border-white/10 bg-slate-950 px-3 py-2 text-sm outline-none focus:border-sky-400" placeholder="Write a business message…" value={messageText} maxLength={5000} onChange={(e) => { setMessageText(e.target.value); sendTyping(true); }} onBlur={() => sendTyping(false)} /></div>
              <Button type="submit" disabled={sendMutation.isPending || (!messageText.trim() && !selectedFile)}><Send className="mr-2 h-4 w-4" />Send</Button>
            </form>
          </> : <div className="grid min-h-[560px] place-items-center p-8 text-center"><div><MessageCircle className="mx-auto h-10 w-10 text-slate-600" /><p className="mt-3 font-medium">Choose a conversation</p><p className="mt-1 text-sm text-slate-500">Messages are private to the participants. Administrators do not have default access to conversation content.</p></div></div>}
        </div>
      </section>
      <p className="mt-3 text-center text-xs text-slate-500">Customer verified and business verified are separate labels. Registered locations do not imply official NNPC authorisation.</p>
    </main>
    </>
  );
}
