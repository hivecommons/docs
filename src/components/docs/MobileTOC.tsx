"use client";

import { useState } from 'react';
import Link from 'next/link';

interface TOCItem {
  id: string;
  value: string;
  depth: number;
}

interface MobileTOCProps {
  toc?: TOCItem[];
}

function TOCLink({ item, onClose }: { item: TOCItem; onClose: () => void }) {
  const indent = (item.depth - 2) * 16;

  const handleClick = (e: React.MouseEvent<HTMLAnchorElement>) => {
    e.preventDefault();
    const element = document.getElementById(item.id);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'start' });
      // Update URL without jumping
      window.history.pushState(null, '', `#${item.id}`);
    }
    onClose();
  };

  return (
    <Link
      href={`#${item.id}`}
      className="block py-2 text-sm border-l-2 border-transparent text-ink-3 transition-colors hover:border-honey hover:text-ink"
      style={{
        paddingLeft: `${indent + 12}px`,
      }}
      onClick={handleClick}
      suppressHydrationWarning
    >
      {item.value}
    </Link>
  );
}

export function MobileTOC({ toc }: MobileTOCProps) {
  const [isOpen, setIsOpen] = useState(false);

  if (!toc || toc.length === 0) {
    return null;
  }

  return (
    <div 
      className="xl:hidden mb-6 rounded-lg overflow-hidden border border-line sticky top-16 z-10 bg-bg-2"
      suppressHydrationWarning
    >
      {/* Accordion Header */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full px-4 py-3 flex items-center justify-between text-left transition-colors text-ink-2 hover:text-ink hover:bg-bg-3"
        suppressHydrationWarning
      >
        <div className="flex items-center gap-2">
          <svg 
            width="20" 
            height="20" 
            viewBox="0 0 24 24" 
            fill="none" 
            stroke="currentColor" 
            strokeWidth="2"
            strokeLinecap="round" 
            strokeLinejoin="round"
          >
            <line x1="3" y1="12" x2="21" y2="12"></line>
            <line x1="3" y1="6" x2="21" y2="6"></line>
            <line x1="3" y1="18" x2="21" y2="18"></line>
          </svg>
          <span className="font-semibold text-sm">On This Page</span>
        </div>
        <svg
          width="20"
          height="20"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          style={{
            transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)',
            transition: 'transform 0.2s ease',
          }}
        >
          <polyline points="6 9 12 15 18 9"></polyline>
        </svg>
      </button>

      {/* Accordion Content */}
      <div
        style={{
          maxHeight: isOpen ? '400px' : '0',
          overflow: isOpen ? 'auto' : 'hidden',
          transition: 'max-height 0.3s ease-in-out',
        }}
        suppressHydrationWarning
      >
        <nav 
          className="px-4 py-3 space-y-1"
          suppressHydrationWarning
        >
          {toc.map((item) => (
            <TOCLink
              key={item.id}
              item={item}
              onClose={() => setIsOpen(false)}
            />
          ))}
        </nav>
      </div>
    </div>
  );
}
