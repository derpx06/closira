import React from 'react';
import { Toaster } from 'react-hot-toast';

const ToastProvider = () => {
  return (
    <Toaster
      position="top-right"
      toastOptions={{
        duration: 3500,
        style: {
          borderRadius: '0.75rem',
          border: '1px solid #e2e8f0',
          background: '#ffffff',
          color: '#0f172a',
          fontSize: '0.875rem',
        },
        success: {
          iconTheme: {
            primary: '#059669',
            secondary: '#ffffff',
          },
        },
        error: {
          iconTheme: {
            primary: '#dc2626',
            secondary: '#ffffff',
          },
        },
      }}
    />
  );
};

export default ToastProvider;
