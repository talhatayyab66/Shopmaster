import React, { useMemo } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line } from 'recharts';
import { DollarSign, Package, AlertTriangle, TrendingUp } from 'lucide-react';
import { Sale, Product } from '../types';
import { Card } from './ui/LayoutComponents';

interface DashboardProps {
  sales: Sale[];
  products: Product[];
}

const StatCard = ({ title, value, icon: Icon, color, subtitle }: any) => (
  <Card className="flex items-start justify-between">
    <div>
      <p className="text-sm font-medium text-slate-500 mb-1">{title}</p>
      <h3 className="text-2xl font-bold text-slate-900">{value}</h3>
      {subtitle && <p className="text-xs text-slate-400 mt-1">{subtitle}</p>}
    </div>
    <div className={`p-3 rounded-lg ${color}`}>
      <Icon size={24} className="text-white" />
    </div>
  </Card>
);

const Dashboard: React.FC<DashboardProps> = ({ sales, products }) => {
  const stats = useMemo(() => {
    const totalRevenue = sales.reduce((acc, sale) => acc + sale.totalAmount, 0);
    const totalOrders = sales.length;
    const lowStockCount = products.filter(p => p.stock < p.minStockLevel).length;
    const totalProducts = products.reduce((acc, p) => acc + p.stock, 0);

    return { totalRevenue, totalOrders, lowStockCount, totalProducts };
  }, [sales, products]);

  const salesData = useMemo(() => {
    // Group sales by day (last 7 days)
    const days = 7;
    const data = [];
    for (let i = days - 1; i >= 0; i--) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      const dateStr = date.toLocaleDateString();
      
      const daySales = sales.filter(s => new Date(s.timestamp).toLocaleDateString() === dateStr);
      const amount = daySales.reduce((acc, s) => acc + s.totalAmount, 0);
      
      data.push({ name: dateStr.slice(0, 5), amount });
    }
    return data;
  }, [sales]);

  return (
    <div className="space-y-6 pb-20 md:pb-0">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
        <StatCard 
          title="Total Revenue" 
          value={`$${stats.totalRevenue.toLocaleString()}`} 
          icon={DollarSign} 
          color="bg-emerald-500"
          subtitle="All time"
        />
        <StatCard 
          title="Total Orders" 
          value={stats.totalOrders} 
          icon={TrendingUp} 
          color="bg-blue-500"
        />
        <StatCard 
          title="Products in Stock" 
          value={stats.totalProducts} 
          icon={Package} 
          color="bg-indigo-500"
        />
        <StatCard 
          title="Low Stock Items" 
          value={stats.lowStockCount} 
          icon={AlertTriangle} 
          color="bg-amber-500"
          subtitle="Requires attention"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="min-h-[300px]">
          <h3 className="text-lg font-semibold mb-4">Sales Trend (Last 7 Days)</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={salesData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="name" stroke="#64748b" fontSize={12} />
                <YAxis stroke="#64748b" fontSize={12} />
                <Tooltip 
                  contentStyle={{ backgroundColor: '#fff', borderRadius: '8px', border: '1px solid #e2e8f0' }}
                />
                <Line type="monotone" dataKey="amount" stroke="#3b82f6" strokeWidth={2} activeDot={{ r: 8 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card>
          <h3 className="text-lg font-semibold mb-4">Low Stock Alert</h3>
          <div className="overflow-y-auto max-h-64">
            <table className="w-full text-sm text-left">
              <thead className="text-xs text-slate-500 uppercase bg-slate-50">
                <tr>
                  <th className="px-4 py-2">Item</th>
                  <th className="px-4 py-2">Stock</th>
                  <th className="px-4 py-2">Min</th>
                  <th className="px-4 py-2">Status</th>
                </tr>
              </thead>
              <tbody>
                {products
                  .filter(p => p.stock < p.minStockLevel)
                  .map(p => (
                    <tr key={p.id} className="border-b border-slate-100 last:border-0 hover:bg-slate-50">
                      <td className="px-4 py-2 font-medium">{p.name}</td>
                      <td className="px-4 py-2 text-red-600 font-bold">{p.stock}</td>
                      <td className="px-4 py-2">{p.minStockLevel}</td>
                      <td className="px-4 py-2">
                        <span className="px-2 py-1 bg-red-100 text-red-700 rounded-full text-xs">Critical</span>
                      </td>
                    </tr>
                  ))}
                {products.filter(p => p.stock < p.minStockLevel).length === 0 && (
                  <tr>
                    <td colSpan={4} className="px-4 py-8 text-center text-slate-500">
                      All stock levels are healthy!
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </Card>
      </div>
    </div>
  );
};

export default Dashboard;
