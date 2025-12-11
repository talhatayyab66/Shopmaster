import React, { useMemo } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line, Legend } from 'recharts';
import { DollarSign, Package, AlertTriangle, TrendingUp, ChevronRight, PieChart } from 'lucide-react';
import { Sale, Product } from '../types';
import { Card } from './ui/LayoutComponents';

interface DashboardProps {
  sales: Sale[];
  products: Product[];
  currency: string;
  themeColorHex?: string;
  onNavigate: (view: 'inventory' | 'orders', filter?: 'low-stock') => void;
}

const StatCard = ({ title, value, icon: Icon, color, subtitle, onClick }: any) => (
  <Card 
    className="flex items-start justify-between cursor-pointer hover:shadow-md hover:scale-[1.02] transition-all duration-200 group relative overflow-hidden"
    children={
        <div onClick={onClick} className="w-full h-full flex items-start justify-between">
            <div className="z-10">
                <p className="text-sm font-medium text-slate-500 dark:text-slate-400 mb-1">{title}</p>
                <h3 className="text-2xl font-bold text-slate-900 dark:text-white">{value}</h3>
                {subtitle && <p className="text-xs text-slate-400 mt-1">{subtitle}</p>}
            </div>
            <div className={`p-3 rounded-lg ${color} shadow-sm group-hover:shadow-md transition-shadow`}>
                <Icon size={24} className="text-white" />
            </div>
            {/* Hover effect indicator */}
            <div className="absolute bottom-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-current to-transparent opacity-0 group-hover:opacity-20 transition-opacity" style={{ color: 'currentColor' }} />
        </div>
    } 
  />
);

