import React, { useState } from 'react';
import { Search, Plus, Minus, Trash2, Printer, CheckCircle } from 'lucide-react';
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

  const currency = shop.currency || '$';

  // Filter products that have stock
  const availableProducts = products.filter(p => 
    p.stock > 0 && 
    (p.name.toLowerCase().includes(searchTerm.toLowerCase()) || p.sku?.includes(searchTerm))
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

  const cartTotal = cart.reduce((acc, item) => acc + (item.price * item.quantity), 0);

  const generatePDF = (items: CartItem[], total: number, invoiceId: string) => {
    const doc = new jsPDF();
    
    // Header
    let yPos = 20;

    // Add Logo if available
    if (shop.logoUrl) {
      try {
        const img = new Image();
        img.src = shop.logoUrl;
        doc.addImage(img, 'PNG', 14, 15, 20, 20); // x, y, w, h
        yPos = 45; // Push text down
      } catch (e) {
        // Fallback if CORS or image load fails
        console.warn('Could not add logo to PDF', e);
      }
    }

    doc.setFontSize(20);
    doc.setTextColor(40);
    doc.text(shop.name, shop.logoUrl ? 40 : 14, 25);
    
    doc.setFontSize(10);
    if (shop.address) {
      doc.text(shop.address, shop.logoUrl ? 40 : 14, 32);
    }
    
    doc.text(`Invoice #: ${invoiceId}`, 14, yPos);
    doc.text(`Date: ${new Date().toLocaleString()}`, 14, yPos + 5);
    doc.text(`Cashier: ${user.fullName}`, 14, yPos + 10);

    // Table
    const tableData = items.map(item => [
      item.name,
      item.quantity.toString(),
      `${currency}${item.price.toFixed(2)}`,
      `${currency}${(item.price * item.quantity).toFixed(2)}`
    ]);

    autoTable(doc, {
      startY: yPos + 20,
      head: [['Item', 'Qty', 'Price', 'Total']],
      body: tableData,
      theme: 'grid',
      headStyles: { fillColor: [59, 130, 246] },
    });

    // Total
    const finalY = (doc as any).lastAutoTable.finalY + 10;
    doc.setFontSize(12);
    doc.setFont("helvetica", "bold");
    doc.text(`Total Amount: ${currency}${total.toFixed(2)}`, 140, finalY);

    // Footer
    doc.setFontSize(8);
    doc.setFont("helvetica", "normal");
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
          generatePDF(cart, cartTotal, invoiceId);
        } catch (e) {
          console.error("PDF Generation failed", e);
          alert("Sale recorded but PDF generation failed (CORS issue often affects images).");
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
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
          <input
            type="text"
            placeholder="Search product..."
            className="w-full pl-10 pr-4 py-3 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-primary-500 outline-none shadow-sm"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
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
              </div>
              <div className="mt-2 flex justify-between items-end">
                <span className="font-bold text-primary-600 dark:text-primary-400 text-sm md:text-base">{currency}{product.price.toFixed(2)}</span>
                <span className="text-[10px] md:text-xs bg-slate-100 dark:bg-slate-700 px-2 py-1 rounded text-slate-600 dark:text-slate-300">Qty: {product.stock}</span>
              </div>
            </button>
          ))}
          {availableProducts.length === 0 && (
            <div className="col-span-full flex items-center justify-center text-slate-400 h-40">
              No products found.
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