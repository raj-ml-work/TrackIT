import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Lock, Mail, AlertCircle, Loader } from 'lucide-react';
import { LoginCredentials } from '../types';

interface LoginProps {
  onLogin: (credentials: LoginCredentials) => Promise<void>;
}

const Login: React.FC<LoginProps> = ({ onLogin }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(false);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [shake, setShake] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      await onLogin({ email, password, rememberMe });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed');
      setShake(true);
      setTimeout(() => setShake(false), 500);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-slate-50 via-slate-100 to-slate-200">
      {/* Animated background blobs */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <motion.div
          animate={{
            x: [0, 100, 0],
            y: [0, 50, 0],
            scale: [1, 1.1, 1],
          }}
          transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
          className="absolute top-20 left-20 w-96 h-96 bg-gradient-to-br from-slate-200/30 to-slate-300/30 rounded-full blur-3xl"
        />
        <motion.div
          animate={{
            x: [0, -80, 0],
            y: [0, 100, 0],
            scale: [1, 1.2, 1],
          }}
          transition={{ duration: 25, repeat: Infinity, ease: "linear" }}
          className="absolute bottom-20 right-20 w-96 h-96 bg-gradient-to-br from-slate-200/30 to-slate-300/30 rounded-full blur-3xl"
        />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
        className="relative w-full max-w-md"
      >
        {/* Login Card */}
        <motion.div
          animate={shake ? { x: [-10, 10, -10, 10, 0] } : {}}
          transition={{ duration: 0.4 }}
          className="glass-panel rounded-3xl p-8 shadow-2xl border border-white/50"
        >
          {/* Logo & Title */}
          <div className="text-center mb-8">
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ delay: 0.2, type: "spring", stiffness: 200 }}
              className="inline-flex mb-4"
            >
              <img
                src="/images/TrackIT_v2.png"
                alt="TrackIT"
                className="h-14 w-auto"
              />
            </motion.div>
            <p className="text-gray-500 font-medium">
              Sign in to manage your inventory
            </p>
          </div>

          {/* Error Alert */}
          {error && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className="mb-6 p-4 bg-red-50 border border-red-200 rounded-xl flex items-start gap-3"
            >
              <AlertCircle size={20} className="text-red-600 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-semibold text-red-900">Login Failed</p>
                <p className="text-xs text-red-700 mt-1">{error}</p>
              </div>
            </motion.div>
          )}

          {/* Login Form */}
          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="block text-xs font-medium text-gray-500 uppercase mb-2 tracking-wide">
                Email Address
              </label>
              <div className="relative">
                <Mail
                  size={18}
                  className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400"
                />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full pl-12 pr-4 py-3 bg-white/60 border border-gray-200 rounded-xl focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-300 outline-none transition-all text-gray-800 placeholder-gray-400"
                  placeholder="you@company.com"
                  disabled={isLoading}
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-500 uppercase mb-2 tracking-wide">
                Password
              </label>
              <div className="relative">
                <Lock
                  size={18}
                  className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400"
                />
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full pl-12 pr-4 py-3 bg-white/60 border border-gray-200 rounded-xl focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-300 outline-none transition-all text-gray-800 placeholder-gray-400"
                  placeholder="••••••••"
                  disabled={isLoading}
                />
              </div>
            </div>

            <div className="flex items-center justify-between">
              <label className="flex items-center gap-2 cursor-pointer group">
                <input
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                  className="w-4 h-4 rounded border-gray-300 text-emerald-600 focus:ring-2 focus:ring-emerald-500/20"
                  disabled={isLoading}
                />
                <span className="text-sm text-gray-600 group-hover:text-gray-900 transition-colors">
                  Remember me
                </span>
              </label>
              <button
                type="button"
                className="text-sm text-emerald-600 hover:text-emerald-800 font-medium transition-colors"
                disabled={isLoading}
              >
                Forgot password?
              </button>
            </div>

            <motion.button
              type="submit"
              disabled={isLoading}
              whileHover={!isLoading ? { y: -2 } : {}}
              whileTap={!isLoading ? { scale: 0.98 } : {}}
              className="relative w-full py-3 bg-gradient-to-r from-emerald-600 to-green-600 text-white rounded-xl font-semibold shadow-lg shadow-emerald-500/30 hover:from-emerald-700 hover:to-green-700 transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 overflow-hidden ring-1 ring-white/40 before:content-[''] before:absolute before:inset-0 before:bg-gradient-to-br before:from-white/35 before:via-white/10 before:to-transparent before:pointer-events-none"
            >
              {isLoading ? (
                <>
                  <Loader size={18} className="animate-spin" />
                  Signing in...
                </>
              ) : (
                'Sign In'
              )}
            </motion.button>
          </form>

          
        </motion.div>

        {/* Footer */}
        <p className="text-center text-xs text-gray-500 mt-6">
          TrackIT Inventory Management &copy; 2025
        </p>
      </motion.div>
    </div>
  );
};

export default Login;
