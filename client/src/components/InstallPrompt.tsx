import { useState, useEffect } from "react";
import { X, Download } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

export function InstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [show, setShow] = useState(false);

  useEffect(() => {
    const handler = (e: any) => {
      e.preventDefault();
      setDeferredPrompt(e);
      // Only show if not already installed (basic check)
      if (!window.matchMedia('(display-mode: standalone)').matches) {
         setShow(true);
      }
    };

    window.addEventListener("beforeinstallprompt", handler);
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  const handleInstall = async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') {
      setShow(false);
    }
    setDeferredPrompt(null);
  };

  if (!show) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ y: 100, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: 100, opacity: 0 }}
        className="fixed bottom-6 left-4 right-4 z-50 md:left-auto md:right-6 md:w-80"
      >
        <div className="bg-secondary/90 backdrop-blur-md border border-white/10 p-4 rounded-2xl shadow-2xl flex items-center justify-between gap-4">
          <div className="flex-1">
            <h4 className="text-sm font-semibold text-foreground">Install App</h4>
            <p className="text-xs text-muted-foreground">Get the best experience offline.</p>
          </div>
          <div className="flex gap-2">
            <button 
              onClick={() => setShow(false)}
              className="p-2 text-muted-foreground hover:bg-white/5 rounded-full"
            >
              <X className="w-4 h-4" />
            </button>
            <button 
              onClick={handleInstall}
              className="px-4 py-2 bg-foreground text-background text-sm font-bold rounded-full flex items-center gap-2 hover:bg-white/90"
            >
              <Download className="w-3 h-3" />
              Install
            </button>
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
