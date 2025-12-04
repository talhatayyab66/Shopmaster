import React, { useState } from 'react';
import { User, Shop, UserRole } from '../types';
import { Card, Button, Input } from './ui/LayoutComponents';
import { updateShop, uploadShopLogo } from '../services/storageService';
import { Moon, Sun, Upload, Save, Store, Palette, SlidersHorizontal } from 'lucide-react';

interface SettingsProps {
  user: User;
  shop: Shop;
  refreshShop: () => void;
  isDarkMode: boolean;
  toggleTheme: () => void;
  themeColor: string;
  setThemeColor: (color: string) => void;
}

const Settings: React.FC<SettingsProps> = ({ 
  user, 
  shop, 
  refreshShop, 
  isDarkMode, 
  toggleTheme,
  themeColor,
  setThemeColor
}) => {
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    name: shop.name,
    address: shop.address || '',
    currency: shop.currency || '$'
  });
  const [logoFile, setLogoFile] = useState<File | null>(null);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const updates: any = {
        id: shop.id,
        name: formData.name,
        address: formData.address,
        currency: formData.currency
      };

      if (logoFile) {
        const url = await uploadShopLogo(shop.id, logoFile);
        updates.logoUrl = url;
      }

      await updateShop(updates);
      await refreshShop();
      alert('Shop settings updated successfully!');
    } catch (error: any) {
      console.error(error);
      alert('Failed to update shop: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <h2 className="text-2xl font-bold text-slate-900 dark:text-white">Settings</h2>

      {/* App Preferences */}
      <Card>
        <h3 className="text-lg font-semibold text-slate-800 dark:text-white mb-6">App Appearance</h3>
        
        {/* Dark Mode Toggle */}
        <div className="flex items-center justify-between mb-8 pb-8 border-b border-slate-100 dark:border-slate-700">
          <div className="flex items-center gap-3">
            <div className={`p-2 rounded-lg ${isDarkMode ? 'bg-slate-700' : 'bg-orange-100'}`}>
              {isDarkMode ? <Moon size={20} className="text-slate-200" /> : <Sun size={20} className="text-orange-500" />}
            </div>
            <div>
              <p className="font-medium text-slate-900 dark:text-white">Theme Mode</p>
              <p className="text-sm text-slate-500 dark:text-slate-400">Switch between light and dark themes</p>
            </div>
          </div>
          <Button variant="secondary" onClick={toggleTheme}>
            {isDarkMode ? 'Switch to Light' : 'Switch to Dark'}
          </Button>
        </div>

        {/* Color Theme Selector */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary-100 dark:bg-primary-900/30">
              <Palette size={20} className="text-primary-600 dark:text-primary-400" />
            </div>
            <div>
              <p className="font-medium text-slate-900 dark:text-white">Accent Color</p>
              <p className="text-sm text-slate-500 dark:text-slate-400">Pick any color from black to white</p>
            </div>
          </div>
          
          <div className="flex items-center gap-3 bg-slate-50 dark:bg-slate-700/50 p-2 rounded-xl border border-slate-200 dark:border-slate-600">
             <div className="relative overflow-hidden w-12 h-12 rounded-lg shadow-sm border border-slate-200 dark:border-slate-600 group">
                <input 
                  type="color" 
                  value={themeColor} 
                  onChange={(e) => setThemeColor(e.target.value)}
                  className="absolute -top-2 -left-2 w-16 h-16 cursor-pointer bg-transparent border-0 p-0"
                  title="Choose any color"
                />
             </div>
             <div className="hidden sm:block">
               <span className="text-xs text-slate-400 font-mono uppercase">{themeColor}</span>
             </div>
             <div className="text-slate-400">
                <SlidersHorizontal size={16} />
             </div>
          </div>
        </div>
      </Card>

      {/* Shop Settings - Admin Only */}
      {user.role === UserRole.ADMIN && (
        <Card>
          <div className="flex items-center gap-2 mb-6">
            <Store className="text-primary-600" size={24} />
            <h3 className="text-lg font-semibold text-slate-800 dark:text-white">Shop Configuration</h3>
          </div>
          
          <form onSubmit={handleSave} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <Input
                label="Shop Name"
                value={formData.name}
                onChange={e => setFormData({ ...formData, name: e.target.value })}
                required
              />
              <div className="space-y-1">
                <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Shop Currency</label>
                <select 
                  value={formData.currency}
                  onChange={e => setFormData({ ...formData, currency: e.target.value })}
                  className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-lg focus:ring-primary-500 outline-none text-slate-900 dark:text-white"
                >
                  <option value="$">USD ($)</option>
                  <option value="€">EUR (€)</option>
                  <option value="£">GBP (£)</option>
                  <option value="₹">INR (₹)</option>
                  <option value="¥">JPY (¥)</option>
                  <option value="PKR">PKR (Rs)</option>
                </select>
              </div>
            </div>

            <Input
              label="Shop Address"
              value={formData.address}
              onChange={e => setFormData({ ...formData, address: e.target.value })}
              placeholder="123 Main St, City, Country"
            />

            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Shop Logo</label>
              <div className="flex items-center gap-4">
                {(logoFile || shop.logoUrl) && (
                  <div className="w-16 h-16 rounded-lg border border-slate-200 dark:border-slate-700 overflow-hidden bg-slate-50 dark:bg-slate-900 flex items-center justify-center">
                    <img 
                      src={logoFile ? URL.createObjectURL(logoFile) : shop.logoUrl} 
                      alt="Logo" 
                      className="w-full h-full object-contain" 
                    />
                  </div>
                )}
                <label className="cursor-pointer">
                  <input 
                    type="file" 
                    accept="image/*" 
                    className="hidden" 
                    onChange={e => {
                      if (e.target.files?.[0]) setLogoFile(e.target.files[0]);
                    }}
                  />
                  <div className="flex items-center gap-2 px-4 py-2 bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 rounded-lg text-slate-700 dark:text-slate-200 transition-colors">
                    <Upload size={18} />
                    <span>{logoFile ? 'Change Logo' : 'Upload Logo'}</span>
                  </div>
                </label>
              </div>
            </div>

            <div className="pt-4 border-t border-slate-100 dark:border-slate-700 flex justify-end">
              <Button type="submit" disabled={loading}>
                <Save size={18} className="mr-2 inline" />
                {loading ? 'Saving...' : 'Save Changes'}
              </Button>
            </div>
          </form>
        </Card>
      )}
    </div>
  );
};

export default Settings;