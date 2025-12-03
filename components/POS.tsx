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
    doc.setFontSize(20);
    doc.setTextColor(40);
    doc.text(shop.name, 14, 22);
    
    doc.setFontSize(10);
    doc.text(`Invoice #: ${invoiceId}`, 14, 30);
    doc.text(`Date: ${new Date().toLocaleString()}`, 14, 35);
    doc.text(`Cashier: ${user.fullName}`, 14, 40);

    // Table
    const tableData = items.map(item => [
      item.name,
      item.quantity.toString(),
      `$${item.price.toFixed(2)}`,
      `$${(item.price * item.quantity).toFixed(2)}`
    ]);

    autoTable(doc, {
      startY: 50,
      head: [['Item', 'Qty', 'Price', 'Total']],
      body: tableData,
      theme: 'grid',
      headStyles: { fillColor: [59, 130, 246] },
    });

    // Total
    const finalY = (doc as any).lastAutoTable.finalY + 10;
    doc.setFontSize(12);
    doc.setFont("helvetica", "bold");
    doc.text(`Total Amount: $${total.toFixed(2)}`, 140, finalY);

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
        // Save Data First
        await onCompleteSale(cart, cartTotal);

        // Generate PDF
        try {
          generatePDF(cart, cartTotal, invoiceId);
        } catch (e) {
          console.error("PDF Generation failed", e);
          alert("Sale recorded but PDF generation failed.");
        }
        
        // Reset
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
    <div className="flex flex-col lg:flex-row gap-6 h-[calc(100vh-140px)]">
      {/* Product Selection */}
      <div className="flex-1 flex flex-col gap-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
          <input
            type="text"
            placeholder="Scan barcode or search product..."
            className="w-full pl-10 pr-4 py-3 rounded-lg border border-slate-300 focus:ring-blue-500 outline-none shadow-sm"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            autoFocus
          />
        </div>

        <div className="flex-1 overflow-y-auto grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4 p-1">
          {availableProducts.map(product => (
            <button
              key={product.id}
              onClick={() => addToCart(product)}
              className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm hover:shadow-md hover:border-blue-300 transition-all text-left flex flex-col justify-between group"
            >
              <div>
                <h4 className="font-semibold text-slate-800 line-clamp-2">{product.name}</h4>
                <p className="text-xs text-slate-500 mt-1">{product.category}</p>
              </div>
              <div className="mt-3 flex justify-between items-end">
                <span className="font-bold text-blue-600">${product.price.toFixed(2)}</span>
                <span className="text-xs bg-slate-100 px-2 py-1 rounded text-slate-600 group-hover:bg-blue-50 group-hover:text-blue-600">Stock: {product.stock}</span>
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
      <Card className="w-full lg:w-96 flex flex-col p-0 overflow-hidden border-0 shadow-lg ring-1 ring-slate-200">
        <div className="p-4 bg-slate-50 border-b border-slate-200">
          <h2 className="font-bold text-lg text-slate-800">Current Order</h2>
          <p className="text-xs text-slate-500">Invoice pending...</p>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {cart.map(item => (
            <div key={item.id} className="flex justify-between items-center bg-white p-3 rounded-lg border border-slate-100 shadow-sm">
              <div className="flex-1">
                <h4 className="font-medium text-sm text-slate-900 line-clamp-1">{item.name}</h4>
                <p className="text-xs text-slate-500">${item.price.toFixed(2)} each</p>
              </div>
              <div className="flex items-center gap-3">
                <div className="flex items-center bg-slate-100 rounded-lg">
                  <button onClick={() => updateQuantity(item.id, -1)} className="p-1 hover:text-blue-600"><Minus size={14} /></button>
                  <span className="w-8 text-center text-sm font-medium">{item.quantity}</span>
                  <button onClick={() => updateQuantity(item.id, 1)} className="p-1 hover:text-blue-600"><Plus size={14} /></button>
                </div>
                <button onClick={() => removeFromCart(item.id)} className="text-red-400 hover:text-red-600">
                  <Trash2 size={16} />
                </button>
              </div>
            </div>
          ))}
          {cart.length === 0 && (
            <div className="h-full flex flex-col items-center justify-center text-slate-400">
              <Printer size={48} className="mb-2 opacity-50" />
              <p>Cart is empty</p>
            </div>
          )}
        </div>

        <div className="p-4 bg-white border-t border-slate-200">
          <div className="space-y-2 mb-4">
            <div className="flex justify-between text-slate-600">
              <span>Subtotal</span>
              <span>${cartTotal.toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-slate-600">
              <span>Tax (0%)</span>
              <span>$0.00</span>
            </div>
            <div className="flex justify-between text-xl font-bold text-slate-900 pt-2 border-t border-dashed border-slate-200">
              <span>Total</span>
              <span>${cartTotal.toFixed(2)}</span>
            </div>
          </div>
          
          <Button 
            onClick={handleCheckout} 
            disabled={cart.length === 0 || loading} 
            className="w-full flex items-center justify-center py-3 text-lg"
          >
            {isSuccess ? <CheckCircle className="mr-2" /> : <Printer className="mr-2" />}
            {loading ? 'Processing...' : (isSuccess ? 'Sale Recorded!' : 'Checkout & Print')}
          </Button>
        </div>
      </Card>
    </div>
  );
};

export default POS;