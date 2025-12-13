import React, { useState } from 'react';
import { User, Shop, BusinessType } from '../types';
import { Card, Button, Input } from './ui/LayoutComponents';
import { createShop, loginUser, sendPasswordResetEmail } from '../services/storageService';
import { Store, MailCheck, ArrowLeft, Stethoscope, Pill, Utensils, Monitor, ShoppingCart, KeyRound } from 'lucide-react';

interface AuthProps {
  onLogin: (user: User, shop: Shop) => void;
}

const Auth: React.FC<AuthProps> = ({ onLogin }) => {
  const [mode, setMode] = useState<'login' | 'register' | 'forgot-password'>('login');
  const [verificationSent, setVerificationSent] = useState(false);
  const [resetEmailSent, setResetEmailSent] = useState(false);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [loading, setLoading] = useState(false);

  // Login State (Identifier can be Username or Email)
  const [loginData, setLoginData] = useState({ identifier: '', password: '' });

  // Forgot Password State
  const [forgotEmail, setForgotEmail] = useState('');

  // Register State
  const [regData, setRegData] = useState({
    shopName: '',
    businessType: 'SHOP' as BusinessType,
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
        setError('Invalid credentials or user not found. If you are a new Admin, please try logging in with your Email address for the first time.');
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
      const { shop, user, confirmationRequired } = await createShop(regData.shopName, regData.businessType, {
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

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccessMsg('');
    if (!forgotEmail) return;

    setLoading(true);
    try {
      await sendPasswordResetEmail(forgotEmail);
      setResetEmailSent(true);
      setSuccessMsg(`Password reset link sent to ${forgotEmail}`);
    } catch (err: any) {
      setError(err.message || 'Failed to send reset email');
    } finally {
      setLoading(false);
    }
  };

  if (verificationSent) {
    return (
      <div className="min-h-screen bg-slate-100 flex items-center justify-center p-4">
        <div className="max-w-md w-full">
          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold text-slate-900">POS PRO</h1>
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
          <div className="inline-flex items-center justify-center w-20 h-20 bg-gradient-to-br from-primary-500 to-primary-700 rounded-2xl mb-6 shadow-xl shadow-primary-500/20 relative">
            <Monitor className="text-white" size={42} />
            <div className="absolute -bottom-2 -right-2 bg-white rounded-full p-2 shadow-md border-2 border-slate-50">
               <ShoppingCart className="text-primary-600" size={20} />
            </div>
          </div>
          <h1 className="text-3xl font-bold text-slate-900">POS PRO</h1>
          <p className="text-slate-500 mt-2">Intelligent Management System</p>
        </div>

        <Card className="shadow-xl border-0">
          <div className="flex border-b border-slate-100 mb-6">
            <button
              className={`flex-1 py-3 text-sm font-medium border-b-2 transition-colors ${mode === 'login' ? 'border-primary-600 text-primary-600' : 'border-transparent text-slate-400 hover:text-slate-600'}`}
              onClick={() => { setMode('login'); setError(''); setSuccessMsg(''); }}
            >
              Log In
            </button>
            <button
              className={`flex-1 py-3 text-sm font-medium border-b-2 transition-colors ${mode === 'register' ? 'border-primary-600 text-primary-600' : 'border-transparent text-slate-400 hover:text-slate-600'}`}
              onClick={() => { setMode('register'); setError(''); setSuccessMsg(''); }}
            >
              Create Account
            </button>
          </div>

          {error && (
            <div className="mb-4 p-3 bg-red-50 text-red-600 text-sm rounded-lg border border-red-100 animate-[shake_0.5s_ease-in-out]">
              {error}
            </div>
          )}

          {successMsg && (
            <div className="mb-4 p-3 bg-green-50 text-green-600 text-sm rounded-lg border border-green-100">
              {successMsg}
            </div>
          )}

          {mode === 'login' && (
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
              <div className="flex justify-end">
                <button 
                  type="button" 
                  onClick={() => { setMode('forgot-password'); setError(''); setSuccessMsg(''); }}
                  className="text-sm text-primary-600 hover:text-primary-700 font-medium"
                >
                  Forgot Password?
                </button>
              </div>
              <Button type="submit" className="w-full py-3" disabled={loading}>
                {loading ? 'Authenticating...' : 'Access System'}
              </Button>
            </form>
          )}

          {mode === 'forgot-password' && (
             <div className="space-y-6 animate-[fadeIn_0.3s_ease-out]">
               <div className="text-center">
                  <div className="w-12 h-12 bg-primary-100 text-primary-600 rounded-full flex items-center justify-center mx-auto mb-3">
                     <KeyRound size={24} />
                  </div>
                  <h3 className="text-lg font-bold text-slate-800">Reset Password</h3>
                  <p className="text-sm text-slate-500 mt-1">Enter your admin email address to receive a password reset link.</p>
               </div>

               {!resetEmailSent ? (
                  <form onSubmit={handleForgotPassword} className="space-y-4">
                    <Input
                      label="Admin Email"
                      type="email"
                      value={forgotEmail}
                      onChange={e => setForgotEmail(e.target.value)}
                      required
                      placeholder="admin@example.com"
                      autoFocus
                    />
                    <Button type="submit" className="w-full py-3" disabled={loading}>
                      {loading ? 'Sending Link...' : 'Send Reset Link'}
                    </Button>
                  </form>
               ) : (
                  <div className="p-4 bg-slate-50 rounded-lg text-sm text-slate-600 text-center">
                    Check your email for the reset link. Once you click it, you'll be redirected back here to set a new password.
                  </div>
               )}

               <button 
                  type="button"
                  onClick={() => { setMode('login'); setResetEmailSent(false); setError(''); }}
                  className="w-full text-sm text-slate-500 hover:text-slate-800 flex items-center justify-center gap-2"
               >
                 <ArrowLeft size={16} /> Back to Login
               </button>
             </div>
          )}

          {mode === 'register' && (
            <form onSubmit={handleRegister} className="space-y-4">
              <div>
                <label className="mb-1 text-sm font-medium text-slate-700">Business Type</label>
                <div className="grid grid-cols-2 gap-2 mt-1">
                   {['SHOP', 'CLINIC', 'PHARMACY', 'RESTAURANT'].map((type) => (
                      <button
                        key={type}
                        type="button"
                        onClick={() => setRegData({...regData, businessType: type as BusinessType})}
                        className={`py-2 px-3 rounded-lg text-sm border transition-colors flex items-center justify-center gap-2 ${
                            regData.businessType === type 
                            ? 'bg-primary-50 border-primary-500 text-primary-700 font-medium' 
                            : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                        }`}
                      >
                         {type === 'SHOP' && <Store size={14} />}
                         {type === 'CLINIC' && <Stethoscope size={14} />}
                         {type === 'PHARMACY' && <Pill size={14} />}
                         {type === 'RESTAURANT' && <Utensils size={14} />}
                         {type.charAt(0) + type.slice(1).toLowerCase()}
                      </button>
                   ))}
                </div>
              </div>

              <Input
                label={regData.businessType === 'CLINIC' ? "Clinic Name" : regData.businessType === 'PHARMACY' ? "Pharmacy Name" : regData.businessType === 'RESTAURANT' ? "Restaurant Name" : "Shop Name"}
                placeholder="e.g., Downtown Meds"
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
                 {loading ? 'Creating...' : 'Create Account'}
              </Button>
            </form>
          )}
        </Card>
      </div>
    </div>
  );
};

export default Auth;