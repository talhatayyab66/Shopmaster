import React, { useState, useEffect, useRef } from 'react';
import { Send, Image as ImageIcon, Paperclip } from 'lucide-react';
import { Message, User } from '../types';
import { getChatMessages, sendChatMessage, subscribeToChat } from '../services/storageService';
import { Card } from './ui/LayoutComponents';

interface ShopChatProps {
  user: User;
  shopId: string;
}

const ShopChat: React.FC<ShopChatProps> = ({ user, shopId }) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [selectedImage, setSelectedImage] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    // Initial fetch
    const fetchMessages = async () => {
      setLoading(true);
      try {
        const msgs = await getChatMessages(shopId);
        setMessages(msgs);
      } catch (error) {
        console.error("Failed to load messages", error);
      } finally {
        setLoading(false);
      }
    };

    fetchMessages();

    // Subscribe to realtime updates
    const subscription = subscribeToChat(shopId, (msg) => {
      setMessages((prev) => {
        // Prevent duplicate messages if optimistic update was used (not used here yet)
        if (prev.some(p => p.id === msg.id)) return prev;
        return [...prev, msg];
      });
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [shopId]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if ((!newMessage.trim() && !selectedImage) || sending) return;

    setSending(true);
    try {
      await sendChatMessage(shopId, user.id, user.fullName, newMessage, selectedImage || undefined);
      setNewMessage('');
      setSelectedImage(null);
    } catch (error) {
      console.error("Failed to send message", error);
      alert("Failed to send message");
    } finally {
      setSending(false);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setSelectedImage(e.target.files[0]);
    }
  };

  return (
    <div className="flex flex-col h-[calc(100vh-140px)] md:h-[calc(100vh-140px)]">
      <Card className="flex-1 flex flex-col p-0 overflow-hidden shadow-lg border-0">
        {/* Header */}
        <div className="p-4 bg-white border-b border-slate-100 flex justify-between items-center">
          <div>
            <h3 className="font-bold text-slate-800">Shop Team Chat</h3>
            <p className="text-xs text-slate-500">Real-time collaboration</p>
          </div>
          <div className="flex -space-x-2">
            {/* Avatars placeholder */}
            <div className="w-8 h-8 rounded-full bg-blue-500 flex items-center justify-center text-white text-xs ring-2 ring-white">T</div>
            <div className="w-8 h-8 rounded-full bg-purple-500 flex items-center justify-center text-white text-xs ring-2 ring-white">S</div>
          </div>
        </div>

        {/* Messages Area */}
        <div 
          ref={scrollRef}
          className="flex-1 overflow-y-auto p-4 space-y-4 bg-slate-50"
        >
          {loading && <div className="text-center text-slate-400 text-sm">Loading messages...</div>}
          
          {!loading && messages.length === 0 && (
            <div className="text-center text-slate-400 my-10">
              <p>No messages yet.</p>
              <p className="text-xs">Start the conversation with your team!</p>
            </div>
          )}

          {messages.map((msg) => {
            const isMe = msg.userId === user.id;
            return (
              <div key={msg.id} className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[80%] md:max-w-[60%] flex flex-col ${isMe ? 'items-end' : 'items-start'}`}>
                  <span className="text-[10px] text-slate-400 mb-1 px-1">{msg.userName}</span>
                  <div className={`p-3 rounded-2xl ${
                    isMe 
                      ? 'bg-blue-600 text-white rounded-tr-none' 
                      : 'bg-white text-slate-800 border border-slate-200 rounded-tl-none'
                  }`}>
                    {msg.imageUrl && (
                      <div className="mb-2 rounded-lg overflow-hidden">
                        <img src={msg.imageUrl} alt="Shared" className="max-w-full h-auto object-cover max-h-60" />
                      </div>
                    )}
                    {msg.content && <p className="text-sm">{msg.content}</p>}
                  </div>
                  <span className="text-[10px] text-slate-300 mt-1 px-1">
                    {new Date(msg.createdAt).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                  </span>
                </div>
              </div>
            );
          })}
        </div>

        {/* Input Area */}
        <div className="p-3 bg-white border-t border-slate-100">
          {selectedImage && (
             <div className="flex items-center gap-2 mb-2 p-2 bg-slate-50 rounded-lg">
                <ImageIcon size={16} className="text-blue-500"/>
                <span className="text-xs text-slate-600 truncate max-w-[200px]">{selectedImage.name}</span>
                <button onClick={() => setSelectedImage(null)} className="text-red-400 hover:text-red-600 ml-auto">&times;</button>
             </div>
          )}
          <form onSubmit={handleSend} className="flex items-center gap-2">
            <button 
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="p-2 text-slate-400 hover:text-blue-600 hover:bg-slate-50 rounded-full transition-colors"
            >
              <Paperclip size={20} />
            </button>
            <input 
              type="file" 
              ref={fileInputRef} 
              className="hidden" 
              accept="image/*"
              onChange={handleFileSelect}
            />
            <input
              type="text"
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              placeholder="Type a message..."
              className="flex-1 py-2 px-4 bg-slate-50 border border-slate-200 rounded-full focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all"
            />
            <button 
              type="submit"
              disabled={(!newMessage.trim() && !selectedImage) || sending}
              className="p-2 bg-blue-600 text-white rounded-full hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-md shadow-blue-200"
            >
              <Send size={18} />
            </button>
          </form>
        </div>
      </Card>
    </div>
  );
};

export default ShopChat;
