import { useState, useEffect } from 'react';

const UsageWidget = () => {
  const [usage, setUsage] = useState({ rpm: 0, tpm: 0, nextRefresh: null });
  const [timeLeft, setTimeLeft] = useState(0);
  
  const RPM_LIMIT = 15;
  const TPM_LIMIT = 1000000;

  // Fetch usage periodically
  useEffect(() => {
    const fetchUsage = async () => {
      try {
        const res = await fetch(`${import.meta.env.VITE_API_URL}/api/status/usage`);
        if (res.ok) {
          const data = await res.json();
          setUsage(data.chat);
        }
      } catch (err) {
        console.error("Failed to fetch usage metrics", err);
      }
    };
    
    fetchUsage();
    const interval = setInterval(fetchUsage, 5000);
    return () => clearInterval(interval);
  }, []);

  // Local countdown timer
  useEffect(() => {
    if (!usage.nextRefresh) {
      setTimeLeft(0);
      return;
    }
    
    const updateTimer = () => {
      const remaining = Math.max(0, Math.ceil((usage.nextRefresh - Date.now()) / 1000));
      setTimeLeft(remaining);
    };
    
    updateTimer();
    const timer = setInterval(updateTimer, 1000);
    return () => clearInterval(timer);
  }, [usage.nextRefresh]);

  const rpmPercent = Math.min(100, (usage.rpm / RPM_LIMIT) * 100);
  const tpmPercent = Math.min(100, (usage.tpm / TPM_LIMIT) * 100);
  
  const isHighUsage = rpmPercent > 80 || tpmPercent > 80;

  return (
    <div className="flex items-center gap-3 bg-[var(--color-apple-bg)] border border-[var(--color-apple-border)] rounded-full px-3 py-1.5 shadow-sm">
      <div className="flex flex-col gap-1 w-24">
        {/* RPM Bar */}
        <div className="flex items-center justify-between text-[8px] uppercase tracking-wider text-[var(--color-apple-text)]/50 font-semibold leading-none">
          <span>RPM</span>
          <span>{usage.rpm}/{RPM_LIMIT}</span>
        </div>
        <div className="h-1 w-full bg-[var(--color-apple-border)] rounded-full overflow-hidden">
          <div 
            className={`h-full rounded-full transition-all duration-500 ease-out ${rpmPercent > 80 ? 'bg-red-500' : rpmPercent > 50 ? 'bg-orange-400' : 'bg-[var(--color-apple-blue)]'}`}
            style={{ width: `${rpmPercent}%` }}
          />
        </div>
        
        {/* TPM Bar */}
        <div className="flex items-center justify-between text-[8px] uppercase tracking-wider text-[var(--color-apple-text)]/50 font-semibold leading-none mt-0.5">
          <span>TPM</span>
          <span>{usage.tpm > 1000 ? (usage.tpm/1000).toFixed(1)+'k' : usage.tpm}</span>
        </div>
        <div className="h-1 w-full bg-[var(--color-apple-border)] rounded-full overflow-hidden">
          <div 
            className={`h-full rounded-full transition-all duration-500 ease-out ${tpmPercent > 80 ? 'bg-red-500' : tpmPercent > 50 ? 'bg-orange-400' : 'bg-[var(--color-apple-blue)]'}`}
            style={{ width: `${tpmPercent}%` }}
          />
        </div>
      </div>
      
      {/* Timer */}
      <div className="flex flex-col items-end border-l border-[var(--color-apple-border)] pl-3">
        <span className="text-[9px] text-[var(--color-apple-text)]/50 font-medium uppercase tracking-wide leading-none mb-1">Quota Reset</span>
        <span className={`text-xs font-mono font-medium ${isHighUsage && timeLeft > 0 ? 'text-orange-500' : 'text-[var(--color-apple-text)]'}`}>
          {timeLeft > 0 ? `${timeLeft}s` : 'Ready'}
        </span>
      </div>
    </div>
  );
};

export default UsageWidget;
