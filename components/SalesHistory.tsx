import React, { useState } from 'react';
import { Search, FileText, Calendar, User as UserIcon, Package, ArrowUpRight, Download } from 'lucide-react';
import { Sale, Shop } from '../types';
import { Card, Button, Input } from './ui/LayoutComponents';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';

interface SalesHistoryProps {
  sales: Sale[];
  shop: Shop;
  currency: string;
}

const SalesHistory: React.FC<SalesHistoryProps> = ({ sales, shop, currency }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedSale, setSelectedSale] = useState<Sale | null>(null);

  const filteredSales = sales.filter(sale => 
    sale.invoiceId.toLowerCase().includes(searchTerm.toLowerCase()) ||
    sale.sellerName.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (sale.patientName && sale.patientName.toLowerCase().includes(searchTerm.toLowerCase())) ||
    (sale.customerName && sale.customerName.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  const formatDate = (timestamp: number) => {
    return new Date(timestamp).toLocaleString(undefined, {
      dateStyle: 'medium',
      timeStyle: 'short'
    });
  };

  const generateDailyReport = async () => {
      const doc = new jsPDF();
      const today = new Date().toLocaleDateString();
      const reportDate = new Date();
      
      doc.setFontSize(18);
      doc.text(`${shop.name} - Daily Sales Report`, 14, 20);
      doc.setFontSize(10);
      doc.text(`Date: ${today}`, 14, 26);
      doc.text(`Type: ${shop.businessType}`, 14, 32);

      // Filter sales for today (roughly)
      const todaySales = sales.filter(s => new Date(s.timestamp).toLocaleDateString() === today);
      
      const tableData = todaySales.map(s => {
          let extra = '';
          if (s.patientName) extra = `Pt: ${s.patientName}`;
          else if (s.customerName) extra = `Cust: ${s.customerName}`;
          
          return [
              s.invoiceId,
              new Date(s.timestamp).toLocaleTimeString(),
              extra,
              s.items.length.toString(),
              `${currency}${s.totalAmount.toFixed(2)}`
          ];
      });

      autoTable(doc, {
          startY: 40,
          head: [['Invoice', 'Time', 'Details', 'Items', 'Amount']],
          body: tableData,
          foot: [['', '', '', 'Total Revenue', `${currency}${todaySales.reduce((a,c) => a + c.totalAmount, 0).toFixed(2)}`]]
      });

      doc.save(`daily_report_${today.replace(/\//g, '-')}.pdf`);
  };

  const handleReprint = async (sale: Sale) => {
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
    
    // Attempt to add logo
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
    doc.text(`Invoice #: ${sale.invoiceId}`, 14, metaStartY);
    doc.text(`Date: ${new Date(sale.timestamp).toLocaleString()}`, 14, metaStartY + 6);
    doc.text(`Cashier: ${sale.sellerName}`, 14, metaStartY + 12);
    
    let customY = metaStartY + 18;
    if (sale.patientName) {
         doc.text(`Patient: ${sale.patientName}`, 14, customY);
         customY += 6;
    }
    if (sale.diagnosis) {
         doc.text(`Diagnosis: ${sale.diagnosis}`, 14, customY);
         customY += 6;
    }
    if (sale.customerName) {
         doc.text(`Customer: ${sale.customerName}`, 14, customY);
         customY += 6;
    }
    
    doc.text(`Status: Paid`, 14, customY);

    const tableData = sale.items.map(item => [
      item.productName,
      item.quantity.toString(),
      `${currency}${item.priceAtSale.toFixed(2)}`,
      `${currency}${item.subtotal.toFixed(2)}`
    ]);

    autoTable(doc, {
      startY: customY + 10,
      head: [['Item', 'Qty', 'Price', 'Total']],
      body: tableData,
      theme: 'grid',
      headStyles: { fillColor: [59, 130, 246] },
      styles: { fontSize: 10 },
    });

    const finalY = (doc as any).lastAutoTable.finalY + 10;
    doc.setFontSize(14);
    doc.setFont("helvetica", "bold");
    doc.text(`Total Amount: ${currency}${sale.totalAmount.toFixed(2)}`, 140, finalY);

    doc.save(`invoice_${sale.invoiceId}.pdf`);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-800 dark:text-white">Order History</h2>
          <p className="text-slate-500 dark:text-slate-400">View past dispensed items and sales</p>
        </div>
        <div className="flex gap-2 w-full sm:w-auto">
             <Button variant="secondary" onClick={generateDailyReport} className="whitespace-nowrap">
                 <Download size={16} className="mr-2 inline" /> Daily Report
             </Button>
            <div className="relative w-full sm:w-auto min-w-[250px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
              <input
                type="text"
                placeholder="Search invoice, patient or cashier..."
                className="w-full pl-10 pr-4 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-primary-500"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Sales List */}
        <div className="lg:col-span-2 space-y-4">
            <Card className="p-0 overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-sm text-left">
                        <thead className="bg-slate-50 dark:bg-slate-900 border-b border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400">
                            <tr>
                                <th className="px-6 py-4 font-medium">Invoice Info</th>
                                <th className="px-6 py-4 font-medium">Customer / Patient</th>
                                <th className="px-6 py-4 font-medium">Items</th>
                                <th className="px-6 py-4 font-medium">Total</th>
                                <th className="px-6 py-4 font-medium text-right">Action</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                            {filteredSales.map((sale) => (
                                <tr 
                                    key={sale.id} 
                                    onClick={() => setSelectedSale(sale)}
                                    className={`cursor-pointer transition-colors ${selectedSale?.id === sale.id ? 'bg-primary-50 dark:bg-primary-900/20' : 'hover:bg-slate-50 dark:hover:bg-slate-800'}`}
                                >
                                    <td className="px-6 py-4">
                                        <div className="flex items-center gap-3">
                                            <div className="p-2 bg-blue-100 text-blue-600 rounded-lg dark:bg-blue-900/30 dark:text-blue-400">
                                                <FileText size={18} />
                                            </div>
                                            <div>
                                                <p className="font-medium text-slate-900 dark:text-white">{sale.invoiceId}</p>
                                                <div className="flex items-center text-xs text-slate-500 dark:text-slate-400 gap-2 mt-0.5">
                                                    <Calendar size={12} />
                                                    <span>{new Date(sale.timestamp).toLocaleDateString()}</span>
                                                </div>
                                            </div>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 text-slate-700 dark:text-slate-300">
                                        {sale.patientName ? sale.patientName : (sale.customerName || 'Walk-in')}
                                    </td>
                                    <td className="px-6 py-4">
                                        <div className="flex items-center gap-1 text-slate-600 dark:text-slate-300">
                                            <Package size={16} />
                                            <span>{sale.items.reduce((acc, item) => acc + item.quantity, 0)} items</span>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 font-bold text-slate-900 dark:text-white">
                                        {currency}{sale.totalAmount.toFixed(2)}
                                    </td>
                                    <td className="px-6 py-4 text-right">
                                        <ArrowUpRight size={18} className="text-slate-400 inline" />
                                    </td>
                                </tr>
                            ))}
                            {filteredSales.length === 0 && (
                                <tr>
                                    <td colSpan={5} className="px-6 py-12 text-center text-slate-400">
                                        No records found.
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </Card>
        </div>

        {/* Invoice Details Sidebar */}
        <div className="lg:col-span-1">
            {selectedSale ? (
                <Card className="sticky top-6 animate-[fadeIn_0.2s_ease-out]">
                    <div className="flex justify-between items-start mb-6 border-b border-slate-100 dark:border-slate-700 pb-4">
                        <div>
                            <h3 className="font-bold text-lg text-slate-900 dark:text-white">Details</h3>
                            <p className="text-sm text-primary-600 dark:text-primary-400">{selectedSale.invoiceId}</p>
                        </div>
                        <Button variant="secondary" onClick={() => handleReprint(selectedSale)} className="text-xs">
                             Reprint
                        </Button>
                    </div>

                    <div className="space-y-4 mb-6">
                        <div className="flex justify-between text-sm">
                            <span className="text-slate-500 dark:text-slate-400">Date</span>
                            <span className="font-medium text-slate-900 dark:text-white">{formatDate(selectedSale.timestamp)}</span>
                        </div>
                        <div className="flex justify-between text-sm">
                            <span className="text-slate-500 dark:text-slate-400">Cashier</span>
                            <span className="font-medium text-slate-900 dark:text-white">{selectedSale.sellerName}</span>
                        </div>
                        
                        {/* Dynamic fields */}
                        {selectedSale.patientName && (
                             <div className="flex justify-between text-sm">
                                <span className="text-slate-500 dark:text-slate-400">Patient</span>
                                <span className="font-medium text-slate-900 dark:text-white">{selectedSale.patientName}</span>
                            </div>
                        )}
                         {selectedSale.diagnosis && (
                             <div className="flex justify-between text-sm">
                                <span className="text-slate-500 dark:text-slate-400">Diagnosis</span>
                                <span className="font-medium text-slate-900 dark:text-white truncate max-w-[150px]" title={selectedSale.diagnosis}>{selectedSale.diagnosis}</span>
                            </div>
                        )}
                        {selectedSale.customerName && !selectedSale.patientName && (
                             <div className="flex justify-between text-sm">
                                <span className="text-slate-500 dark:text-slate-400">Customer</span>
                                <span className="font-medium text-slate-900 dark:text-white">{selectedSale.customerName}</span>
                            </div>
                        )}
                         {selectedSale.customerContact && (
                             <div className="flex justify-between text-sm">
                                <span className="text-slate-500 dark:text-slate-400">Contact</span>
                                <span className="font-medium text-slate-900 dark:text-white">{selectedSale.customerContact}</span>
                            </div>
                        )}
                    </div>

                    <div className="space-y-3 mb-6">
                        <p className="text-xs font-semibold uppercase text-slate-400 tracking-wider">Items Dispensed</p>
                        {selectedSale.items.map((item, idx) => (
                            <div key={idx} className="flex justify-between items-center text-sm">
                                <div>
                                    <p className="text-slate-800 dark:text-white font-medium">{item.productName}</p>
                                    <p className="text-xs text-slate-500">{item.quantity} x {currency}{item.priceAtSale.toFixed(2)}</p>
                                </div>
                                <span className="font-medium text-slate-900 dark:text-white">
                                    {currency}{item.subtotal.toFixed(2)}
                                </span>
                            </div>
                        ))}
                    </div>

                    <div className="pt-4 border-t border-slate-100 dark:border-slate-700 flex justify-between items-center">
                        <span className="font-bold text-slate-800 dark:text-white">Total</span>
                        <span className="font-bold text-xl text-primary-600 dark:text-primary-400">
                            {currency}{selectedSale.totalAmount.toFixed(2)}
                        </span>
                    </div>
                </Card>
            ) : (
                <div className="h-full flex flex-col items-center justify-center p-8 text-center text-slate-400 border-2 border-dashed border-slate-200 dark:border-slate-700 rounded-xl bg-slate-50/50 dark:bg-slate-800/50 min-h-[300px]">
                    <FileText size={48} className="mb-4 opacity-20" />
                    <p>Select a record to view details.</p>
                </div>
            )}
        </div>
      </div>
    </div>
  );
};

export default SalesHistory;