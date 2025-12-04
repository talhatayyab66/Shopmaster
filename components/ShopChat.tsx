import React, { useState, useEffect, useRef } from 'react';
import { Send, Image as ImageIcon, Paperclip, Loader2, Trash2 } from 'lucide-react';
import { Message, User } from '../types';
import { getChatMessages, sendChatMessage, subscribeToChat, deleteChatMessage } from '../services/storageService';
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
    const subscription = subscribeToChat(shopId, {
      onInsert: (msg) => {
        setMessages((prev) => {
          // Prevent duplicate messages if optimistic update was used
          if (prev.some(p => p.id === msg.id)) return prev;
          const updated = [...prev, msg];
          // Sort by time to be safe
          return updated.sort((a, b) => a.createdAt - b.createdAt);
        });
      },
      onDelete: (id) => {
        setMessages((prev) => prev.filter(m => m.id !== id));
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [shopId]);

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    if (scrollRef.current) {
      setTimeout(() => {
        if (scrollRef.current) {
          scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
      }, 100);
    }
  }, [messages]);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if ((!newMessage.trim() && !selectedImage) || sending) return;

    setSending(true);
    try {
      await sendChatMessage(shopId, user.id, user.fullName, newMessage, selectedImage || undefined);
      
      // Reset form
      setNewMessage('');
      setSelectedImage(null);
      if (fileInputRef.current) {
        fileInputRef.current.value = ''; // Reset file input DOM element
      }
    } catch (error: any) {
      console.error("Failed to send message", error);
      alert(`Failed to send message: ${error.message}`);
    } finally {
      setSending(false);
    }
  };

  const handleDelete = async (messageId: string) => {
    if (!window.confirm("Are you sure you want to delete this message?")) return;
    try {
      await deleteChatMessage(messageId);
    } catch (error: any) {
      console.error("Failed to delete message", error);
      alert("Failed to delete message");
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
        <div className="p-4 bg-white dark:bg-slate-800 border-b border-slate-100 dark:border-slate-700 flex justify-between items-center">
          <div>
            <h3 className="font-bold text-slate-800 dark:text-white">Shop Team Chat</h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">Real-time collaboration</p>
          </div>
          <div className="flex -space-x-2">
            <div className="w-8 h-8 rounded-full bg-blue-500 flex items-center justify-center text-white text-xs ring-2 ring-white dark:ring-slate-800">T</div>
            <div className="w-8 h-8 rounded-full bg-purple-500 flex items-center justify-center text-white text-xs ring-2 ring-white dark:ring-slate-800">S</div>
          </div>
        </div>

        {/* Messages Area */}
        <div 
          ref={scrollRef}
          className="flex-1 overflow-y-auto p-4 space-y-4 bg-slate-50 dark:bg-slate-900/50"
        >
          {loading && (
            <div className="flex justify-center items-center h-full">
              <Loader2 className="animate-spin text-blue-500" size={24} />
            </div>
          )}
          
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
                <div className={`max-w-[85%] md:max-w-[70%] flex flex-col ${isMe ? 'items-end' : 'items-start'}`}>
                  <span className="text-[10px] text-slate-400 mb-1 px-1">{msg.userName}</span>
                  <div className={`relative group p-3 rounded-2xl shadow-sm ${
                    isMe 
                      ? 'bg-blue-600 text-white rounded-tr-none' 
                      : 'bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 border border-slate-200 dark:border-slate-700 rounded-tl-none'
                  }`}>
                    {/* Delete Button */}
                    {isMe && (
                      <button
                        onClick={() => handleDelete(msg.id)}
                        className="absolute -top-2 -right-2 p-1 bg-red-500 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity shadow-sm hover:bg-red-600 focus:opacity-100"
                        title="Delete message"
                      >
                        <Trash2 size={12} />
                      </button>
                    )}

                    {msg.imageUrl && (
                      <div className="mb-2 rounded-lg overflow-hidden bg-black/10">
                        <img 
                          src={msg.imageUrl} 
                          alt="Shared" 
                          className="max-w-full h-auto object-cover max-h-60" 
                          loading="lazy"
                          onLoad={() => {
                            // Scroll when image loads
                            if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
                          }}
                        />
                      </div>
                    )}
                    {msg.content && <p className="text-sm break-words whitespace-pre-wrap">{msg.content}</p>}
                  </div>
                  <span className="text-[10px] text-slate-400 mt-1 px-1">
                    {new Date(msg.createdAt).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                  </span>
                </div>
              </div>
            );
          })}
        </div>

        {/* Input Area */}
        <div className="p-3 bg-white dark:bg-slate-800 border-t border-slate-100 dark:border-slate-700">
          {selectedImage && (
             <div className="flex items-center gap-2 mb-2 p-2 bg-slate-50 dark:bg-slate-700 rounded-lg animate-[fadeIn_0.2s_ease-out]">
                <ImageIcon size={16} className="text-blue-500"/>
                <span className="text-xs text-slate-600 dark:text-slate-300 truncate max-w-[200px]">{selectedImage.name}</span>
                <button 
                  onClick={() => {
                    setSelectedImage(null);
                    if (fileInputRef.current) fileInputRef.current.value = '';
                  }} 
                  className="text-red-400 hover:text-red-600 ml-auto p-1"
                >
                  &times;
                </button>
             </div>
          )}
          <form onSubmit={handleSend} className="flex items-center gap-2">
            <button 
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="p-2 text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-slate-50 dark:hover:bg-slate-700 rounded-full transition-colors"
              title="Attach Image"
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
              className="flex-1 py-2 px-4 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-600 rounded-full focus:outline-none focus:ring-2 focus:ring-blue-500 dark:text-white transition-all"
            />
            <button 
              type="submit"
              disabled={(!newMessage.trim() && !selectedImage) || sending}
              className="p-2 bg-blue-600 text-white rounded-full hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-md shadow-blue-200 dark:shadow-none flex items-center justify-center min-w-[40px]"
            >
              {sending ? <Loader2 size={18} className="animate-spin" /> : <Send size={18} />}
            </button>
          </form>
        </div>
      </Card>
    </div>
  );
};

export default ShopChat;