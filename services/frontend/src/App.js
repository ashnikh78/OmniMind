import React, { useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { ThemeProvider } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';
import { ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import { AuthProvider } from './contexts/AuthContext';
import { TenantProvider } from './contexts/TenantContext';
import { RBACProvider } from './contexts/RBACContext';
import { AnalyticsProvider } from './contexts/AnalyticsContext';
import { NotificationProvider } from './contexts/NotificationContext';
import { ActivityProvider } from './contexts/ActivityContext';
import { MLServiceProvider } from './contexts/MLServiceContext';
import { theme } from './theme';
import Layout from './components/Layout';
import Login from './pages/Login';
import Register from './pages/Register';
import ForgotPassword from './pages/ForgotPassword';
import ResetPassword from './pages/ResetPassword';
import Dashboard from './pages/Dashboard';
import Profile from './pages/Profile';
import Messages from './pages/Messages';
import Notifications from './pages/Notifications';
import Activity from './pages/Activity';
import MLService from './pages/MLService';
import Tenants from './pages/Tenants';
import Roles from './pages/Roles';
import Analytics from './pages/Analytics';
import PrivateRoute from './components/PrivateRoute';
import ProtectedRoute from './components/ProtectedRoute';
import NotFound from './pages/NotFound';

function App() {
  useEffect(() => {
    console.log('App component mounted');
  }, []);

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <AuthProvider>
        <TenantProvider>
          <RBACProvider>
            <AnalyticsProvider>
              <NotificationProvider>
                <ActivityProvider>
                  <MLServiceProvider>
                    <Router>
                      <ToastContainer
                        position="top-right"
                        autoClose={5000}
                        hideProgressBar={false}
                        newestOnTop
                        closeOnClick
                        rtl={false}
                        pauseOnFocusLoss
                        draggable
                        pauseOnHover
                        theme="light"
                      />
                      <Routes>
                        {/* Public routes */}
                        <Route path="/login" element={<Login />} />
                        <Route path="/register" element={<Register />} />
                        <Route path="/forgot-password" element={<ForgotPassword />} />
                        <Route path="/reset-password" element={<ResetPassword />} />

                        {/* Protected routes */}
                        <Route path="/" element={<Layout />}>
                          <Route index element={<Navigate to="/dashboard" replace />} />
                          <Route path="dashboard" element={<PrivateRoute><Dashboard /></PrivateRoute>} />
                          <Route path="profile" element={<PrivateRoute><Profile /></PrivateRoute>} />
                          <Route path="messages" element={<PrivateRoute><Messages /></PrivateRoute>} />
                          <Route path="notifications" element={<PrivateRoute><Notifications /></PrivateRoute>} />
                          <Route path="activity" element={<PrivateRoute><Activity /></PrivateRoute>} />
                          <Route path="tenants" element={<PrivateRoute><Tenants /></PrivateRoute>} />
                          <Route path="roles" element={<PrivateRoute><Roles /></PrivateRoute>} />
                          <Route path="analytics" element={<PrivateRoute><Analytics /></PrivateRoute>} />
                          <Route path="ml-service" element={<PrivateRoute><MLService /></PrivateRoute>} />
                          <Route path="*" element={<NotFound />} />
                        </Route>
                      </Routes>
                    </Router>
                  </MLServiceProvider>
                </ActivityProvider>
              </NotificationProvider>
            </AnalyticsProvider>
          </RBACProvider>
        </TenantProvider>
      </AuthProvider>
    </ThemeProvider>
  );
}

export default App; 