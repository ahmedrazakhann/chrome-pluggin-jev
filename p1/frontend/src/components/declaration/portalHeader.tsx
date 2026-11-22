import { Home, Ship } from 'lucide-react';
import { config } from '@config/config';

const NAV = ['Service Catalogue', 'Trade Services', 'Help Centre'];

const PortalHeader: React.FC = () => (
  <header className="bg-portal-navy text-white">
    <div className="mx-auto flex max-w-[1400px] items-center gap-4 px-4 py-3 md:gap-8 md:px-6">
      <div className="flex items-center gap-2">
        <span className="flex h-8 w-8 items-center justify-center rounded-full bg-white/10">
          <Ship size={18} />
        </span>
        <div className="leading-tight">
          <p className="text-sm font-bold tracking-wide">{config.appName}</p>
          <p className="text-[10px] uppercase tracking-[0.2em] text-white/60">Sandbox</p>
        </div>
      </div>
      <nav aria-label="Main" className="hidden items-center gap-6 text-[13px] text-white/85 md:flex">
        <Home size={16} aria-label="Home" />
        {NAV.map(item => (
          <span key={item}>{item}</span>
        ))}
      </nav>
    </div>
  </header>
);

export default PortalHeader;
