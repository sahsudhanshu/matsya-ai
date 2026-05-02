/* eslint-disable @next/next/no-img-element */
import React from 'react';

const Logo = ({ className = "" }: { className?: string }) => {
  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <img src="/logo.png" alt="MatsyaAI Logo" className="w-10 h-10 object-contain" />
      <span className="font-bold text-xl tracking-tight text-foreground">
        Matsya<span className="text-primary">AI</span>
      </span>
    </div>
  );
};

export default Logo;
