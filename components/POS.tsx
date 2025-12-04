import React, { useState, useRef } from 'react';
import { Search, Plus, Minus, Trash2, Printer, CheckCircle, ScanBarcode } from 'lucide-react';
import { Product, CartItem, User, Shop } from '../types';
import { Card, Button } from './ui/LayoutComponents';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';

interface POSProps {
  products: Product[];
  user: User;
  shop: Shop;
  onCompleteSale: (items: CartItem[], total: number) => Promise<void>;
}

const POS: React.FC<POSProps> = ({ products, user, shop, onCompleteSale }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [cart, setCart] = useState<CartItem[]>([]);
  const [isSuccess, setIsSuccess] = useState(false);
  const [loading, setLoading] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);

  const currency = shop.currency || '$';

  // Filter products that have stock (Standard Search)
  const availableProducts = products.filter(p => 
    p.stock > 0 && 
    (p.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
     p.sku?.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  const addToCart = (product: Product) => {
    const existing = cart.find(item => item.id === product.id);
    if (existing) {
      if (existing.quantity < product.stock) {
        setCart(cart.map(item => item.id === product.id ? { ...item, quantity: item.quantity + 1 } : item));
      } else {
        alert('Not enough stock!');
      }
    } else {
      setCart([...cart, { ...product, quantity: 1 }]);
    }
  };

  const updateQuantity = (id: string, delta: number) => {
    setCart(cart.map(item => {
      if (item.id === id) {
        const product = products.find(p => p.id === id);
        if (!product) return item;
        
        const newQty = item.quantity + delta;
        if (newQty > product.stock) return item; // limit to stock
        if (newQty < 1) return item;
        return { ...item, quantity: newQty };
      }
      return item;
    }));
  };

  const removeFromCart = (id: string) => {
    setCart(cart.filter(item => item.id !== id));
  };

  // Handle Scan Logic (Enter key usually sent by scanner)
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && searchTerm.trim()) {
      // 1. Try to find Exact SKU Match first (Barcode Scan)
      const exactMatch = products.find(p => p.sku === searchTerm.trim() || p.sku === searchTerm);
      
      if (exactMatch && exactMatch.stock > 0) {
        addToCart(exactMatch);
        setSearchTerm(''); // Clear for next scan
        // Keep focus
        e.preventDefault(); 
        return;
      }

      // 2. If no exact SKU match, check if there is exactly one search result in list
      // This is helpful if someone types part of a name and hits enter
      if (availableProducts.length === 1) {
        addToCart(availableProducts[0]);
        setSearchTerm('');
        e.preventDefault();
        return;
      }
    }
  };

  const cartTotal = cart.reduce((acc, item) => acc + (item.price * item.quantity), 0);

  const generatePDF = async (items: CartItem[], total: number, invoiceId: string) => {
    const doc = new jsPDF();
    
    const loadImage = (url: string): Promise<HTMLImageElement> => {
      return new Promise((resolve, reject) => {
        const img = new Image();
        img.crossOrigin = 'Anonymous';
        img.src = url;
        img.onload = () => resolve(img);
        img.onerror = (e) => reject(e);
      });
    };

    let headerTextX = 14;
    
    // Attempt to add logo
    if (shop.logoUrl) {
      try {
        const img = await loadImage(shop.logoUrl);
        // Add logo at x:14, y:10 with size 25x25
        doc.addImage(img, 'PNG', 14, 10, 25, 25); 
        headerTextX = 45; // Shift text right to avoid overlap with logo
      } catch (e) {
        console.warn('Logo load failed or CORS issue, skipping logo.', e);
        // Keep headerTextX at 14
      }
    }

    // Shop Name & Address Header
    // Aligned either to left (14) or to right of logo (45)
    doc.setFontSize(18);
    doc.setTextColor(40);
    doc.text(shop.name, headerTextX, 20); 

    doc.setFontSize(10);
    doc.setTextColor(100);
    if (shop.address) {
      doc.text(shop.address, headerTextX, 26);
    }
    
    // Invoice Meta Data
    // We position this below the header area to ensure no overlap.
    // Header area takes up roughly top 40 units (Logo is 10->35 + padding).
    const metaStartY = 50;
    
    doc.setTextColor(0);
    doc.setFontSize(10);
    doc.text(`Invoice #: ${invoiceId}`, 14, metaStartY);
    doc.text(`Date: ${new Date().toLocaleString()}`, 14, metaStartY + 6);
    doc.text(`Cashier: ${user.fullName}`, 14, metaStartY + 12);

    // Table
    const tableData = items.map(item => [
      item.name,
      item.quantity.toString(),
      `${currency}${item.price.toFixed(2)}`,
      `${currency}${(item.price * item.quantity).toFixed(2)}`
    ]);

    autoTable(doc, {
      startY: metaStartY + 20,
      head: [['Item', 'Qty', 'Price', 'Total']],
      body: tableData,
      theme: 'grid',
      headStyles: { fillColor: [59, 130, 246] }, // Tailwind Blue-500
      styles: { fontSize: 10 },
    });

    // Total
    const finalY = (doc as any).lastAutoTable.finalY + 10;
    doc.setFontSize(14);
    doc.setFont("helvetica", "bold");
    doc.text(`Total Amount: ${currency}${total.toFixed(2)}`, 140, finalY);

    // Footer
    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(128);
    doc.text("Thank you for your business!", 105, 280, { align: "center" });

    doc.save(`invoice_${invoiceId}.pdf`);
  };

  const handleCheckout = async () => {
    if (cart.length === 0) return;
    setLoading(true);
    
    const invoiceId = `INV-${Math.floor(Math.random() * 1000000)}`;
    
    try {
        await onCompleteSale(cart, cartTotal);
        try {
          await generatePDF(cart, cartTotal, invoiceId);
        } catch (e) {
          console.error("PDF Generation failed", e);
          alert("Sale recorded but PDF generation failed (Image loading error or browser block).");
        }
        
        setCart([]);
        setIsSuccess(true);
        setTimeout(() => setIsSuccess(false), 3000);
    } catch (e) {
        console.error(e);
        alert("Transaction Failed!");
    } finally {
        setLoading(false);
    }
  };

  return (
    <div className="flex flex-col lg:flex-row gap-6 h-[calc(100vh-200px)] md:h-[calc(100vh-140px)]">
      {/* Product Selection */}
      <div className="flex-1 flex flex-col gap-4 order-2 lg:order-1">
        <div className="relative">
          <div className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 flex items-center gap-1">
             <Search size={18} />
          </div>
          <input
            ref={searchInputRef}
            type="text"
            placeholder="Scan barcode or search product..."
            className="w-full pl-10 pr-12 py-3 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-primary-500 outline-none shadow-sm transition-all focus:border-primary-500"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            onKeyDown={handleKeyDown}
            autoFocus
          />
          <div className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" title="Barcode Scanner Ready">
            <ScanBarcode size={20} className={searchTerm ? "text-primary-500" : ""} />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4 p-1 content-start">
          {availableProducts.map(product => (
            <button
              key={product.id}
              onClick={() => addToCart(product)}
              className="bg-white dark:bg-slate-800 p-4 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm hover:shadow-md hover:border-primary-300 transition-all text-left flex flex-col justify-between group h-32 md:h-auto"
            >
              <div>
                <h4 className="font-semibold text-slate-800 dark:text-slate-100 line-clamp-2 text-sm md:text-base">{product.name}</h4>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">{product.category}</p>
                {product.sku && <p className="text-[10px] text-slate-400 font-mono mt-0.5">{product.sku}</p>}
              </div>
              <div className="mt-2 flex justify-between items-end">
                <span className="font-bold text-primary-600 dark:text-primary-400 text-sm md:text-base">{currency}{product.price.toFixed(2)}</span>
                <span className="text-[10px] md:text-xs bg-slate-100 dark:bg-slate-700 px-2 py-1 rounded text-slate-600 dark:text-slate-300">Qty: {product.stock}</span>
              </div>
            </button>
          ))}
          {availableProducts.length === 0 && (
            <div className="col-span-full flex items-center justify-center text-slate-400 h-40">
              {searchTerm ? 'No matching products found.' : 'No products found.'}
            </div>
          )}
        </div>
      </div>

      {/* Cart & Checkout */}
      <Card className="w-full lg:w-96 flex flex-col p-0 overflow-hidden border-0 shadow-lg ring-1 ring-slate-200 dark:ring-slate-700 order-1 lg:order-2 max-h-[40vh] lg:max-h-full">
        <div className="p-4 bg-slate-50 dark:bg-slate-900 border-b border-slate-200 dark:border-slate-700 flex justify-between items-center">
          <div>
            <h2 className="font-bold text-lg text-slate-800 dark:text-white">Current Order</h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">{cart.length} Items</p>
          </div>
          <div className="font-bold text-xl text-primary-600 dark:text-primary-400">{currency}{cartTotal.toFixed(2)}</div>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-white dark:bg-slate-800">
          {cart.map(item => (
            <div key={item.id} className="flex justify-between items-center bg-white dark:bg-slate-700 p-2 rounded-lg border border-slate-100 dark:border-slate-600 shadow-sm">
              <div className="flex-1 min-w-0 mr-2">
                <h4 className="font-medium text-sm text-slate-900 dark:text-white truncate">{item.name}</h4>
                <p className="text-xs text-slate-500 dark:text-slate-300">{currency}{item.price.toFixed(2)}</p>
              </div>
              <div className="flex items-center gap-2">
                <div className="flex items-center bg-slate-100 dark:bg-slate-600 rounded-lg">
                  <button onClick={() => updateQuantity(item.id, -1)} className="p-1 hover:text-primary-600 dark:hover:text-primary-300 text-slate-600 dark:text-slate-300"><Minus size={14} /></button>
                  <span className="w-6 text-center text-sm font-medium text-slate-800 dark:text-white">{item.quantity}</span>
                  <button onClick={() => updateQuantity(item.id, 1)} className="p-1 hover:text-primary-600 dark:hover:text-primary-300 text-slate-600 dark:text-slate-300"><Plus size={14} /></button>
                </div>
                <button onClick={() => removeFromCart(item.id)} className="text-red-400 hover:text-red-600">
                  <Trash2 size={16} />
                </button>
              </div>
            </div>
          ))}
          {cart.length === 0 && (
            <div className="h-full flex flex-col items-center justify-center text-slate-400 py-8">
              <Printer size={32} className="mb-2 opacity-50" />
              <p className="text-sm">Cart is empty</p>
            </div>
          )}
        </div>

        <div className="p-4 bg-white dark:bg-slate-800 border-t border-slate-200 dark:border-slate-700">
          <Button 
            onClick={handleCheckout} 
            disabled={cart.length === 0 || loading} 
            className="w-full flex items-center justify-center py-3 text-lg"
          >
            {isSuccess ? <CheckCircle className="mr-2" /> : <Printer className="mr-2" />}
            {loading ? '...' : (isSuccess ? 'Done!' : 'Checkout')}
          </Button>
        </div>
      </Card>
    </div>
  );
};

export default POS;