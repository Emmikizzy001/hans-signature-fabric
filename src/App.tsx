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
  minPieces: number;
  image: string;
  images?: string[];
  colors?: string[];
  palette: string;
  description: string;
  tag: string;
};

type Review = {
  id: string;
  product_id: string;
  user_name: string;
  rating: number;
  comment: string;
  created_at: string;
};

type CartItem = {
  productId: string;
  pieces: number;
  colorSelected?: string;
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
  pieces: number;
  price: number;
  total: number;
  image: string;
  color?: string;
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

const ADMIN_PIN = import.meta.env.VITE_ADMIN_PIN || "amaka2026"; // Hardcoded default for testing

const emptyProduct: Product = {
  id: "", name: "", category: "Premium Big Cotton Ankara", price: 0, stock: 0, minPieces: 1,
  image: "", images: [], colors: [], palette: "", description: "", tag: "New arrival",
};

const categories: Category[] = ["All", "Premium Big Cotton Ankara", "Medium print Ankara", "Small Print Ankara", "Lace Fabrics", "Senator Materials", "Crepe Fabrics", "Adire", "Aso-Oke", "Wholesale"];
const productCategories: ProductCategory[] = ["Premium Big Cotton Ankara", "Medium print Ankara", "Small Print Ankara", "Lace Fabrics", "Senator Materials", "Crepe Fabrics", "Adire", "Aso-Oke", "Wholesale"];
const orderStatuses: OrderStatus[] = ["New", "Processing", "Shipped", "Delivered"];

const deliveryOptions: Record<DeliveryOption, { label: string; fee: number; eta: string }> = {
  pickup: { label: "Pickup at Oshodi, Ikorodu", fee: 0, eta: "Same day after confirmation" },
  lagos: { label: "Lagos delivery", fee: 2500, eta: "1 to 2 working days" },
  "outside-lagos": { label: "Delivery outside Lagos", fee: 5000, eta: "2 to 5 working days" },
};

const formatMoney = (amount: number) => {
  if (isNaN(amount) || amount === null) return "₦0";
  return new Intl.NumberFormat("en-NG", { style: "currency", currency: "NGN", maximumFractionDigits: 0 })
    .format(amount).replace("NGN", "₦");
};

const getWhatsAppUrl = (message: string) => `https://wa.me/2349042941371?text=${encodeURIComponent(message)}`;
const createProductId = (name: string) => name.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "") || `fabric-${Date.now()}`;
const getProductImages = (product: Pick<Product, "image" | "images">) => Array.from(new Set([product.image, ...(product.images ?? [])].filter(Boolean)));
const getProductImage = (product: Pick<Product, "image" | "images">) => getProductImages(product)[0] || "/logo.jpg";

const SocialIcon = ({ name }: { name: "whatsapp" | "instagram" | "facebook" | "email" | "phone" | "share" | "heart" | "heart-filled" | "star" }) => {
  const iconClass = "h-4 w-4";
  if (name === "star") return <svg className={iconClass} viewBox="0 0 24 24" fill="currentColor"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>;
  if (name === "heart") return <svg className={iconClass} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z"/></svg>;
  if (name === "heart-filled") return <svg className={iconClass} viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" strokeWidth="2"><path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z"/></svg>;
  if (name === "share") return <svg className={iconClass} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" /></svg>;
  if (name === "whatsapp") return <svg className={iconClass} viewBox="0 0 24 24" fill="currentColor"><path d="M12.04 2a9.86 9.86 0 0 0-8.45 14.94L2.4 21.33l4.5-1.17A9.9 9.9 0 1 0 12.04 2Zm0 1.7a8.2 8.2 0 1 1 0 16.4 8.15 8.15 0 0 1-4.18-1.14l-.31-.18-2.67.7.72-2.6-.2-.33A8.2 8.2 0 0 1 12.04 3.7Zm-3.16 4.37c-.18 0-.46.06-.7.33-.24.26-.92.9-.92 2.2s.94 2.55 1.08 2.73c.13.17 1.85 2.83 4.49 3.97 2.22.96 2.67.77 3.15.72.48-.04 1.55-.63 1.77-1.24.22-.61.22-1.14.15-1.25-.06-.11-.24-.17-.5-.3-.26-.13-1.55-.76-1.79-.85-.24-.09-.41-.13-.58.13-.18.26-.67.85-.82 1.03-.15.17-.3.2-.56.06-.26-.13-1.1-.41-2.1-1.3-.78-.7-1.3-1.55-1.45-1.81-.15-.26-.02-.4.11-.53.12-.12.26-.3.39-.46.13-.15.17-.26.26-.44.09-.17.04-.33-.02-.46-.07-.13-.59-1.42-.8-1.95-.21-.5-.43-.43-.59-.44h-.5Z" /></svg>;
  if (name === "instagram") return <svg className={iconClass} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><rect x="4" y="4" width="16" height="16" rx="5" /><circle cx="12" cy="12" r="3.6" /><circle cx="17" cy="7" r="1" fill="currentColor" stroke="none" /></svg>;
  return <svg className={iconClass} viewBox="0 0 24 24" fill="currentColor"><path d="M14.2 8.15V6.9c0-.6.4-.74.68-.74h1.76V3.14L14.22 3.13c-2.68 0-3.29 2-3.29 3.28v1.74H8.82v3.1h2.11V21h3.27v-9.75h2.2l.3-3.1h-2.5Z" /></svg>;
};

