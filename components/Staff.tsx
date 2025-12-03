import React, { useState } from 'react';
import { User, UserRole } from '../types';
import { Card, Button, Input, Modal } from './ui/LayoutComponents';
import { Trash2, UserPlus, Shield } from 'lucide-react';
import { createUser, deleteUser } from '../services/storageService';

interface StaffProps {
  staff: User[];
  shopId: string;
  refreshStaff: () => void;
}

const Staff: React.FC<StaffProps> = ({ staff, shopId, refreshStaff }) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [formData, setFormData] = useState({
    fullName: '',
    username: '',
    password: ''
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await createUser({
        fullName: formData.fullName,
        username: formData.username,
        passwordHash: formData.password,
        shopId: shopId,
        role: UserRole.SALES,
        email: '' // Not required for sales staff per requirement
      });
      refreshStaff(); // Triggers parent fetch
      setIsModalOpen(false);
      setFormData({ fullName: '', username: '', password: '' });
      setError('');
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (window.confirm('Remove this staff member access?')) {
      try {
        await deleteUser(id);
        refreshStaff();
      } catch (err: any) {
        alert("Failed to delete user: " + err.message);
      }
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-slate-800">Staff Management</h2>
          <p className="text-slate-500">Manage access for your shop employees</p>
        </div>
        <Button onClick={() => setIsModalOpen(true)}>
          <UserPlus size={20} className="mr-2 inline" />
          Add Sales Person
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {staff.map(user => (
          <Card key={user.id} className="relative group hover:shadow-md transition-shadow">
            <div className="flex items-start justify-between">
              <div className="flex items-center space-x-4">
                <div className={`w-12 h-12 rounded-full flex items-center justify-center text-lg font-bold text-white ${user.role === 'ADMIN' ? 'bg-purple-600' : 'bg-blue-500'}`}>
                  {user.fullName.charAt(0).toUpperCase()}
                </div>
                <div>
                  <h3 className="font-semibold text-slate-900">{user.fullName}</h3>
                  <p className="text-sm text-slate-500">@{user.username}</p>
                </div>
              </div>
              {user.role === 'ADMIN' ? (
                <Shield size={20} className="text-purple-600" title="Admin" />
              ) : (
                <button 
                  onClick={() => handleDelete(user.id)}
                  className="text-slate-300 hover:text-red-500 transition-colors"
                >
                  <Trash2 size={20} />
                </button>
              )}
            </div>
            <div className="mt-4 pt-4 border-t border-slate-100 flex justify-between items-center">
              <span className="px-3 py-1 bg-slate-100 text-slate-600 rounded-full text-xs font-medium">
                {user.role}
              </span>
              <span className="text-xs text-slate-400">ID: {user.id.substring(0,6)}</span>
            </div>
          </Card>
        ))}
      </div>

      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title="Add Sales Person">
        <form onSubmit={handleSubmit} className="space-y-4">
          {error && <div className="p-3 bg-red-100 text-red-700 text-sm rounded-lg">{error}</div>}
          <Input 
            label="Full Name" 
            value={formData.fullName} 
            onChange={e => setFormData({...formData, fullName: e.target.value})} 
            required 
          />
          <Input 
            label="Username" 
            value={formData.username} 
            onChange={e => setFormData({...formData, username: e.target.value})} 
            required 
          />
          <Input 
            label="Password" 
            type="password"
            value={formData.password} 
            onChange={e => setFormData({...formData, password: e.target.value})} 
            required 
          />
          <div className="flex justify-end pt-4">
            <Button type="submit" disabled={loading}>
                {loading ? 'Creating...' : 'Create Account'}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};

export default Staff;