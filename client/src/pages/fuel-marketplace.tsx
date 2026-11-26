import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { BadgeCheck, Bell, Check, ChevronRight, MapPin, MessageCircle, Package, Plus, Search, ShieldAlert, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Navbar } from "@/components/navbar";
import { useAuth } from "@/lib/auth";
import { queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

type Category = { id: string; name: string; description: string };
type Listing = {
  id: string; ownerUserId: string; title: string; description: string; categoryId: string; categoryName: string;
  listingType: string; productType?: string; quantity?: number; unit: string; price?: number; minimumOrder?: number;
  state?: string; lga?: string; city?: string; deliveryAvailable: boolean; collectionAvailable: boolean;
  availability: string; expiresAt: string; createdAt: string; displayName: string; businessName?: string; businessVerified: boolean;
};
type RequestItem = {
  id: string; buyerUserId: string; title: string; productType: string; quantity: number; targetPriceMin?: number;
  targetPriceMax?: number; state: string; lga?: string; city?: string; deliveryRequired: boolean; requirements?: string;
  expiresAt: string; displayName: string; businessName?: string; businessVerified: boolean;
};
type MarketplaceDashboard = {
  summary: Record<string, number>;
  listings: Array<{ id: string; title: string; productType?: string; status: string; expiresAt: string; documents: Array<{ id: string; fileName: string }> }>;
  requests: Array<{ id: string; title: string; productType: string; quantity: number; state: string; status: string; expiresAt: string }>;
  offers: Array<{ id: string; requestId: string; requestTitle: string; quantity: number; price: number; status: string; direction: string; buyerUserId: string; supplierUserId: string }>;
  matches: Array<{ id: string; requestId: string; listingId?: string; score: number; reasons: string[]; requestTitle: string; productType: string; quantity: number; state: string; listingTitle?: string; price?: number; listingQuantity?: number; supplierUserId: string; buyerUserId: string; businessName: string; businessVerified: boolean }>;
  enquiries: Array<{ id: string; listingId?: string; senderUserId: string; recipientUserId: string; message: string; status: string; listingTitle?: string }>;
  notifications: Array<{ id: string; type: string; readAt?: string; createdAt: string }>;
};
type Preferences = {
  roles: string[]; productsSupply: string[]; productsNeed: string[]; preferredStates: string[];
  minQuantity?: number; maxQuantity?: number; minPrice?: number; maxPrice?: number;
  deliveryRequired: boolean; marketplaceNotificationsEnabled: boolean;
};

const products = ["PMS", "AGO", "DPK", "LPG"];
const roles = ["supplier", "bulk_buyer", "retail_station_owner", "terminal_operator", "fuel_distributor", "transporter", "business_partner", "other"];
const expiry = () => new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
const naira = (value?: number | string | null) => value === undefined || value === null || value === "" ? "Contact for price" : `₦${Number(value).toLocaleString("en-NG")}`;

async function request<T>(url: string, method: string, token: string, body?: unknown): Promise<T> {
  const response = await fetch(url, {
    method,
    headers: { Authorization: `Bearer ${token}`, ...(body === undefined ? {} : { "Content-Type": "application/json" }) },
    body: body === undefined ? undefined : JSON.stringify(body),
    credentials: "include",
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(result.message || "Marketplace request failed.");
  return result.data as T;
}

function formatDate(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "Unknown date" : date.toLocaleDateString("en-NG");
}

function dateInput(days = 30) {
  return new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

export default function FuelMarketplacePage() {
  const { user, token } = useAuth();
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const [tab, setTab] = useState<"browse" | "requests" | "dashboard" | "preferences">("browse");
  const [search, setSearch] = useState("");
  const [filterProduct, setFilterProduct] = useState("");
  const [filterState, setFilterState] = useState("");
  const [filterCategory, setFilterCategory] = useState("");
  const [filterMinPrice, setFilterMinPrice] = useState("");
  const [filterMaxPrice, setFilterMaxPrice] = useState("");
  const [filterMinQuantity, setFilterMinQuantity] = useState("");
  const [deliveryOnly, setDeliveryOnly] = useState(false);
  const [verifiedOnly, setVerifiedOnly] = useState(false);
  const [sort, setSort] = useState("relevant");
  const [listingFormOpen, setListingFormOpen] = useState(false);
  const [requestFormOpen, setRequestFormOpen] = useState(false);
  const [enquiryListing, setEnquiryListing] = useState<Listing | null>(null);
  const [enquiryMessage, setEnquiryMessage] = useState("");
  const [offerRequest, setOfferRequest] = useState<RequestItem | null>(null);
  const [listingDocument, setListingDocument] = useState<File | null>(null);
  const [prefs, setPrefs] = useState<Preferences>({
    roles: [], productsSupply: [], productsNeed: [], preferredStates: [], deliveryRequired: false,
    marketplaceNotificationsEnabled: true,
  });
  const [listingForm, setListingForm] = useState({
    title: "", description: "", categoryId: "fuel_supply", listingType: "supply", productType: "PMS",
    quantity: "", unit: "litres", price: "", minimumOrder: "", state: "", lga: "", city: "",
    deliveryAvailable: false, collectionAvailable: true, expiresAt: dateInput(),
  });
  const [requestForm, setRequestForm] = useState({
    title: "", productType: "PMS", quantity: "", targetPriceMin: "", targetPriceMax: "",
    state: "", lga: "", city: "", deliveryRequired: false, requiredDeliveryDate: "", requirements: "",
    expiresAt: dateInput(),
  });
  const [offerForm, setOfferForm] = useState({ quantity: "", price: "", deliveryTerms: "", location: "", conditions: "", expiresAt: dateInput(7) });

  const categoryQuery = useQuery<Category[]>({
    queryKey: ["marketplace-categories"], enabled: !!token,
    queryFn: () => request("/api/marketplace/categories", "GET", token!),
  });
  const filters = useMemo(() => new URLSearchParams({
    ...(search.trim() ? { q: search.trim() } : {}),
    ...(filterProduct ? { product: filterProduct } : {}),
    ...(filterState ? { state: filterState } : {}),
    ...(filterCategory ? { category: filterCategory } : {}),
    ...(filterMinPrice ? { minPrice: filterMinPrice } : {}),
    ...(filterMaxPrice ? { maxPrice: filterMaxPrice } : {}),
    ...(filterMinQuantity ? { minQuantity: filterMinQuantity } : {}),
    ...(deliveryOnly ? { delivery: "true" } : {}),
    ...(verifiedOnly ? { verified: "true" } : {}),
    sort,
  }).toString(), [search, filterProduct, filterState, filterCategory, filterMinPrice, filterMaxPrice, filterMinQuantity, deliveryOnly, verifiedOnly, sort]);
  const listingsQuery = useQuery<Listing[]>({
    queryKey: ["marketplace-listings", filters], enabled: !!token,
    queryFn: () => request(`/api/marketplace/listings?${filters}`, "GET", token!),
  });
  const requestsQuery = useQuery<RequestItem[]>({
    queryKey: ["marketplace-requests"], enabled: !!token,
    queryFn: () => request("/api/marketplace/requests", "GET", token!),
  });
  const dashboardQuery = useQuery<MarketplaceDashboard>({
    queryKey: ["marketplace-dashboard"], enabled: !!token,
    queryFn: () => request("/api/marketplace/dashboard", "GET", token!),
  });
  const preferencesQuery = useQuery<Preferences>({
    queryKey: ["marketplace-preferences"], enabled: !!token,
    queryFn: async () => {
      const saved = await request<Preferences>("/api/marketplace/preferences", "GET", token!);
      setPrefs(saved);
      return saved;
    },
  });
  useEffect(() => {
    if (preferencesQuery.data) setPrefs(preferencesQuery.data);
  }, [preferencesQuery.data]);
  const refresh = () => {
    for (const key of ["marketplace-listings", "marketplace-requests", "marketplace-dashboard", "marketplace-preferences"]) {
      void queryClient.invalidateQueries({ queryKey: [key] });
    }
  };
  const mutation = useMutation({
    mutationFn: ({ url, method, body }: { url: string; method: string; body?: unknown }) => request(url, method, token!, body),
    onSuccess: refresh,
    onError: (error) => toast({ title: "Marketplace action failed", description: (error as Error).message, variant: "destructive" }),
  });
  const listingMutation = useMutation({
    mutationFn: async () => {
      const listing = await request<{ id: string }>("/api/marketplace/listings", "POST", token!, {
        ...listingForm, quantity: listingForm.quantity ? Number(listingForm.quantity) : undefined,
        price: listingForm.price ? Number(listingForm.price) : undefined,
        minimumOrder: listingForm.minimumOrder ? Number(listingForm.minimumOrder) : undefined,
        expiresAt: new Date(`${listingForm.expiresAt}T23:59:59+01:00`).toISOString(),
      });
      if (!listingDocument) return { documentError: "", listing };
      const upload = await fetch(`/api/marketplace/listings/${listing.id}/documents`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/octet-stream",
          "X-File-Name": listingDocument.name,
          "X-File-Type": listingDocument.type,
        },
        body: listingDocument,
      });
      const response = await upload.json().catch(() => ({}));
      return { documentError: upload.ok ? "" : response.message || "Document upload failed.", listing };
    },
    onSuccess: (result) => {
      setListingFormOpen(false);
      setListingDocument(null);
      setListingForm((form) => ({ ...form, title: "", description: "", quantity: "", price: "", minimumOrder: "" }));
      toast({
        title: "Listing published",
        description: result.documentError
          ? `The listing is live, but its optional document was not attached: ${result.documentError}`
          : "Your listing is visible to eligible marketplace customers.",
        ...(result.documentError ? { variant: "destructive" as const } : {}),
      });
      refresh();
    },
    onError: (error) => toast({ title: "Listing could not be published", description: (error as Error).message, variant: "destructive" }),
  });
  const buyerRequestMutation = useMutation({
    mutationFn: () => request("/api/marketplace/requests", "POST", token!, {
      ...requestForm, quantity: Number(requestForm.quantity),
      targetPriceMin: requestForm.targetPriceMin ? Number(requestForm.targetPriceMin) : undefined,
      targetPriceMax: requestForm.targetPriceMax ? Number(requestForm.targetPriceMax) : undefined,
      requiredDeliveryDate: requestForm.requiredDeliveryDate || undefined,
      expiresAt: new Date(`${requestForm.expiresAt}T23:59:59+01:00`).toISOString(),
    }),
    onSuccess: () => {
      setRequestFormOpen(false);
      setRequestForm((form) => ({ ...form, title: "", quantity: "", requirements: "" }));
      toast({ title: "Procurement request published", description: "Matching suppliers can now see your request." });
      refresh();
    },
    onError: (error) => toast({ title: "Request could not be published", description: (error as Error).message, variant: "destructive" }),
  });
  const contactMutation = useMutation({
    mutationFn: async () => {
      if (!enquiryListing) throw new Error("Choose a marketplace listing first.");
      const enquiry = await request<{ recipientUserId: string }>(
        `/api/marketplace/listings/${enquiryListing.id}/enquiries`, "POST", token!, { message: enquiryMessage },
      );
      const conversation = await request<{ id: string }>("/api/messaging/conversations", "POST", token!, { targetUserId: enquiry.recipientUserId });
      return conversation.id;
    },
    onSuccess: (conversationId) => {
      setEnquiryListing(null);
      setEnquiryMessage("");
      refresh();
      setLocation(`/messages?conversationId=${conversationId}`);
    },
    onError: (error) => toast({ title: "Enquiry could not be sent", description: (error as Error).message, variant: "destructive" }),
  });
  const offerMutation = useMutation({
    mutationFn: async () => {
      if (!offerRequest) throw new Error("Choose a request first.");
      const offer = await request<{ id: string }>(`/api/marketplace/requests/${offerRequest.id}/offers`, "POST", token!, {
        productType: offerRequest.productType, quantity: Number(offerForm.quantity), price: Number(offerForm.price),
        deliveryTerms: offerForm.deliveryTerms, location: offerForm.location, conditions: offerForm.conditions || undefined,
        expiresAt: new Date(`${offerForm.expiresAt}T23:59:59+01:00`).toISOString(),
      });
      const conversation = await request<{ id: string }>("/api/messaging/conversations", "POST", token!, { targetUserId: offerRequest.buyerUserId });
      return conversation.id;
    },
    onSuccess: (conversationId) => {
      setOfferRequest(null);
      refresh();
      setLocation(`/messages?conversationId=${conversationId}`);
    },
    onError: (error) => toast({ title: "Offer could not be sent", description: (error as Error).message, variant: "destructive" }),
  });
  const preferenceMutation = useMutation({
    mutationFn: () => request("/api/marketplace/preferences", "PUT", token!, prefs),
    onSuccess: () => toast({ title: "Business preferences saved" }),
    onError: (error) => toast({ title: "Preferences could not be saved", description: (error as Error).message, variant: "destructive" }),
  });

  if (!token) return <><Navbar /><main className="mx-auto max-w-xl px-5 pt-28 text-center text-slate-200">Sign in with an approved, verified customer account to use the Fuel Business Marketplace.</main></>;

  const toggleArray = (key: "roles" | "productsSupply" | "productsNeed", item: string) => {
    setPrefs((current) => ({ ...current, [key]: current[key].includes(item) ? current[key].filter((value) => value !== item) : [...current[key], item] }));
  };
  const openConversation = async (targetUserId: string) => {
    try {
      const conversation = await request<{ id: string }>("/api/messaging/conversations", "POST", token, { targetUserId });
      setLocation(`/messages?conversationId=${conversation.id}`);
    } catch (error) {
      toast({ title: "Could not open business chat", description: (error as Error).message, variant: "destructive" });
    }
  };
  const openDocument = async (documentId: string) => {
    try {
      const link = await request<{ url: string }>(`/api/marketplace/documents/${documentId}`, "GET", token);
      window.open(link.url, "_blank", "noopener,noreferrer");
    } catch (error) {
      toast({ title: "Document unavailable", description: (error as Error).message, variant: "destructive" });
    }
  };
  const dashboard = dashboardQuery.data;

  return (
    <>
      <Navbar />
      <main className="min-h-screen bg-[#060b18] px-3 pb-12 pt-24 text-slate-100 sm:px-6" data-testid="page-fuel-marketplace">
        <div className="mx-auto max-w-7xl space-y-6">
          <header className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-sky-300">FuelIQ business network</p>
              <h1 className="mt-1 text-3xl font-bold">Fuel Business Marketplace</h1>
              <p className="mt-2 max-w-2xl text-sm text-slate-400">Discover supply, procurement, logistics and partnership opportunities from registered customers. Listings are not independently confirmed supply or price guarantees.</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" className="border-white/10" onClick={() => setListingFormOpen((open) => !open)}><Plus className="mr-2 h-4 w-4" />Publish listing</Button>
              <Button className="bg-sky-600 hover:bg-sky-500" onClick={() => setRequestFormOpen((open) => !open)}><Package className="mr-2 h-4 w-4" />Post buyer request</Button>
            </div>
          </header>

          <nav className="flex flex-wrap gap-2" aria-label="Marketplace sections">
            {([
              ["browse", "Browse listings"], ["requests", "Buyer requests"], ["dashboard", "My marketplace"],
              ["preferences", "Business preferences"],
            ] as const).map(([key, label]) => <button key={key} onClick={() => setTab(key)} className={`rounded-full border px-4 py-2 text-sm transition ${tab === key ? "border-sky-300/30 bg-sky-300/10 text-sky-100" : "border-white/10 text-slate-400 hover:text-white"}`}>{label}</button>)}
            <button onClick={() => setLocation("/messages")} className="ml-auto flex items-center gap-2 rounded-full border border-white/10 px-4 py-2 text-sm text-slate-300"><MessageCircle className="h-4 w-4" />Messages</button>
          </nav>

          {(listingFormOpen || requestFormOpen) && (
            <section className="grid gap-4 lg:grid-cols-2">
              {listingFormOpen && <form onSubmit={(event) => { event.preventDefault(); listingMutation.mutate(); }} className="space-y-3 rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                <div className="flex items-center justify-between"><h2 className="font-semibold">Publish a business listing</h2><button type="button" onClick={() => setListingFormOpen(false)}><X className="h-4 w-4 text-slate-400" /></button></div>
                <Input required minLength={5} maxLength={180} placeholder="Listing title" value={listingForm.title} onChange={(e) => setListingForm({ ...listingForm, title: e.target.value })} />
                <textarea required minLength={10} maxLength={5000} className="min-h-24 w-full rounded-md border border-white/10 bg-slate-950/60 p-3 text-sm" placeholder="Describe the product, service, terms and availability" value={listingForm.description} onChange={(e) => setListingForm({ ...listingForm, description: e.target.value })} />
                <div className="grid gap-3 sm:grid-cols-2">
                  <select className="rounded-md border border-white/10 bg-slate-950 p-2 text-sm" value={listingForm.categoryId} onChange={(e) => setListingForm({ ...listingForm, categoryId: e.target.value })}>{(categoryQuery.data || []).map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}</select>
                  <select className="rounded-md border border-white/10 bg-slate-950 p-2 text-sm" value={listingForm.listingType} onChange={(e) => setListingForm({ ...listingForm, listingType: e.target.value })}><option value="supply">Fuel for sale</option><option value="service">Business service</option></select>
                  <select className="rounded-md border border-white/10 bg-slate-950 p-2 text-sm" value={listingForm.productType} onChange={(e) => setListingForm({ ...listingForm, productType: e.target.value })}>{products.map((product) => <option key={product}>{product}</option>)}</select>
                  <Input type="number" min="0.01" step="0.01" placeholder="Available quantity" value={listingForm.quantity} onChange={(e) => setListingForm({ ...listingForm, quantity: e.target.value })} />
                  <Input type="number" min="0.01" step="0.01" placeholder="Price per litre / unit (₦)" value={listingForm.price} onChange={(e) => setListingForm({ ...listingForm, price: e.target.value })} />
                  <Input type="number" min="0.01" step="0.01" placeholder="Minimum order" value={listingForm.minimumOrder} onChange={(e) => setListingForm({ ...listingForm, minimumOrder: e.target.value })} />
                  <Input placeholder="State" value={listingForm.state} onChange={(e) => setListingForm({ ...listingForm, state: e.target.value })} />
                  <Input placeholder="LGA" value={listingForm.lga} onChange={(e) => setListingForm({ ...listingForm, lga: e.target.value })} />
                  <Input placeholder="City / town" value={listingForm.city} onChange={(e) => setListingForm({ ...listingForm, city: e.target.value })} />
                  <Input type="date" required min={dateInput(1)} max={dateInput(90)} value={listingForm.expiresAt} onChange={(e) => setListingForm({ ...listingForm, expiresAt: e.target.value })} />
                </div>
                <label className="block text-xs text-slate-400">Optional business document (PDF, JPEG, PNG or WebP; up to 10 MB)<input className="mt-2 block w-full text-sm text-slate-300 file:mr-3 file:rounded-md file:border-0 file:bg-sky-500/15 file:px-3 file:py-2 file:text-sky-200" type="file" accept=".pdf,image/jpeg,image/png,image/webp" onChange={(e) => {
                  const file = e.target.files?.[0] || null;
                  if (file && (file.size > 10 * 1024 * 1024 || !["application/pdf", "image/jpeg", "image/png", "image/webp"].includes(file.type))) {
                    toast({ title: "Unsupported document", description: "Choose a PDF, JPEG, PNG or WebP file no larger than 10 MB.", variant: "destructive" });
                    e.target.value = "";
                    setListingDocument(null);
                    return;
                  }
                  setListingDocument(file);
                }} /></label>
                <div className="flex flex-wrap gap-4 text-sm text-slate-300"><label className="flex gap-2"><input type="checkbox" checked={listingForm.deliveryAvailable} onChange={(e) => setListingForm({ ...listingForm, deliveryAvailable: e.target.checked })} />Delivery available</label><label className="flex gap-2"><input type="checkbox" checked={listingForm.collectionAvailable} onChange={(e) => setListingForm({ ...listingForm, collectionAvailable: e.target.checked })} />Collection available</label></div>
                <Button type="submit" disabled={listingMutation.isPending} className="w-full">{listingMutation.isPending ? "Publishing…" : "Publish listing"}</Button>
              </form>}

              {requestFormOpen && <form onSubmit={(event) => { event.preventDefault(); buyerRequestMutation.mutate(); }} className="space-y-3 rounded-2xl border border-sky-300/20 bg-sky-300/[0.03] p-4">
                <div className="flex items-center justify-between"><h2 className="font-semibold">Post a procurement request</h2><button type="button" onClick={() => setRequestFormOpen(false)}><X className="h-4 w-4 text-slate-400" /></button></div>
                <Input required minLength={5} maxLength={180} placeholder="What are you looking to buy?" value={requestForm.title} onChange={(e) => setRequestForm({ ...requestForm, title: e.target.value })} />
                <div className="grid gap-3 sm:grid-cols-2">
                  <select className="rounded-md border border-white/10 bg-slate-950 p-2 text-sm" value={requestForm.productType} onChange={(e) => setRequestForm({ ...requestForm, productType: e.target.value })}>{products.map((product) => <option key={product}>{product}</option>)}</select>
                  <Input required type="number" min="0.01" step="0.01" placeholder="Quantity (litres / unit)" value={requestForm.quantity} onChange={(e) => setRequestForm({ ...requestForm, quantity: e.target.value })} />
                  <Input type="number" min="0.01" placeholder="Budget from (₦/unit)" value={requestForm.targetPriceMin} onChange={(e) => setRequestForm({ ...requestForm, targetPriceMin: e.target.value })} />
                  <Input type="number" min="0.01" placeholder="Budget up to (₦/unit)" value={requestForm.targetPriceMax} onChange={(e) => setRequestForm({ ...requestForm, targetPriceMax: e.target.value })} />
                  <Input required placeholder="State" value={requestForm.state} onChange={(e) => setRequestForm({ ...requestForm, state: e.target.value })} />
                  <Input placeholder="LGA" value={requestForm.lga} onChange={(e) => setRequestForm({ ...requestForm, lga: e.target.value })} />
                  <Input placeholder="City / town" value={requestForm.city} onChange={(e) => setRequestForm({ ...requestForm, city: e.target.value })} />
                  <Input type="date" value={requestForm.requiredDeliveryDate} onChange={(e) => setRequestForm({ ...requestForm, requiredDeliveryDate: e.target.value })} />
                  <Input type="date" required min={dateInput(1)} max={dateInput(90)} value={requestForm.expiresAt} onChange={(e) => setRequestForm({ ...requestForm, expiresAt: e.target.value })} />
                </div>
                <textarea maxLength={3000} className="min-h-20 w-full rounded-md border border-white/10 bg-slate-950/60 p-3 text-sm" placeholder="Delivery requirements, timing or other terms" value={requestForm.requirements} onChange={(e) => setRequestForm({ ...requestForm, requirements: e.target.value })} />
                <label className="flex gap-2 text-sm text-slate-300"><input type="checkbox" checked={requestForm.deliveryRequired} onChange={(e) => setRequestForm({ ...requestForm, deliveryRequired: e.target.checked })} />Delivery required</label>
                <Button type="submit" disabled={buyerRequestMutation.isPending} className="w-full bg-sky-600 hover:bg-sky-500">{buyerRequestMutation.isPending ? "Posting…" : "Publish request"}</Button>
              </form>}
            </section>
          )}

          {tab === "browse" && <>
            <section className="grid gap-3 rounded-2xl border border-white/[0.07] bg-white/[0.025] p-3 md:grid-cols-5">
              <div className="relative md:col-span-2"><Search className="absolute left-3 top-3 h-4 w-4 text-slate-500" /><Input className="pl-9" placeholder="Search supply, services, locations…" value={search} onChange={(e) => setSearch(e.target.value)} /></div>
              <select className="rounded-md border border-white/10 bg-slate-950 px-3 py-2 text-sm" value={filterProduct} onChange={(e) => setFilterProduct(e.target.value)}><option value="">All products</option>{products.map((product) => <option key={product}>{product}</option>)}</select>
              <Input placeholder="State" value={filterState} onChange={(e) => setFilterState(e.target.value)} />
              <select className="rounded-md border border-white/10 bg-slate-950 px-3 py-2 text-sm" value={filterCategory} onChange={(e) => setFilterCategory(e.target.value)}><option value="">All categories</option>{(categoryQuery.data || []).map((category) => <option value={category.id} key={category.id}>{category.name}</option>)}</select>
              <Input type="number" placeholder="Minimum price (₦)" value={filterMinPrice} onChange={(e) => setFilterMinPrice(e.target.value)} />
              <Input type="number" placeholder="Maximum price (₦)" value={filterMaxPrice} onChange={(e) => setFilterMaxPrice(e.target.value)} />
              <Input type="number" placeholder="Minimum quantity" value={filterMinQuantity} onChange={(e) => setFilterMinQuantity(e.target.value)} />
              <div className="flex flex-wrap items-center gap-3 text-xs text-slate-300 md:col-span-2"><label className="flex gap-2"><input type="checkbox" checked={deliveryOnly} onChange={(e) => setDeliveryOnly(e.target.checked)} />Delivery available</label><label className="flex gap-2"><input type="checkbox" checked={verifiedOnly} onChange={(e) => setVerifiedOnly(e.target.checked)} />Verified business</label></div>
              <select className="rounded-md border border-white/10 bg-slate-950 px-3 py-2 text-sm md:col-span-5" value={sort} onChange={(e) => setSort(e.target.value)}><option value="relevant">Recommended</option><option value="price_asc">Lowest price</option><option value="quantity_desc">Highest quantity</option><option value="verified">Verified businesses first</option><option value="recent">Recently published</option></select>
            </section>
            {listingsQuery.isError && <p role="alert" className="rounded-lg border border-red-300/20 bg-red-300/5 p-3 text-sm text-red-200">{(listingsQuery.error as Error).message}</p>}
            <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {(listingsQuery.data || []).map((listing) => <article key={listing.id} className="flex flex-col rounded-2xl border border-white/[0.08] bg-white/[0.025] p-5">
                <div className="flex items-start justify-between gap-3"><div><p className="text-xs font-medium text-sky-300">{listing.categoryName} · {listing.productType || "Service"}</p><h2 className="mt-1 text-lg font-semibold">{listing.title}</h2></div><Package className="h-5 w-5 shrink-0 text-slate-500" /></div>
                <p className="mt-3 line-clamp-3 text-sm text-slate-300">{listing.description}</p>
                <div className="mt-4 grid grid-cols-2 gap-3 text-sm"><div><p className="text-xs text-slate-500">Price</p><p className="font-semibold">{naira(listing.price)}{listing.price ? ` / ${listing.unit}` : ""}</p></div><div><p className="text-xs text-slate-500">Available</p><p>{listing.quantity ? `${Number(listing.quantity).toLocaleString()} ${listing.unit}` : "Contact supplier"}</p></div></div>
                <p className="mt-3 flex items-center gap-1 text-xs text-slate-400"><MapPin className="h-3.5 w-3.5" />{[listing.city, listing.lga, listing.state].filter(Boolean).join(", ") || "Location not provided"}</p>
                <div className="mt-3 flex flex-wrap gap-2 text-[11px] text-slate-400">{listing.businessVerified && <span className="flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-1 text-emerald-300"><BadgeCheck className="h-3 w-3" />Verified business</span>}{listing.deliveryAvailable && <span className="rounded-full bg-white/5 px-2 py-1">Delivery</span>}{listing.collectionAvailable && <span className="rounded-full bg-white/5 px-2 py-1">Collection</span>}<span className="rounded-full bg-white/5 px-2 py-1">Expires {formatDate(listing.expiresAt)}</span></div>
                <div className="mt-auto flex items-center justify-between border-t border-white/[0.06] pt-4 mt-4"><div><p className="text-sm font-medium">{listing.businessName || listing.displayName}</p><p className="text-[11px] text-slate-500">Registered customer · not an official supply confirmation</p></div><Button size="sm" onClick={() => { setEnquiryListing(listing); setEnquiryMessage(""); }}>Enquire <ChevronRight className="ml-1 h-4 w-4" /></Button></div>
              </article>)}
            </section>
            {!listingsQuery.isLoading && !listingsQuery.data?.length && <div className="rounded-2xl border border-dashed border-white/10 p-10 text-center text-slate-400">No matching active listings. Try another location or product filter.</div>}
          </>}

          {tab === "requests" && <section className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3"><div className="min-w-0"><h2 className="text-xl font-semibold">Buyer requests matched to your business</h2><p className="mt-1 text-sm text-slate-400">Private procurement details are visible only to the buyer and matched suppliers.</p></div><Button className="max-w-full" onClick={() => setRequestFormOpen(true)} variant="outline"><Plus className="mr-2 h-4 w-4" />New request</Button></div>
            {(requestsQuery.data || []).map((item) => <article key={item.id} className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-white/[0.08] bg-white/[0.025] p-4"><div><p className="text-xs text-sky-300">{item.productType} · {Number(item.quantity).toLocaleString()} litres</p><h3 className="mt-1 font-semibold">{item.title}</h3><p className="mt-1 text-sm text-slate-400">{item.businessName || item.displayName} · {[item.city, item.lga, item.state].filter(Boolean).join(", ")} · expires {formatDate(item.expiresAt)}</p><p className="mt-1 text-xs text-slate-500">{item.targetPriceMax ? `Budget up to ${naira(item.targetPriceMax)} per litre` : "Budget not specified"}{item.deliveryRequired ? " · delivery required" : ""}</p>{item.requirements && <p className="mt-2 max-w-2xl text-sm text-slate-300">{item.requirements}</p>}</div>{item.buyerUserId !== user?.id && <Button onClick={() => { setOfferRequest(item); setOfferForm((form) => ({ ...form, quantity: String(item.quantity), location: [item.city, item.state].filter(Boolean).join(", ") })); }}>Send offer</Button>}{item.buyerUserId === user?.id && <span className="rounded-full bg-white/5 px-3 py-1 text-xs text-slate-400">Your request</span>}</article>)}
            {!requestsQuery.isLoading && !requestsQuery.data?.length && <div className="rounded-2xl border border-dashed border-white/10 p-10 text-center text-slate-400">No buyer requests currently match your listings. Publish a supply listing to improve matching.</div>}
          </section>}

          {tab === "dashboard" && <section className="space-y-6">
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">{Object.entries({
              "Active listings": dashboard?.summary.activeListings || 0, "Open buyer requests": dashboard?.summary.openRequests || 0,
              "Offers received": dashboard?.summary.offersReceived || 0, "Offers sent": dashboard?.summary.offersSent || 0,
              "New enquiries": dashboard?.summary.newEnquiries || 0, "Accepted offers": dashboard?.summary.acceptedOffers || 0,
              "Expiring soon": dashboard?.summary.expiringListings || 0, "Recommended matches": dashboard?.summary.recommendedMatches || 0,
            }).map(([label, count]) => <div key={label} className="rounded-xl border border-white/[0.07] bg-white/[0.025] p-4"><p className="text-xs text-slate-400">{label}</p><p className="mt-2 text-3xl font-bold text-sky-200">{count}</p></div>)}</div>
            <div className="grid gap-5 lg:grid-cols-2">
              <section className="space-y-3"><h2 className="text-lg font-semibold">Your listings</h2>{(dashboard?.listings || []).map((item) => <article key={item.id} className="flex items-center justify-between gap-3 rounded-xl border border-white/[0.07] p-3"><div><p className="font-medium">{item.title}</p><p className="text-xs text-slate-400">{item.productType || "Service"} · {item.status} · expires {formatDate(item.expiresAt)}</p>{item.documents?.map((document) => <button key={document.id} onClick={() => void openDocument(document.id)} className="mt-1 block text-xs text-sky-300 underline">{document.fileName}</button>)}</div><div className="flex gap-2">{item.status === "active" ? <Button size="sm" variant="outline" onClick={() => mutation.mutate({ url: `/api/marketplace/listings/${item.id}`, method: "PATCH", body: { status: "paused" } })}>Pause</Button> : item.status === "paused" && new Date(item.expiresAt) > new Date() ? <Button size="sm" onClick={() => mutation.mutate({ url: `/api/marketplace/listings/${item.id}`, method: "PATCH", body: { status: "active" } })}>Resume</Button> : ["archived", "paused"].includes(item.status) ? <Button size="sm" onClick={() => mutation.mutate({ url: `/api/marketplace/listings/${item.id}`, method: "PATCH", body: { status: "active", expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString() } })}>Renew</Button> : null}<Button size="sm" variant="ghost" onClick={() => mutation.mutate({ url: `/api/marketplace/listings/${item.id}`, method: "PATCH", body: { status: "archived" } })}>Archive</Button></div></article>)}</section>
              <section className="space-y-3"><h2 className="text-lg font-semibold">Recommended matches</h2>{(dashboard?.matches || []).slice(0, 8).map((match) => <article key={match.id} className="rounded-xl border border-white/[0.07] p-3"><div className="flex items-center justify-between"><p className="font-medium">{match.businessName}</p><span className="rounded-full bg-sky-400/10 px-2 py-1 text-xs text-sky-200">{Math.round(Number(match.score))}% match</span></div><p className="mt-1 text-sm text-slate-300">{match.productType} · {match.requestTitle} · {match.state}</p><p className="mt-1 text-xs text-slate-500">{(match.reasons || []).join(" · ") || "Matched to your fuel type and location"}</p><p className="mt-1 text-xs text-slate-400">{match.listingTitle || "Supplier listing"} · {naira(match.price)}</p><button onClick={() => setTab("requests")} className="mt-2 inline-flex items-center gap-1 text-xs text-sky-300 hover:text-sky-100"><ChevronRight className="h-3.5 w-3.5" />View matched request</button></article>)}{!dashboard?.matches?.length && <p className="rounded-xl border border-dashed border-white/10 p-5 text-sm text-slate-400">Matches appear when an open buyer request aligns with an active supply listing.</p>}</section>
              <section className="space-y-3"><h2 className="text-lg font-semibold">Offers sent and received</h2>{(dashboard?.offers || []).map((offer) => <article key={offer.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-white/[0.07] p-3"><div><p className="font-medium">{offer.requestTitle}</p><p className="text-xs text-slate-400">{offer.direction} · {Number(offer.quantity).toLocaleString()} litres at {naira(offer.price)} · {offer.status}</p></div>{offer.direction === "received" && offer.status === "pending" && <div className="flex gap-2"><Button size="sm" onClick={() => mutation.mutate({ url: `/api/marketplace/offers/${offer.id}`, method: "PATCH", body: { action: "accept" } })}><Check className="mr-1 h-3.5 w-3.5" />Accept</Button><Button size="sm" variant="outline" onClick={() => mutation.mutate({ url: `/api/marketplace/offers/${offer.id}`, method: "PATCH", body: { action: "decline" } })}>Decline</Button></div>}</article>)}</section>
              <section className="space-y-3"><h2 className="text-lg font-semibold">Recent enquiries</h2>{(dashboard?.enquiries || []).slice(0, 8).map((enquiry) => <article key={enquiry.id} className="rounded-xl border border-white/[0.07] p-3"><p className="font-medium">{enquiry.listingTitle || "Marketplace enquiry"}</p><p className="mt-1 text-sm text-slate-300">{enquiry.message}</p><Button variant="link" className="h-auto p-0 pt-2 text-sky-300" onClick={() => openConversation(enquiry.senderUserId === user?.id ? enquiry.recipientUserId : enquiry.senderUserId)}><MessageCircle className="mr-1 h-3.5 w-3.5" />Continue in messages</Button></article>)}</section>
              <section className="space-y-3"><h2 className="text-lg font-semibold">Your procurement requests</h2>{(dashboard?.requests || []).map((item) => <article key={item.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-white/[0.07] p-3"><div><p className="font-medium">{item.title}</p><p className="text-xs text-slate-400">{item.productType} · {Number(item.quantity).toLocaleString()} litres · {item.state} · {item.status}</p></div><div className="flex gap-2">{item.status === "open" ? <Button size="sm" variant="outline" onClick={() => mutation.mutate({ url: `/api/marketplace/requests/${item.id}`, method: "PATCH", body: { status: "paused" } })}>Pause</Button> : ["paused", "expired"].includes(item.status) ? <Button size="sm" onClick={() => mutation.mutate({ url: `/api/marketplace/requests/${item.id}`, method: "PATCH", body: { status: "open", ...(new Date(item.expiresAt) <= new Date() ? { expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString() } : {}) } })}>Resume</Button> : null}<Button size="sm" variant="ghost" onClick={() => mutation.mutate({ url: `/api/marketplace/requests/${item.id}`, method: "PATCH", body: { status: "closed" } })}>Close</Button></div></article>)}</section>
            </div>
          </section>}

          {tab === "preferences" && <section className="max-w-3xl space-y-5 rounded-2xl border border-white/[0.08] bg-white/[0.025] p-5">
            <div><h2 className="text-xl font-semibold">Business preferences</h2><p className="mt-1 text-sm text-slate-400">Used to personalize marketplace recommendations and matching alerts.</p></div>
            <div className="space-y-2"><p className="text-sm font-medium">Business roles</p><div className="flex flex-wrap gap-2">{roles.map((role) => <label key={role} className={`cursor-pointer rounded-full border px-3 py-1.5 text-xs ${prefs.roles.includes(role) ? "border-sky-300/30 bg-sky-300/10 text-sky-100" : "border-white/10 text-slate-400"}`}><input className="sr-only" type="checkbox" checked={prefs.roles.includes(role)} onChange={() => toggleArray("roles", role)} />{role.replaceAll("_", " ")}</label>)}</div></div>
            {(["productsSupply", "productsNeed"] as const).map((key) => <div key={key} className="space-y-2"><p className="text-sm font-medium">{key === "productsSupply" ? "Products you supply" : "Products you need"}</p><div className="flex flex-wrap gap-2">{products.map((product) => <label key={product} className={`cursor-pointer rounded-full border px-3 py-1.5 text-xs ${prefs[key].includes(product) ? "border-emerald-300/30 bg-emerald-300/10 text-emerald-100" : "border-white/10 text-slate-400"}`}><input className="sr-only" type="checkbox" checked={prefs[key].includes(product)} onChange={() => toggleArray(key, product)} />{product}</label>)}</div></div>)}
            <div className="grid gap-3 sm:grid-cols-2"><Input placeholder="Preferred states, comma-separated" value={prefs.preferredStates.join(", ")} onChange={(e) => setPrefs({ ...prefs, preferredStates: e.target.value.split(",").map((state) => state.trim()).filter(Boolean) })} /><label className="flex items-center gap-2 text-sm text-slate-300"><input type="checkbox" checked={prefs.deliveryRequired} onChange={(e) => setPrefs({ ...prefs, deliveryRequired: e.target.checked })} />Delivery is required</label><Input type="number" placeholder="Minimum quantity" value={prefs.minQuantity ?? ""} onChange={(e) => setPrefs({ ...prefs, minQuantity: e.target.value ? Number(e.target.value) : undefined })} /><Input type="number" placeholder="Maximum quantity" value={prefs.maxQuantity ?? ""} onChange={(e) => setPrefs({ ...prefs, maxQuantity: e.target.value ? Number(e.target.value) : undefined })} /><Input type="number" placeholder="Minimum price per unit (₦)" value={prefs.minPrice ?? ""} onChange={(e) => setPrefs({ ...prefs, minPrice: e.target.value ? Number(e.target.value) : undefined })} /><Input type="number" placeholder="Maximum price per unit (₦)" value={prefs.maxPrice ?? ""} onChange={(e) => setPrefs({ ...prefs, maxPrice: e.target.value ? Number(e.target.value) : undefined })} /></div>
            <label className="flex items-center gap-2 text-sm text-slate-300"><input type="checkbox" checked={prefs.marketplaceNotificationsEnabled} onChange={(e) => setPrefs({ ...prefs, marketplaceNotificationsEnabled: e.target.checked })} />Receive marketplace matching, offer, enquiry, and expiry notifications</label>
            <Button disabled={preferenceMutation.isPending} onClick={() => preferenceMutation.mutate()}>{preferenceMutation.isPending ? "Saving…" : "Save preferences"}</Button>
            {preferencesQuery.isError && <p className="text-sm text-red-300">Could not load preferences. {(preferencesQuery.error as Error).message}</p>}
          </section>}

          {dashboard?.notifications?.some((item) => !item.readAt) && <section className="rounded-xl border border-amber-300/20 bg-amber-300/[0.04] p-3 text-sm"><div className="flex items-center gap-2 text-amber-100"><Bell className="h-4 w-4" />Marketplace notifications</div><div className="mt-2 flex flex-wrap gap-2">{dashboard.notifications.filter((item) => !item.readAt).slice(0, 5).map((item) => <button key={item.id} onClick={() => mutation.mutate({ url: `/api/marketplace/notifications/${item.id}/read`, method: "PATCH" })} className="rounded-full border border-amber-200/10 px-3 py-1 text-xs text-amber-100">{item.type.replaceAll("_", " ")} · {formatDate(item.createdAt)} · mark read</button>)}</div></section>}

          {enquiryListing && <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 p-4"><form onSubmit={(e) => { e.preventDefault(); contactMutation.mutate(); }} className="w-full max-w-lg space-y-4 rounded-2xl border border-white/10 bg-[#0c1220] p-5"><div className="flex items-start justify-between"><div><p className="text-xs text-sky-300">Business enquiry</p><h2 className="mt-1 font-semibold">{enquiryListing.title}</h2><p className="mt-1 text-sm text-slate-400">This will start a private conversation with the listing owner.</p></div><button type="button" onClick={() => setEnquiryListing(null)}><X className="h-4 w-4" /></button></div><textarea required minLength={2} maxLength={3000} className="min-h-28 w-full rounded-md border border-white/10 bg-slate-950 p-3 text-sm" placeholder="Ask a question or describe your business enquiry" value={enquiryMessage} onChange={(e) => setEnquiryMessage(e.target.value)} /><Button className="w-full" disabled={contactMutation.isPending}>{contactMutation.isPending ? "Sending…" : "Send enquiry and open chat"}</Button></form></div>}

          {offerRequest && <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 p-4"><form onSubmit={(e) => { e.preventDefault(); offerMutation.mutate(); }} className="w-full max-w-lg space-y-3 rounded-2xl border border-white/10 bg-[#0c1220] p-5"><div className="flex items-start justify-between"><div><p className="text-xs text-sky-300">Supplier offer</p><h2 className="mt-1 font-semibold">{offerRequest.title}</h2></div><button type="button" onClick={() => setOfferRequest(null)}><X className="h-4 w-4" /></button></div><div className="grid grid-cols-2 gap-3"><Input type="number" min="0.01" required placeholder="Quantity" value={offerForm.quantity} onChange={(e) => setOfferForm({ ...offerForm, quantity: e.target.value })} /><Input type="number" min="0.01" required placeholder="Price per litre (₦)" value={offerForm.price} onChange={(e) => setOfferForm({ ...offerForm, price: e.target.value })} /><Input required placeholder="Delivery terms" value={offerForm.deliveryTerms} onChange={(e) => setOfferForm({ ...offerForm, deliveryTerms: e.target.value })} /><Input required placeholder="Supply location" value={offerForm.location} onChange={(e) => setOfferForm({ ...offerForm, location: e.target.value })} /><Input type="date" required min={dateInput(1)} max={dateInput(90)} value={offerForm.expiresAt} onChange={(e) => setOfferForm({ ...offerForm, expiresAt: e.target.value })} /></div><textarea maxLength={2000} className="min-h-20 w-full rounded-md border border-white/10 bg-slate-950 p-3 text-sm" placeholder="Additional offer terms (optional)" value={offerForm.conditions} onChange={(e) => setOfferForm({ ...offerForm, conditions: e.target.value })} /><p className="text-xs text-amber-200">An accepted offer records intent only. Fuel supply, payment and transaction security are not guaranteed by this platform.</p><Button className="w-full" disabled={offerMutation.isPending}>{offerMutation.isPending ? "Sending…" : "Submit offer and open chat"}</Button></form></div>}

          {(listingsQuery.isLoading || requestsQuery.isLoading || dashboardQuery.isLoading) && <div className="text-center text-sm text-slate-500">Loading marketplace data…</div>}
          {listingsQuery.isError || requestsQuery.isError || dashboardQuery.isError ? <div role="alert" className="text-sm text-red-300">Some marketplace information could not be loaded. Verify migration 0005 and database availability.</div> : null}
          <p className="text-center text-xs text-slate-600"><ShieldAlert className="mr-1 inline h-3.5 w-3.5" />FuelIQ does not verify supply, pricing, business legitimacy or secure payment unless expressly confirmed through a separate verification process.</p>
        </div>
      </main>
    </>
  );
}