export default function App() {
  const [activeCategory, setActiveCategory] = useState<Category>("All");
  const [products, setProducts] = useState<Product[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [wishlist, setWishlist] = useState<string[]>([]);
  const [heroImage, setHeroImage] = useState("/images/hans-hero.jpg");
  const [isSupabaseConnected, setIsSupabaseConnected] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  
  const [isAuthOpen, setIsAuthOpen] = useState(false);
  const [authMode, setAuthMode] = useState<"login" | "signup">("login");
  const [authFullName, setAuthFullName] = useState("");
  const [authPhone, setAuthPhone] = useState("");
  const [authEmail, setAuthEmail] = useState("");
  const [authPassword, setAuthPassword] = useState("");
  const [authError, setAuthError] = useState("");
  const [authMessage, setAuthMessage] = useState("");
  
  const [cart, setCart] = useState<CartItem[]>([]);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [selectedPieces, setSelectedPieces] = useState<number>(0);
  const [selectedColor, setSelectedColor] = useState<string>("");
  
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [isAdminOpen, setIsAdminOpen] = useState(false);
  const [isAdminUnlocked, setIsAdminUnlocked] = useState(false);
  const [adminPin, setAdminPin] = useState("");
  const [adminError, setAdminError] = useState("");
  const [productForm, setProductForm] = useState<Product>(emptyProduct);
  const [productColorsInput, setProductColorsInput] = useState("");
  const [checkout, setCheckout] = useState<CheckoutDetails>(initialCheckout);
  const [checkoutError, setCheckoutError] = useState("");
  const [orderStatus, setOrderStatus] = useState("");
  const [isPaying, setIsPaying] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isAccountOpen, setIsAccountOpen] = useState(false);
  const [adminClickCount, setAdminClickCount] = useState(0);

  // Load Data from Supabase
  useEffect(() => {
    if (!supabase) return;
    setIsSupabaseConnected(true);

    const loadData = async () => {
      const { data: pData } = await supabase.from('products').select('*');
      if (pData) {
        setProducts(pData.map(row => ({
          id: row.id, name: row.name, category: row.category,
          price: row.price, stock: row.stock, minPieces: row.min_yards,
          image: row.image, images: row.images || [], colors: row.colors || [], palette: row.palette,
          description: row.description, tag: row.tag
        })));
      }

      const { data: oData } = await supabase.from('orders').select('*').order('created_at', { ascending: false });
      if (oData) {
        setOrders(oData.map(row => ({
          id: row.id, reference: row.reference, createdAt: row.created_at,
          customer: row.customer, items: row.items, subtotal: row.subtotal,
          deliveryFee: row.delivery_fee, total: row.total, status: row.status
        })));
      }

      const { data: sData } = await supabase.from('settings').select('*').eq('key', 'heroImage').single();
      if (sData) setHeroImage(sData.value);

      const { data: rData } = await supabase.from('reviews').select('*').order('created_at', { ascending: false });
      if (rData) setReviews(rData);
    };

    loadData();

    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) loadWishlist(session.user.id);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) loadWishlist(session.user.id);
      else setWishlist([]);
    });

    return () => subscription.unsubscribe();
  }, []);

  const loadWishlist = async (userId: string) => {
    if (!supabase) return;
    const { data } = await supabase.from('wishlist').select('product_id').eq('user_id', userId);
    if (data) setWishlist(data.map(d => d.product_id));
  };

  const toggleWishlist = async (productId: string) => {
    if (!user) {
      setIsAuthOpen(true);
      return;
    }
    if (!supabase) return;

    if (wishlist.includes(productId)) {
      setWishlist(w => w.filter(id => id !== productId));
      await supabase.from('wishlist').delete().match({ user_id: user.id, product_id: productId });
    } else {
      setWishlist(w => [...w, productId]);
      await supabase.from('wishlist').insert([{ user_id: user.id, product_id: productId }]);
    }
  };

  const visibleProducts = useMemo(() => {
    if (activeCategory === "All") return products;
    return products.filter((product) => product.category === activeCategory);
  }, [activeCategory, products]);

  const cartLines = useMemo(
    () => cart.map((item) => {
        const product = products.find((entry) => entry.id === item.productId);
        if (!product) return null;
        const p = item.pieces || 0;
        return { ...item, pieces: p, product, lineTotal: p * product.price };
      }).filter(Boolean) as Array<CartItem & { product: Product; lineTotal: number }>,
    [cart, products]
  );

  const subtotal = cartLines.reduce((sum, item) => sum + (item.lineTotal || 0), 0);
  const deliveryFee = deliveryOptions[checkout.delivery].fee;
  const grandTotal = subtotal > 0 ? subtotal + deliveryFee : 0;
  const cartPieces = cart.reduce((sum, item) => sum + (item.pieces || 0), 0);
  const totalRevenue = orders.filter((o) => o.status === "Delivered" || o.status === "Shipped").reduce((sum, o) => sum + o.total, 0);

  const openProduct = (product: Product) => {
    setSelectedProduct(product);
    setSelectedPieces(product.minPieces);
    setSelectedColor(product.colors?.[0] || "");
  };

  const addToCart = (product: Product, pieces: number, color?: string) => {
    if (pieces < product.minPieces) return;
    const safePieces = Math.min(pieces, product.stock);

    setCart((current) => {
      const existing = current.find((item) => item.productId === product.id && item.colorSelected === color);
      if (!existing) return [...current, { productId: product.id, pieces: safePieces, colorSelected: color }];
      return current.map((item) =>
        item.productId === product.id && item.colorSelected === color ? { ...item, pieces: Math.min(item.pieces + safePieces, product.stock) } : item
      );
    });
    setIsCartOpen(true);
  };

  const updateCartPieces = (productId: string, colorSelected: string | undefined, pieces: number) => {
    const product = products.find((item) => item.id === productId);
    if (!product) return;
    if (pieces < 1) {
      setCart((current) => current.filter((item) => !(item.productId === productId && item.colorSelected === colorSelected)));
      return;
    }
    setCart((current) => current.map((item) => 
      (item.productId === productId && item.colorSelected === colorSelected) ? { ...item, pieces: Math.min(pieces, product.stock) } : item
    ));
  };

  const adjustStock = async (productId: string, delta: number) => {
    const product = products.find(p => p.id === productId);
    if (!product || !supabase) return;
    const newStock = Math.max(0, product.stock + delta);
    setProducts(current => current.map(p => p.id === productId ? { ...p, stock: newStock } : p));
    await supabase.from('products').update({ stock: newStock }).eq('id', productId);
  };

  const completeOrder = async (reference: string) => {
    const orderItems: OrderLine[] = cartLines.map((item) => ({
      productId: item.product.id, productName: item.product.name,
      pieces: item.pieces, price: item.product.price,
      total: item.lineTotal, image: getProductImage(item.product),
      color: item.colorSelected
    }));

    const newOrder: Order = {
      id: `order-${Date.now()}`, reference, createdAt: new Date().toISOString(),
      customer: { ...checkout, fullName: user?.user_metadata?.full_name || checkout.fullName, email: user?.email || checkout.email, phone: user?.user_metadata?.phone || checkout.phone },
      items: orderItems, subtotal, deliveryFee, total: grandTotal, status: "New",
    };

    if (supabase) {
      await supabase.from('orders').insert([{
        id: newOrder.id, reference: newOrder.reference, created_at: newOrder.createdAt,
        customer: newOrder.customer, items: newOrder.items, subtotal: newOrder.subtotal,
        delivery_fee: newOrder.deliveryFee, total: newOrder.total, status: newOrder.status
      }]);
      for (const item of cartLines) {
        const p = products.find(p => p.id === item.product.id);
        if (p) await supabase.from('products').update({ stock: Math.max(0, p.stock - item.pieces) }).eq('id', p.id);
      }
    }

    setProducts(current => current.map(p => {
      const orderedItems = cart.filter(item => item.productId === p.id);
      const totalOrdered = orderedItems.reduce((sum, item) => sum + item.pieces, 0);
      return totalOrdered > 0 ? { ...p, stock: Math.max(0, p.stock - totalOrdered) } : p;
    }));
    setOrders(current => [newOrder, ...current]);
    setCart([]);
    setOrderStatus(`Order confirmed. Ref: ${reference}. Hans Signature Fabrics will contact you to confirm delivery.`);
    setCheckoutError("");
    setIsPaying(false);
  };

  const handleCheckout = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!user) {
      setIsCartOpen(false); setAuthMode("signup");
      setAuthMessage("Please log in or sign up to complete your order.");
      setIsAuthOpen(true); return;
    }
    if (!cartLines.length) { setCheckoutError("Your cart is empty."); return; }
    setCheckoutError(""); setOrderStatus(""); setIsPaying(true);
    await completeOrder(`DEMO-${Date.now()}`); // Simulated checkout. Replace with Paystack loading when ready.
  };

  const orderMessage = useMemo(() => {
    const lines = cartLines.map((item) => `${item.product.name} ${item.colorSelected ? `(${item.colorSelected})` : ''} - ${item.pieces} pcs - ${formatMoney(item.lineTotal)}`);
    return ["Hello Hans Signature Fabrics, I want to order:", ...lines, `Delivery: ${deliveryOptions[checkout.delivery].label}`, `Total: ${formatMoney(grandTotal)}`].join("\n");
  }, [cartLines, checkout.delivery, grandTotal]);

  const handleAuth = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!supabase) return setAuthError("Supabase connection missing.");
    setAuthError(""); setAuthMessage("");

    try {
      if (authMode === "signup") {
        const { error, data } = await supabase.auth.signUp({
          email: authEmail, password: authPassword,
          options: { data: { full_name: authFullName, phone: authPhone } }
        });
        if (error) throw error;
        if (data.user?.identities?.length === 0) setAuthError("An account with this email already exists.");
        else {
          setAuthMessage("Success! You are now logged in.");
          setIsAuthOpen(false);
        }
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email: authEmail, password: authPassword });
        if (error) throw error;
        setIsAuthOpen(false);
      }
    } catch (err: any) { setAuthError(err.message || "An error occurred"); }
  };

  const handleSignOut = async () => { 
    if (supabase) await supabase.auth.signOut(); 
    setIsAccountOpen(false);
  };

  const unlockAdmin = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setAdminError("");
    if (adminPin.trim() === ADMIN_PIN && ADMIN_PIN !== "LOCKED") setIsAdminUnlocked(true);
    else setAdminError("Incorrect PIN.");
  };

  // NEW SUPABASE SECURE IMAGE UPLOAD
  const uploadImageToSupabase = async (file: File) => {
    if (!supabase) return null;
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${Date.now()}-${Math.random().toString(36).substring(2)}.${fileExt}`;
      const { error } = await supabase.storage.from('fabric-images').upload(fileName, file);
      if (error) throw error;
      const { data } = supabase.storage.from('fabric-images').getPublicUrl(fileName);
      return data.publicUrl;
    } catch (error) {
      console.error("Upload error:", error);
      alert("Image upload failed. Ensure 'fabric-images' bucket is created and public.");
      return null;
    }
  };

  const handleMultipleImageUpload = async (event: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files ?? []);
    if (!files.length) return;
    setIsUploading(true);
    
    const uploadedUrls: string[] = [];
    for (const file of files) {
      const url = await uploadImageToSupabase(file);
      if (url) uploadedUrls.push(url);
    }
    
    if (uploadedUrls.length > 0) {
      setProductForm((current) => {
        const images = Array.from(new Set([...getProductImages(current), ...uploadedUrls]));
        return { ...current, image: images[0] || current.image, images };
      });
    }
    setIsUploading(false);
  };

  const saveProduct = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!supabase) return setAdminError("Supabase not connected.");
    const cleanName = productForm.name.trim();
    if (!cleanName) return setAdminError("Product name is required.");

    // Convert colors string to array
    const colorsArray = productColorsInput.split(",").map(c => c.trim()).filter(Boolean);

    const dbProduct = {
      id: productForm.id || createProductId(cleanName),
      name: cleanName, category: productForm.category, price: Math.max(0, Number(productForm.price)),
      stock: Math.max(0, Number(productForm.stock)), min_yards: Math.max(1, Number(productForm.minPieces)),
      image: getProductImage(productForm), images: getProductImages(productForm), colors: colorsArray,
      palette: productForm.palette, description: productForm.description, tag: productForm.tag
    };

    const { error } = await supabase.from('products').upsert([dbProduct]);
    if (error) return setAdminError(error.message);

    const savedProduct = { ...productForm, id: dbProduct.id, image: dbProduct.image, images: dbProduct.images, colors: dbProduct.colors };
    setProducts(current => current.some(p => p.id === savedProduct.id) ? current.map(p => p.id === savedProduct.id ? savedProduct : p) : [savedProduct, ...current]);
    setProductForm(emptyProduct); setProductColorsInput(""); setAdminError("");
  };

  const editProduct = (product: Product) => {
    setProductForm(product);
    setProductColorsInput(product.colors?.join(", ") || "");
    setAdminError("");
  };

  const deleteProduct = async (productId: string) => {
    if (!supabase) return;
    await supabase.from('products').delete().eq('id', productId);
    setProducts(current => current.filter(p => p.id !== productId));
  };

  const updateOrderStatus = async (orderId: string, status: OrderStatus) => {
    if (!supabase) return;
    await supabase.from('orders').update({ status }).eq('id', orderId);
    setOrders(current => current.map(o => o.id === orderId ? { ...o, status } : o));
  };

  const submitReview = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!user || !supabase || !selectedProduct) return;
    
    const target = e.target as typeof e.target & { rating: { value: string }, comment: { value: string } };
    const newReview = {
      product_id: selectedProduct.id,
      user_id: user.id,
      user_name: user.user_metadata?.full_name || user.email?.split('@')[0],
      rating: Number(target.rating.value),
      comment: target.comment.value
    };

    const { data, error } = await supabase.from('reviews').insert([newReview]).select().single();
    if (!error && data) {
      setReviews(r => [data, ...r]);
      (e.target as HTMLFormElement).reset();
    }
  };

  const handleShare = async (product: Product) => {
    if (navigator.share) {
      try { await navigator.share({ title: product.name, text: `Check out ${product.name} at Hans Signature Fabrics!`, url: window.location.href }); } catch (err) {}
    } else { alert("Sharing is not supported on this browser."); }
  };

  const userName = user?.user_metadata?.full_name?.split(" ")[0] || "User";
  const productReviews = reviews.filter(r => r.product_id === selectedProduct?.id);

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
              <button onClick={() => setIsAccountOpen(true)} className="text-sm font-semibold text-white/90 hover:text-white">Hi, {userName}</button>
            ) : (
              <button onClick={() => setIsAuthOpen(true)} className="inline-flex items-center justify-center rounded-full border border-white/30 px-4 py-1.5 text-sm font-semibold text-white transition hover:bg-white hover:text-[#0f3d24]">
                Log in
              </button>
            )}
            <button onClick={() => setIsCartOpen(true)} className="relative inline-flex items-center p-1 transition hover:text-[#d4af37]">
              <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z"></path></svg>
              {cartPieces > 0 && <span className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-[#d4af37] text-[10px] font-bold text-stone-950">{cartPieces}</span>}
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
                  <p className="text-sm font-normal text-[#d4af37]">Logged in as {userName}</p>
                  <button onClick={() => { setIsMobileMenuOpen(false); setIsAccountOpen(true); }} className="text-left">My Account</button>
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
              Browse fabrics by style, select your colors, order by pieces, and pay securely.
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
                  <img src={getProductImage(product)} alt={product.name} className="h-full w-full object-cover transition duration-700 group-hover:scale-105" />
                  <div className="absolute left-2 top-2 rounded-full bg-white/95 px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-stone-950 shadow-sm backdrop-blur">
                    {product.tag}
                  </div>
                  <button onClick={(e) => { e.stopPropagation(); toggleWishlist(product.id); }} className="absolute right-2 top-2 rounded-full bg-white/80 p-2 text-stone-600 hover:text-red-500 backdrop-blur">
                    <SocialIcon name={wishlist.includes(product.id) ? "heart-filled" : "heart"} />
                  </button>
                </div>
                <div className="mt-3 space-y-1">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-[#a85c20] sm:text-xs">
                    {product.category}
                  </p>
                  <h3 className="truncate text-xs font-semibold sm:text-sm">{product.name}</h3>
                  <p className="text-xs font-semibold text-stone-600 sm:text-sm">{formatMoney(product.price)} / piece</p>
                </div>
              </article>
            ))}
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
                <article key={product.id} className="group relative flex w-[65vw] shrink-0 snap-start flex-col gap-3 sm:w-[45vw] lg:w-[300px]">
                  <button type="button" onClick={() => openProduct(product)} className="text-left">
                    <div className="relative aspect-[3/4] overflow-hidden rounded-2xl bg-stone-100">
                      <img src={getProductImage(product)} alt={product.name} className="h-full w-full object-cover transition duration-700 group-hover:scale-105" />
                      <div className="absolute left-3 top-3 rounded-full bg-red-600 px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-white shadow-sm">
                        {product.stock <= 10 ? "Almost Gone" : "Trending"}
                      </div>
                    </div>
                  </button>
                  <div className="flex flex-col gap-1">
                    <h3 className="truncate text-sm font-semibold">{product.name}</h3>
                    <p className="text-sm font-semibold text-stone-600">{formatMoney(product.price)} / piece</p>
                    <button
                      type="button"
                      disabled={product.stock < product.minPieces}
                      onClick={(e) => { e.stopPropagation(); openProduct(product); }}
                      className="mt-2 w-full rounded-full bg-stone-950 py-2.5 text-xs font-semibold text-white transition hover:bg-[#0c331d] disabled:bg-stone-300"
                    >
                      {product.stock < product.minPieces ? "Out of Stock" : "Add to Cart"}
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
                Hans Signature Fabrics serves retail and wholesale customers from Oshodi/Ikorodu, Lagos, Nigeria.
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
                <a key={label} href={href} target={href.startsWith("http") ? "_blank" : undefined} rel={href.startsWith("http") ? "noreferrer" : undefined} className="grid gap-2 bg-white p-6 transition hover:bg-[#f8f4ef] sm:grid-cols-[0.4fr_1fr]">
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
                <span className="text-sm font-bold uppercase tracking-[0.2em] text-white">Hans Signature Fabrics</span>
              </a>
              <div className="text-sm text-white/70">
                <p>Premium Prints for Every Occasion.</p>
                <p className="mt-1">Oshodi/Ikorodu, Lagos, Nigeria.</p>
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
                <button 
                  type="button" 
                  onClick={() => {
                    setAdminClickCount(c => c + 1);
                    if (adminClickCount >= 4) { setIsAdminOpen(true); setAdminClickCount(0); }
                  }} 
                  className="text-left transition hover:text-white"
                >
                  Admin Login
                </button>
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
                <a key={label} href={href} target={href.startsWith("http") ? "_blank" : undefined} rel={href.startsWith("http") ? "noreferrer" : undefined} className="inline-flex items-center gap-2 rounded-full border border-white/15 px-4 py-2 text-white/75 transition hover:border-white/40 hover:text-white">
                  <SocialIcon name={icon as "whatsapp" | "instagram" | "facebook" | "email" | "phone" | "share"} />
                  {label}
                </a>
              ))}
            </div>
          </div>
        </div>
      </footer>

      {selectedProduct && (
        <div className="fixed inset-0 z-40 flex items-end bg-stone-950/60 p-0 backdrop-blur-sm sm:items-center sm:p-6 overflow-y-auto">
          <div className="mx-auto my-auto grid max-h-[92vh] w-full max-w-5xl overflow-auto rounded-t-[2rem] bg-white sm:rounded-[2rem] lg:grid-cols-2">
            <div className="min-h-[360px] bg-stone-200">
              <img src={getProductImage(selectedProduct)} alt={selectedProduct.name} className="h-full min-h-[360px] w-full object-cover" />
              {getProductImages(selectedProduct).length > 1 && (
                <div className="grid grid-cols-4 gap-2 bg-white p-3">
                  {getProductImages(selectedProduct).map((image) => (
                    <img key={image} src={image} alt="" className="h-16 w-full rounded-xl object-cover" />
                  ))}
                </div>
              )}
            </div>
            <div className="flex flex-col p-6 sm:p-8">
              <div className="flex items-start justify-between gap-6">
                <div>
                  <p className="text-sm font-semibold uppercase tracking-[0.24em] text-[#a85c20]">{selectedProduct.category}</p>
                  <h3 className="mt-2 text-3xl font-semibold tracking-[-0.04em]">{selectedProduct.name}</h3>
                </div>
                <div className="flex gap-2">
                  <button type="button" onClick={() => toggleWishlist(selectedProduct.id)} className="rounded-full border border-stone-300 p-2 text-sm font-semibold transition hover:border-stone-950" title="Wishlist">
                    <SocialIcon name={wishlist.includes(selectedProduct.id) ? "heart-filled" : "heart"} />
                  </button>
                  <button type="button" onClick={() => handleShare(selectedProduct)} className="rounded-full border border-stone-300 p-2 text-sm font-semibold transition hover:border-stone-950" title="Share product">
                    <SocialIcon name="share" />
                  </button>
                  <button type="button" onClick={() => setSelectedProduct(null)} className="rounded-full border border-stone-300 px-4 py-2 text-sm font-semibold transition hover:border-stone-950">
                    Close
                  </button>
                </div>
              </div>

              <p className="mt-4 text-stone-600">{selectedProduct.description}</p>
              
              <div className="mt-6 grid gap-px overflow-hidden rounded-2xl bg-stone-200">
                <div className="grid grid-cols-2 bg-white px-4 py-3"><span className="text-stone-500">Price</span><span className="text-right font-semibold">{formatMoney(selectedProduct.price)} / pc</span></div>
                <div className="grid grid-cols-2 bg-white px-4 py-3"><span className="text-stone-500">Stock</span><span className="text-right font-semibold">{selectedProduct.stock} pieces</span></div>
              </div>

              {selectedProduct.colors && selectedProduct.colors.length > 0 && (
                <div className="mt-6">
                  <label className="text-sm font-semibold text-stone-700">Available Colors</label>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {selectedProduct.colors.map(color => (
                      <button key={color} onClick={() => setSelectedColor(color)} className={`rounded-full px-4 py-2 text-sm font-semibold border ${selectedColor === color ? 'bg-stone-950 text-white border-stone-950' : 'bg-white text-stone-700 border-stone-300 hover:border-stone-950'}`}>
                        {color}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <div className="mt-6">
                <label className="text-sm font-semibold text-stone-700" htmlFor="pieces">Order Quantity (Pieces)</label>
                <div className="mt-2 flex items-center gap-3">
                  <button type="button" onClick={() => setSelectedPieces((p) => Math.max(0, (p as number) - 1))} className="h-11 w-11 rounded-full border border-stone-300 font-semibold transition hover:border-stone-950">-</button>
                  <input id="pieces" type="number" min={0} max={selectedProduct.stock} value={selectedPieces} onChange={(e) => setSelectedPieces(e.target.value === "" ? "" : Number(e.target.value))} className="h-11 w-24 rounded-full border border-stone-300 text-center font-semibold outline-none focus:border-stone-950" />
                  <button type="button" onClick={() => setSelectedPieces((p) => Math.min(selectedProduct.stock, (p as number) + 1))} className="h-11 w-11 rounded-full border border-stone-300 font-semibold transition hover:border-stone-950">+</button>
                </div>
                <p className="mt-2 text-xs font-semibold text-stone-500">Minimum Order: {selectedProduct.minPieces} piece(s)</p>
              </div>

              <div className="mt-6 flex flex-col gap-3 sm:flex-row">
                <button type="button" onClick={() => { addToCart(selectedProduct, selectedPieces as number, selectedColor); setSelectedProduct(null); }} className="rounded-full bg-stone-950 px-6 py-3 text-sm font-semibold text-white transition hover:bg-[#a85c20]">
                  Add to cart - {formatMoney(selectedProduct.price * (selectedPieces as number))}
                </button>
                <a href={getWhatsAppUrl(`Hello Hans Signature Fabrics, I want ${selectedPieces} pieces of ${selectedProduct.name} ${selectedColor ? `in ${selectedColor}` : ''}.`)} target="_blank" rel="noreferrer" className="rounded-full border border-stone-300 px-6 py-3 text-center text-sm font-semibold transition hover:border-stone-950">
                  Ask on WhatsApp
                </a>
              </div>

              {/* Reviews Section */}
              <div className="mt-10 border-t border-stone-200 pt-6">
                <h4 className="text-xl font-semibold">Customer Reviews</h4>
                <div className="mt-4 space-y-4 max-h-48 overflow-y-auto pr-2">
                  {productReviews.length === 0 ? (
                    <p className="text-sm text-stone-500">No reviews yet. Be the first to review!</p>
                  ) : (
                    productReviews.map(r => (
                      <div key={r.id} className="rounded-xl bg-stone-50 p-4">
                        <div className="flex items-center justify-between">
                          <span className="font-semibold text-sm">{r.user_name}</span>
                          <span className="flex text-[#d4af37]">{Array(r.rating).fill(<SocialIcon name="star" />)}</span>
                        </div>
                        <p className="mt-2 text-sm text-stone-700">{r.comment}</p>
                      </div>
                    ))
                  )}
                </div>
                {user && (
                  <form onSubmit={submitReview} className="mt-4 flex flex-col gap-3 bg-stone-50 p-4 rounded-xl border border-stone-200">
                    <p className="text-sm font-semibold">Write a review</p>
                    <select name="rating" className="rounded-lg border border-stone-300 p-2 text-sm outline-none" required>
                      <option value="5">5 Stars - Excellent</option>
                      <option value="4">4 Stars - Very Good</option>
                      <option value="3">3 Stars - Good</option>
                      <option value="2">2 Stars - Fair</option>
                      <option value="1">1 Star - Poor</option>
                    </select>
                    <textarea name="comment" className="rounded-lg border border-stone-300 p-2 text-sm outline-none min-h-[60px]" placeholder="Share your thoughts about this fabric..." required></textarea>
                    <button type="submit" className="rounded-full bg-stone-950 py-2 text-sm font-semibold text-white">Post Review</button>
                  </form>
                )}
              </div>

            </div>
          </div>
        </div>
      )}

      {/* Cart Aside */}
      <aside className={`fixed inset-y-0 right-0 z-[60] flex w-full max-w-xl transform flex-col bg-white shadow-2xl transition duration-300 ${isCartOpen ? "translate-x-0" : "translate-x-full"}`} aria-hidden={!isCartOpen}>
        <div className="flex items-center justify-between border-b border-stone-200 p-5 sm:p-6">
          <div><p className="text-sm font-semibold uppercase tracking-[0.24em] text-[#a85c20]">Order</p><h2 className="text-3xl font-semibold tracking-[-0.04em]">Cart and checkout</h2></div>
          <button type="button" onClick={() => setIsCartOpen(false)} className="rounded-full border border-stone-300 px-4 py-2 text-sm font-semibold transition hover:border-stone-950">Close</button>
        </div>
        <div className="flex-1 overflow-auto p-5 sm:p-6">
          {cartLines.length === 0 ? (
            <div className="flex h-full flex-col items-center justify-center text-center">
              <p className="text-2xl font-semibold tracking-[-0.03em]">Your cart is empty.</p>
              <p className="mt-3 max-w-sm text-stone-600">Add a fabric collection to start an order.</p>
              <button type="button" onClick={() => setIsCartOpen(false)} className="mt-6 rounded-full bg-stone-950 px-6 py-3 text-sm font-semibold text-white transition hover:bg-[#a85c20]">Continue shopping</button>
            </div>
          ) : (
            <div className="space-y-8">
              <div className="space-y-4">
                {cartLines.map((item) => (
                  <div key={`${item.productId}-${item.colorSelected}`} className="flex gap-4 rounded-3xl border border-stone-200 p-3">
                    <img src={getProductImage(item.product)} alt="" className="h-24 w-24 rounded-2xl object-cover" />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-4">
                        <div>
                          <p className="font-semibold leading-tight">{item.product.name} {item.colorSelected && <span className="text-[#a85c20]">({item.colorSelected})</span>}</p>
                          <p className="text-sm text-stone-500">{formatMoney(item.product.price)} per piece</p>
                        </div>
                        <button type="button" onClick={() => setCart((c) => c.filter((l) => !(l.productId === item.productId && l.colorSelected === item.colorSelected)))} className="text-sm font-semibold text-stone-500 transition hover:text-red-700">Remove</button>
                      </div>
                      <div className="mt-4 flex items-center justify-between gap-4">
                        <div className="flex items-center gap-2">
                          <button type="button" onClick={() => updateCartPieces(item.productId, item.colorSelected, item.pieces - 1)} className="h-8 w-8 rounded-full border border-stone-300 font-semibold">-</button>
                          <span className="w-16 text-center text-sm font-semibold">{item.pieces} pc</span>
                          <button type="button" onClick={() => updateCartPieces(item.productId, item.colorSelected, item.pieces + 1)} className="h-8 w-8 rounded-full border border-stone-300 font-semibold">+</button>
                        </div>
                        <p className="font-semibold">{formatMoney(item.lineTotal)}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              <form onSubmit={handleCheckout} className="space-y-5">
                <div><h3 className="text-2xl font-semibold tracking-[-0.03em]">Delivery details</h3><p className="mt-2 text-sm leading-6 text-stone-600">Customers enter their delivery address and contact details before payment.</p></div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <label className="block text-sm font-semibold text-stone-700">Full name<input value={checkout.fullName} onChange={(e) => setCheckout({ ...checkout, fullName: e.target.value })} className="mt-2 w-full rounded-2xl border border-stone-300 px-4 py-3 font-normal outline-none focus:border-stone-950" placeholder="Customer name" /></label>
                  <label className="block text-sm font-semibold text-stone-700">Phone<input value={checkout.phone} onChange={(e) => setCheckout({ ...checkout, phone: e.target.value })} className="mt-2 w-full rounded-2xl border border-stone-300 px-4 py-3 font-normal outline-none focus:border-stone-950" placeholder="080..." /></label>
                  <label className="block text-sm font-semibold text-stone-700 sm:col-span-2">Email for Paystack receipt<input type="email" value={checkout.email} onChange={(e) => setCheckout({ ...checkout, email: e.target.value })} className="mt-2 w-full rounded-2xl border border-stone-300 px-4 py-3 font-normal outline-none focus:border-stone-950" placeholder="customer@email.com" /></label>
                  <label className="block text-sm font-semibold text-stone-700 sm:col-span-2">Delivery address<textarea value={checkout.address} onChange={(e) => setCheckout({ ...checkout, address: e.target.value })} className="mt-2 min-h-24 w-full rounded-2xl border border-stone-300 px-4 py-3 font-normal outline-none focus:border-stone-950" placeholder="Street, bus stop, house number" /></label>
                  <label className="block text-sm font-semibold text-stone-700">City<input value={checkout.city} onChange={(e) => setCheckout({ ...checkout, city: e.target.value })} className="mt-2 w-full rounded-2xl border border-stone-300 px-4 py-3 font-normal outline-none focus:border-stone-950" /></label>
                  <label className="block text-sm font-semibold text-stone-700">State<input value={checkout.state} onChange={(e) => setCheckout({ ...checkout, state: e.target.value })} className="mt-2 w-full rounded-2xl border border-stone-300 px-4 py-3 font-normal outline-none focus:border-stone-950" /></label>
                </div>
                <div className="space-y-3"><p className="text-sm font-semibold text-stone-700">Delivery option</p>
                  {(Object.keys(deliveryOptions) as DeliveryOption[]).map((option) => (
                    <label key={option} className={`flex cursor-pointer items-start justify-between gap-4 rounded-3xl border p-4 transition ${checkout.delivery === option ? "border-stone-950 bg-[#f8f4ef]" : "border-stone-200"}`}>
                      <span><span className="block font-semibold">{deliveryOptions[option].label}</span><span className="mt-1 block text-sm text-stone-500">{deliveryOptions[option].eta}</span></span>
                      <span className="font-semibold">{formatMoney(deliveryOptions[option].fee)}</span>
                      <input type="radio" name="delivery" checked={checkout.delivery === option} onChange={() => setCheckout({ ...checkout, delivery: option })} className="sr-only" />
                    </label>
                  ))}
                </div>
                <label className="block text-sm font-semibold text-stone-700">Order note<textarea value={checkout.note} onChange={(e) => setCheckout({ ...checkout, note: e.target.value })} className="mt-2 min-h-20 w-full rounded-2xl border border-stone-300 px-4 py-3 font-normal outline-none focus:border-stone-950" placeholder="Example: Call before delivery, preferred color, wholesale request" /></label>
                <div className="space-y-3 rounded-3xl bg-stone-950 p-5 text-white">
                  <div className="flex justify-between text-sm text-white/70"><span>Subtotal</span><span>{formatMoney(subtotal)}</span></div>
                  <div className="flex justify-between text-sm text-white/70"><span>Delivery</span><span>{formatMoney(deliveryFee)}</span></div>
                  <div className="flex justify-between border-t border-white/15 pt-3 text-xl font-semibold"><span>Total</span><span>{formatMoney(grandTotal)}</span></div>
                </div>
                {checkoutError && <p className="rounded-2xl bg-red-50 p-4 text-sm font-semibold text-red-700">{checkoutError}</p>}
                {orderStatus && <p className="rounded-2xl bg-emerald-50 p-4 text-sm font-semibold text-emerald-700">{orderStatus}</p>}
                <div className="grid gap-3 sm:grid-cols-2">
                  <button type="submit" disabled={isPaying} className="rounded-full bg-stone-950 px-6 py-3 text-sm font-semibold text-white transition hover:bg-[#a85c20] disabled:cursor-wait disabled:bg-stone-400">
                    {isPaying ? "Opening Paystack..." : "Pay with Paystack"}
                  </button>
                  <a href={getWhatsAppUrl(orderMessage)} target="_blank" rel="noreferrer" className="rounded-full border border-stone-300 px-6 py-3 text-center text-sm font-semibold transition hover:border-stone-950">
                    Send order on WhatsApp
                  </a>
                </div>
              </form>
            </div>
          )}
        </div>
      </aside>

      {/* Auth Panel */}
      {isAuthOpen && !user && (
        <aside className="fixed inset-y-0 right-0 z-[80] flex w-full max-w-md transform flex-col bg-white shadow-2xl transition duration-300 translate-x-0 overflow-y-auto">
          <div className="flex items-center justify-between p-6 sm:p-8">
            <div><p className="text-xs font-bold uppercase tracking-[0.2em] text-[#d4af37]">Customer Account</p><h2 className="mt-2 text-3xl font-semibold tracking-[-0.04em]">{authMode === "login" ? "Login" : "Create account"}</h2></div>
            <button type="button" onClick={() => setIsAuthOpen(false)} className="rounded-full border border-stone-200 px-4 py-2 text-sm font-semibold transition hover:border-stone-950">Close</button>
          </div>
          <div className="flex-1 px-6 sm:px-8 pb-8">
            <form onSubmit={handleAuth} className="space-y-5">
              {authMode === "signup" && (
                <><label className="block text-sm font-semibold text-stone-700">Full name<input type="text" value={authFullName} onChange={(e) => setAuthFullName(e.target.value)} className="mt-2 w-full rounded-2xl border border-stone-200 px-4 py-3 font-normal outline-none focus:border-stone-950" placeholder="Your full name" required /></label><label className="block text-sm font-semibold text-stone-700">Phone<input type="tel" value={authPhone} onChange={(e) => setAuthPhone(e.target.value)} className="mt-2 w-full rounded-2xl border border-stone-200 px-4 py-3 font-normal outline-none focus:border-stone-950" placeholder="080..." required /></label></>
              )}
              <label className="block text-sm font-semibold text-stone-700">Email<input type="email" value={authEmail} onChange={(e) => setAuthEmail(e.target.value)} className="mt-2 w-full rounded-2xl border border-stone-200 px-4 py-3 font-normal outline-none focus:border-stone-950" placeholder="you@email.com" required /></label>
              <label className="block text-sm font-semibold text-stone-700">Password<input type="password" value={authPassword} onChange={(e) => setAuthPassword(e.target.value)} className="mt-2 w-full rounded-2xl border border-stone-200 px-4 py-3 font-normal outline-none focus:border-stone-950" placeholder="At least 6 characters" required minLength={6} /></label>
              {authError && <p className="rounded-2xl bg-red-50 p-4 text-sm font-semibold text-red-700">{authError}</p>}
              {authMessage && <p className="rounded-2xl bg-emerald-50 p-4 text-sm font-semibold text-emerald-700">{authMessage}</p>}
              <button type="submit" className="mt-6 w-full rounded-full bg-stone-950 px-6 py-4 text-sm font-semibold text-white transition hover:bg-[#0c331d]">{authMode === "login" ? "Login" : "Create account"}</button>
              <button type="button" onClick={() => { setAuthMode(authMode === "login" ? "signup" : "login"); setAuthError(""); setAuthMessage(""); }} className="w-full rounded-full border border-stone-200 px-6 py-4 text-sm font-semibold text-stone-950 transition hover:border-stone-950">{authMode === "login" ? "Create account" : "Already have an account? Login"}</button>
            </form>
          </div>
        </aside>
      )}
      {isAuthOpen && !user && <button type="button" aria-label="Close auth overlay" onClick={() => setIsAuthOpen(false)} className="fixed inset-0 z-[70] bg-stone-950/30 backdrop-blur-[2px]" />}

      {/* Customer Account Panel */}
      {isAccountOpen && (
        <aside className="fixed inset-y-0 right-0 z-[80] flex w-full max-w-md transform flex-col overflow-y-auto bg-white shadow-2xl transition duration-300">
          <div className="flex items-center justify-between border-b border-stone-100 p-6 sm:p-8">
            <div><p className="text-xs font-bold uppercase tracking-[0.2em] text-[#d4af37]">Customer Account</p><h2 className="mt-2 text-3xl font-semibold tracking-[-0.04em]">My Account</h2></div>
            <button onClick={() => setIsAccountOpen(false)} className="rounded-full border border-stone-200 px-4 py-2 text-sm font-semibold transition hover:border-stone-950">Close</button>
          </div>
          <div className="flex flex-col gap-8 p-6 sm:p-8">
            <div>
              <h3 className="text-xl font-semibold">My Wishlist</h3>
              {wishlist.length === 0 ? <p className="mt-2 text-stone-500">Your wishlist is empty.</p> : (
                <div className="mt-4 grid gap-4 grid-cols-2">
                  {wishlist.map(id => {
                    const p = products.find(prod => prod.id === id);
                    if(!p) return null;
                    return (
                      <div key={id} className="relative rounded-xl border border-stone-200 p-2 cursor-pointer" onClick={() => {setIsAccountOpen(false); openProduct(p);}}>
                        <img src={getProductImage(p)} alt="" className="aspect-[3/4] w-full rounded-lg object-cover" />
                        <p className="mt-2 truncate text-xs font-semibold">{p.name}</p>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
            <div className="border-t border-stone-200 pt-8">
              <h3 className="text-xl font-semibold">My Orders</h3>
              {orders.filter(o => o.customer.email === user?.email).length === 0 ? <p className="mt-2 text-stone-500">You haven't placed any orders yet.</p> : (
                 <div className="mt-4 space-y-6">
                   {orders.filter(o => o.customer.email === user?.email).map(order => (
                     <div key={order.id} className="rounded-2xl border border-stone-200 p-4">
                       <div className="mb-4 flex items-start justify-between"><div><p className="text-xs text-stone-500">Ref: {order.reference}</p><p className="font-semibold">{new Date(order.createdAt).toLocaleDateString()}</p></div><span className={`rounded-full px-2 py-1 text-[10px] font-bold uppercase ${order.status === 'Delivered' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>{order.status}</span></div>
                       <div className="space-y-2">{order.items.map(item => (<div key={`${item.productId}-${item.color}`} className="flex justify-between text-sm"><span className="truncate pr-4">{item.pieces}x {item.productName} {item.color && `(${item.color})`}</span><span className="font-semibold">{formatMoney(item.total)}</span></div>))}</div>
                     </div>
                   ))}
                 </div>
              )}
            </div>
          </div>
        </aside>
      )}

      {/* Admin Panel */}
      {isAdminOpen && (
        <div className="fixed inset-0 z-[70] overflow-auto bg-stone-950/70 p-3 backdrop-blur-sm sm:p-6">
          <div className="mx-auto min-h-[92vh] max-w-7xl rounded-[2rem] bg-[#f8f4ef] shadow-2xl">
            <div className="sticky top-0 z-10 flex items-center justify-between border-b border-stone-200 bg-[#f8f4ef]/95 p-5 backdrop-blur sm:p-6">
              <div><p className="text-sm font-semibold uppercase tracking-[0.24em] text-[#a85c20]">Owner dashboard</p><h2 className="text-3xl font-semibold tracking-[-0.04em]">Hans admin</h2></div>
              <button type="button" onClick={() => setIsAdminOpen(false)} className="rounded-full border border-stone-300 px-4 py-2 text-sm font-semibold transition hover:border-stone-950">Close</button>
            </div>
            {!isAdminUnlocked ? (
              <div className="mx-auto flex max-w-md flex-col justify-center p-6 py-16 sm:p-10">
                <h3 className="text-4xl font-semibold tracking-[-0.04em]">Admin login</h3>
                <form onSubmit={unlockAdmin} className="mt-8 space-y-4"><input type="password" value={adminPin} onChange={(e) => setAdminPin(e.target.value)} className="w-full rounded-2xl border border-stone-300 px-4 py-3 outline-none focus:border-stone-950" placeholder="Enter PIN" />{adminError && <p className="rounded-2xl bg-red-50 p-4 text-sm font-semibold text-red-700">{adminError}</p>}<button type="submit" className="w-full rounded-full bg-stone-950 px-6 py-3 text-sm font-semibold text-white transition hover:bg-[#a85c20]">Unlock dashboard</button></form>
              </div>
            ) : (
              <div className="space-y-8 p-5 sm:p-6 lg:p-8">
                <div className="grid gap-4 md:grid-cols-4">
                  {[["Products", products.length.toString()], ["Low stock", lowStockCount.toString()], ["Orders", orders.length.toString()], ["Confirmed Revenue", formatMoney(totalRevenue)]].map(([label, value]) => (<div key={label} className="rounded-[1.5rem] bg-white p-5 shadow-sm"><p className="text-sm font-semibold text-stone-500">{label}</p><p className="mt-2 text-3xl font-semibold tracking-[-0.04em]">{value}</p></div>))}
                </div>
                <section className="grid gap-6 lg:grid-cols-[0.85fr_1.15fr]">
                  <form onSubmit={saveProduct} className="rounded-[2rem] bg-white p-5 shadow-sm sm:p-6">
                    <div className="flex items-start justify-between gap-4"><div><p className="text-sm font-semibold uppercase tracking-[0.22em] text-[#a85c20]">Products</p><h3 className="mt-2 text-3xl font-semibold tracking-[-0.04em]">{productForm.id ? "Edit product" : "Add product"}</h3></div>{productForm.id && (<button type="button" onClick={() => {setProductForm(emptyProduct); setProductColorsInput("");}} className="rounded-full border border-stone-300 px-4 py-2 text-sm font-semibold transition hover:border-stone-950">New</button>)}</div>
                    <div className="mt-6 grid gap-4">
                      <div className="text-sm font-semibold text-stone-700">Product photos<div className="mt-2 rounded-3xl border border-stone-200 p-3"><div className="grid grid-cols-3 gap-3 sm:grid-cols-4">{getProductImages(productForm).map((image) => (<div key={image} className="relative overflow-hidden rounded-2xl border border-stone-200 bg-stone-100"><img src={image} alt="" className="h-24 w-full object-cover" /><div className="flex gap-1 p-2"><button type="button" onClick={() => setMainProductImage(image)} className={`flex-1 rounded-full px-2 py-1 text-[11px] font-semibold ${getProductImage(productForm) === image ? "bg-stone-950 text-white" : "bg-white text-stone-700"}`}>Main</button><button type="button" onClick={() => removeProductImage(image)} className="rounded-full bg-red-50 px-2 py-1 text-[11px] font-semibold text-red-700">Remove</button></div></div>))}</div><input type="file" accept="image/*" multiple onChange={handleMultipleImageUpload} className="mt-4 w-full text-sm text-stone-600 file:mr-4 file:rounded-full file:border-0 file:bg-stone-950 file:px-4 file:py-2 file:text-sm file:font-semibold file:text-white" disabled={isUploading} /><p className="mt-2 text-xs font-normal leading-5 text-stone-500">{isUploading ? "Uploading to secure cloud..." : "Upload unlimited photos directly to Supabase cloud."}</p></div></div>
                      <label className="text-sm font-semibold text-stone-700">Name<input value={productForm.name} onChange={(e) => setProductForm({ ...productForm, name: e.target.value })} className="mt-2 w-full rounded-2xl border border-stone-300 px-4 py-3 font-normal outline-none focus:border-stone-950" placeholder="Fabric name" /></label>
                      <div className="grid gap-4 sm:grid-cols-2">
                        <label className="text-sm font-semibold text-stone-700">Category<select value={productForm.category} onChange={(e) => setProductForm({ ...productForm, category: e.target.value as ProductCategory })} className="mt-2 w-full rounded-2xl border border-stone-300 bg-white px-4 py-3 font-normal outline-none focus:border-stone-950">{productCategories.map((c) => (<option key={c} value={c}>{c}</option>))}</select></label>
                        <label className="text-sm font-semibold text-stone-700">Available Colors<input value={productColorsInput} onChange={(e) => setProductColorsInput(e.target.value)} className="mt-2 w-full rounded-2xl border border-stone-300 px-4 py-3 font-normal outline-none focus:border-stone-950" placeholder="Red, Blue, Gold (comma separated)" /></label>
                        <label className="text-sm font-semibold text-stone-700">Price per piece<input type="number" value={productForm.price || ""} onChange={(e) => setProductForm({ ...productForm, price: Number(e.target.value) })} className="mt-2 w-full rounded-2xl border border-stone-300 px-4 py-3 font-normal outline-none focus:border-stone-950" /></label>
                        <label className="text-sm font-semibold text-stone-700">Stock (Pieces)<input type="number" value={productForm.stock || ""} onChange={(e) => setProductForm({ ...productForm, stock: Number(e.target.value) })} className="mt-2 w-full rounded-2xl border border-stone-300 px-4 py-3 font-normal outline-none focus:border-stone-950" /></label>
                        <label className="text-sm font-semibold text-stone-700">Min Order (Pieces)<input type="number" value={productForm.minPieces || ""} onChange={(e) => setProductForm({ ...productForm, minPieces: Number(e.target.value) })} className="mt-2 w-full rounded-2xl border border-stone-300 px-4 py-3 font-normal outline-none focus:border-stone-950" /></label>
                        <label className="text-sm font-semibold text-stone-700">Tag<input value={productForm.tag} onChange={(e) => setProductForm({ ...productForm, tag: e.target.value })} className="mt-2 w-full rounded-2xl border border-stone-300 px-4 py-3 font-normal outline-none focus:border-stone-950" placeholder="New arrival" /></label>
                      </div>
                      <label className="text-sm font-semibold text-stone-700">Description<textarea value={productForm.description} onChange={(e) => setProductForm({ ...productForm, description: e.target.value })} className="mt-2 min-h-24 w-full rounded-2xl border border-stone-300 px-4 py-3 font-normal outline-none focus:border-stone-950" placeholder="Fabric description..." /></label>
                    </div>
                    {adminError && <p className="mt-4 rounded-2xl bg-red-50 p-4 text-sm font-semibold text-red-700">{adminError}</p>}
                    <button type="submit" disabled={isUploading} className="mt-6 w-full rounded-full bg-stone-950 px-6 py-3 text-sm font-semibold text-white transition hover:bg-[#a85c20] disabled:bg-stone-400">Save product</button>
                  </form>
                  <div className="rounded-[2rem] bg-white p-5 shadow-sm sm:p-6">
                    <div className="flex items-start justify-between gap-4"><div><p className="text-sm font-semibold uppercase tracking-[0.22em] text-[#a85c20]">Inventory list</p><h3 className="mt-2 text-3xl font-semibold tracking-[-0.04em]">Manage stock</h3></div></div>
                    <div className="mt-6 space-y-3">
                      {products.map((product) => (
                        <div key={product.id} className="grid gap-4 rounded-3xl border border-stone-200 p-4 md:grid-cols-[1fr_auto] md:items-center">
                          <div className="flex gap-4"><img src={getProductImage(product)} alt="" className="h-20 w-20 rounded-2xl object-cover" /><div><p className="font-semibold">{product.name}</p><p className="text-sm text-stone-500">{product.category} / {formatMoney(product.price)} per piece</p><p className={product.stock <= 10 ? "mt-1 text-sm font-semibold text-red-700" : "mt-1 text-sm font-semibold text-emerald-700"}>{product.stock} pieces left</p></div></div>
                          <div className="flex flex-wrap gap-2 md:justify-end"><button type="button" onClick={() => adjustStock(product.id, -1)} className="rounded-full border border-stone-300 px-4 py-2 text-sm font-semibold transition hover:border-stone-950">-1</button><button type="button" onClick={() => adjustStock(product.id, 1)} className="rounded-full border border-stone-300 px-4 py-2 text-sm font-semibold transition hover:border-stone-950">+1</button><button type="button" onClick={() => editProduct(product)} className="rounded-full bg-stone-950 px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#a85c20]">Edit</button><button type="button" onClick={() => deleteProduct(product.id)} className="rounded-full bg-red-50 px-4 py-2 text-sm font-semibold text-red-700 transition hover:bg-red-100">Delete</button></div>
                        </div>
                      ))}
                    </div>
                  </div>
                </section>

                <section className="grid gap-6 lg:grid-cols-[0.8fr_1.2fr]">
                  <div className="rounded-[2rem] bg-white p-5 shadow-sm sm:p-6"><p className="text-sm font-semibold uppercase tracking-[0.22em] text-[#a85c20]">Images</p><h3 className="mt-2 text-3xl font-semibold tracking-[-0.04em]">Homepage Banner</h3>
                    <div className="mt-6 space-y-4"><label className="block text-sm font-semibold text-stone-700">Upload new banner<div className="mt-2 flex items-center gap-4"><img src={heroImage} alt="" className="h-24 w-24 rounded-2xl object-cover" /><input type="file" accept="image/*" onChange={async (e) => { const f = e.target.files?.[0]; if(f){ const url = await uploadImageToSupabase(f); if(url) saveHeroImage(url); } }} className="w-full text-sm text-stone-600 file:mr-4 file:rounded-full file:border-0 file:bg-stone-950 file:px-4 file:py-2 file:text-sm file:font-semibold file:text-white" /></div></label></div>
                  </div>
                  <div className="rounded-[2rem] bg-white p-5 shadow-sm sm:p-6"><p className="text-sm font-semibold uppercase tracking-[0.22em] text-[#a85c20]">Orders</p><h3 className="mt-2 text-3xl font-semibold tracking-[-0.04em]">Customer orders</h3>
                    <div className="mt-6 space-y-4">
                      {orders.map((order) => (
                        <div key={order.id} className="rounded-3xl border border-stone-200 p-4"><div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between"><div><p className="font-semibold">{order.customer.fullName}</p><p className="text-sm text-stone-500">{order.customer.phone} / {order.customer.email}</p><p className="mt-1 text-sm text-stone-500">Ref: {order.reference}</p></div><select value={order.status} onChange={(e) => updateOrderStatus(order.id, e.target.value as OrderStatus)} className="rounded-full border border-stone-300 bg-white px-4 py-2 text-sm font-semibold outline-none focus:border-stone-950">{orderStatuses.map(s => (<option key={s} value={s}>{s}</option>))}</select></div><div className="mt-4 space-y-2">{order.items.map((item) => (<div key={`${order.id}-${item.productId}`} className="flex justify-between gap-4 text-sm"><span>{item.productName} {item.color ? `(${item.color})` : ''} x {item.pieces} pc</span><span className="font-semibold">{formatMoney(item.total)}</span></div>))}</div><div className="mt-4 border-t border-stone-200 pt-4 text-sm text-stone-600"><p>{order.customer.address}, {order.customer.city}, {order.customer.state}</p><p>{deliveryOptions[order.customer.delivery].label}</p>{order.customer.note && <p>Note: {order.customer.note}</p>}<p className="mt-2 text-lg font-semibold text-stone-950">{formatMoney(order.total)}</p></div></div>
                      ))}
                    </div>
                  </div>
                </section>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}