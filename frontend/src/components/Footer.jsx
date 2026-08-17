import React from 'react';
import { Link } from 'react-router-dom';
import { ShieldCheck } from 'lucide-react';

export function Footer() {
  return (
    <footer className="w-full mt-auto py-12 px-6 sm:px-12 md:px-16 flex flex-col md:flex-row justify-between items-center gap-6 bg-glass-fill backdrop-blur-lg border-t border-glass-border">
      <div className="flex items-center gap-2">
        <ShieldCheck className="w-5 h-5 text-secondary-fixed" />
        <span className="font-headline text-xl font-bold text-primary-fixed">MedCheck</span>
      </div>

      <div className="text-xs text-center max-w-xl text-primary-fixed/60 leading-relaxed font-body">
        © {new Date().getFullYear()} MedCheck AI. Medical Disclaimer: This platform provides informational guidance based on openFDA & pharmacological knowledge and does not constitute medical diagnosis or prescription advice.
      </div>

      <div className="flex gap-6 text-xs text-primary-fixed/70">
        <Link to="/auth" className="hover:text-primary-fixed transition-colors">
          Account
        </Link>
        <a href="#how-it-works" className="hover:text-primary-fixed transition-colors">
          How It Works
        </a>
      </div>
    </footer>
  );
}
