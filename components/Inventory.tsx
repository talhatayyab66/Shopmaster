import React, { useState } from 'react';
import { Plus, Search, Edit2, Trash2, AlertCircle } from 'lucide-react';
import { Product, User, UserRole } from '../types';
import { Card, Button, Input, Modal } from './ui/LayoutComponents';

interface InventoryProps {
  products: Product[];
  user: User;
  onSave: (product: Omit<Product, 'id'> & { id?: string }) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
}

const Inventory: React.FC<InventoryProps> = ({ products, user, onSave, onDelete }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [loading, setLoading] = useState(false);
  
  // Form State
  const [formData, setFormData] = useState({
    name: '',
    category: '',
    price: '',
    costPrice: '',
    stock: '',
    minStockLevel: '',
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
      });
    } else {
      setEditingProduct(null);
      setFormData({ name: '', category: '', price: '', costPrice: '', stock: '', minStockLevel: '' });
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

  const filteredProducts = products.filter(p => 
    p.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
    p.category.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const canEdit = user.role === UserRole.ADMIN;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
          <input
            type="text"
            placeholder="Search items..."
            className="w-full pl-10 pr-4 py-2 rounded-lg border border-slate-300 focus:ring-primary-500 focus:border-primary-500 outline-none"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        {canEdit && (
          <Button onClick={() => handleOpenModal()} disabled={loading} className="w-full sm:w-auto">
            <Plus size={20} className="inline mr-2" />
            Add Item
          </Button>
        )}
      </div>

      <Card className="overflow-hidden p-0">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left min-w-[600px]">
            <thead className="text-xs text-slate-500 uppercase bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="px-6 py-4">Product Name</th>
                <th className="px-6 py-4">Category</th>
                <th className="px-6 py-4">Price</th>
                <th className="px-6 py-4">Stock</th>
                <th className="px-6 py-4">Status</th>
                {canEdit && <th className="px-6 py-4 text-right">Actions</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredProducts.map((product) => (
                <tr key={product.id} className="hover:bg-slate-50 transition-colors">
                  <td className="px-6 py-4 font-medium text-slate-900">{product.name}</td>
                  <td className="px-6 py-4 text-slate-500">{product.category}</td>
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
                  <td colSpan={6} className="px-6 py-12 text-center text-slate-500">
                    <div className="flex flex-col items-center justify-center">
                      <AlertCircle size={48} className="mb-2 text-slate-300" />
                      <p>No products found matching your search.</p>
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
        title={editingProduct ? 'Edit Product' : 'Add New Product'}
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <Input 
            label="Product Name" 
            value={formData.name} 
            onChange={e => setFormData({...formData, name: e.target.value})} 
            required 
          />
          <Input 
            label="Category" 
            value={formData.category} 
            onChange={e => setFormData({...formData, category: e.target.value})} 
            required 
          />
          <div className="grid grid-cols-2 gap-4">
            <Input 
              label="Selling Price ($)" 
              type="number" 
              step="0.01" 
              value={formData.price} 
              onChange={e => setFormData({...formData, price: e.target.value})} 
              required 
            />
            <Input 
              label="Cost Price ($)" 
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
            <Button type="submit" disabled={loading}>{editingProduct ? 'Save Changes' : 'Add Product'}</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};

export default Inventory;