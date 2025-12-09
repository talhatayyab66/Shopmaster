import React, { useState, useEffect, useRef } from 'react';
import { Plus, Search, Edit2, Trash2, AlertCircle, ScanBarcode, Filter, X, Upload, Download, FileSpreadsheet } from 'lucide-react';
import { Product, User, UserRole } from '../types';
import { Card, Button, Input, Modal } from './ui/LayoutComponents';
import * as XLSX from 'xlsx';
import { bulkUpsertProducts } from '../services/storageService';

interface InventoryProps {
  products: Product[];
  user: User;
  onSave: (product: Omit<Product, 'id'> & { id?: string }) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  defaultFilter?: 'all' | 'low-stock';
}

const Inventory: React.FC<InventoryProps> = ({ products, user, onSave, onDelete, defaultFilter = 'all' }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [loading, setLoading] = useState(false);
  const [showLowStockOnly, setShowLowStockOnly] = useState(defaultFilter === 'low-stock');
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // Update state if defaultFilter changes (e.g. navigation from dashboard)
  useEffect(() => {
    setShowLowStockOnly(defaultFilter === 'low-stock');
  }, [defaultFilter]);

  // Form State
  const [formData, setFormData] = useState({
    name: '',
    category: '',
    price: '',
    costPrice: '',
    stock: '',
    minStockLevel: '',
    sku: '',
    formula: '',
    brand: ''
  });

  const handleOpenModal = (product?: Product) => {
    if (product) {
      setEditingProduct(product);
      setFormData({
        name: product.name,
        category: product.category,
        price: product.price.toString(),
        costPrice: product.costPrice.toString(),
        stock: product.stock.toString(),
        minStockLevel: product.minStockLevel.toString(),
        sku: product.sku || '',
        formula: product.formula || '',
        brand: product.brand || ''
      });
    } else {
      setEditingProduct(null);
      setFormData({ name: '', category: '', price: '', costPrice: '', stock: '', minStockLevel: '', sku: '', formula: '', brand: '' });
    }
    setIsModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
        const payload = {
        shopId: user.shopId,
        name: formData.name,
        category: formData.category,
        price: Number(formData.price),
        costPrice: Number(formData.costPrice),
        stock: Number(formData.stock),
        minStockLevel: Number(formData.minStockLevel),
        sku: formData.sku,
        formula: formData.formula,
        brand: formData.brand,
        ...(editingProduct ? { id: editingProduct.id } : {})
        };
        await onSave(payload);
        setIsModalOpen(false);
    } catch (e) {
        console.error("Error saving product", e);
        alert("Failed to save product");
    } finally {
        setLoading(false);
    }
  };

  const handleDeleteClick = async (id: string) => {
      if (window.confirm('Are you sure you want to delete this item?')) {
        setLoading(true);
        try {
            await onDelete(id);
        } catch(e) {
            console.error(e);
            alert("Failed to delete item");
        } finally {
            setLoading(false);
        }
      }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setLoading(true);
    const reader = new FileReader();
    reader.onload = async (evt) => {
      try {
        const bstr = evt.target?.result;
        const wb = XLSX.read(bstr, { type: 'binary' });
        const wsname = wb.SheetNames[0];
        const ws = wb.Sheets[wsname];
        const data = XLSX.utils.sheet_to_json(ws);

        if (data.length === 0) {
          alert("Excel file is empty.");
          setLoading(false);
          return;
        }

        const newProducts: Product[] = [];
        
        // Map Excel rows to Product objects
        for (const row of data as any[]) {
          // Try to match headers loosely
          const name = row['Name'] || row['Product Name'] || row['Item Name'];
          const sku = row['SKU'] || row['Barcode'] ? String(row['SKU'] || row['Barcode']) : undefined;
          
          if (!name && !sku) continue; // Skip invalid rows

          // Check if product exists (by SKU first, then Name)
          const existing = products.find(p => 
            (sku && p.sku === sku) || 
            (!sku && p.name.toLowerCase() === name?.toLowerCase())
          );

          const product: Product = {
            id: existing ? existing.id : crypto.randomUUID(),
            shopId: user.shopId,
            name: name || (existing?.name) || 'Unknown Item',
            category: row['Category'] || (existing?.category) || 'General',
            price: Number(row['Price'] || row['Selling Price'] || existing?.price || 0),
            costPrice: Number(row['Cost'] || row['Cost Price'] || existing?.costPrice || 0),
            stock: Number(row['Stock'] || row['Quantity'] || existing?.stock || 0),
            minStockLevel: Number(row['Min Stock'] || row['Alert Level'] || existing?.minStockLevel || 5),
            sku: sku || existing?.sku,
            brand: row['Brand'] || existing?.brand,
            formula: row['Formula'] || existing?.formula
          };
          
          newProducts.push(product);
        }

        if (newProducts.length > 0) {
           await bulkUpsertProducts(newProducts);
           // Trigger refresh by calling onSave with a dummy (hacky but effective if onSave triggers refresh in parent)
           // Actually, onSave just refreshes data in App.tsx. 
           // We can just call onSave with one item, but better is if Inventory triggered a refresh.
           // Since Inventory doesn't have a direct 'refresh' prop, we rely on parent re-rendering.
           // However, bulkUpsertProducts writes to DB. We need to trigger parent update.
           // Calling onSave with a dummy update is a safe way to trigger App.tsx refreshData
           await onSave(newProducts[0]); 
           alert(`Successfully processed ${newProducts.length} items.`);
        } else {
           alert("No valid items found in the file.");
        }

      } catch (err: any) {
        console.error(err);
        alert("Failed to parse Excel file: " + err.message);
      } finally {
        setLoading(false);
        if (fileInputRef.current) fileInputRef.current.value = '';
      }
    };
    reader.readAsBinaryString(file);
  };

  const downloadTemplate = () => {
    const ws = XLSX.utils.json_to_sheet([
      {
        'Name': 'Example Item',
        'Category': 'General',
        'Price': 100,
        'Cost Price': 80,
        'Stock': 50,
        'Min Stock': 10,
        'SKU': 'ABC-123',
        'Brand': 'BrandX',
        'Formula': 'ChemicalY (Optional)'
      }
    ]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Template");
    XLSX.writeFile(wb, "inventory_template.xlsx");
  };

  const filteredProducts = products.filter(p => {
    const term = searchTerm.toLowerCase();
    const matchesSearch = p.name.toLowerCase().includes(term) || 
                          p.category.toLowerCase().includes(term) ||
                          p.sku?.toLowerCase().includes(term) ||
                          (p.formula && p.formula.toLowerCase().includes(term)) ||
                          (p.brand && p.brand.toLowerCase().includes(term));
    
    const matchesStock = showLowStockOnly ? p.stock < p.minStockLevel : true;

    return matchesSearch && matchesStock;
  });

  const canEdit = user.role === UserRole.ADMIN;

  return (
    <div className="space-y-6">
      <div className="flex flex-col xl:flex-row justify-between gap-4">
        <div className="flex flex-col sm:flex-row gap-2 flex-1">
            <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
                <input
                    type="text"
                    placeholder="Search name, brand, formula or SKU..."
                    className="w-full pl-10 pr-4 py-2 rounded-lg border border-slate-300 focus:ring-primary-500 focus:border-primary-500 outline-none"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                />
            </div>
            <button
                onClick={() => setShowLowStockOnly(!showLowStockOnly)}
                className={`px-3 py-2 rounded-lg border flex items-center gap-2 transition-colors whitespace-nowrap ${
                    showLowStockOnly 
                    ? 'bg-amber-50 border-amber-200 text-amber-700' 
                    : 'bg-white border-slate-300 text-slate-600 hover:bg-slate-50'
                }`}
                title="Toggle Low Stock Filter"
            >
                <Filter size={20} />
                <span className="hidden sm:inline">Low Stock</span>
                {showLowStockOnly && <X size={16} />}
            </button>
        </div>

        {canEdit && (
          <div className="flex gap-2">
            <Button variant="secondary" onClick={downloadTemplate} disabled={loading} className="whitespace-nowrap hidden sm:flex items-center">
               <Download size={18} className="mr-2" />
               Template
            </Button>
            <div className="relative">
               <input 
                 type="file" 
                 ref={fileInputRef}
                 accept=".xlsx,.xls,.csv"
                 className="hidden"
                 onChange={handleFileUpload}
               />
               <Button variant="secondary" onClick={() => fileInputRef.current?.click()} disabled={loading} className="whitespace-nowrap flex items-center w-full justify-center">
                  <FileSpreadsheet size={18} className="mr-2 text-green-600" />
                  Import Excel
               </Button>
            </div>
            <Button onClick={() => handleOpenModal()} disabled={loading} className="whitespace-nowrap flex items-center w-full justify-center">
              <Plus size={20} className="mr-2" />
              Add Item
            </Button>
          </div>
        )}
      </div>

      {showLowStockOnly && (
        <div className="p-3 bg-amber-50 border border-amber-100 rounded-lg flex items-center gap-2 text-amber-800 text-sm">
            <AlertCircle size={16} />
            Showing only low stock items ({filteredProducts.length})
            <button 
                onClick={() => setShowLowStockOnly(false)} 
                className="ml-auto text-xs underline font-medium hover:text-amber-900"
            >
                Clear Filter
            </button>
        </div>
      )}

      <Card className="overflow-hidden p-0">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left min-w-[600px]">
            <thead className="text-xs text-slate-500 uppercase bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="px-6 py-4">Item Name / Formula</th>
                <th className="px-6 py-4">Brand / Category</th>
                <th className="px-6 py-4">Price</th>
                <th className="px-6 py-4">Stock</th>
                <th className="px-6 py-4">Status</th>
                {canEdit && <th className="px-6 py-4 text-right">Actions</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredProducts.map((product) => (
                <tr key={product.id} className="hover:bg-slate-50 transition-colors">
                  <td className="px-6 py-4">
                    <div className="font-medium text-slate-900">{product.name}</div>
                    {product.formula && <div className="text-xs text-slate-500 italic">{product.formula}</div>}
                    {product.sku && <div className="text-[10px] text-slate-400 font-mono mt-0.5">{product.sku}</div>}
                  </td>
                  <td className="px-6 py-4">
                     {product.brand && <div className="text-slate-700 font-medium">{product.brand}</div>}
                     <div className="text-slate-500 text-xs">{product.category}</div>
                  </td>
                  <td className="px-6 py-4 font-medium text-slate-900">${product.price.toFixed(2)}</td>
                  <td className="px-6 py-4">
                    <span className={product.stock < product.minStockLevel ? 'text-red-600 font-bold' : 'text-slate-700'}>
                      {product.stock}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    {product.stock === 0 ? (
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
                        Out of Stock
                      </span>
                    ) : product.stock < product.minStockLevel ? (
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-800">
                        Low Stock
                      </span>
                    ) : (
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                        In Stock
                      </span>
                    )}
                  </td>
                  {canEdit && (
                    <td className="px-6 py-4 text-right space-x-2">
                      <button 
                        onClick={() => handleOpenModal(product)}
                        className="text-primary-600 hover:text-primary-900 p-1 hover:bg-primary-50 rounded"
                      >
                        <Edit2 size={16} />
                      </button>
                      <button 
                        onClick={() => handleDeleteClick(product.id)}
                        className="text-red-600 hover:text-red-900 p-1 hover:bg-red-50 rounded"
                      >
                        <Trash2 size={16} />
                      </button>
                    </td>
                  )}
                </tr>
              ))}
              {filteredProducts.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center text-slate-500">
                    <div className="flex flex-col items-center justify-center">
                      <AlertCircle size={48} className="mb-2 text-slate-300" />
                      <p>No products found.</p>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>

      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={editingProduct ? 'Edit Item' : 'Add New Item'}
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <Input 
            label="Item Name / Medicine Name" 
            value={formData.name} 
            onChange={e => setFormData({...formData, name: e.target.value})} 
            required 
            autoFocus
          />
          {/* Pharmacy Fields - we show them always or could toggle, but showing them as optional is fine */}
          <div className="grid grid-cols-2 gap-4">
             <Input 
                label="Formula (Generic)" 
                value={formData.formula} 
                onChange={e => setFormData({...formData, formula: e.target.value})} 
                placeholder="e.g. Paracetamol"
             />
             <Input 
                label="Brand Name" 
                value={formData.brand} 
                onChange={e => setFormData({...formData, brand: e.target.value})} 
                placeholder="e.g. Panadol"
             />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <Input 
              label="Barcode / SKU" 
              value={formData.sku} 
              onChange={e => setFormData({...formData, sku: e.target.value})} 
              placeholder="Scan barcode"
            />
            <Input 
                label="Category" 
                value={formData.category} 
                onChange={e => setFormData({...formData, category: e.target.value})} 
                required 
                placeholder="e.g. Tablets, Syrup, Food"
            />
          </div>
          
          <div className="grid grid-cols-2 gap-4">
            <Input 
              label="Retail Price" 
              type="number" 
              step="0.01" 
              value={formData.price} 
              onChange={e => setFormData({...formData, price: e.target.value})} 
              required 
            />
            <Input 
              label="Cost Price" 
              type="number" 
              step="0.01" 
              value={formData.costPrice} 
              onChange={e => setFormData({...formData, costPrice: e.target.value})} 
              required 
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Input 
              label="Current Stock" 
              type="number" 
              value={formData.stock} 
              onChange={e => setFormData({...formData, stock: e.target.value})} 
              required 
            />
            <Input 
              label="Min Alert Level" 
              type="number" 
              value={formData.minStockLevel} 
              onChange={e => setFormData({...formData, minStockLevel: e.target.value})} 
              required 
            />
          </div>
          <div className="pt-4 flex justify-end gap-3">
            <Button variant="secondary" onClick={() => setIsModalOpen(false)} disabled={loading}>Cancel</Button>
            <Button type="submit" disabled={loading}>{editingProduct ? 'Save Changes' : 'Add Item'}</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};

export default Inventory;