import { ChangeEvent, FormEvent, useEffect, useMemo, useState } from "react";
import { supabase } from "./supabaseClient";
import type { Session, User } from "@supabase/supabase-js";

type Category = "All" | "Premium Big Cotton Ankara" | "Small Print Ankara" | "Medium print Ankara" | "Lace Fabrics" | "Senator Materials" | "Crepe Fabrics" | "Adire" | "Aso-Oke" | "Wholesale";
type ProductCategory = Exclude<Category, "All">;
type DeliveryOption = "pickup" | "lagos" | "outside-lagos";
type OrderStatus = "New" | "Processing" | "Shipped" | "Delivered";

type Product = {
  id: string;
  name: string;
  category: ProductCategory;
  price: number;
  stock: number;
  minYards: number;
  image: string;
  images?: string[];
  palette: string;
  description: string;
  tag: string;
};

type CartItem = {
  productId: string;
  yards: number;
};

type CheckoutDetails = {
  fullName: string;
  email: string;
  phone: string;
  address: string;
  city: string;
  state: string;
  delivery: DeliveryOption;
  note: string;
};

type OrderLine = {
  productId: string;
  productName: string;
  yards: number;
  price: number;
  total: number;
  image: string;
};

type Order = {
  id: string;
  reference: string;
  createdAt: string;
  customer: CheckoutDetails;
  items: OrderLine[];
  subtotal: number;
  deliveryFee: number;
  total: number;
  status: OrderStatus;
};

type PaystackResponse = {
  reference: string;
  status?: string;
  message?: string;
};

type PaystackOptions = {
  key: string;
  email: string;
  amount: number;
  currency: string;
  ref: string;
  metadata: Record<string, unknown>;
  callback: (response: PaystackResponse) => void;
  onClose: () => void;
};

declare global {
  interface Window {
    PaystackPop?: {
      setup: (options: PaystackOptions) => { openIframe: () => void };
    };
  }

  interface ImportMeta {
    readonly env: {
      readonly VITE_PAYSTACK_PUBLIC_KEY?: string;
      readonly VITE_API_BASE_URL?: string;
      readonly VITE_ADMIN_PIN?: string;
      readonly [key: string]: string | undefined;
    };
  }
}

// Security Fix: PIN is now loaded from environment variables, never hardcoded.
// If VITE_ADMIN_PIN is not set in Netlify, it defaults to a completely locked state ("LOCKED") so no one can guess it.
const ADMIN_PIN = import.meta.env.VITE_ADMIN_PIN || "LOCKED";
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://127.0.0.1:8000";
const PRODUCT_STORAGE_KEY = "hans-signature-products-v2";
const ORDER_STORAGE_KEY = "hans-signature-orders-v2";
const HERO_STORAGE_KEY = "hans-signature-hero-v2";

const defaultProducts: Product[] = [
  {
    id: "geo-ochre",
    name: "Ochre Geometry Ankara",
    category: "Premium Big Cotton Ankara",
    price: 12500,
    stock: 24,
    minYards: 3,
    image: "/images/ankara-geo-ochre.jpg",
    palette: "Ochre, navy, cream",
    description: "A clean geometric print for gowns, two-piece sets, shirts, and corporate casual looks.",
    tag: "New arrival",
  },
  {
    id: "cocoa-stripe",
    name: "Cocoa Stripe Ankara",
    category: "Medium print Ankara",
    price: 11500,
    stock: 18,
    minYards: 3,
    image: "/images/ankara-cocoa-stripe.jpg",
    palette: "Cocoa, blush, black",
    description: "A refined stripe and dot print that works beautifully for wrappers, kaftans, and casual sets.",
    tag: "Best seller",
  },
  {
    id: "mono-floral",
    name: "Monochrome Floral Ankara",
    category: "Small Print Ankara",
    price: 11000,
    stock: 31,
    minYards: 3,
    image: "/images/ankara-mono-floral.jpg",
    palette: "Black and white",
    description: "Minimal floral details for customers who want Ankara with a calm, modern finish.",
    tag: "Everyday wear",
  },
  {
    id: "charcoal-wave",
    name: "Charcoal Wave Print",
    category: "Wholesale",
    price: 10800,
    stock: 52,
    minYards: 6,
    image: "/images/ankara-charcoal-wave.jpg",
    palette: "Charcoal, ivory",
    description: "A repeat pattern suited for bulk orders, uniforms, family aso ebi, and ready-to-wear production.",
    tag: "Wholesale ready",
  },
  {
    id: "rust-symbol",
    name: "Rust Heritage Print",
    category: "Adire",
    price: 15000,
    stock: 12,
    minYards: 3,
    image: "/images/ankara-rust-symbol.jpg",
    palette: "Rust, orange, cream",
    description: "Warm heritage-inspired motifs for customers who want a bold traditional statement.",
    tag: "Limited stock",
  },
  {
    id: "ceremony-lace",
    name: "Ceremony Lace Noir",
    category: "Lace Fabrics",
    price: 18000,
    stock: 9,
    minYards: 3,
    image: "/images/ankara-mono-floral.jpg",
    images: ["/images/ankara-mono-floral.jpg"],
    palette: "Black, white, silver",
    description: "A dressy monochrome option for church, weddings, birthdays, and occasion styling.",
    tag: "Occasion wear",
  },
  {
    id: "navy-senator",
    name: "Premium Navy Senator",
    category: "Senator Materials",
    price: 14000,
    stock: 40,
    minYards: 4,
    image: "/images/senator-material.jpg",
    images: ["/images/senator-material.jpg"],
    palette: "Navy Blue, Charcoal",
    description: "High-quality, durable Senator material perfect for men's traditional native wear and suits.",
    tag: "Men's Classic",
  },
  {
    id: "emerald-crepe",
    name: "Emerald Flow Crepe",
    category: "Crepe Fabrics",
    price: 8500,
    stock: 60,
    minYards: 3,
    image: "/images/crepe-fabric.jpg",
    images: ["/images/crepe-fabric.jpg"],
    palette: "Emerald Green",
    description: "Soft, flowing crepe fabric with a beautiful drape, ideal for gowns, blouses, and office wear.",
    tag: "Restocked",
  },
  {
    id: "royal-aso-oke",
    name: "Royal Burgundy Aso-Oke",
    category: "Aso-Oke",
    price: 35000,
    stock: 5,
    minYards: 1,
    image: "/images/aso-oke.jpg",
    images: ["/images/aso-oke.jpg"],
    palette: "Burgundy, Gold",
    description: "Handwoven traditional Aso-Oke with metallic gold threads, perfect for bridal wear and headties.",
    tag: "Premium Bridal",
  },
];

const emptyProduct: Product = {
  id: "",
  name: "",
  category: "Premium Big Cotton Ankara",
  price: 0,
  stock: 0,
  minYards: 3,
  image: "/images/ankara-geo-ochre.jpg",
  images: ["/images/ankara-geo-ochre.jpg"],
  palette: "",
  description: "",
  tag: "New arrival",
};

const categories: Category[] = ["All", "Premium Big Cotton Ankara", "Medium print Ankara", "Small Print Ankara", "Lace Fabrics", "Senator Materials", "Crepe Fabrics", "Adire", "Aso-Oke", "Wholesale"];
const productCategories: ProductCategory[] = ["Premium Big Cotton Ankara", "Medium print Ankara", "Small Print Ankara", "Lace Fabrics", "Senator Materials", "Crepe Fabrics", "Adire", "Aso-Oke", "Wholesale"];
const orderStatuses: OrderStatus[] = ["New", "Processing", "Shipped", "Delivered"];

const deliveryOptions: Record<DeliveryOption, { label: string; fee: number; eta: string }> = {
  pickup: {
    label: "Pickup at Oshodi/CANA, Ikorodu",
    fee: 0,
    eta: "Same day after confirmation",
  },
  lagos: {
    label: "Lagos delivery",
    fee: 2500,
    eta: "1 to 2 working days",
  },
  "outside-lagos": {
    label: "Delivery outside Lagos",
    fee: 5000,
    eta: "2 to 5 working days",
  },
};

const initialCheckout: CheckoutDetails = {
  fullName: "",
  email: "",
  phone: "",
  address: "",
  city: "Lagos",
  state: "Lagos",
  delivery: "lagos",
  note: "",
};

const readStorage = <T,>(key: string, fallback: T): T => {
  if (typeof window === "undefined") return fallback;

  try {
    const item = window.localStorage.getItem(key);
    return item ? (JSON.parse(item) as T) : fallback;
  } catch {
    return fallback;
  }
};

const writeStorage = (key: string, value: unknown) => {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(key, JSON.stringify(value));
};

const formatMoney = (amount: number) =>
  new Intl.NumberFormat("en-NG", {
    style: "currency",
    currency: "NGN",
    maximumFractionDigits: 0,
  })
    .format(amount)
    .replace("NGN", "NGN ");

const getWhatsAppUrl = (message: string) =>
  `https://wa.me/2349042941371?text=${encodeURIComponent(message)}`;

const createProductId = (name: string) =>
  name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "") || `fabric-${Date.now()}`;

const getProductImages = (product: Pick<Product, "image" | "images">) => {
  const images = [product.image, ...(product.images ?? [])].filter(Boolean);
  return Array.from(new Set(images));
};

const getProductImage = (product: Pick<Product, "image" | "images">) =>
  getProductImages(product)[0] || "/images/ankara-geo-ochre.jpg";

const normalizeProduct = (product: Product): Product => {
  const image = getProductImage(product);
  return { ...product, image, images: getProductImages({ ...product, image }) };
};

const apiRequest = async <T,>(path: string, options: RequestInit = {}) => {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(options.headers ?? {}),
    },
  });

  if (!response.ok) {
    throw new Error(`API request failed: ${response.status}`);
  }

  return (await response.json()) as T;
};

