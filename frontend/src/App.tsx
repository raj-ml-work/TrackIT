import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { ThemeProvider } from './contexts/ThemeContext';
import { LoadingProvider } from './contexts/LoadingContext';
import { ErrorProvider } from './contexts/ErrorContext';
import { PerformanceProvider } from './contexts/PerformanceContext';
import { Dashboard } from './components/Dashboard';
import { Login } from './components/Login';
import { AssetManager } from './components/AssetManager';
import { EmployeeManagement } from './components/EmployeeManagement';
import { LocationManagement } from './components/LocationManagement';
import { DepartmentManagement } from './components/DepartmentManagement';
import { UserManagement } from './components/UserManagement';
import { ProfilePanel } from './components/ProfilePanel';
import { Settings } from './components/Settings';
import { LoadingSpinner } from './components/LoadingSpinner';
import { ErrorBoundary } from './components/ErrorBoundary';
import { usePerformanceMonitoring } from './hooks/usePerformanceMonitoring';
import { useAsyncInsights } from './hooks/useAsyncInsights';
import { dataLoader } from './services/dataLoader';
import { initializeDefaultAdmin } from './services/authClient';
import './index.css';

// Lazy load heavy components
const LazyAssetManager = React.lazy(() => import('./components/AssetManager'));
const LazyEmployeeManagement = React.lazy(() => import('./components/EmployeeManagement'));
const LazyLocationManagement = React.lazy(() => import('./components/LocationManagement'));
const LazyDepartmentManagement = React.lazy(() => import('./components/DepartmentManagement'));
const LazyUserManagement = React.lazy(() => import('./components/UserManagement'));
const LazyProfilePanel = React.lazy(() => import('./components/ProfilePanel'));
const LazySettings = React.lazy(() => import('./components/Settings'));

/**
 * Main App component with performance optimizations
 */
function AppContent() {
  const { user, loading: authLoading } = useAuth();
  const [appInitialized, setAppInitialized] = useState(false);
  const [initialDataLoaded, setInitialDataLoaded] = useState(false);
  
  // Performance monitoring
  const { trackPageView, trackUserAction } = usePerformanceMonitoring();
  const { insights, loading: insightsLoading } = useAsyncInsights({
    autoGenerate: true,
    cacheDuration: 10 * 60 * 1000 // 10 minutes
  });

  // Initialize application
  useEffect(() => {
    const initializeApp = async () => {
      try {
        // Initialize default admin user
        await initializeDefaultAdmin();
        
        // Preload critical data for authenticated users
        if (user) {
          await dataLoader.loadDashboardMetrics();
          await dataLoader.loadActiveAssets();
          await dataLoader.loadCurrentEmployees();
          setInitialDataLoaded(true);
        }
        
        setAppInitialized(true);
      } catch (error) {
        console.error('Failed to initialize app:', error);
      }
    };

    initializeApp();
  }, [user]);

  // Track page views
  useEffect(() => {
    trackPageView(window.location.pathname);
  }, [trackPageView]);

  // Show loading spinner during initialization
  if (!appInitialized || authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100">
        <LoadingSpinner size="lg" message="Initializing application..." />
      </div>
    );
  }

  // Show skeleton while loading initial data for authenticated users
  if (user && !initialDataLoaded && !insightsLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
        <div className="container mx-auto px-4 py-8">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="bg-white rounded-lg shadow-sm border border-slate-200 p-6 animate-pulse">
                <div className="h-4 bg-slate-200 rounded w-3/4 mb-2"></div>
                <div className="h-8 bg-slate-200 rounded w-1/2"></div>
              </div>
            ))}
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="bg-white rounded-lg shadow-sm border border-slate-200 p-6 animate-pulse">
                <div className="h-6 bg-slate-200 rounded w-1/3 mb-4"></div>
                <div className="space-y-3">
                  {[...Array(5)].map((_, j) => (
                    <div key={j} className="h-4 bg-slate-200 rounded"></div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <ErrorBoundary>
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
        <Routes>
          {/* Public routes */}
          <Route 
            path="/login" 
            element={user ? <Navigate to="/" replace /> : <Login />} 
          />
          
          {/* Protected routes */}
          <Route 
            path="/" 
            element={user ? <Dashboard insights={insights} /> : <Navigate to="/login" replace />}
          />
          
          <Route 
            path="/assets" 
            element={user ? (
              <React.Suspense fallback={<LoadingSpinner message="Loading assets..." />}>
                <LazyAssetManager />
              </React.Suspense>
            ) : <Navigate to="/login" replace />}
          />
          
          <Route 
            path="/employees" 
            element={user ? (
              <React.Suspense fallback={<LoadingSpinner message="Loading employees..." />}>
                <LazyEmployeeManagement />
              </React.Suspense>
            ) : <Navigate to="/login" replace />}
          />
          
          <Route 
            path="/locations" 
            element={user ? (
              <React.Suspense fallback={<LoadingSpinner message="Loading locations..." />}>
                <LazyLocationManagement />
              </React.Suspense>
            ) : <Navigate to="/login" replace />}
          />
          
          <Route 
            path="/departments" 
            element={user ? (
              <React.Suspense fallback={<LoadingSpinner message="Loading departments..." />}>
                <LazyDepartmentManagement />
              </React.Suspense>
            ) : <Navigate to="/login" replace />}
          />
          
          <Route 
            path="/users" 
            element={user ? (
              <React.Suspense fallback={<LoadingSpinner message="Loading users..." />}>
                <LazyUserManagement />
              </React.Suspense>
            ) : <Navigate to="/login" replace />}
          />
          
          <Route 
            path="/profile" 
            element={user ? (
              <React.Suspense fallback={<LoadingSpinner message="Loading profile..." />}>
                <LazyProfilePanel />
              </React.Suspense>
            ) : <Navigate to="/login" replace />}
          />
          
          <Route 
            path="/settings" 
            element={user ? (
              <React.Suspense fallback={<LoadingSpinner message="Loading settings..." />}>
                <LazySettings />
              </React.Suspense>
            ) : <Navigate to="/login" replace />}
          />
          
          {/* Catch all route */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>

        {/* Global toast notifications */}
        <Toaster
          position="top-right"
          toastOptions={{
            duration: 4000,
            style: {
              background: '#fff',
              color: '#333',
              border: '1px solid #e5e7eb',
              borderRadius: '8px',
              boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)'
            },
            success: {
              iconTheme: {
                primary: '#10b981',
                secondary: '#fff',
              },
            },
            error: {
              iconTheme: {
                primary: '#ef4444',
                secondary: '#fff',
              },
            },
          }}
        />
      </div>
    </ErrorBoundary>
  );
}

/**
 * Main App component with providers
 */
function App() {
  return (
    <ErrorProvider>
      <LoadingProvider>
        <PerformanceProvider>
          <ThemeProvider>
            <AuthProvider>
              <Router>
                <AppContent />
              </Router>
            </AuthProvider>
          </ThemeProvider>
        </PerformanceProvider>
      </LoadingProvider>
    </ErrorProvider>
  );
}

export default App;