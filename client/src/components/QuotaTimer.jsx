import { useState, useEffect } from 'react';

const QuotaTimer = ({ waitTime, message = "Pausing for quota..." }) => {
  const [timeLeft, setTimeLeft] = useState(Math.ceil(waitTime / 1000));

  useEffect(() => {
    setTimeLeft(Math.ceil(waitTime / 1000));
    const timer = setInterval(() => {
      setTimeLeft(prev => Math.max(0, prev - 1));
    }, 1000);
    return () => clearInterval(timer);
  }, [waitTime]);

  return (
    <div className="flex items-center gap-1.5 text-orange-400 font-medium text-[11px] sm:text-xs">
      <svg className="w-3.5 h-3.5 sm:w-4 sm:h-4 animate-spin flex-shrink-0" fill="none" viewBox="0 0 24 24">
        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
      </svg>
      <span className="truncate">{message} ({timeLeft}s)</span>
    </div>
  );
};

export default QuotaTimer;
