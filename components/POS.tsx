import React, { useState, useRef } from 'react';
import { Search, Plus, Minus, Trash2, Printer, CheckCircle, ScanBarcode, User as UserIcon, Activity, Phone, Utensils, Stethoscope, ShoppingBag, Package, Percent, DollarSign, FilePlus } from 'lucide-react';
import { Product, CartItem, User, Shop } from '../types';
import { Card, Button, Input } from './ui/LayoutComponents';
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
  const [activeTab, setActiveTab] = useState<'products' | 'cart'>('products');
  
  // Customer / Patient Data
  const [customerData, setCustomerData] = useState({
      name: '',
      age: '',
      contact: '',
      diagnosis: ''
  });

  // Clinic Specific Charges
  const [clinicFees, setClinicFees] = useState({
    consultation: '',
    procedures: ''
  });

  const searchInputRef = useRef<HTMLInputElement>(null);
  const currency = shop.currency || '$';

  // Enhanced Search for Pharmacy (Brand, Formula)
  const availableProducts = products.filter(p => 
    p.stock > 0 && 
    (p.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
     p.sku?.toLowerCase().includes(searchTerm.toLowerCase()) ||
     (p.formula && p.formula.toLowerCase().includes(searchTerm.toLowerCase())) ||
     (p.brand && p.brand.toLowerCase().includes(searchTerm.toLowerCase())))
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
      setCart([...cart, { ...product, quantity: 1, discount: 0 }]);
    }
  };

  const updateQuantity = (id: string, delta: number) => {
    setCart(cart.map(item => {
      if (item.id === id) {
        const product = products.find(p => p.id === id);
        if (!product) return item;
        
        const newQty = item.quantity + delta;
        if (newQty > product.stock) return item; 
        if (newQty < 1) return item;
        return { ...item, quantity: newQty };
      }
      return item;
    }));
  };

  const updateQuantityExact = (id: string, value: string) => {
    const qty = parseInt(value);
    if (isNaN(qty)) return;

    setCart(cart.map(item => {
      if (item.id === id) {
        const product = products.find(p => p.id === id);
        if (!product) return item;

        // Allow typing, but validate max stock
        if (qty > product.stock) {
             alert(`Max stock available is ${product.stock}`);
             return { ...item, quantity: product.stock };
        }
        if (qty < 1) return { ...item, quantity: 1 };
        return { ...item, quantity: qty };
      }
      return item;
    }));
  };

  const updateDiscount = (id: string, discount: number) => {
    // Ensure discount is between 0 and 100
    const validDiscount = Math.min(100, Math.max(0, discount));
    setCart(cart.map(item => {
      if (item.id === id) {
        return { ...item, discount: validDiscount };
      }
      return item;
    }));
  };

  const removeFromCart = (id: string) => {
    setCart(cart.filter(item => item.id !== id));
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && searchTerm.trim()) {
      const exactMatch = products.find(p => p.sku === searchTerm.trim() || p.sku === searchTerm);
      if (exactMatch && exactMatch.stock > 0) {
        addToCart(exactMatch);
        setSearchTerm('');
        e.preventDefault(); 
        return;
      }
      if (availableProducts.length === 1) {
        addToCart(availableProducts[0]);
        setSearchTerm('');
        e.preventDefault();
        return;
      }
    }
  };

  const getDiscountedPrice = (item: CartItem) => {
    const discount = item.discount || 0;
    return item.price * (1 - discount / 100);
  };

  // Calculate Totals
  const itemsTotal = cart.reduce((acc, item) => acc + (getDiscountedPrice(item) * item.quantity), 0);
  
  const consultationFee = Number(clinicFees.consultation) || 0;
  const procedureCharges = Number(clinicFees.procedures) || 0;
  
  const finalTotal = itemsTotal + consultationFee + procedureCharges;

  const generatePDF = async (items: CartItem[], total: number, invoiceId: string, fees: {consultation: number, procedures: number}) => {
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
    
    if (shop.logoUrl) {
      try {
        const img = await loadImage(shop.logoUrl);
        doc.addImage(img, 'PNG', 14, 10, 25, 25); 
        headerTextX = 45; 
      } catch (e) {
        console.warn('Logo load failed', e);
      }
    }

    doc.setFontSize(18);
    doc.setTextColor(40);
    doc.text(shop.name, headerTextX, 20); 

    doc.setFontSize(10);
    doc.setTextColor(100);
    if (shop.address) {
      doc.text(shop.address, headerTextX, 26);
    }
    
    const metaStartY = 50;
    
    doc.setTextColor(0);
    doc.setFontSize(10);
    doc.text(`Invoice #: ${invoiceId}`, 14, metaStartY);
    doc.text(`Date: ${new Date().toLocaleString()}`, 14, metaStartY + 6);
    doc.text(`Cashier: ${user.fullName}`, 14, metaStartY + 12);
    
    // Custom Fields based on Shop Type
    let customFieldY = metaStartY + 18;
    
    if (shop.businessType === 'CLINIC' || shop.businessType === 'PHARMACY') {
         if (customerData.name) {
             doc.text(`Patient: ${customerData.name}`, 14, customFieldY);
             customFieldY += 6;
         }
         if (customerData.diagnosis) {
             doc.text(`Diagnosis: ${customerData.diagnosis}`, 14, customFieldY);
             customFieldY += 6;
         }
    } else if (shop.businessType === 'RESTAURANT') {
         if (customerData.name) {
             doc.text(`Customer: ${customerData.name}`, 14, customFieldY);
             customFieldY += 6;
         }
         if (customerData.contact) {
             doc.text(`Contact: ${customerData.contact}`, 14, customFieldY);
             customFieldY += 6;
         }
    } else {
        // Standard shop
        if (customerData.name) {
             doc.text(`Customer: ${customerData.name}`, 14, customFieldY);
             customFieldY += 6;
        }
    }

    const tableData = items.map(item => {
      const discountedPrice = getDiscountedPrice(item);
      let name = item.name + (item.brand ? ` (${item.brand})` : '');
      if (item.discount && item.discount > 0) {
        name += `\n(Disc: ${item.discount}%)`;
      }
      
      return [
        name,
        item.quantity.toString(),
        `${currency}${discountedPrice.toFixed(2)}`,
        `${currency}${(discountedPrice * item.quantity).toFixed(2)}`
      ];
    });

    // Add Fee Rows if applicable
    if (fees.consultation > 0) {
        tableData.push(['Consultation Fee', '1', `${currency}${fees.consultation.toFixed(2)}`, `${currency}${fees.consultation.toFixed(2)}`]);
    }
    if (fees.procedures > 0) {
        tableData.push(['Procedure/Service Charges', '1', `${currency}${fees.procedures.toFixed(2)}`, `${currency}${fees.procedures.toFixed(2)}`]);
    }

    autoTable(doc, {
      startY: customFieldY + 4,
      head: [['Item', 'Qty', 'Price', 'Total']],
      body: tableData,
      theme: 'grid',
      headStyles: { fillColor: [59, 130, 246] },
      styles: { fontSize: 10 },
    });

    const finalY = (doc as any).lastAutoTable.finalY + 10;
    doc.setFontSize(14);
    doc.setFont("helvetica", "bold");
    doc.text(`Total Amount: ${currency}${total.toFixed(2)}`, 140, finalY);

    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(128);
    doc.text("Thank you for your business!", 105, 290, { align: "center" });

    doc.save(`invoice_${invoiceId}.pdf`);
  };

  const handleCheckout = async () => {
    if (cart.length === 0 && finalTotal === 0) return;
    setLoading(true);
    
    const invoiceId = `INV-${Math.floor(Math.random() * 1000000)}`;
    
    // Process items to include effective price after discount
    const processedCart = cart.map(item => ({
       ...item,
       price: getDiscountedPrice(item) // Override price with discounted price for sales record
    }));

    // Add Fees as pseudo-items for the backend record
    if (consultationFee > 0) {
        processedCart.push({
            id: 'FEE-CONSULTATION',
            shopId: shop.id,
            name: 'Consultation Fee',
            category: 'Service',
            price: consultationFee,
            costPrice: 0,
            stock: 9999, // infinite stock
            minStockLevel: 0,
            quantity: 1,
            discount: 0,
            isService: true
        });
    }

    if (procedureCharges > 0) {
        processedCart.push({
            id: 'FEE-PROCEDURES',
            shopId: shop.id,
            name: 'Procedures & Charges',
            category: 'Service',
            price: procedureCharges,
            costPrice: 0,
            stock: 9999,
            minStockLevel: 0,
            quantity: 1,
            discount: 0,
            isService: true
        });
    }

    // Prepare Sale Data with extra fields
    const saleExtras: any = {};
    if (shop.businessType === 'CLINIC' || shop.businessType === 'PHARMACY') {
        saleExtras.patientName = customerData.name;
        saleExtras.diagnosis = customerData.diagnosis;
    } else if (shop.businessType === 'RESTAURANT') {
        saleExtras.customerName = customerData.name;
        saleExtras.customerAge = customerData.age;
        saleExtras.customerContact = customerData.contact;
    } else {
        saleExtras.customerName = customerData.name;
    }

    try {
        await (onCompleteSale as any)(processedCart, finalTotal, saleExtras);
        
        try {
          await generatePDF(cart, finalTotal, invoiceId, { consultation: consultationFee, procedures: procedureCharges });
        } catch (e) {
          console.error("PDF Generation failed", e);
        }
        
        setCart([]);
        setClinicFees({ consultation: '', procedures: '' });
        setCustomerData({ name: '', age: '', contact: '', diagnosis: '' });
        setIsSuccess(true);
        setTimeout(() => setIsSuccess(false), 3000);
    } catch (e) {
        console.error(e);
        alert("Transaction Failed!");
    } finally {
        setLoading(false);
    }
  };

  // UI for Customer/Patient Details
  const renderCustomerFields = () => {
      const isClinic = shop.businessType === 'CLINIC';
      const isPharmacy = shop.businessType === 'PHARMACY';

      if (isClinic || isPharmacy) {
          return (
              <div className="space-y-3 mb-4 p-3 bg-blue-50 dark:bg-slate-800/50 rounded-lg border border-blue-100 dark:border-slate-700">
                  <h3 className="text-sm font-semibold text-blue-800 dark:text-blue-300 flex items-center gap-2">
                      <Stethoscope size={14} /> Patient Details
                  </h3>
                  <Input 
                     placeholder="Patient Name" 
                     value={customerData.name} 
                     onChange={e => setCustomerData({...customerData, name: e.target.value})}
                     className="bg-white"
                  />
                  <Input 
                     placeholder="Diagnosis (Optional)" 
                     value={customerData.diagnosis} 
                     onChange={e => setCustomerData({...customerData, diagnosis: e.target.value})}
                     className="bg-white"
                  />

                  {isClinic && (
                      <div className="grid grid-cols-2 gap-3 pt-2 border-t border-blue-100 dark:border-slate-700">
                          <div>
                              <label className="text-xs text-slate-500 font-medium mb-1 block">Consultation Fee</label>
                              <div className="relative">
                                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-xs">{currency}</span>
                                  <input 
                                    type="number"
                                    min="0"
                                    placeholder="0.00"
                                    value={clinicFees.consultation}
                                    onChange={e => setClinicFees({...clinicFees, consultation: e.target.value})}
                                    className="w-full pl-7 pr-3 py-2 text-sm bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-lg focus:ring-primary-500 focus:border-primary-500 outline-none"
                                  />
                              </div>
                          </div>
                          <div>
                              <label className="text-xs text-slate-500 font-medium mb-1 block">Other Charges</label>
                              <div className="relative">
                                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-xs">{currency}</span>
                                  <input 
                                    type="number"
                                    min="0"
                                    placeholder="0.00"
                                    value={clinicFees.procedures}
                                    onChange={e => setClinicFees({...clinicFees, procedures: e.target.value})}
                                    className="w-full pl-7 pr-3 py-2 text-sm bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-lg focus:ring-primary-500 focus:border-primary-500 outline-none"
                                  />
                              </div>
                          </div>
                      </div>
                  )}
              </div>
          );
      } else if (shop.businessType === 'RESTAURANT') {
          return (
              <div className="space-y-3 mb-4 p-3 bg-orange-50 dark:bg-slate-800/50 rounded-lg border border-orange-100 dark:border-slate-700">
                  <h3 className="text-sm font-semibold text-orange-800 dark:text-orange-300 flex items-center gap-2">
                      <Utensils size={14} /> Customer Info
                  </h3>
                  <Input 
                     placeholder="Customer Name" 
                     value={customerData.name} 
                     onChange={e => setCustomerData({...customerData, name: e.target.value})}
                     className="bg-white"
                  />
                  <div className="grid grid-cols-2 gap-2">
                    <Input 
                        placeholder="Age" 
                        value={customerData.age} 
                        onChange={e => setCustomerData({...customerData, age: e.target.value})}
                        className="bg-white"
                    />
                    <Input 
                        placeholder="Contact" 
                        value={customerData.contact} 
                        onChange={e => setCustomerData({...customerData, contact: e.target.value})}
                        className="bg-white"
                    />
                  </div>
              </div>
          );
      } else {
          // Standard Shop
          return (
              <div className="mb-4">
                  <Input 
                     placeholder="Customer Name (Optional)" 
                     value={customerData.name} 
                     onChange={e => setCustomerData({...customerData, name: e.target.value})}
                  />
              </div>
          );
      }
  }

  return (
    <div className="flex flex-col h-[calc(100vh-200px)] md:h-[calc(100vh-140px)]">
      {/* Mobile Tab Switcher */}
      <div className="lg:hidden flex mb-4 bg-white dark:bg-slate-800 rounded-lg p-1 border border-slate-200 dark:border-slate-700 shrink-0 shadow-sm">
        <button
          onClick={() => setActiveTab('products')}
          className={`flex-1 py-2 px-4 rounded-md text-sm font-medium flex items-center justify-center gap-2 transition-all ${
            activeTab === 'products'
              ? 'bg-primary-100 text-primary-700 dark:bg-primary-900/30 dark:text-primary-400'
              : 'text-slate-500 hover:text-slate-700 dark:text-slate-400'
          }`}
        >
          <Package size={18} />
          Products
        </button>
        <button
          onClick={() => setActiveTab('cart')}
          className={`flex-1 py-2 px-4 rounded-md text-sm font-medium flex items-center justify-center gap-2 transition-all relative ${
            activeTab === 'cart'
              ? 'bg-primary-100 text-primary-700 dark:bg-primary-900/30 dark:text-primary-400'
              : 'text-slate-500 hover:text-slate-700 dark:text-slate-400'
          }`}
        >
          <ShoppingBag size={18} />
          Cart
          {cart.length > 0 && (
            <span className="bg-primary-600 text-white text-[10px] px-2 py-0.5 rounded-full ml-2 text-center font-bold shadow-sm">
              {cart.reduce((a,c) => a + c.quantity, 0)}
            </span>
          )}
        </button>
      </div>

      <div className="flex flex-1 gap-6 overflow-hidden relative">
        {/* Product Selection */}
        <div className={`flex-1 flex-col gap-4 h-full ${activeTab === 'products' ? 'flex' : 'hidden lg:flex'}`}>
          <div className="relative shrink-0">
            <div className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 flex items-center gap-1">
               <Search size={18} />
            </div>
            <input
              ref={searchInputRef}
              type="text"
              placeholder={shop.businessType === 'PHARMACY' ? "Search by Name, Formula, Brand..." : "Scan barcode or search product..."}
              className="w-full pl-10 pr-12 py-3 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-primary-500 outline-none shadow-sm transition-all focus:border-primary-500"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              onKeyDown={handleKeyDown}
              autoFocus
            />
            <div className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400">
              <ScanBarcode size={20} className={searchTerm ? "text-primary-500" : ""} />
            </div>
          </div>

          <div className="flex-1 overflow-y-auto grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4 p-1 content-start pb-20 lg:pb-0">
            {availableProducts.map(product => (
              <button
                key={product.id}
                onClick={() => addToCart(product)}
                className="bg-white dark:bg-slate-800 p-4 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm hover:shadow-md hover:border-primary-300 transition-all text-left flex flex-col justify-between group h-32 md:h-auto"
              >
                <div>
                  <h4 className="font-semibold text-slate-800 dark:text-slate-100 line-clamp-2 text-sm md:text-base">{product.name}</h4>
                  {product.brand && <p className="text-xs text-primary-600 font-medium">{product.brand}</p>}
                  {product.formula && <p className="text-[10px] text-slate-500 italic mt-0.5 truncate" title={product.formula}>{product.formula}</p>}
                  
                  {!product.formula && <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">{product.category}</p>}
                </div>
                <div className="mt-2 flex justify-between items-end">
                  <span className="font-bold text-primary-600 dark:text-primary-400 text-sm md:text-base">{currency}{product.price.toFixed(2)}</span>
                  <span className="text-[10px] md:text-xs bg-slate-100 dark:bg-slate-700 px-2 py-1 rounded text-slate-600 dark:text-slate-300">Qty: {product.stock}</span>
                </div>
              </button>
            ))}
            {availableProducts.length === 0 && (
              <div className="col-span-full flex items-center justify-center text-slate-400 h-40">
                {searchTerm ? 'No matching items found.' : 'No items found.'}
              </div>
            )}
          </div>
        </div>

        {/* Cart & Checkout */}
        <div className={`w-full lg:w-96 flex-col h-full ${activeTab === 'cart' ? 'flex' : 'hidden lg:flex'}`}>
           <Card className="flex flex-col p-0 overflow-hidden border-0 shadow-lg ring-1 ring-slate-200 dark:ring-slate-700 h-full">
            <div className="p-4 bg-slate-50 dark:bg-slate-900 border-b border-slate-200 dark:border-slate-700 flex justify-between items-center shrink-0">
              <div>
                <h2 className="font-bold text-lg text-slate-800 dark:text-white">
                    {shop.businessType === 'RESTAURANT' ? 'Current Table' : 'Current Order'}
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400">{cart.length} Items</p>
              </div>
              <div className="font-bold text-xl text-primary-600 dark:text-primary-400">{currency}{finalTotal.toFixed(2)}</div>
            </div>

            <div className="p-4 border-b border-slate-100 dark:border-slate-700 bg-white dark:bg-slate-800 shrink-0">
                {renderCustomerFields()}
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-white dark:bg-slate-800">
              {cart.map(item => (
                <div key={item.id} className="flex flex-col bg-white dark:bg-slate-700 p-3 rounded-lg border border-slate-100 dark:border-slate-600 shadow-sm gap-2">
                  <div className="flex justify-between items-start">
                    <div className="flex-1 min-w-0 mr-2">
                        <h4 className="font-medium text-sm text-slate-900 dark:text-white truncate">{item.name}</h4>
                        <div className="flex items-center gap-2 text-xs">
                            <span className="text-slate-500 dark:text-slate-300">{currency}{item.price.toFixed(2)}</span>
                            {item.discount && item.discount > 0 ? (
                                <span className="text-green-600 dark:text-green-400 font-medium bg-green-50 dark:bg-green-900/20 px-1 rounded">-{item.discount}%</span>
                            ) : null}
                        </div>
                    </div>
                    <button onClick={() => removeFromCart(item.id)} className="text-red-400 hover:text-red-600">
                      <Trash2 size={16} />
                    </button>
                  </div>
                  
                  <div className="flex justify-between items-center border-t border-slate-100 dark:border-slate-600 pt-2">
                     <div className="flex items-center gap-2">
                        <span className="text-xs text-slate-400 flex items-center gap-1"><Percent size={10} /> Disc</span>
                        <input 
                           type="number"
                           min="0"
                           max="100"
                           value={item.discount || 0}
                           onChange={(e) => updateDiscount(item.id, Number(e.target.value))}
                           className="w-12 text-center text-xs py-1 rounded border border-slate-200 dark:border-slate-500 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 outline-none focus:border-primary-500"
                        />
                     </div>
                     
                     <div className="flex items-center bg-slate-100 dark:bg-slate-600 rounded-lg">
                        <button onClick={() => updateQuantity(item.id, -1)} className="p-1 hover:text-primary-600 dark:hover:text-primary-300 text-slate-600 dark:text-slate-300"><Minus size={14} /></button>
                        <input 
                            type="number"
                            min="1"
                            max={item.stock}
                            value={item.quantity}
                            onChange={(e) => updateQuantityExact(item.id, e.target.value)}
                            className="w-12 text-center text-sm font-medium text-slate-800 dark:text-white bg-transparent border-0 outline-none p-0 appearance-none"
                        />
                        <button onClick={() => updateQuantity(item.id, 1)} className="p-1 hover:text-primary-600 dark:hover:text-primary-300 text-slate-600 dark:text-slate-300"><Plus size={14} /></button>
                     </div>
                  </div>
                </div>
              ))}

              {/* Fee Summaries in Cart List */}
              {(consultationFee > 0 || procedureCharges > 0) && (
                  <div className="border-t border-dashed border-slate-200 dark:border-slate-700 pt-3 mt-2">
                      {consultationFee > 0 && (
                          <div className="flex justify-between text-sm py-1">
                              <span className="text-slate-600 dark:text-slate-300">Consultation</span>
                              <span className="font-medium text-slate-900 dark:text-white">{currency}{consultationFee.toFixed(2)}</span>
                          </div>
                      )}
                      {procedureCharges > 0 && (
                          <div className="flex justify-between text-sm py-1">
                              <span className="text-slate-600 dark:text-slate-300">Procedures</span>
                              <span className="font-medium text-slate-900 dark:text-white">{currency}{procedureCharges.toFixed(2)}</span>
                          </div>
                      )}
                  </div>
              )}

              {cart.length === 0 && consultationFee === 0 && procedureCharges === 0 && (
                <div className="h-full flex flex-col items-center justify-center text-slate-400 py-8">
                  <Printer size={32} className="mb-2 opacity-50" />
                  <p className="text-sm">List is empty</p>
                </div>
              )}
            </div>

            <div className="p-4 bg-white dark:bg-slate-800 border-t border-slate-200 dark:border-slate-700 shrink-0">
              <Button 
                onClick={handleCheckout} 
                disabled={(cart.length === 0 && finalTotal === 0) || loading} 
                className="w-full flex items-center justify-center py-3 text-lg"
              >
                {isSuccess ? <CheckCircle className="mr-2" /> : <Printer className="mr-2" />}
                {loading ? '...' : (isSuccess ? 'Dispensed' : (shop.businessType === 'CLINIC' || shop.businessType === 'PHARMACY' ? 'Dispense' : 'Checkout'))}
              </Button>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default POS;