const SocialIcon = ({ name }: { name: "whatsapp" | "instagram" | "facebook" | "email" | "phone" }) => {
  const iconClass = "h-4 w-4";

  if (name === "whatsapp") {
    return (
      <svg className={iconClass} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
        <path d="M12.04 2a9.86 9.86 0 0 0-8.45 14.94L2.4 21.33l4.5-1.17A9.9 9.9 0 1 0 12.04 2Zm0 1.7a8.2 8.2 0 1 1 0 16.4 8.15 8.15 0 0 1-4.18-1.14l-.31-.18-2.67.7.72-2.6-.2-.33A8.2 8.2 0 0 1 12.04 3.7Zm-3.16 4.37c-.18 0-.46.06-.7.33-.24.26-.92.9-.92 2.2s.94 2.55 1.08 2.73c.13.17 1.85 2.83 4.49 3.97 2.22.96 2.67.77 3.15.72.48-.04 1.55-.63 1.77-1.24.22-.61.22-1.14.15-1.25-.06-.11-.24-.17-.5-.3-.26-.13-1.55-.76-1.79-.85-.24-.09-.41-.13-.58.13-.18.26-.67.85-.82 1.03-.15.17-.3.2-.56.06-.26-.13-1.1-.41-2.1-1.3-.78-.7-1.3-1.55-1.45-1.81-.15-.26-.02-.4.11-.53.12-.12.26-.3.39-.46.13-.15.17-.26.26-.44.09-.17.04-.33-.02-.46-.07-.13-.59-1.42-.8-1.95-.21-.5-.43-.43-.59-.44h-.5Z" />
      </svg>
    );
  }

  if (name === "instagram") {
    return (
      <svg className={iconClass} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
        <rect x="4" y="4" width="16" height="16" rx="5" />
        <circle cx="12" cy="12" r="3.6" />
        <circle cx="17" cy="7" r="1" fill="currentColor" stroke="none" />
      </svg>
    );
  }

  if (name === "facebook") {
    return (
      <svg className={iconClass} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
        <path d="M14.2 8.15V6.9c0-.6.4-.74.68-.74h1.76V3.14L14.22 3.13c-2.68 0-3.29 2-3.29 3.28v1.74H8.82v3.1h2.11V21h3.27v-9.75h2.2l.3-3.1h-2.5Z" />
      </svg>
    );
  }

  if (name === "email") {
    return (
      <svg className={iconClass} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
        <rect x="3" y="5" width="18" height="14" rx="2" />
        <path d="m4 7 8 6 8-6" />
      </svg>
    );
  }

  return (
    <svg className={iconClass} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
      <path d="M22 16.92v2.1a2 2 0 0 1-2.18 2 19.8 19.8 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.12 3.3 2 2 0 0 1 4.11 1h2.1a2 2 0 0 1 2 1.72c.12.91.33 1.8.63 2.65a2 2 0 0 1-.45 2.11l-.89.89a16 16 0 0 0 6 6l.89-.89a2 2 0 0 1 2.11-.45c.85.3 1.74.51 2.65.63A2 2 0 0 1 22 16.92Z" />
    </svg>
  );
};

