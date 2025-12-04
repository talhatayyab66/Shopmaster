import React, { useState } from 'react';
import { Sparkles, Send } from 'lucide-react';
import { Card, Button } from './ui/LayoutComponents';
import { generateBusinessInsight } from '../services/geminiService';
import { Product, Sale } from '../types';
import ReactMarkdown from 'react-markdown';

interface AIAssistantProps {
  products: Product[];
  sales: Sale[];
}

const AIAssistant: React.FC<AIAssistantProps> = ({ products, sales }) => {
  const [query, setQuery] = useState('');
  const [response, setResponse] = useState('');
  const [loading, setLoading] = useState(false);

  const handleAsk = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim()) return;

    setLoading(true);
    setResponse('');
    
    const result = await generateBusinessInsight(products, sales, query);
    
    setResponse(result);
    setLoading(false);
  };

  const suggestions = [
    "What items are selling the best?",
    "Which products are low on stock?",
    "How can I increase my revenue based on recent trends?",
    "Write a promotional email for my best sellers."
  ];

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-center gap-3 mb-6">
        <div className="p-3 bg-gradient-to-br from-primary-500 to-purple-600 rounded-lg shadow-lg">
          <Sparkles className="text-white" size={24} />
        </div>
        <div>
          <h2 className="text-2xl font-bold text-slate-900">AI Business Advisor</h2>
          <p className="text-slate-500">Powered by Gemini - Ask about your inventory and sales.</p>
        </div>
      </div>

      <Card className="min-h-[400px] flex flex-col">
        <div className="flex-1 space-y-4 mb-6">
          {!response && !loading && (
            <div className="text-center py-12">
              <p className="text-slate-400 mb-6">Select a suggestion or type your own question below.</p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {suggestions.map((s, i) => (
                  <button 
                    key={i}
                    onClick={() => setQuery(s)}
                    className="p-4 text-sm text-slate-600 bg-slate-50 hover:bg-slate-100 rounded-lg border border-slate-200 text-left transition-colors"
                  >
                    "{s}"
                  </button>
                ))}
              </div>
            </div>
          )}

          {loading && (
            <div className="flex flex-col items-center justify-center py-12 space-y-4">
              <div className="w-8 h-8 border-4 border-primary-200 border-t-primary-600 rounded-full animate-spin"></div>
              <p className="text-slate-500 animate-pulse">Analyzing your business data...</p>
            </div>
          )}

          {response && (
            <div className="bg-slate-50 p-6 rounded-xl border border-slate-100 prose prose-slate max-w-none">
              <ReactMarkdown>{response}</ReactMarkdown>
            </div>
          )}
        </div>

        <form onSubmit={handleAsk} className="relative">
          <input
            type="text"
            className="w-full pl-4 pr-14 py-4 bg-white border border-slate-200 rounded-xl shadow-sm focus:ring-2 focus:ring-primary-500 outline-none"
            placeholder="Ask anything about your shop performance..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          <button 
            type="submit"
            disabled={loading || !query}
            className="absolute right-2 top-2 p-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
          >
            <Send size={20} />
          </button>
        </form>
      </Card>
    </div>
  );
};

export default AIAssistant;