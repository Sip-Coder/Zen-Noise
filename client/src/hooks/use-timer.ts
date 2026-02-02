import { useState, useEffect, useRef } from 'react';

export function useTimer(onComplete: () => void) {
  const [duration, setDuration] = useState<number>(0); // 0 = infinite
  const [remaining, setRemaining] = useState<number>(0);
  const intervalRef = useRef<number | null>(null);

  const startTimer = (minutes: number) => {
    setDuration(minutes);
    setRemaining(minutes * 60);
    
    if (intervalRef.current) clearInterval(intervalRef.current);
    
    if (minutes > 0) {
      intervalRef.current = window.setInterval(() => {
        setRemaining((prev) => {
          if (prev <= 1) {
            // Timer complete
            if (intervalRef.current) clearInterval(intervalRef.current);
            onComplete();
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
  };

  const cancelTimer = () => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    setDuration(0);
    setRemaining(0);
  };

  useEffect(() => {
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, []);

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  return {
    duration,
    remaining,
    startTimer,
    cancelTimer,
    formatTime,
  };
}