export default function App() {
  const [activeCategory, setActiveCategory] = useState<Category>("All");
  const [products, setProducts] = useState<Product[]>(() =>
    readStorage(PRODUCT_STORAGE_KEY, defaultProducts).map(normalizeProduct),
  );
  const [orders, setOrders] = useState<Order[]>(() => readStorage(ORDER_STORAGE_KEY, []));
  const [heroImage, setHeroImage] = useState(() => readStorage(HERO_STORAGE_KEY, "/images/hans-hero.jpg"));
  const [isBackendConnected, setIsBackendConnected] = useState(false);
  const [isSupabaseConnected, setIsSupabaseConnected] = useState(false);
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [isAuthOpen, setIsAuthOpen] = useState(false);
  const [authMode, setAuthMode] = useState<"login" | "signup">("login");
  const [authEmail, setAuthEmail] = useState("");
  const [authPassword, setAuthPassword] = useState("");
  const [authError, setAuthError] = useState("");
  const [authMessage, setAuthMessage] = useState("");
  const [cart, setCart] = useState<CartItem[]>([]);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [selectedYards, setSelectedYards] = useState(3);
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [isAdminOpen, setIsAdminOpen] = useState(false);
  const [isAdminUnlocked, setIsAdminUnlocked] = useState(false);
  const [adminPin, setAdminPin] = useState("");
  const [adminError, setAdminError] = useState("");
  const [productForm, setProductForm] = useState<Product>(emptyProduct);
  const [checkout, setCheckout] = useState<CheckoutDetails>(initialCheckout);
  const [checkoutError, setCheckoutError] = useState("");
  const [orderStatus, setOrderStatus] = useState("");
  const [isPaying, setIsPaying] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isOrdersOpen, setIsOrdersOpen] = useState(false);

  useEffect(() => {
    if (supabase) {
      setIsSupabaseConnected(true);
      
      // Get initial session
      supabase.auth.getSession().then(({ data: { session } }) => {
        setSession(session);
        setUser(session?.user ?? null);
      });

      // Listen for auth changes
      const {
        data: { subscription },
      } = supabase.auth.onAuthStateChange((_event, session) => {
        setSession(session);
        setUser(session?.user ?? null);
      });

      return () => subscription.unsubscribe();
    }
  }, []);

  useEffect(() => {
    let ignore = false;

    const loadBackendData = async () => {
      try {
        await apiRequest<{ ok: boolean }>("/api/health");
        const [apiProducts, apiOrders, apiHero] = await Promise.all([
          apiRequest<Product[]>("/api/products"),
          apiRequest<Order[]>("/api/orders"),
          apiRequest<{ heroImage: string }>("/api/settings/hero"),
        ]);

        if (ignore) return;
        setProducts(apiProducts.map(normalizeProduct));
        setOrders(apiOrders);
        setHeroImage(apiHero.heroImage || "/images/hans-hero.jpg");
        setIsBackendConnected(true);
      } catch {
        if (!ignore) setIsBackendConnected(false);
      }
    };

    void loadBackendData();

    return () => {
      ignore = true;
    };
  }, []);

  useEffect(() => writeStorage(PRODUCT_STORAGE_KEY, products), [products]);
  useEffect(() => writeStorage(ORDER_STORAGE_KEY, orders), [orders]);
  useEffect(() => writeStorage(HERO_STORAGE_KEY, heroImage), [heroImage]);

  const visibleProducts = useMemo(() => {
    if (activeCategory === "All") return products;
    return products.filter((product) => product.category === activeCategory);
  }, [activeCategory, products]);

  const cartLines = useMemo(
    () =>
      cart
        .map((item) => {
          const product = products.find((entry) => entry.id === item.productId);
          if (!product) return null;
          return { ...item, product, lineTotal: item.yards * product.price };
        })
        .filter(Boolean) as Array<CartItem & { product: Product; lineTotal: number }>,
    [cart, products],
  );

  const subtotal = cartLines.reduce((sum, item) => sum + item.lineTotal, 0);
  const deliveryFee = deliveryOptions[checkout.delivery].fee;
  const grandTotal = subtotal + (cartLines.length ? deliveryFee : 0);
  const cartYards = cart.reduce((sum, item) => sum + item.yards, 0);
  const totalRevenue = orders
    .filter((order) => order.status === "Delivered" || order.status === "Shipped")
    .reduce((sum, order) => sum + order.total, 0);
  const lowStockCount = products.filter((product) => product.stock <= 10).length;

  const openProduct = (product: Product) => {
    setSelectedProduct(product);
    setSelectedYards(product.minYards);
  };

  const addToCart = (product: Product, yards: number) => {
    const safeYards = Math.min(Math.max(yards, product.minYards), product.stock);
    if (safeYards < product.minYards) return;

    setCart((current) => {
      const existing = current.find((item) => item.productId === product.id);
      if (!existing) return [...current, { productId: product.id, yards: safeYards }];

      return current.map((item) =>
        item.productId === product.id
          ? { ...item, yards: Math.min(item.yards + safeYards, product.stock) }
          : item,
      );
    });
    setIsCartOpen(true);
  };

  const updateCartYards = (productId: string, yards: number) => {
    const product = products.find((item) => item.id === productId);
    if (!product) return;

    if (yards < product.minYards) {
      setCart((current) => current.filter((item) => item.productId !== productId));
      return;
    }

    setCart((current) =>
      current.map((item) =>
        item.productId === productId ? { ...item, yards: Math.min(yards, product.stock) } : item,
      ),
    );
  };

  const adjustStock = (productId: string, delta: number) => {
    setProducts((current) =>
      current.map((product) =>
        product.id === productId ? { ...product, stock: Math.max(0, product.stock + delta) } : product,
      ),
    );

    if (isBackendConnected) {
      void apiRequest<Product>(`/api/products/${productId}/stock`, {
        method: "PATCH",
        body: JSON.stringify({ delta }),
      }).catch(() => setIsBackendConnected(false));
    }
  };

  const completeOrder = async (reference: string) => {
    const orderItems: OrderLine[] = cartLines.map((item) => ({
      productId: item.product.id,
      productName: item.product.name,
      yards: item.yards,
      price: item.product.price,
      total: item.lineTotal,
      image: getProductImage(item.product),
    }));

    const newOrder: Order = {
      id: `order-${Date.now()}`,
      reference,
      createdAt: new Date().toISOString(),
      customer: { ...checkout },
      items: orderItems,
      subtotal,
      deliveryFee,
      total: grandTotal,
      status: "New",
    };

    if (isBackendConnected) {
      try {
        const saved = await apiRequest<{ order: Order; products: Product[] }>("/api/orders", {
          method: "POST",
          body: JSON.stringify(newOrder),
        });
        setProducts(saved.products.map(normalizeProduct));
        setOrders((current) => [saved.order, ...current.filter((order) => order.id !== saved.order.id)]);
      } catch {
        setIsBackendConnected(false);
        setProducts((current) =>
          current.map((product) => {
            const orderedItem = cart.find((item) => item.productId === product.id);
            return orderedItem ? { ...product, stock: Math.max(0, product.stock - orderedItem.yards) } : product;
          }),
        );
        setOrders((current) => [newOrder, ...current]);
      }
    } else {
      setProducts((current) =>
        current.map((product) => {
          const orderedItem = cart.find((item) => item.productId === product.id);
          return orderedItem ? { ...product, stock: Math.max(0, product.stock - orderedItem.yards) } : product;
        }),
      );
      setOrders((current) => [newOrder, ...current]);
    }

    setCart([]);
    setOrderStatus(
      `Order confirmed. Payment reference: ${reference}. Hans Signature Fabrics will contact you on WhatsApp to confirm delivery.`,
    );
    setCheckoutError("");
    setIsPaying(false);
  };

  const loadPaystack = () =>
    new Promise<void>((resolve, reject) => {
      if (window.PaystackPop) {
        resolve();
        return;
      }

      const existingScript = document.querySelector<HTMLScriptElement>(
        'script[src="https://js.paystack.co/v1/inline.js"]',
      );

      if (existingScript) {
        existingScript.addEventListener("load", () => resolve());
        existingScript.addEventListener("error", () => reject(new Error("Paystack failed to load")));
        return;
      }

      const script = document.createElement("script");
      script.src = "https://js.paystack.co/v1/inline.js";
      script.async = true;
      script.onload = () => resolve();
      script.onerror = () => reject(new Error("Paystack failed to load"));
      document.body.appendChild(script);
    });

  const handleCheckout = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!user) {
      setIsCartOpen(false);
      setAuthMode("signup");
      setAuthMessage("Please log in or sign up to complete your order and track its status.");
      setIsAuthOpen(true);
      return;
    }

    if (!cartLines.length) {
      setCheckoutError("Your cart is empty. Add a fabric before checkout.");
      return;
    }

    const missingField = [checkout.fullName, checkout.email, checkout.phone, checkout.address].some(
      (field) => !field.trim(),
    );

    if (missingField) {
      setCheckoutError("Please enter your name, email, phone number, and delivery address.");
      return;
    }

    const publicKey = import.meta.env.VITE_PAYSTACK_PUBLIC_KEY;
    setCheckoutError("");
    setOrderStatus("");
    setIsPaying(true);

    if (!publicKey) {
      await completeOrder(`DEMO-${Date.now()}`);
      setOrderStatus(
        "Demo checkout completed. Add VITE_PAYSTACK_PUBLIC_KEY to connect real Paystack payments before launch.",
      );
      return;
    }

    try {
      await loadPaystack();

      window.PaystackPop?.setup({
        key: publicKey,
        email: checkout.email,
        amount: grandTotal * 100,
        currency: "NGN",
        ref: `HSF-${Date.now()}`,
        metadata: {
          customer_name: checkout.fullName,
          customer_phone: checkout.phone,
          delivery_address: `${checkout.address}, ${checkout.city}, ${checkout.state}`,
          delivery_method: deliveryOptions[checkout.delivery].label,
          order_note: checkout.note,
          cart: cartLines.map((item) => ({
            product: item.product.name,
            yards: item.yards,
            total: item.lineTotal,
          })),
        },
        callback: (response) => {
          // A production backend should verify this reference with Paystack before fulfilment.
          void completeOrder(response.reference);
        },
        onClose: () => {
          setIsPaying(false);
          setCheckoutError("Payment window closed. You can try again when ready.");
        },
      }).openIframe();
    } catch {
      setIsPaying(false);
      setCheckoutError("Paystack could not load. Please check your internet connection or order on WhatsApp.");
    }
  };

  const orderMessage = useMemo(() => {
    const lines = cartLines.map(
      (item) => `${item.product.name} - ${item.yards} yards - ${formatMoney(item.lineTotal)}`,
    );
    return [
      "Hello Hans Signature Fabrics, I want to order:",
      ...lines,
      `Delivery: ${deliveryOptions[checkout.delivery].label}`,
      `Total: ${formatMoney(grandTotal)}`,
    ].join("\n");
  }, [cartLines, checkout.delivery, grandTotal]);

  const handleAuth = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!supabase) {
      setAuthError("Supabase connection missing. Check your .env file.");
      return;
    }

    setAuthError("");
    setAuthMessage("");

    try {
      if (authMode === "signup") {
        const { error, data } = await supabase.auth.signUp({
          email: authEmail,
          password: authPassword,
        });
        if (error) throw error;
        if (data.user?.identities?.length === 0) {
          setAuthError("An account with this email already exists.");
        } else {
          setAuthMessage("Success! You can now log in.");
          setAuthMode("login");
        }
      } else {
        const { error } = await supabase.auth.signInWithPassword({
          email: authEmail,
          password: authPassword,
        });
        if (error) throw error;
        setIsAuthOpen(false);
      }
    } catch (err: any) {
      setAuthError(err.message || "An error occurred");
    }
  };

  const handleSignOut = async () => {
    if (supabase) await supabase.auth.signOut();
  };

  const unlockAdmin = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setAdminError("");

    if (isBackendConnected) {
      try {
        await apiRequest<{ ok: boolean }>("/api/admin/verify", {
          method: "POST",
          body: JSON.stringify({ pin: adminPin.trim() }),
        });
        setIsAdminUnlocked(true);
      } catch {
        setAdminError("Incorrect PIN.");
      }
    } else {
      // Fallback for when backend is not running locally
      if (adminPin.trim() === ADMIN_PIN) {
        setIsAdminUnlocked(true);
      } else {
        setAdminError("Incorrect PIN.");
      }
    }
  };

  const handleImageUpload = (event: ChangeEvent<HTMLInputElement>, callback: (image: string) => void) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") callback(reader.result);
    };
    reader.readAsDataURL(file);
  };

  const handleMultipleImageUpload = (event: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files ?? []);
    if (!files.length) return;

    Promise.all(
      files.map(
        (file) =>
          new Promise<string>((resolve) => {
            const reader = new FileReader();
            reader.onload = () => resolve(typeof reader.result === "string" ? reader.result : "");
            reader.readAsDataURL(file);
          }),
      ),
    ).then((uploadedImages) => {
      const cleanImages = uploadedImages.filter(Boolean);
      setProductForm((current) => {
        const images = Array.from(new Set([...getProductImages(current), ...cleanImages]));
        return { ...current, image: images[0] || current.image, images };
      });
    });
  };

  const saveHeroImage = (image: string) => {
    setHeroImage(image);
    if (isBackendConnected) {
      void apiRequest<{ heroImage: string }>("/api/settings/hero", {
        method: "PUT",
        body: JSON.stringify({ heroImage: image }),
      }).catch(() => setIsBackendConnected(false));
    }
  };

  const setMainProductImage = (image: string) => {
    setProductForm((current) => ({ ...current, image, images: getProductImages({ ...current, image }) }));
  };

  const removeProductImage = (image: string) => {
    setProductForm((current) => {
      const images = getProductImages(current).filter((item) => item !== image);
      const nextImage = images[0] || "/images/ankara-geo-ochre.jpg";
      return { ...current, image: nextImage, images };
    });
  };

  const saveProduct = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const cleanName = productForm.name.trim();

    if (!cleanName || !productForm.description.trim()) {
      setAdminError("Product name and description are required.");
      return;
    }

    const productToSave: Product = {
      ...productForm,
      id: productForm.id || createProductId(cleanName),
      name: cleanName,
      image: getProductImage(productForm),
      images: getProductImages(productForm),
      price: Math.max(0, Number(productForm.price)),
      stock: Math.max(0, Number(productForm.stock)),
      minYards: Math.max(1, Number(productForm.minYards)),
    };

    let savedProduct = productToSave;

    if (isBackendConnected) {
      try {
        savedProduct = await apiRequest<Product>(productForm.id ? `/api/products/${productForm.id}` : "/api/products", {
          method: productForm.id ? "PUT" : "POST",
          body: JSON.stringify(productToSave),
        });
        savedProduct = normalizeProduct(savedProduct);
      } catch {
        setIsBackendConnected(false);
      }
    }

    setProducts((current) => {
      const exists = current.some((product) => product.id === savedProduct.id);
      return exists
        ? current.map((product) => (product.id === savedProduct.id ? savedProduct : product))
        : [savedProduct, ...current];
    });
    setProductForm(emptyProduct);
    setAdminError("");
  };

  const editProduct = (product: Product) => {
    setProductForm(normalizeProduct(product));
    setAdminError("");
  };

  const deleteProduct = (productId: string) => {
    setProducts((current) => current.filter((product) => product.id !== productId));
    setCart((current) => current.filter((item) => item.productId !== productId));

    if (isBackendConnected) {
      void apiRequest<{ ok: boolean }>(`/api/products/${productId}`, { method: "DELETE" }).catch(() =>
        setIsBackendConnected(false),
      );
    }
  };

  const updateOrderStatus = (orderId: string, status: OrderStatus) => {
    setOrders((current) => current.map((order) => (order.id === orderId ? { ...order, status } : order)));

    if (isBackendConnected) {
      void apiRequest<Order>(`/api/orders/${orderId}/status`, {
        method: "PATCH",
        body: JSON.stringify({ status }),
      }).catch(() => setIsBackendConnected(false));
    }
  };

  const resetDemoData = () => {
    setProducts(defaultProducts.map(normalizeProduct));
    setOrders([]);
    setHeroImage("/images/hans-hero.jpg");
    setProductForm(emptyProduct);
    setAdminError("");
  };

  return (
    <div className="min-h-screen bg-white text-stone-950 pt-20 lg:pt-32">
      <header className="fixed left-0 right-0 top-0 z-50 bg-[#0f3d24] text-white shadow-md">
        <div className="mx-auto flex w-full max-w-7xl items-center justify-between gap-3 px-5 py-3 sm:px-8">
          <div className="flex items-center gap-4">
            <button onClick={() => setIsMobileMenuOpen(true)} className="p-1 lg:hidden">
              <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h16M4 18h16"></path></svg>
            </button>
            <a href="#top" className="flex items-center gap-3">
              <img src="/logo.jpg" alt="Logo" className="h-10 w-10 rounded-lg bg-[#fdf8ec] object-contain p-0.5 sm:h-12 sm:w-12" />
              <span className="hidden text-xs font-bold uppercase tracking-[0.2em] sm:block sm:text-sm sm:tracking-[0.34em]">
                Hans Signature
              </span>
            </a>
          </div>

          <div className="hidden items-center gap-8 text-sm font-medium text-white/90 lg:flex">
            <a href="#about" className="transition hover:text-white">About Us</a>
            <div className="group relative py-4">
              <a href="#collections" className="transition hover:text-white">Shop Collections</a>
              <div className="absolute left-0 top-full hidden w-64 flex-col rounded-2xl bg-white p-3 text-stone-950 shadow-xl group-hover:flex">
                <button onClick={() => { setActiveCategory("All"); document.getElementById('collections')?.scrollIntoView(); }} className="rounded-xl px-4 py-2 text-left text-sm hover:bg-[#fdf8ec]">All Fabrics</button>
                {productCategories.map(cat => (
                  <button key={cat} onClick={() => { setActiveCategory(cat); document.getElementById('collections')?.scrollIntoView(); }} className="rounded-xl px-4 py-2 text-left text-sm hover:bg-[#fdf8ec]">{cat}</button>
                ))}
              </div>
            </div>
            <a href="#inventory" className="transition hover:text-white">Trending</a>
            <a href="#delivery" className="transition hover:text-white">Delivery</a>
          </div>

          <div className="flex items-center gap-4 sm:gap-6">
            {user ? (
              <div className="hidden items-center gap-4 sm:flex">
                <button onClick={() => setIsOrdersOpen(true)} className="text-sm font-semibold text-white/90 hover:text-white">My Orders</button>
                <button onClick={handleSignOut} className="text-sm text-white/60 hover:text-white">Log out</button>
              </div>
            ) : (
              <button onClick={() => setIsAuthOpen(true)} className="inline-flex items-center justify-center rounded-full border border-white/30 px-4 py-1.5 text-sm font-semibold text-white transition hover:bg-white hover:text-[#0f3d24]">
                Log in
              </button>
            )}
            <button onClick={() => setIsCartOpen(true)} className="relative inline-flex items-center p-1 transition hover:text-[#d4af37]">
              <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z"></path></svg>
              {cartYards > 0 && <span className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-[#d4af37] text-[10px] font-bold text-stone-950">{cartYards}</span>}
            </button>
          </div>
        </div>
      </header>

      {isMobileMenuOpen && (
        <div className="fixed inset-0 z-[60] overflow-y-auto bg-[#0f3d24] text-white">
          <div className="flex items-center justify-between p-5">
            <span className="text-xs font-bold uppercase tracking-[0.2em] text-[#d4af37]">Menu</span>
            <button onClick={() => setIsMobileMenuOpen(false)} className="p-2">
              <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg>
            </button>
          </div>
          <div className="flex flex-col gap-6 p-5 text-lg font-semibold">
            <a href="#about" onClick={() => setIsMobileMenuOpen(false)}>About Us</a>
            <div>
              <p className="mb-3 text-sm font-bold uppercase tracking-widest text-[#d4af37]">Shop Categories</p>
              <div className="flex flex-col gap-4 pl-4 text-base font-medium text-white/80">
                <button className="text-left" onClick={() => { setActiveCategory("All"); setIsMobileMenuOpen(false); document.getElementById('collections')?.scrollIntoView(); }}>All Fabrics</button>
                {productCategories.map(cat => (
                  <button key={cat} className="text-left" onClick={() => { setActiveCategory(cat); setIsMobileMenuOpen(false); document.getElementById('collections')?.scrollIntoView(); }}>{cat}</button>
                ))}
              </div>
            </div>
            <a href="#inventory" onClick={() => setIsMobileMenuOpen(false)}>Trending & Low Stock</a>
            <a href="#delivery" onClick={() => setIsMobileMenuOpen(false)}>Delivery Info</a>
            <div className="mt-8 flex flex-col gap-6 border-t border-white/20 pt-8">
              {user ? (
                <>
                  <button onClick={() => { setIsMobileMenuOpen(false); setIsOrdersOpen(true); }} className="text-left">My Orders</button>
                  <button onClick={() => { setIsMobileMenuOpen(false); handleSignOut(); }} className="text-left text-red-400">Log out</button>
                </>
              ) : (
                <button onClick={() => { setIsMobileMenuOpen(false); setIsAuthOpen(true); }} className="text-left">Log In / Sign Up</button>
              )}
            </div>
          </div>
        </div>
      )}

      <section id="top" className="relative flex min-h-[60vh] items-center overflow-hidden bg-stone-950 px-5 py-20 sm:px-8">
        <img src={heroImage} alt="Hans Signature Fabrics" className="absolute inset-0 h-full w-full object-cover opacity-80" />
        <div className="absolute inset-0 bg-black/60" />
        <div className="relative z-10 mx-auto w-full max-w-7xl">
          <div className="max-w-3xl animate-fade-up">
            <h1 className="text-5xl font-semibold leading-[0.95] tracking-[-0.06em] text-white sm:text-7xl lg:text-8xl">Hans Signature Fabrics</h1>
            <p className="mt-7 max-w-2xl text-2xl font-medium leading-tight text-white/90 sm:text-4xl">Premium Fabrics for Every Occasion</p>
            <p className="mt-5 max-w-xl text-base leading-8 text-white/80 sm:text-lg">Discover Premium Ankara Fabrics That Make Every Outfit Stand Out. Shop Retail & Wholesale with Fast Nationwide Delivery.</p>
            <div className="mt-9 flex flex-col gap-3 sm:flex-row">
              <button onClick={() => document.getElementById('collections')?.scrollIntoView()} className="inline-flex items-center justify-center rounded-full bg-white px-7 py-4 text-sm font-semibold text-stone-950 transition hover:bg-[#fdf8ec]">Shop collections</button>
            </div>
          </div>
        </div>
      </section>

      <main>
        <section id="about" className="bg-[#fdf8ec] py-20 text-stone-950 lg:py-28">
          <div className="mx-auto max-w-7xl px-5 sm:px-8 text-center">
            <p className="text-sm font-semibold uppercase tracking-[0.28em] text-[#0f3d24]">About Us</p>
            <h2 className="mt-6 text-3xl font-semibold tracking-[-0.03em] sm:text-5xl max-w-4xl mx-auto leading-tight text-stone-950">
              Premium-quality fabrics that combine style, durability, and affordability.
            </h2>
            <p className="mt-8 text-lg leading-8 text-stone-600 max-w-3xl mx-auto">
              Hans Signature Fabrics is your trusted destination for premium Ankara, lace, and other quality fabrics. Whether you're shopping for yourself, your fashion brand, or a special occasion, we offer retail and wholesale sales with nationwide delivery, helping you stand out and create beautiful outfits with confidence.
            </p>
          </div>
        </section>

        <section id="collections" className="mx-auto max-w-7xl px-5 py-20 sm:px-8 lg:py-28">
          <div className="max-w-2xl animate-rise-in">
            <p className="text-sm font-semibold uppercase tracking-[0.28em] text-[#a85c20]">Collections</p>
            <h2 className="mt-4 text-4xl font-semibold tracking-[-0.04em] sm:text-6xl">
              Choose the print that fits the occasion.
            </h2>
            <p className="mt-5 text-lg leading-8 text-stone-600">
              Browse fabrics by style, order in yards, add delivery details, and pay securely with Paystack.
            </p>
          </div>

          <div className="mt-10 flex gap-2 overflow-x-auto pb-3">
            {categories.map((category) => (
              <button
                key={category}
                type="button"
                onClick={() => setActiveCategory(category)}
                className={`whitespace-nowrap border-b-2 px-4 py-3 text-sm font-semibold transition ${
                  activeCategory === category
                    ? "border-stone-950 text-stone-950"
                    : "border-transparent text-stone-500 hover:border-stone-400 hover:text-stone-950"
                }`}
              >
                {category}
              </button>
            ))}
          </div>

          <div className="mt-10 grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-5 lg:grid-cols-4">
            {visibleProducts.map((product, index) => (
              <article
                key={product.id}
                className="group cursor-pointer"
                style={{ animationDelay: `${index * 80}ms` }}
                onClick={() => openProduct(product)}
              >
                <div className="relative aspect-[3/4] overflow-hidden rounded-xl bg-stone-100 sm:rounded-2xl">
                  <img
                    src={getProductImage(product)}
                    alt={product.name}
                    className="h-full w-full object-cover transition duration-700 group-hover:scale-105"
                  />
                  <div className="absolute left-2 top-2 rounded-full bg-white/95 px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-stone-950 shadow-sm backdrop-blur">
                    {product.tag}
                  </div>
                </div>
                <div className="mt-3 space-y-1">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-[#a85c20] sm:text-xs">
                    {product.category}
                  </p>
                  <h3 className="truncate text-xs font-semibold sm:text-sm">{product.name}</h3>
                  <p className="text-xs font-semibold text-stone-600 sm:text-sm">{formatMoney(product.price)} / yard</p>
                </div>
              </article>
            ))}
          </div>
        </section>

        <section className="bg-stone-950 py-20 text-white lg:py-28">
          <div className="mx-auto grid max-w-7xl gap-12 px-5 sm:px-8 lg:grid-cols-[0.9fr_1.1fr] lg:items-center">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.28em] text-[#f3d1a9]">Fabric guide</p>
              <h2 className="mt-4 text-4xl font-semibold tracking-[-0.04em] sm:text-6xl">
                Help customers order the right yards.
              </h2>
              <p className="mt-5 text-lg leading-8 text-white/70">
                A clear yard guide reduces guesswork and helps buyers make faster decisions before checkout.
              </p>
            </div>
            <div className="grid gap-px overflow-hidden rounded-[2rem] bg-white/15">
              {[
                ["Simple gown", "3 to 4 yards"],
                ["Bubu or kaftan", "4 to 5 yards"],
                ["Wrapper and blouse", "5 to 6 yards"],
                ["Family aso ebi", "Contact for wholesale"],
              ].map(([style, yards]) => (
                <div key={style} className="grid grid-cols-2 bg-stone-950 px-5 py-5 sm:px-7">
                  <span className="text-white/65">{style}</span>
                  <span className="text-right font-semibold text-white">{yards}</span>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section id="inventory" className="mx-auto max-w-7xl px-5 py-20 sm:px-8 lg:py-28 overflow-hidden">
          <div className="mb-10 text-center">
            <p className="text-sm font-semibold uppercase tracking-[0.28em] text-[#a85c20]">Trending</p>
            <h2 className="mt-4 text-3xl font-semibold tracking-[-0.04em] text-[#0f3d24] sm:text-5xl">
              Trending & Low Stock
            </h2>
            <p className="mx-auto mt-5 max-w-2xl text-sm leading-7 text-stone-600 sm:text-base">
              Our most-loved fabrics sell out quickly. Secure your favorite designs before they're gone. Once a fabric is sold out, restocking may take time—or it may not return at all. Shop Now
            </p>
          </div>

          <div className="-mx-5 flex gap-4 overflow-x-auto px-5 pb-8 sm:-mx-8 sm:gap-6 sm:px-8 snap-x snap-mandatory hide-scrollbar">
            {products
              .filter((p) => p.stock <= 10 || p.tag.toLowerCase().includes("new"))
              .map((product) => (
                <article
                  key={product.id}
                  className="group relative flex w-[65vw] shrink-0 snap-start flex-col gap-3 sm:w-[45vw] lg:w-[300px]"
                >
                  <button type="button" onClick={() => openProduct(product)} className="text-left">
                    <div className="relative aspect-[3/4] overflow-hidden rounded-2xl bg-stone-100">
                      <img
                        src={getProductImage(product)}
                        alt={product.name}
                        className="h-full w-full object-cover transition duration-700 group-hover:scale-105"
                      />
                      <div className="absolute left-3 top-3 rounded-full bg-red-600 px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-white shadow-sm">
                        {product.stock <= 10 ? "Almost Gone" : "Trending"}
                      </div>
                    </div>
                  </button>
                  
                  <div className="flex flex-col gap-1">
                    <h3 className="truncate text-sm font-semibold">{product.name}</h3>
                    <p className="text-sm font-semibold text-stone-600">{formatMoney(product.price)} / yard</p>
                    <button
                      type="button"
                      disabled={product.stock < product.minYards}
                      onClick={(e) => { e.stopPropagation(); openProduct(product); }}
                      className="mt-2 w-full rounded-full bg-stone-950 py-2.5 text-xs font-semibold text-white transition hover:bg-[#0c331d] disabled:bg-stone-300"
                    >
                      Add to Cart
                    </button>
                  </div>
                </article>
              ))}
          </div>
        </section>

        <section id="delivery" className="bg-white py-20 lg:py-28">
          <div className="mx-auto grid max-w-7xl gap-12 px-5 sm:px-8 lg:grid-cols-[0.95fr_1.05fr]">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.28em] text-[#a85c20]">Delivery and contact</p>
              <h2 className="mt-4 text-4xl font-semibold tracking-[-0.04em] sm:text-6xl">
                Customers can reach, order, and receive fabrics from Lagos.
              </h2>
              <p className="mt-5 text-lg leading-8 text-stone-600">
                Hans Signature Fabrics serves retail and wholesale customers from Oshodi/CANA, Ikorodu, Lagos, Nigeria.
              </p>
            </div>

            <div className="grid gap-px overflow-hidden rounded-[2rem] bg-stone-200">
              {[
                ["Phone", "07053734349", "tel:07053734349"],
                ["WhatsApp", "09042941371", getWhatsAppUrl("Hello Hans Signature Fabrics, I am contacting you from the website.")],
                ["Email", "hanssignaturefabric3@gmail.com", "mailto:hanssignaturefabric3@gmail.com"],
                ["Instagram", "@hans_signaturefabric", "https://www.instagram.com/hans_signaturefabric/"],
                ["Facebook", "Ibeh Ndidiamaka", "https://www.facebook.com/search/top?q=Ibeh%20Ndidiamaka"],
              ].map(([label, value, href]) => (
                <a
                  key={label}
                  href={href}
                  target={href.startsWith("http") ? "_blank" : undefined}
                  rel={href.startsWith("http") ? "noreferrer" : undefined}
                  className="grid gap-2 bg-white p-6 transition hover:bg-[#f8f4ef] sm:grid-cols-[0.4fr_1fr]"
                >
                  <span className="text-sm font-semibold uppercase tracking-[0.2em] text-stone-500">{label}</span>
                  <span className="font-semibold text-stone-950">{value}</span>
                </a>
              ))}
            </div>
          </div>
        </section>
      </main>

      <footer className="bg-[#0f3d24] px-5 py-12 text-white sm:px-8">
        <div className="mx-auto max-w-7xl">
          <div className="flex flex-col gap-10 lg:flex-row lg:justify-between">
            <div className="flex flex-col items-start gap-4">
              <a href="#top" className="flex items-center gap-3">
                <img src="/logo.jpg" alt="Logo" className="h-14 w-14 rounded-lg object-contain bg-[#fdf8ec] p-1" />
                <span className="text-sm font-bold uppercase tracking-[0.2em] text-white">
                  Hans Signature Fabrics
                </span>
              </a>
              <div className="text-sm text-white/70">
                <p>Premium Prints for Every Occasion.</p>
                <p className="mt-1">Oshodi/CANA, Ikorodu, Lagos, Nigeria.</p>
              </div>
            </div>

            <div className="flex flex-col gap-4 text-sm font-medium text-white/90 sm:flex-row sm:gap-10">
              <div className="flex flex-col gap-3">
                <p className="text-xs uppercase tracking-[0.2em] text-[#d4af37]">Explore</p>
                <a href="#about" className="transition hover:text-white">About Us</a>
                <a href="#collections" className="transition hover:text-white">Shop Collections</a>
              </div>
              <div className="flex flex-col gap-3">
                <p className="text-xs uppercase tracking-[0.2em] text-[#d4af37]">Customer Care</p>
                <a href="#inventory" className="transition hover:text-white">Live Inventory</a>
                <a href="#delivery" className="transition hover:text-white">Delivery Information</a>
                <button type="button" onClick={() => setIsOrdersOpen(true)} className="text-left transition hover:text-white">My Orders</button>
                <button type="button" onClick={() => setIsAdminOpen(true)} className="text-left transition hover:text-white">Admin Login</button>
              </div>
            </div>
          </div>

          <div className="mt-12 flex flex-wrap items-center gap-4 border-t border-white/10 pt-8 text-sm text-white/65 lg:justify-between">
            <p>© {new Date().getFullYear()} Hans Signature Fabrics. All rights reserved.</p>
            <div className="flex flex-wrap gap-3">
              {[
                ["whatsapp", "WhatsApp", getWhatsAppUrl("Hello Hans Signature Fabrics, I am contacting you from the website.")],
                ["instagram", "Instagram", "https://www.instagram.com/hans_signaturefabric/"],
                ["facebook", "Facebook", "https://www.facebook.com/search/top?q=Ibeh%20Ndidiamaka"],
                ["email", "Email", "mailto:hanssignaturefabric3@gmail.com"],
                ["phone", "Call", "tel:07053734349"],
              ].map(([icon, label, href]) => (
                <a
                  key={label}
                  href={href}
                  target={href.startsWith("http") ? "_blank" : undefined}
                  rel={href.startsWith("http") ? "noreferrer" : undefined}
                  className="inline-flex items-center gap-2 rounded-full border border-white/15 px-4 py-2 text-white/75 transition hover:border-white/40 hover:text-white"
                >
                  <SocialIcon name={icon as "whatsapp" | "instagram" | "facebook" | "email" | "phone"} />
                  {label}
                </a>
              ))}
            </div>
          </div>
        </div>
      </footer>

      {selectedProduct && (
        <div className="fixed inset-0 z-40 flex items-end bg-stone-950/60 p-0 backdrop-blur-sm sm:items-center sm:p-6">
          <div className="mx-auto grid max-h-[92vh] w-full max-w-5xl overflow-auto rounded-t-[2rem] bg-white sm:rounded-[2rem] lg:grid-cols-2">
            <div className="min-h-[360px] bg-stone-200">
              <img
                src={getProductImage(selectedProduct)}
                alt={selectedProduct.name}
                className="h-full min-h-[360px] w-full object-cover"
              />
              {getProductImages(selectedProduct).length > 1 && (
                <div className="grid grid-cols-4 gap-2 bg-white p-3">
                  {getProductImages(selectedProduct).map((image) => (
                    <img key={image} src={image} alt="" className="h-16 w-full rounded-xl object-cover" />
                  ))}
                </div>
              )}
            </div>
            <div className="p-6 sm:p-8">
              <div className="flex items-start justify-between gap-6">
                <div>
                  <p className="text-sm font-semibold uppercase tracking-[0.24em] text-[#a85c20]">
                    {selectedProduct.category}
                  </p>
                  <h3 className="mt-3 text-4xl font-semibold tracking-[-0.04em]">{selectedProduct.name}</h3>
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedProduct(null)}
                  className="rounded-full border border-stone-300 px-4 py-2 text-sm font-semibold transition hover:border-stone-950"
                >
                  Close
                </button>
              </div>

              <p className="mt-6 text-stone-600">{selectedProduct.description}</p>
              <div className="mt-7 grid gap-px overflow-hidden rounded-3xl bg-stone-200">
                <div className="grid grid-cols-2 bg-white px-5 py-4">
                  <span className="text-stone-500">Price per yard</span>
                  <span className="text-right font-semibold">{formatMoney(selectedProduct.price)}</span>
                </div>
                <div className="grid grid-cols-2 bg-white px-5 py-4">
                  <span className="text-stone-500">Available stock</span>
                  <span className="text-right font-semibold">{selectedProduct.stock} yards</span>
                </div>
                <div className="grid grid-cols-2 bg-white px-5 py-4">
                  <span className="text-stone-500">Palette</span>
                  <span className="text-right font-semibold">{selectedProduct.palette}</span>
                </div>
              </div>

              <div className="mt-8">
                <label className="text-sm font-semibold text-stone-700" htmlFor="yards">
                  Yards
                </label>
                <div className="mt-3 flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => setSelectedYards((yards) => Math.max(selectedProduct.minYards, yards - 1))}
                    className="h-11 w-11 rounded-full border border-stone-300 font-semibold transition hover:border-stone-950"
                  >
                    -
                  </button>
                  <input
                    id="yards"
                    type="number"
                    min={selectedProduct.minYards}
                    max={selectedProduct.stock}
                    value={selectedYards}
                    onChange={(event) => setSelectedYards(Number(event.target.value))}
                    className="h-11 w-24 rounded-full border border-stone-300 text-center font-semibold outline-none focus:border-stone-950"
                  />
                  <button
                    type="button"
                    onClick={() => setSelectedYards((yards) => Math.min(selectedProduct.stock, yards + 1))}
                    className="h-11 w-11 rounded-full border border-stone-300 font-semibold transition hover:border-stone-950"
                  >
                    +
                  </button>
                </div>
              </div>

              <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                <button
                  type="button"
                  onClick={() => {
                    addToCart(selectedProduct, selectedYards);
                    setSelectedProduct(null);
                  }}
                  className="rounded-full bg-stone-950 px-6 py-3 text-sm font-semibold text-white transition hover:bg-[#a85c20]"
                >
                  Add to cart - {formatMoney(selectedProduct.price * selectedYards)}
                </button>
                <a
                  href={getWhatsAppUrl(
                    `Hello Hans Signature Fabrics, I want ${selectedYards} yards of ${selectedProduct.name}.`,
                  )}
                  target="_blank"
                  rel="noreferrer"
                  className="rounded-full border border-stone-300 px-6 py-3 text-center text-sm font-semibold transition hover:border-stone-950"
                >
                  Ask on WhatsApp
                </a>
              </div>
            </div>
          </div>
        </div>
      )}

      <aside
        className={`fixed inset-y-0 right-0 z-50 flex w-full max-w-xl transform flex-col bg-white shadow-2xl transition duration-300 ${
          isCartOpen ? "translate-x-0" : "translate-x-full"
        }`}
        aria-hidden={!isCartOpen}
      >
        <div className="flex items-center justify-between border-b border-stone-200 p-5 sm:p-6">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.24em] text-[#a85c20]">Order</p>
            <h2 className="text-3xl font-semibold tracking-[-0.04em]">Cart and checkout</h2>
          </div>
          <button
            type="button"
            onClick={() => setIsCartOpen(false)}
            className="rounded-full border border-stone-300 px-4 py-2 text-sm font-semibold transition hover:border-stone-950"
          >
            Close
          </button>
        </div>

        <div className="flex-1 overflow-auto p-5 sm:p-6">
          {cartLines.length === 0 ? (
            <div className="flex h-full flex-col items-center justify-center text-center">
              <p className="text-2xl font-semibold tracking-[-0.03em]">Your cart is empty.</p>
              <p className="mt-3 max-w-sm text-stone-600">Add a fabric collection to start an order.</p>
              <button
                type="button"
                onClick={() => setIsCartOpen(false)}
                className="mt-6 rounded-full bg-stone-950 px-6 py-3 text-sm font-semibold text-white transition hover:bg-[#a85c20]"
              >
                Continue shopping
              </button>
            </div>
          ) : (
            <div className="space-y-8">
              <div className="space-y-4">
                {cartLines.map((item) => (
                  <div key={item.productId} className="flex gap-4 rounded-3xl border border-stone-200 p-3">
                    <img src={getProductImage(item.product)} alt="" className="h-24 w-24 rounded-2xl object-cover" />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-4">
                        <div>
                          <p className="font-semibold">{item.product.name}</p>
                          <p className="text-sm text-stone-500">{formatMoney(item.product.price)} per yard</p>
                        </div>
                        <button
                          type="button"
                          onClick={() => setCart((current) => current.filter((line) => line.productId !== item.productId))}
                          className="text-sm font-semibold text-stone-500 transition hover:text-red-700"
                        >
                          Remove
                        </button>
                      </div>
                      <div className="mt-4 flex items-center justify-between gap-4">
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => updateCartYards(item.productId, item.yards - 1)}
                            className="h-8 w-8 rounded-full border border-stone-300 font-semibold"
                          >
                            -
                          </button>
                          <span className="w-16 text-center text-sm font-semibold">{item.yards} yd</span>
                          <button
                            type="button"
                            onClick={() => updateCartYards(item.productId, item.yards + 1)}
                            className="h-8 w-8 rounded-full border border-stone-300 font-semibold"
                          >
                            +
                          </button>
                        </div>
                        <p className="font-semibold">{formatMoney(item.lineTotal)}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              <form onSubmit={handleCheckout} className="space-y-5">
                <div>
                  <h3 className="text-2xl font-semibold tracking-[-0.03em]">Delivery details</h3>
                  <p className="mt-2 text-sm leading-6 text-stone-600">
                    Customers enter their delivery address and contact details before payment.
                  </p>
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  <label className="block text-sm font-semibold text-stone-700">
                    Full name
                    <input
                      value={checkout.fullName}
                      onChange={(event) => setCheckout({ ...checkout, fullName: event.target.value })}
                      className="mt-2 w-full rounded-2xl border border-stone-300 px-4 py-3 font-normal outline-none focus:border-stone-950"
                      placeholder="Customer name"
                    />
                  </label>
                  <label className="block text-sm font-semibold text-stone-700">
                    Phone
                    <input
                      value={checkout.phone}
                      onChange={(event) => setCheckout({ ...checkout, phone: event.target.value })}
                      className="mt-2 w-full rounded-2xl border border-stone-300 px-4 py-3 font-normal outline-none focus:border-stone-950"
                      placeholder="080..."
                    />
                  </label>
                  <label className="block text-sm font-semibold text-stone-700 sm:col-span-2">
                    Email for Paystack receipt
                    <input
                      type="email"
                      value={checkout.email}
                      onChange={(event) => setCheckout({ ...checkout, email: event.target.value })}
                      className="mt-2 w-full rounded-2xl border border-stone-300 px-4 py-3 font-normal outline-none focus:border-stone-950"
                      placeholder="customer@email.com"
                    />
                  </label>
                  <label className="block text-sm font-semibold text-stone-700 sm:col-span-2">
                    Delivery address
                    <textarea
                      value={checkout.address}
                      onChange={(event) => setCheckout({ ...checkout, address: event.target.value })}
                      className="mt-2 min-h-24 w-full rounded-2xl border border-stone-300 px-4 py-3 font-normal outline-none focus:border-stone-950"
                      placeholder="Street, bus stop, house number"
                    />
                  </label>
                  <label className="block text-sm font-semibold text-stone-700">
                    City
                    <input
                      value={checkout.city}
                      onChange={(event) => setCheckout({ ...checkout, city: event.target.value })}
                      className="mt-2 w-full rounded-2xl border border-stone-300 px-4 py-3 font-normal outline-none focus:border-stone-950"
                    />
                  </label>
                  <label className="block text-sm font-semibold text-stone-700">
                    State
                    <input
                      value={checkout.state}
                      onChange={(event) => setCheckout({ ...checkout, state: event.target.value })}
                      className="mt-2 w-full rounded-2xl border border-stone-300 px-4 py-3 font-normal outline-none focus:border-stone-950"
                    />
                  </label>
                </div>

                <div className="space-y-3">
                  <p className="text-sm font-semibold text-stone-700">Delivery option</p>
                  {(Object.keys(deliveryOptions) as DeliveryOption[]).map((option) => (
                    <label
                      key={option}
                      className={`flex cursor-pointer items-start justify-between gap-4 rounded-3xl border p-4 transition ${
                        checkout.delivery === option ? "border-stone-950 bg-[#f8f4ef]" : "border-stone-200"
                      }`}
                    >
                      <span>
                        <span className="block font-semibold">{deliveryOptions[option].label}</span>
                        <span className="mt-1 block text-sm text-stone-500">{deliveryOptions[option].eta}</span>
                      </span>
                      <span className="font-semibold">{formatMoney(deliveryOptions[option].fee)}</span>
                      <input
                        type="radio"
                        name="delivery"
                        checked={checkout.delivery === option}
                        onChange={() => setCheckout({ ...checkout, delivery: option })}
                        className="sr-only"
                      />
                    </label>
                  ))}
                </div>

                <label className="block text-sm font-semibold text-stone-700">
                  Order note
                  <textarea
                    value={checkout.note}
                    onChange={(event) => setCheckout({ ...checkout, note: event.target.value })}
                    className="mt-2 min-h-20 w-full rounded-2xl border border-stone-300 px-4 py-3 font-normal outline-none focus:border-stone-950"
                    placeholder="Example: Call before delivery, preferred color, wholesale request"
                  />
                </label>

                <div className="space-y-3 rounded-3xl bg-stone-950 p-5 text-white">
                  <div className="flex justify-between text-sm text-white/70">
                    <span>Subtotal</span>
                    <span>{formatMoney(subtotal)}</span>
                  </div>
                  <div className="flex justify-between text-sm text-white/70">
                    <span>Delivery</span>
                    <span>{formatMoney(deliveryFee)}</span>
                  </div>
                  <div className="flex justify-between border-t border-white/15 pt-3 text-xl font-semibold">
                    <span>Total</span>
                    <span>{formatMoney(grandTotal)}</span>
                  </div>
                </div>

                {checkoutError && <p className="rounded-2xl bg-red-50 p-4 text-sm font-semibold text-red-700">{checkoutError}</p>}
                {orderStatus && <p className="rounded-2xl bg-emerald-50 p-4 text-sm font-semibold text-emerald-700">{orderStatus}</p>}

                <div className="grid gap-3 sm:grid-cols-2">
                  <button
                    type="submit"
                    disabled={isPaying}
                    className="rounded-full bg-stone-950 px-6 py-3 text-sm font-semibold text-white transition hover:bg-[#a85c20] disabled:cursor-wait disabled:bg-stone-400"
                  >
                    {isPaying ? "Opening Paystack..." : "Pay with Paystack"}
                  </button>
                  <a
                    href={getWhatsAppUrl(orderMessage)}
                    target="_blank"
                    rel="noreferrer"
                    className="rounded-full border border-stone-300 px-6 py-3 text-center text-sm font-semibold transition hover:border-stone-950"
                  >
                    Send order on WhatsApp
                  </a>
                </div>
              </form>
            </div>
          )}
        </div>
      </aside>

      {isCartOpen && (
        <button
          type="button"
          aria-label="Close cart overlay"
          onClick={() => setIsCartOpen(false)}
          className="fixed inset-0 z-40 bg-stone-950/30 backdrop-blur-[2px]"
        />
      )}

      {isAuthOpen && !user && (
        <aside className="fixed inset-y-0 right-0 z-[80] flex w-full max-w-md transform flex-col bg-white shadow-2xl transition duration-300 translate-x-0 overflow-y-auto">
          <div className="flex items-center justify-between p-6 sm:p-8">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.2em] text-[#d4af37]">Customer Account</p>
              <h2 className="mt-2 text-3xl font-semibold tracking-[-0.04em]">
                {authMode === "login" ? "Login" : "Create account"}
              </h2>
            </div>
            <button
              type="button"
              onClick={() => setIsAuthOpen(false)}
              className="rounded-full border border-stone-200 px-4 py-2 text-sm font-semibold transition hover:border-stone-950"
            >
              Close
            </button>
          </div>

          <div className="flex-1 px-6 sm:px-8 pb-8">
            <form onSubmit={handleAuth} className="space-y-5">
              {authMode === "signup" && (
                <>
                  <label className="block text-sm font-semibold text-stone-700">
                    Full name
                    <input
                      type="text"
                      className="mt-2 w-full rounded-2xl border border-stone-200 px-4 py-3 font-normal outline-none focus:border-stone-950"
                      placeholder="Your full name"
                    />
                  </label>
                  <label className="block text-sm font-semibold text-stone-700">
                    Phone
                    <input
                      type="tel"
                      className="mt-2 w-full rounded-2xl border border-stone-200 px-4 py-3 font-normal outline-none focus:border-stone-950"
                      placeholder="080..."
                    />
                  </label>
                </>
              )}
              
              <label className="block text-sm font-semibold text-stone-700">
                Email
                <input
                  type="email"
                  value={authEmail}
                  onChange={(event) => setAuthEmail(event.target.value)}
                  className="mt-2 w-full rounded-2xl border border-stone-200 px-4 py-3 font-normal outline-none focus:border-stone-950"
                  placeholder="you@email.com"
                  required
                />
              </label>

              <label className="block text-sm font-semibold text-stone-700">
                Password
                <input
                  type="password"
                  value={authPassword}
                  onChange={(event) => setAuthPassword(event.target.value)}
                  className="mt-2 w-full rounded-2xl border border-stone-200 px-4 py-3 font-normal outline-none focus:border-stone-950"
                  placeholder="At least 6 characters"
                  required
                  minLength={6}
                />
              </label>

              {authError && <p className="rounded-2xl bg-red-50 p-4 text-sm font-semibold text-red-700">{authError}</p>}
              {authMessage && <p className="rounded-2xl bg-emerald-50 p-4 text-sm font-semibold text-emerald-700">{authMessage}</p>}

              <button
                type="submit"
                className="mt-6 w-full rounded-full bg-stone-950 px-6 py-4 text-sm font-semibold text-white transition hover:bg-[#0c331d]"
              >
                {authMode === "login" ? "Login" : "Create account"}
              </button>

              <button
                type="button"
                onClick={() => {
                  setAuthMode(authMode === "login" ? "signup" : "login");
                  setAuthError("");
                  setAuthMessage("");
                }}
                className="w-full rounded-full border border-stone-200 px-6 py-4 text-sm font-semibold text-stone-950 transition hover:border-stone-950"
              >
                {authMode === "login" ? "Create account" : "Already have an account? Login"}
              </button>
            </form>
          </div>
        </aside>
      )}

      {isAuthOpen && !user && (
        <button
          type="button"
          aria-label="Close auth overlay"
          onClick={() => setIsAuthOpen(false)}
          className="fixed inset-0 z-[70] bg-stone-950/30 backdrop-blur-[2px]"
        />
      )}

      {isAdminOpen && (
        <div className="fixed inset-0 z-[70] overflow-auto bg-stone-950/70 p-3 backdrop-blur-sm sm:p-6">
          <div className="mx-auto min-h-[92vh] max-w-7xl rounded-[2rem] bg-[#f8f4ef] shadow-2xl">
            <div className="sticky top-0 z-10 flex items-center justify-between border-b border-stone-200 bg-[#f8f4ef]/95 p-5 backdrop-blur sm:p-6">
              <div>
                <p className="text-sm font-semibold uppercase tracking-[0.24em] text-[#a85c20]">Owner dashboard</p>
                <h2 className="text-3xl font-semibold tracking-[-0.04em]">Hans admin</h2>
              </div>
              <button
                type="button"
                onClick={() => setIsAdminOpen(false)}
                className="rounded-full border border-stone-300 px-4 py-2 text-sm font-semibold transition hover:border-stone-950"
              >
                Close
              </button>
            </div>

            {!isAdminUnlocked ? (
              <div className="mx-auto flex max-w-md flex-col justify-center p-6 py-16 sm:p-10">
                <h3 className="text-4xl font-semibold tracking-[-0.04em]">Admin login</h3>
                <p className="mt-3 text-stone-600">
                  Enter the secure PIN to manage inventory and view customer orders.
                </p>
                <form onSubmit={unlockAdmin} className="mt-8 space-y-4">
                  <input
                    type="password"
                    value={adminPin}
                    onChange={(event) => setAdminPin(event.target.value)}
                    className="w-full rounded-2xl border border-stone-300 px-4 py-3 outline-none focus:border-stone-950"
                    placeholder="Enter PIN"
                  />
                  {adminError && <p className="rounded-2xl bg-red-50 p-4 text-sm font-semibold text-red-700">{adminError}</p>}
                  <button
                    type="submit"
                    className="w-full rounded-full bg-stone-950 px-6 py-3 text-sm font-semibold text-white transition hover:bg-[#a85c20]"
                  >
                    Unlock dashboard
                  </button>
                </form>
              </div>
            ) : (
              <div className="space-y-8 p-5 sm:p-6 lg:p-8">
                <div className="grid gap-4 md:grid-cols-4">
                  {[
                    ["Products", products.length.toString()],
                    ["Low stock", lowStockCount.toString()],
                    ["Orders", orders.length.toString()],
                    ["Revenue", formatMoney(totalRevenue)],
                  ].map(([label, value]) => (
                    <div key={label} className="rounded-[1.5rem] bg-white p-5 shadow-sm">
                      <p className="text-sm font-semibold text-stone-500">{label}</p>
                      <p className="mt-2 text-3xl font-semibold tracking-[-0.04em]">{value}</p>
                    </div>
                  ))}
                </div>
                <div className={`rounded-3xl p-4 text-sm font-semibold ${isSupabaseConnected ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-800"}`}>
                  {isSupabaseConnected
                    ? "Supabase connected! Customer logins and data are active."
                    : "Supabase not connected. Check .env keys. App is running in Local Mode."}
                </div>

                <section className="grid gap-6 lg:grid-cols-[0.85fr_1.15fr]">
                  <form onSubmit={saveProduct} className="rounded-[2rem] bg-white p-5 shadow-sm sm:p-6">
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <p className="text-sm font-semibold uppercase tracking-[0.22em] text-[#a85c20]">Products</p>
                        <h3 className="mt-2 text-3xl font-semibold tracking-[-0.04em]">
                          {productForm.id ? "Edit product" : "Add product"}
                        </h3>
                      </div>
                      {productForm.id && (
                        <button
                          type="button"
                          onClick={() => setProductForm(emptyProduct)}
                          className="rounded-full border border-stone-300 px-4 py-2 text-sm font-semibold transition hover:border-stone-950"
                        >
                          New
                        </button>
                      )}
                    </div>

                    <div className="mt-6 grid gap-4">
                      <div className="text-sm font-semibold text-stone-700">
                        Product photos
                        <div className="mt-2 rounded-3xl border border-stone-200 p-3">
                          <div className="grid grid-cols-3 gap-3 sm:grid-cols-4">
                            {getProductImages(productForm).map((image) => (
                              <div key={image} className="relative overflow-hidden rounded-2xl border border-stone-200 bg-stone-100">
                                <img src={image} alt="" className="h-24 w-full object-cover" />
                                <div className="flex gap-1 p-2">
                                  <button
                                    type="button"
                                    onClick={() => setMainProductImage(image)}
                                    className={`flex-1 rounded-full px-2 py-1 text-[11px] font-semibold ${
                                      getProductImage(productForm) === image
                                        ? "bg-stone-950 text-white"
                                        : "bg-white text-stone-700"
                                    }`}
                                  >
                                    Main
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => removeProductImage(image)}
                                    className="rounded-full bg-red-50 px-2 py-1 text-[11px] font-semibold text-red-700"
                                  >
                                    Remove
                                  </button>
                                </div>
                              </div>
                            ))}
                          </div>
                          <input
                            type="file"
                            accept="image/*"
                            multiple
                            onChange={handleMultipleImageUpload}
                            className="mt-4 w-full text-sm text-stone-600 file:mr-4 file:rounded-full file:border-0 file:bg-stone-950 file:px-4 file:py-2 file:text-sm file:font-semibold file:text-white"
                          />
                          <p className="mt-2 text-xs font-normal leading-5 text-stone-500">
                            Upload one or more photos. Click Main to choose the first photo customers will see.
                          </p>
                        </div>
                      </div>
                      <label className="text-sm font-semibold text-stone-700">
                        Name
                        <input
                          value={productForm.name}
                          onChange={(event) => setProductForm({ ...productForm, name: event.target.value })}
                          className="mt-2 w-full rounded-2xl border border-stone-300 px-4 py-3 font-normal outline-none focus:border-stone-950"
                          placeholder="Fabric name"
                        />
                      </label>
                      <div className="grid gap-4 sm:grid-cols-2">
                        <label className="text-sm font-semibold text-stone-700">
                          Category
                          <select
                            value={productForm.category}
                            onChange={(event) => setProductForm({ ...productForm, category: event.target.value as ProductCategory })}
                            className="mt-2 w-full rounded-2xl border border-stone-300 bg-white px-4 py-3 font-normal outline-none focus:border-stone-950"
                          >
                            {productCategories.map((category) => (
                              <option key={category} value={category}>
                                {category}
                              </option>
                            ))}
                          </select>
                        </label>
                        <label className="text-sm font-semibold text-stone-700">
                          Tag
                          <input
                            value={productForm.tag}
                            onChange={(event) => setProductForm({ ...productForm, tag: event.target.value })}
                            className="mt-2 w-full rounded-2xl border border-stone-300 px-4 py-3 font-normal outline-none focus:border-stone-950"
                            placeholder="New arrival"
                          />
                        </label>
                        <label className="text-sm font-semibold text-stone-700">
                          Price per yard
                          <input
                            type="number"
                            value={productForm.price}
                            onChange={(event) => setProductForm({ ...productForm, price: Number(event.target.value) })}
                            className="mt-2 w-full rounded-2xl border border-stone-300 px-4 py-3 font-normal outline-none focus:border-stone-950"
                          />
                        </label>
                        <label className="text-sm font-semibold text-stone-700">
                          Stock in yards
                          <input
                            type="number"
                            value={productForm.stock}
                            onChange={(event) => setProductForm({ ...productForm, stock: Number(event.target.value) })}
                            className="mt-2 w-full rounded-2xl border border-stone-300 px-4 py-3 font-normal outline-none focus:border-stone-950"
                          />
                        </label>
                        <label className="text-sm font-semibold text-stone-700">
                          Minimum yards
                          <input
                            type="number"
                            value={productForm.minYards}
                            onChange={(event) => setProductForm({ ...productForm, minYards: Number(event.target.value) })}
                            className="mt-2 w-full rounded-2xl border border-stone-300 px-4 py-3 font-normal outline-none focus:border-stone-950"
                          />
                        </label>
                        <label className="text-sm font-semibold text-stone-700">
                          Palette
                          <input
                            value={productForm.palette}
                            onChange={(event) => setProductForm({ ...productForm, palette: event.target.value })}
                            className="mt-2 w-full rounded-2xl border border-stone-300 px-4 py-3 font-normal outline-none focus:border-stone-950"
                            placeholder="Black, white, rust"
                          />
                        </label>
                      </div>
                      <label className="text-sm font-semibold text-stone-700">
                        Description
                        <textarea
                          value={productForm.description}
                          onChange={(event) => setProductForm({ ...productForm, description: event.target.value })}
                          className="mt-2 min-h-24 w-full rounded-2xl border border-stone-300 px-4 py-3 font-normal outline-none focus:border-stone-950"
                          placeholder="What makes this fabric useful for customers?"
                        />
                      </label>
                    </div>

                    {adminError && <p className="mt-4 rounded-2xl bg-red-50 p-4 text-sm font-semibold text-red-700">{adminError}</p>}
                    <button
                      type="submit"
                      className="mt-6 w-full rounded-full bg-stone-950 px-6 py-3 text-sm font-semibold text-white transition hover:bg-[#a85c20]"
                    >
                      Save product
                    </button>
                  </form>

                  <div className="rounded-[2rem] bg-white p-5 shadow-sm sm:p-6">
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <p className="text-sm font-semibold uppercase tracking-[0.22em] text-[#a85c20]">Inventory list</p>
                        <h3 className="mt-2 text-3xl font-semibold tracking-[-0.04em]">Manage stock</h3>
                      </div>
                      <button
                        type="button"
                        onClick={resetDemoData}
                        className="rounded-full border border-stone-300 px-4 py-2 text-sm font-semibold transition hover:border-stone-950"
                      >
                        Reset only
                      </button>
                    </div>
                    <div className="mt-6 space-y-3">
                      {products.map((product) => (
                        <div key={product.id} className="grid gap-4 rounded-3xl border border-stone-200 p-4 md:grid-cols-[1fr_auto] md:items-center">
                          <div className="flex gap-4">
                          <img src={getProductImage(product)} alt="" className="h-20 w-20 rounded-2xl object-cover" />
                            <div>
                              <p className="font-semibold">{product.name}</p>
                              <p className="text-sm text-stone-500">{product.category} / {formatMoney(product.price)} per yard</p>
                              <p className={product.stock <= 10 ? "mt-1 text-sm font-semibold text-red-700" : "mt-1 text-sm font-semibold text-emerald-700"}>
                                {product.stock} yards left
                              </p>
                            </div>
                          </div>
                          <div className="flex flex-wrap gap-2 md:justify-end">
                            <button
                              type="button"
                              onClick={() => adjustStock(product.id, -1)}
                              className="rounded-full border border-stone-300 px-4 py-2 text-sm font-semibold transition hover:border-stone-950"
                            >
                              -1
                            </button>
                            <button
                              type="button"
                              onClick={() => adjustStock(product.id, 1)}
                              className="rounded-full border border-stone-300 px-4 py-2 text-sm font-semibold transition hover:border-stone-950"
                            >
                              +1
                            </button>
                            <button
                              type="button"
                              onClick={() => editProduct(product)}
                              className="rounded-full bg-stone-950 px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#a85c20]"
                            >
                              Edit
                            </button>
                            <button
                              type="button"
                              onClick={() => deleteProduct(product.id)}
                              className="rounded-full bg-red-50 px-4 py-2 text-sm font-semibold text-red-700 transition hover:bg-red-100"
                            >
                              Delete
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </section>

                <section className="grid gap-6 lg:grid-cols-[0.8fr_1.2fr]">
                  <div className="rounded-[2rem] bg-white p-5 shadow-sm sm:p-6">
                    <p className="text-sm font-semibold uppercase tracking-[0.22em] text-[#a85c20]">Images</p>
                    <h3 className="mt-2 text-3xl font-semibold tracking-[-0.04em]">Replace with your exact photos</h3>
                    <p className="mt-3 text-sm leading-6 text-stone-600">
                      The pictures sent in chat are not available as files inside the project. When your laptop is on, download them and upload them here. The storefront updates immediately and saves them in this browser.
                    </p>
                    <div className="mt-6 space-y-4">
                      <label className="block text-sm font-semibold text-stone-700">
                        Homepage owner photo
                        <div className="mt-2 flex items-center gap-4">
                          <img src={heroImage} alt="" className="h-24 w-24 rounded-2xl object-cover" />
                          <input
                            type="file"
                            accept="image/*"
                            onChange={(event) => handleImageUpload(event, saveHeroImage)}
                            className="w-full text-sm text-stone-600 file:mr-4 file:rounded-full file:border-0 file:bg-stone-950 file:px-4 file:py-2 file:text-sm file:font-semibold file:text-white"
                          />
                        </div>
                      </label>
                      <div className="rounded-3xl bg-[#f8f4ef] p-4 text-sm leading-6 text-stone-600">
                        Use the product form above to open each fabric and upload its matching real Ankara photo. This is the fastest way to replace the generated sample images with the exact ones you sent.
                      </div>
                    </div>
                  </div>

                  <div className="rounded-[2rem] bg-white p-5 shadow-sm sm:p-6">
                    <p className="text-sm font-semibold uppercase tracking-[0.22em] text-[#a85c20]">Orders</p>
                    <h3 className="mt-2 text-3xl font-semibold tracking-[-0.04em]">Customer orders</h3>
                    <div className="mt-6 space-y-4">
                      {orders.length === 0 ? (
                        <p className="rounded-3xl bg-[#f8f4ef] p-5 text-stone-600">No orders yet. Demo orders will appear after checkout.</p>
                      ) : (
                        orders.map((order) => (
                          <div key={order.id} className="rounded-3xl border border-stone-200 p-4">
                            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                              <div>
                                <p className="font-semibold">{order.customer.fullName}</p>
                                <p className="text-sm text-stone-500">{order.customer.phone} / {order.customer.email}</p>
                                <p className="mt-1 text-sm text-stone-500">Ref: {order.reference}</p>
                              </div>
                              <select
                                value={order.status}
                                onChange={(event) => updateOrderStatus(order.id, event.target.value as OrderStatus)}
                                className="rounded-full border border-stone-300 bg-white px-4 py-2 text-sm font-semibold outline-none focus:border-stone-950"
                              >
                                {orderStatuses.map((status) => (
                                  <option key={status} value={status}>
                                    {status}
                                  </option>
                                ))}
                              </select>
                            </div>
                            <div className="mt-4 space-y-2">
                              {order.items.map((item) => (
                                <div key={`${order.id}-${item.productId}`} className="flex justify-between gap-4 text-sm">
                                  <span>{item.productName} x {item.yards} yd</span>
                                  <span className="font-semibold">{formatMoney(item.total)}</span>
                                </div>
                              ))}
                            </div>
                            <div className="mt-4 border-t border-stone-200 pt-4 text-sm text-stone-600">
                              <p>{order.customer.address}, {order.customer.city}, {order.customer.state}</p>
                              <p>{deliveryOptions[order.customer.delivery].label}</p>
                              {order.customer.note && <p>Note: {order.customer.note}</p>}
                              <p className="mt-2 text-lg font-semibold text-stone-950">{formatMoney(order.total)}</p>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                </section>
              </div>
            )}
          </div>
        </div>
      )}

      {isOrdersOpen && (
        <aside className="fixed inset-y-0 right-0 z-[80] flex w-full max-w-md transform flex-col overflow-y-auto bg-white shadow-2xl transition duration-300">
          <div className="flex items-center justify-between border-b border-stone-100 p-6 sm:p-8">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.2em] text-[#d4af37]">Customer Account</p>
              <h2 className="mt-2 text-3xl font-semibold tracking-[-0.04em]">My Orders</h2>
            </div>
            <button onClick={() => setIsOrdersOpen(false)} className="rounded-full border border-stone-200 px-4 py-2 text-sm font-semibold transition hover:border-stone-950">Close</button>
          </div>
          <div className="flex-1 p-6 sm:p-8">
            {orders.filter(o => o.customer.email === user?.email).length === 0 ? (
               <p className="text-stone-500">You haven't placed any orders yet.</p>
            ) : (
               <div className="space-y-6">
                 {orders.filter(o => o.customer.email === user?.email).map(order => (
                   <div key={order.id} className="rounded-2xl border border-stone-200 p-4">
                     <div className="mb-4 flex items-start justify-between">
                       <div>
                         <p className="text-xs text-stone-500">Order Ref: {order.reference}</p>
                         <p className="font-semibold">{new Date(order.createdAt).toLocaleDateString()}</p>
                       </div>
                       <span className={`rounded-full px-2 py-1 text-[10px] font-bold uppercase ${order.status === 'Delivered' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>{order.status}</span>
                     </div>
                     <div className="space-y-2">
                       {order.items.map(item => (
                         <div key={item.productId} className="flex justify-between text-sm">
                           <span className="truncate pr-4">{item.yards}x {item.productName}</span>
                           <span className="font-semibold">{formatMoney(item.total)}</span>
                         </div>
                       ))}
                     </div>
                     <div className="mt-4 flex justify-between border-t border-stone-100 pt-4 font-semibold">
                       <span>Total</span>
                       <span>{formatMoney(order.total)}</span>
                     </div>
                   </div>
                 ))}
               </div>
            )}
          </div>
        </aside>
      )}

      <a
        href={getWhatsAppUrl("Hello Hans Signature Fabrics, I am interested in your fabrics.")}
        target="_blank"
        rel="noreferrer"
        className="fixed bottom-5 left-5 z-30 rounded-full bg-[#1f7a3d] px-5 py-3 text-sm font-semibold text-white shadow-lg transition hover:bg-[#176232]"
      >
        WhatsApp Hans
      </a>
    </div>
  );
}