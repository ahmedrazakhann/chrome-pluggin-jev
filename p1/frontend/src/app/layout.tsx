'use client';
import './globals.css';
import { Toaster } from 'react-hot-toast';
import { config } from '@config/config';

// Public app: no sign-in, every page renders as-is.
const RootLayout = ({ children }: { children: React.ReactNode }) => (
  <html lang="en">
    <head>
      <title>{config.appName}</title>
      <meta name="viewport" content="width=device-width, initial-scale=1" />
      <meta name="description" content="Sandbox customs declaration form: parties, shipping, invoices and payment." />
      <meta name="theme-color" content="#0e1b3d" />
    </head>
    <body>
      {children}
      <Toaster
        position="top-center"
        toastOptions={{
          duration: 3000,
          style: { background: '#333', color: '#fff', borderRadius: '4px', padding: '12px 16px', fontSize: '13px' },
          success: { style: { background: '#15803d' } },
          error: { style: { background: '#b91c1c' } },
        }}
      />
    </body>
  </html>
);

export default RootLayout;