const Dashboard: React.FC<DashboardProps> = ({ sales, products, currency, themeColorHex = '#3b82f6', onNavigate }) => {
  const stats = useMemo(() => {
    const totalRevenue = sales.reduce((acc, sale) => acc + sale.totalAmount, 0);
    const totalOrders = sales.length;
    const lowStockCount = products.filter(p => p.stock < p.minStockLevel).length;
    const totalProducts = products.reduce((acc, p) => acc + p.stock, 0);

    // Calculate Profit
    // Note: This uses current product cost. For historical accuracy, cost should be snapshot at sale time.
    let totalProfit = 0;
    sales.forEach(sale => {
      sale.items.forEach(item => {
        const product = products.find(p => p.id === item.productId);
        // If product deleted, we fallback to 0 cost which assumes 100% profit (best effort)
        // ideally we would store costPrice in SaleItem
        const cost = product ? product.costPrice : 0;
        totalProfit += (item.priceAtSale - cost) * item.quantity;
      });
    });

    return { totalRevenue, totalProfit, totalOrders, lowStockCount, totalProducts };
  }, [sales, products]);

  const salesData = useMemo(() => {
    const days = 7;
    const data = [];
    for (let i = days - 1; i >= 0; i--) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      const dateStr = date.toLocaleDateString();
      
      const daySales = sales.filter(s => new Date(s.timestamp).toLocaleDateString() === dateStr);
      const amount = daySales.reduce((acc, s) => acc + s.totalAmount, 0);
      
      let profit = 0;
      daySales.forEach(sale => {
        sale.items.forEach(item => {
           const product = products.find(p => p.id === item.productId);
           const cost = product ? product.costPrice : 0;
           profit += (item.priceAtSale - cost) * item.quantity;
        });
      });

      data.push({ name: dateStr.slice(0, 5), amount, profit });
    }
    return data;
  }, [sales, products]);

  return (
    <div className="space-y-6 pb-20 md:pb-0">
      {/* Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4 md:gap-6">
        <StatCard 
          title="Total Revenue" 
          value={`${currency}${stats.totalRevenue.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}`} 
          icon={DollarSign} 
          color="bg-blue-500"
          subtitle="All time sales"
          onClick={() => onNavigate('orders')}
        />
        <StatCard 
          title="Total Profit" 
          value={`${currency}${stats.totalProfit.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}`} 
          icon={PieChart} 
          color="bg-emerald-500"
          subtitle="Estimated Net Profit"
          onClick={() => onNavigate('orders')}
        />
        <StatCard 
          title="Total Orders" 
          value={stats.totalOrders} 
          icon={TrendingUp} 
          color="bg-purple-500"
          onClick={() => onNavigate('orders')}
        />
        <StatCard 
          title="Inventory Count" 
          value={stats.totalProducts} 
          icon={Package} 
          color="bg-indigo-500"
          onClick={() => onNavigate('inventory')}
        />
        <StatCard 
          title="Low Stock" 
          value={stats.lowStockCount} 
          icon={AlertTriangle} 
          color="bg-amber-500"
          subtitle="Items need reorder"
          onClick={() => onNavigate('inventory', 'low-stock')}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Revenue & Profit Chart */}
        <Card className="min-h-[300px]">
          <h3 className="text-lg font-semibold mb-4 text-slate-800 dark:text-white">Financial Trend (Last 7 Days)</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={salesData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="name" stroke="#64748b" fontSize={12} />
                <YAxis stroke="#64748b" fontSize={12} />
                <Tooltip 
                  contentStyle={{ backgroundColor: '#fff', borderRadius: '8px', border: '1px solid #e2e8f0' }}
                  labelStyle={{ color: '#64748b' }}
                />
                <Legend />
                <Line 
                    type="monotone" 
                    dataKey="amount" 
                    name="Revenue" 
                    stroke={themeColorHex} 
                    strokeWidth={2} 
                    activeDot={{ r: 6 }} 
                    dot={false}
                />
                <Line 
                    type="monotone" 
                    dataKey="profit" 
                    name="Profit" 
                    stroke="#10b981" // Emerald-500
                    strokeWidth={2} 
                    activeDot={{ r: 6 }} 
                    dot={false}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </Card>

        {/* Low Stock Alerts */}
        <Card>
          <div className="flex justify-between items-center mb-4">
             <h3 className="text-lg font-semibold text-slate-800 dark:text-white">Low Stock Alert</h3>
             <button 
                onClick={() => onNavigate('inventory', 'low-stock')}
                className="text-xs text-primary-600 dark:text-primary-400 hover:underline flex items-center"
             >
                View All <ChevronRight size={12} />
             </button>
          </div>
          <div className="overflow-y-auto max-h-64 pr-2">
            <table className="w-full text-sm text-left">
              <thead className="text-xs text-slate-500 uppercase bg-slate-50 dark:bg-slate-700 dark:text-slate-300 sticky top-0">
                <tr>
                  <th className="px-4 py-2 rounded-tl-lg">Item</th>
                  <th className="px-4 py-2">Stock</th>
                  <th className="px-4 py-2">Min</th>
                  <th className="px-4 py-2 rounded-tr-lg">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                {products
                  .filter(p => p.stock < p.minStockLevel)
                  .map(p => (
                    <tr 
                        key={p.id} 
                        onClick={() => onNavigate('inventory', 'low-stock')}
                        className="border-b border-slate-100 last:border-0 hover:bg-slate-50 dark:hover:bg-slate-700 cursor-pointer transition-colors"
                    >
                      <td className="px-4 py-3 font-medium text-slate-900 dark:text-white">
                          <div className="truncate max-w-[120px]" title={p.name}>{p.name}</div>
                      </td>
                      <td className="px-4 py-3 text-red-600 font-bold">{p.stock}</td>
                      <td className="px-4 py-3 text-slate-600 dark:text-slate-400">{p.minStockLevel}</td>
                      <td className="px-4 py-3">
                        <span className="px-2 py-1 bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400 rounded-full text-xs font-medium">Critical</span>
                      </td>
                    </tr>
                  ))}
                {products.filter(p => p.stock < p.minStockLevel).length === 0 && (
                  <tr>
                    <td colSpan={4} className="px-4 py-12 text-center text-slate-500 dark:text-slate-400">
                      <div className="flex flex-col items-center gap-2">
                          <CheckIcon size={24} className="text-green-500" />
                          <span>All stock levels are healthy!</span>
                      </div>
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

const CheckIcon = ({ size, className }: { size: number, className: string }) => (
    <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}><polyline points="20 6 9 17 4 12"></polyline></svg>
)

export default Dashboard;