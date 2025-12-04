import React from 'react';

export default function EmailConfirmedPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-900 p-4 font-sans">
      <div className="max-w-md w-full bg-white dark:bg-slate-800 rounded-xl shadow-lg border border-slate-200 dark:border-slate-700 p-8 text-center animate-[fadeIn_0.5s_ease-out]">
        <h1 className="text-3xl font-bold text-slate-900 dark:text-white mb-4">
          Email Confirmed 🎉
        </h1>
        <p className="text-lg text-slate-600 dark:text-slate-300 mb-8">
          Your email has been successfully verified. You can now log in.
        </p>
        <button 
          onClick={() => window.location.href = '/'}
          className="px-6 py-3 bg-primary-600 text-white font-medium rounded-lg hover:bg-primary-700 transition-colors w-full focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2"
        >
          Go to Login
        </button>
      </div>
    </div>
  );
}