import React, { useState, useEffect, useRef } from 'react';
import { Plus, Search, Edit2, Trash2, AlertCircle, Filter, X, Upload, Download, FileSpreadsheet, Check, AlertTriangle, ArrowRight, CheckSquare, Square, Printer } from 'lucide-react';
import { Product, User, UserRole } from '../types';
import { Card, Button, Input, Modal } from './ui/LayoutComponents';
import * as XLSX from 'xlsx';
import { bulkUpsertProducts } from '../services/storageService';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';

interface InventoryProps {
  products: Product[];
  user: User;
  onSave: (product: Omit<Product, 'id'> & { id?: string }) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  defaultFilter?: 'all' | 'low-stock';
  currency: string;
}

interface PreviewItem extends Product {
  _status: 'new' | 'update' | 'invalid';
  _errors: string[];
  _originalName?: string;
}

const Inventory: React.FC<InventoryProps> = ({ products, user, onSave, onDelete, defaultFilter = 'all', currency }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [loading, setLoading] = useState(false);
  const [showLowStockOnly, setShowLowStockOnly] = useState(defaultFilter === 'low-stock');
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // Selection State
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // Import Preview State
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [previewData, setPreviewData] = useState<PreviewItem[]>([]);
  
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

  // --- Inventory Report Generation ---
  const generateInventoryReport = () => {
    // 1. Determine which items to include
    const itemsToReport = selectedIds.size > 0 
        ? products.filter(p => selectedIds.has(p.id))
        : products;

    if (itemsToReport.length === 0) {
        alert("No items available for report.");
        return;
    }

    const doc = new jsPDF();
    const date = new Date().toLocaleDateString();

    doc.setFontSize(18);
    doc.text(`Inventory Report`, 14, 20);
    doc.setFontSize(10);
    doc.text(`Date: ${date}`, 14, 26);
    doc.text(`Items: ${itemsToReport.length}`, 14, 32);

    let totalCostValue = 0;
    let totalRetailValue = 0;

    const tableData = itemsToReport.map(item => {
        const costVal = item.costPrice * item.stock;
        const retailVal = item.price * item.stock;
        
        totalCostValue += costVal;
        totalRetailValue += retailVal;

        return [
            item.name,
            item.category,
            item.stock.toString(),
            `${currency}${item.costPrice.toFixed(2)}`,
            `${currency}${item.price.toFixed(2)}`,
            `${currency}${costVal.toFixed(2)}`,
            `${currency}${retailVal.toFixed(2)}`
        ];
    });

    autoTable(doc, {
        startY: 40,
        head: [['Item', 'Category', 'Qty', 'Cost', 'Price', 'Total Cost', 'Total Value']],
        body: tableData,
        foot: [[
            'TOTALS', 
            '', 
            '', 
            '', 
            '', 
            `${currency}${totalCostValue.toFixed(2)}`, 
            `${currency}${totalRetailValue.toFixed(2)}`
        ]],
        styles: { fontSize: 8 },
        footStyles: { fillColor: [41, 37, 36], textColor: [255, 255, 255], fontStyle: 'bold' }
    });

    const filename = selectedIds.size > 0 ? 'inventory_selected.pdf' : 'inventory_full.pdf';
    doc.save(filename);
  };

  // --- Export Functionality ---
  const handleExport = () => {
    const dataToExport = products.map(p => ({
      'ID (Do Not Change)': p.id,
      'Name': p.name,
      'Category': p.category,
      'Price': p.price,
      'Cost Price': p.costPrice,
      'Stock': p.stock,
      'Min Stock': p.minStockLevel,
      'SKU': p.sku || '',
      'Brand': p.brand || '',
      'Formula': p.formula || ''
    }));

    const ws = XLSX.utils.json_to_sheet(dataToExport);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Inventory");
    const dateStr = new Date().toISOString().split('T')[0];
    XLSX.writeFile(wb, `Inventory_Export_${dateStr}.xlsx`);
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

  // --- Import Functionality ---

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

        const processed: PreviewItem[] = [];
        
        // Map Excel rows to Product objects with validation
        for (const row of data as any[]) {
          // Normalize Keys helpers
          const getVal = (keys: string[]) => {
             for (const k of keys) if (row[k] !== undefined) return row[k];
             return undefined;
          };

          const name = getVal(['Name', 'Product Name', 'Item Name']);
          const id = getVal(['ID', 'ID (Do Not Change)', 'id']);
          const skuRaw = getVal(['SKU', 'Barcode', 'sku', 'barcode']);
          const sku = skuRaw ? String(skuRaw).trim() : undefined;
          
          const errors: string[] = [];
          if (!name) errors.push("Missing Name");
          
          // Validation
          const priceRaw = getVal(['Price', 'Selling Price', 'Retail Price']);
          const price = Number(priceRaw);
          if (isNaN(price) || price < 0) errors.push("Invalid Price");

          const costRaw = getVal(['Cost', 'Cost Price', 'Buying Price']);
          const cost = Number(costRaw || 0);
          
          const stockRaw = getVal(['Stock', 'Quantity', 'Qty']);
          const stock = Number(stockRaw);
          if (isNaN(stock) || stock < 0) errors.push("Invalid Stock");
          
          const minStockRaw = getVal(['Min Stock', 'Alert Level', 'Reorder Point']);
          const minStockLevel = Number(minStockRaw || 5);

          // Conflict Detection
          // 1. Check by ID (if provided)
          let existing = id ? products.find(p => p.id === id) : undefined;
          
          // 2. Check by SKU
          if (!existing && sku) {
            existing = products.find(p => p.sku === sku);
          }

          // 3. Check by Name
          if (!existing && name) {
            existing = products.find(p => p.name.toLowerCase() === String(name).toLowerCase());
          }

          const status: PreviewItem['_status'] = errors.length > 0 ? 'invalid' : (existing ? 'update' : 'new');

          const product: PreviewItem = {
            id: existing ? existing.id : crypto.randomUUID(),
            shopId: user.shopId,
            name: name ? String(name) : (existing?.name || 'Unknown'),
            category: getVal(['Category', 'Cat']) || existing?.category || 'General',
            price: isNaN(price) ? (existing?.price || 0) : price,
            costPrice: cost,
            stock: isNaN(stock) ? (existing?.stock || 0) : stock,
            minStockLevel: minStockLevel,
            sku: sku || existing?.sku,
            brand: getVal(['Brand', 'Manufacturer']) || existing?.brand,
            formula: getVal(['Formula', 'Generic Name']) || existing?.formula,
            _status: status,
            _errors: errors,
            _originalName: existing?.name
          };
          
          processed.push(product);
        }

        setPreviewData(processed);
        setIsPreviewOpen(true);

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

  const handleConfirmImport = async () => {
     const validItems = previewData.filter(i => i._status !== 'invalid');
     if (validItems.length === 0) return;

     setLoading(true);
     try {
       // Strip internal fields
       const cleanProducts: Product[] = validItems.map(item => {
          const { _status, _errors, _originalName, ...rest } = item;
          return rest;
       });

       await bulkUpsertProducts(cleanProducts);
       
       // Trigger refresh
       if (cleanProducts.length > 0) {
         await onSave(cleanProducts[0]); // Hack to trigger refreshData in App
       }
       
       setIsPreviewOpen(false);
       setPreviewData([]);
       alert(`Successfully processed ${cleanProducts.length} items.`);
     } catch (err: any) {
        alert("Import failed: " + err.message);
     } finally {
        setLoading(false);
     }
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

  // Render Stats for Preview
  const previewStats = {
    new: previewData.filter(i => i._status === 'new').length,
    update: previewData.filter(i => i._status === 'update').length,
    invalid: previewData.filter(i => i._status === 'invalid').length,
    total: previewData.length
  };
  
  // Checkbox helpers
  const isAllSelected = filteredProducts.length > 0 && selectedIds.size === filteredProducts.length;
  const isPartiallySelected = selectedIds.size > 0 && selectedIds.size < filteredProducts.length;

  const toggleSelectAll = () => {
    if (isAllSelected) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredProducts.map(p => p.id)));
    }
  };

  const toggleSelect = (id: string) => {
    const newSet = new Set(selectedIds);
    if (newSet.has(id)) newSet.delete(id);
    else newSet.add(id);
    setSelectedIds(newSet);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col xl:flex-row justify-between gap-4">
        <div className="flex flex-col sm:flex-row gap-2 flex-1">
            <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
                <input
                    type="text"
                    placeholder="Search name, brand, formula or SKU..."
                    className="w-full pl-10 pr-4 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-primary-500 focus:border-primary-500 outline-none"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                />
            </div>
            <button
                onClick={() => setShowLowStockOnly(!showLowStockOnly)}
                className={`px-3 py-2 rounded-lg border flex items-center gap-2 transition-colors whitespace-nowrap ${
                    showLowStockOnly 
                    ? 'bg-amber-50 border-amber-200 text-amber-700 dark:bg-amber-900/30 dark:border-amber-700 dark:text-amber-400' 
                    : 'bg-white border-slate-300 text-slate-600 hover:bg-slate-50 dark:bg-slate-800 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-700'
                }`}
                title="Toggle Low Stock Filter"
            >
                <Filter size={20} />
                <span className="hidden sm:inline">Low Stock</span>
                {showLowStockOnly && <X size={16} />}
            </button>
        </div>

        {canEdit && (
          <div className="flex gap-2 overflow-x-auto pb-1">
            {/* New Report Button */}
            <Button variant="secondary" onClick={generateInventoryReport} disabled={loading} className="whitespace-nowrap flex items-center">
               <Printer size={18} className="mr-2" />
               {selectedIds.size > 0 ? `Report (${selectedIds.size})` : 'Report (All)'}
            </Button>

            <Button variant="secondary" onClick={downloadTemplate} disabled={loading} className="whitespace-nowrap flex items-center">
               <Download size={18} className="mr-2" />
               Template
            </Button>
            <Button variant="secondary" onClick={handleExport} disabled={loading} className="whitespace-nowrap flex items-center">
               <Upload className="mr-2 rotate-180" size={18} />
               Export
            </Button>
            <div className="relative">
               <input 
                 type="file" 
                 ref={fileInputRef}
                 accept=".xlsx,.xls,.csv"
                 className="hidden"
                 onChange={handleFileUpload}
               />
               <Button variant="secondary" onClick={() => fileInputRef.current?.click()} disabled={loading} className="whitespace-nowrap flex items-center justify-center">
                  <FileSpreadsheet size={18} className="mr-2 text-green-600" />
                  Import
               </Button>
            </div>
            <Button onClick={() => handleOpenModal()} disabled={loading} className="whitespace-nowrap flex items-center justify-center">
              <Plus size={20} className="mr-2" />
              Add Item
            </Button>
          </div>
        )}
      </div>

      {showLowStockOnly && (
        <div className="p-3 bg-amber-50 border border-amber-100 dark:bg-amber-900/20 dark:border-amber-800 rounded-lg flex items-center gap-2 text-amber-800 dark:text-amber-400 text-sm">
            <AlertCircle size={16} />
            Showing only low stock items ({filteredProducts.length})
            <button 
                onClick={() => setShowLowStockOnly(false)} 
                className="ml-auto text-xs underline font-medium hover:text-amber-900 dark:hover:text-amber-300"
            >
                Clear Filter
            </button>
        </div>
      )}

      <Card className="overflow-hidden p-0">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left min-w-[600px]">
            <thead className="text-xs text-slate-500 dark:text-slate-400 uppercase bg-slate-50 dark:bg-slate-900 border-b border-slate-200 dark:border-slate-700">
              <tr>
                <th className="px-6 py-4 w-12">
                   <button onClick={toggleSelectAll} className="flex items-center text-slate-500 hover:text-primary-600">
                      {isAllSelected ? <CheckSquare size={18} /> : (isPartiallySelected ? <div className="w-[14px] h-[14px] bg-primary-600 rounded-sm mx-[2px]"/> : <Square size={18} />)}
                   </button>
                </th>
                <th className="px-6 py-4">Item Name / Formula</th>
                <th className="px-6 py-4">Brand / Category</th>
                <th className="px-6 py-4">Price</th>
                <th className="px-6 py-4">Stock</th>
                <th className="px-6 py-4">Status</th>
                {canEdit && <th className="px-6 py-4 text-right">Actions</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {filteredProducts.map((product) => (
                <tr key={product.id} className={`hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors ${selectedIds.has(product.id) ? 'bg-primary-50 dark:bg-primary-900/10' : ''}`}>
                  <td className="px-6 py-4">
                     <button onClick={() => toggleSelect(product.id)} className={`flex items-center ${selectedIds.has(product.id) ? 'text-primary-600' : 'text-slate-400'}`}>
                        {selectedIds.has(product.id) ? <CheckSquare size={18} /> : <Square size={18} />}
                     </button>
                  </td>
                  <td className="px-6 py-4">
                    <div className="font-medium text-slate-900 dark:text-white">{product.name}</div>
                    {product.formula && <div className="text-xs text-slate-500 italic">{product.formula}</div>}
                    {product.sku && <div className="text-[10px] text-slate-400 font-mono mt-0.5">{product.sku}</div>}
                  </td>
                  <td className="px-6 py-4">
                     {product.brand && <div className="text-slate-700 dark:text-slate-300 font-medium">{product.brand}</div>}
                     <div className="text-slate-500 text-xs">{product.category}</div>
                  </td>
                  <td className="px-6 py-4 font-medium text-slate-900 dark:text-white">{currency}{product.price.toFixed(2)}</td>
                  <td className="px-6 py-4">
                    <span className={product.stock < product.minStockLevel ? 'text-red-600 font-bold' : 'text-slate-700 dark:text-slate-300'}>
                      {product.stock}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    {product.stock === 0 ? (
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400">
                        Out of Stock
                      </span>
                    ) : product.stock < product.minStockLevel ? (
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400">
                        Low Stock
                      </span>
                    ) : (
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400">
                        In Stock
                      </span>
                    )}
                  </td>
                  {canEdit && (
                    <td className="px-6 py-4 text-right space-x-2">
                      <button 
                        onClick={() => handleOpenModal(product)}
                        className="text-primary-600 hover:text-primary-900 p-1 hover:bg-primary-50 dark:hover:bg-primary-900/20 rounded"
                      >
                        <Edit2 size={16} />
                      </button>
                      <button 
                        onClick={() => handleDeleteClick(product.id)}
                        className="text-red-600 hover:text-red-900 p-1 hover:bg-red-50 dark:hover:bg-red-900/20 rounded"
                      >
                        <Trash2 size={16} />
                      </button>
                    </td>
                  )}
                </tr>
              ))}
              {filteredProducts.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-6 py-12 text-center text-slate-500 dark:text-slate-400">
                    <div className="flex flex-col items-center justify-center">
                      <AlertCircle size={48} className="mb-2 text-slate-300 dark:text-slate-600" />
                      <p>No products found.</p>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Edit/Add Modal */}
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
                placeholder="e.g. Tablets"
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

      {/* Import Preview Modal */}
      {isPreviewOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-white dark:bg-slate-800 rounded-xl shadow-xl w-full max-w-4xl max-h-[90vh] flex flex-col animate-[fadeIn_0.2s_ease-out]">
             {/* Header */}
             <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-700 flex justify-between items-center bg-slate-50 dark:bg-slate-800 rounded-t-xl">
               <div>
                  <h3 className="text-lg font-bold text-slate-800 dark:text-white">Import Preview</h3>
                  <p className="text-sm text-slate-500">Review changes before applying</p>
               </div>
               <button onClick={() => setIsPreviewOpen(false)} className="text-slate-400 hover:text-slate-600">&times;</button>
             </div>

             {/* Stats */}
             <div className="grid grid-cols-4 gap-4 p-4 border-b border-slate-100 dark:border-slate-700 bg-white dark:bg-slate-800">
               <div className="text-center p-2 bg-slate-50 dark:bg-slate-700 rounded-lg">
                  <p className="text-xs text-slate-500 dark:text-slate-400 uppercase">Total Rows</p>
                  <p className="text-xl font-bold text-slate-800 dark:text-white">{previewStats.total}</p>
               </div>
               <div className="text-center p-2 bg-green-50 dark:bg-green-900/20 rounded-lg">
                  <p className="text-xs text-green-600 uppercase">New Items</p>
                  <p className="text-xl font-bold text-green-700">{previewStats.new}</p>
               </div>
               <div className="text-center p-2 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                  <p className="text-xs text-blue-600 uppercase">Updates</p>
                  <p className="text-xl font-bold text-blue-700">{previewStats.update}</p>
               </div>
               <div className="text-center p-2 bg-red-50 dark:bg-red-900/20 rounded-lg">
                  <p className="text-xs text-red-600 uppercase">Errors</p>
                  <p className="text-xl font-bold text-red-700">{previewStats.invalid}</p>
               </div>
             </div>
             
             {/* Table */}
             <div className="flex-1 overflow-y-auto p-0">
               <table className="w-full text-sm text-left">
                 <thead className="text-xs text-slate-500 uppercase bg-slate-50 dark:bg-slate-700 sticky top-0 z-10 shadow-sm">
                   <tr>
                     <th className="px-4 py-3">Status</th>
                     <th className="px-4 py-3">Name</th>
                     <th className="px-4 py-3">Category</th>
                     <th className="px-4 py-3">Price</th>
                     <th className="px-4 py-3">Stock</th>
                     <th className="px-4 py-3">Notes</th>
                   </tr>
                 </thead>
                 <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                    {previewData.map((item, idx) => (
                      <tr key={idx} className={item._status === 'invalid' ? 'bg-red-50 dark:bg-red-900/10' : 'hover:bg-slate-50 dark:hover:bg-slate-800'}>
                        <td className="px-4 py-2">
                          {item._status === 'new' && <span className="text-xs font-bold text-green-600 bg-green-100 px-2 py-1 rounded">NEW</span>}
                          {item._status === 'update' && <span className="text-xs font-bold text-blue-600 bg-blue-100 px-2 py-1 rounded">UPDATE</span>}
                          {item._status === 'invalid' && <span className="text-xs font-bold text-red-600 bg-red-100 px-2 py-1 rounded">ERROR</span>}
                        </td>
                        <td className="px-4 py-2 font-medium text-slate-800 dark:text-white">
                          {item.name}
                          {item._originalName && item._originalName !== item.name && (
                             <div className="text-xs text-slate-400 line-through">{item._originalName}</div>
                          )}
                        </td>
                        <td className="px-4 py-2 text-slate-600 dark:text-slate-300">{item.category}</td>
                        <td className="px-4 py-2 text-slate-600 dark:text-slate-300">{item.price}</td>
                        <td className="px-4 py-2 text-slate-600 dark:text-slate-300">{item.stock}</td>
                        <td className="px-4 py-2 text-xs">
                          {item._errors.length > 0 ? (
                            <span className="text-red-600">{item._errors.join(', ')}</span>
                          ) : item._status === 'update' ? (
                            <span className="text-blue-600">Matched existing item</span>
                          ) : (
                            <span className="text-slate-400">-</span>
                          )}
                        </td>
                      </tr>
                    ))}
                 </tbody>
               </table>
             </div>

             {/* Footer */}
             <div className="p-4 border-t border-slate-100 dark:border-slate-700 bg-white dark:bg-slate-800 rounded-b-xl flex justify-end gap-3">
               <Button variant="secondary" onClick={() => setIsPreviewOpen(false)}>Cancel</Button>
               <Button 
                 onClick={handleConfirmImport} 
                 disabled={loading || previewStats.invalid === previewStats.total || (previewStats.new === 0 && previewStats.update === 0)}
               >
                 {loading ? 'Processing...' : `Confirm Import (${previewStats.new + previewStats.update} items)`}
               </Button>
             </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Inventory;