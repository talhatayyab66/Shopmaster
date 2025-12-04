import React, { useState } from 'react';
import { User, Shop } from '../types';
import { Card, Button, Input } from './ui/LayoutComponents';
import { createShop, loginUser } from '../services/storageService';
import { Store, MailCheck, ArrowLeft } from 'lucide-react';

interface AuthProps {
  onLogin: (user: User, shop: Shop) => void;
}

const Auth: React.FC<AuthProps> = ({ onLogin }) => {
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [verificationSent, setVerificationSent] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  // Login State (Identifier can be Username or Email)
  const [loginData, setLoginData] = useState({ identifier: '', password: '' });

  // Register State
  const [regData, setRegData] = useState({
    shopName: '',
    adminName: '',
    username: '',
    email: '',
    password: ''
  });

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      // Logic handles both Supabase Auth (Email) and Staff Auth (Username)
      const result = await loginUser(loginData.identifier, loginData.password);
      if (result) {
        onLogin(result.user, result.shop);
      } else {
        // If result is null, it means no user found or auth failed silently (for staff/username flow)
        setError('Invalid credentials or user not found. If you are a new Shop Admin, please try logging in with your Email address for the first time.');
      }
    } catch (err: any) {
      // This will catch "Email not confirmed" errors from Supabase
      setError(err.message || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const { shop, user, confirmationRequired } = await createShop(regData.shopName, {
        fullName: regData.adminName,
        username: regData.username,
        email: regData.email,
        password: regData.password
      });

      if (confirmationRequired) {
        setVerificationSent(true);
      } else {
        // If no email confirmation required (e.g. dev mode), login immediately
        onLogin(user, shop);
      }
    } catch (err: any) {
      setError(err.message || 'Registration failed');
    } finally {
      setLoading(false);
    }
  };

  if (verificationSent) {
    return (
      <div className="min-h-screen bg-slate-100 flex items-center justify-center p-4">
        <div className="max-w-md w-full">
          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold text-slate-900">ShopMaster AI</h1>
          </div>
          <Card className="shadow-xl border-0 p-8 text-center">
            <div className="w-16 h-16 bg-green-100 text-green-600 rounded-full flex items-center justify-center mx-auto mb-6">
               <MailCheck size={32} />
            </div>
            <h2 className="text-2xl font-bold text-slate-900 mb-2">Check Your Email</h2>
            <p className="text-slate-600 mb-6 leading-relaxed">
              We have sent a confirmation link to <br/>
              <span className="font-semibold text-slate-800">{regData.email}</span>.
            </p>
            <p className="text-sm text-slate-500 mb-8">
              Please check your inbox and click the link to verify your account. Once verified, you can log in to your shop.
            </p>
            <Button 
              className="w-full flex items-center justify-center gap-2" 
              onClick={() => { setVerificationSent(false); setMode('login'); }}
            >
              <ArrowLeft size={18} />
              Back to Login
            </Button>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-100 flex items-center justify-center p-4">
      <div className="max-w-md w-full">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-primary-600 rounded-2xl mb-4 shadow-lg shadow-primary-600/30">
            <Store className="text-white" size={32} />
          </div>
          <h1 className="text-3xl font-bold text-slate-900">ShopMaster AI</h1>
          <p className="text-slate-500 mt-2">Intelligent Inventory Management</p>
        </div>

        <Card className="shadow-xl border-0">
          <div className="flex border-b border-slate-100 mb-6">
            <button
              className={`flex-1 py-3 text-sm font-medium border-b-2 transition-colors ${mode === 'login' ? 'border-primary-600 text-primary-600' : 'border-transparent text-slate-400 hover:text-slate-600'}`}
              onClick={() => { setMode('login'); setError(''); }}
            >
              Log In
            </button>
            <button
              className={`flex-1 py-3 text-sm font-medium border-b-2 transition-colors ${mode === 'register' ? 'border-primary-600 text-primary-600' : 'border-transparent text-slate-400 hover:text-slate-600'}`}
              onClick={() => { setMode('register'); setError(''); }}
            >
              Create Shop
            </button>
          </div>

          {error && (
            <div className="mb-4 p-3 bg-red-50 text-red-600 text-sm rounded-lg border border-red-100 animate-[shake_0.5s_ease-in-out]">
              {error}
            </div>
          )}

          {mode === 'login' ? (
            <form onSubmit={handleLogin} className="space-y-4">
              <Input
                label="Email (Admin) or Username (Staff)"
                value={loginData.identifier}
                onChange={e => setLoginData({...loginData, identifier: e.target.value})}
                required
                placeholder="Enter email or username"
              />
              <Input
                label="Password"
                type="password"
                value={loginData.password}
                onChange={e => setLoginData({...loginData, password: e.target.value})}
                required
                placeholder="Enter password"
              />
              <Button type="submit" className="w-full py-3" disabled={loading}>
                {loading ? 'Authenticating...' : 'Access Shop'}
              </Button>
            </form>
          ) : (
            <form onSubmit={handleRegister} className="space-y-4">
              <Input
                label="Shop Name"
                placeholder="e.g., Downtown Electronics"
                value={regData.shopName}
                onChange={e => setRegData({...regData, shopName: e.target.value})}
                required
              />
              <div className="grid grid-cols-2 gap-4">
                <Input
                  label="Admin Name"
                  placeholder="John Doe"
                  value={regData.adminName}
                  onChange={e => setRegData({...regData, adminName: e.target.value})}
                  required
                />
                <Input
                  label="Username"
                  placeholder="admin_john"
                  value={regData.username}
                  onChange={e => setRegData({...regData, username: e.target.value})}
                  required
                />
              </div>
              <Input
                label="Email"
                type="email"
                placeholder="admin@example.com"
                value={regData.email}
                onChange={e => setRegData({...regData, email: e.target.value})}
                required
              />
              <Input
                label="Password"
                type="password"
                value={regData.password}
                onChange={e => setRegData({...regData, password: e.target.value})}
                required
              />
              <Button type="submit" className="w-full py-3" disabled={loading}>
                 {loading ? 'Creating...' : 'Create Shop Account'}
              </Button>
            </form>
          )}
        </Card>
      </div>
    </div>
  );
};

export default Auth;