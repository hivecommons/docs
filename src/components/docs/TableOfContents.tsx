"use client";

import { useEffect, useState } from 'react';
import Link from 'next/link';

interface TOCItem {
  id: string;
  value: string;
  depth: number;
}

interface TableOfContentsProps {
  toc?: TOCItem[];
}

function TOCLink({ item, isActive }: { item: TOCItem; isActive: boolean }) {
  const indent = (item.depth - 2) * 12;

  const handleClick = (e: React.MouseEvent<HTMLAnchorElement>) => {
    e.preventDefault();
    const element = document.getElementById(item.id);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'start' });
      // Update URL without jumping
      window.history.pushState(null, '', `#${item.id}`);
    }
  };

  return (
    <Link
      href={`#${item.id}`}
      className={`block py-1.5 text-sm transition-colors border-l-2 ${
        isActive
          ? 'border-honey text-honey font-medium'
          : 'border-transparent text-ink-3 hover:border-line hover:text-ink'
      }`}
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

export function TableOfContents({ toc }: TableOfContentsProps) {
  const [activeId, setActiveId] = useState<string>('');

  useEffect(() => {
    if (!toc || toc.length === 0) return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setActiveId(entry.target.id);
          }
        });
      },
      {
        rootMargin: '-20% 0px -60% 0px',
        threshold: 0,
      }
    );

    // Observe all heading elements
    toc.forEach(({ id }) => {
      const element = document.getElementById(id);
      if (element) {
        observer.observe(element);
      }
    });

    return () => {
      observer.disconnect();
    };
  }, [toc]);

  if (!toc || toc.length === 0) {
    return null;
  }

  return (
    <aside 
      className="hidden xl:block w-64 overflow-y-auto border-l border-line bg-bg"
      style={{
        position: 'sticky',
        top: 'calc(var(--nextra-navbar-height, 4rem) + var(--nextra-banner-height, 0px))',
        height: 'calc(100vh - var(--nextra-navbar-height, 4rem) - var(--nextra-banner-height, 0px))',
      }}
      suppressHydrationWarning
    >
      <div className="p-4">
        <h3 
          className="text-sm font-semibold mb-4 text-ink"
          suppressHydrationWarning
        >
          On This Page
        </h3>
        <nav className="space-y-2">
          {toc.map((item) => (
            <TOCLink
              key={item.id}
              item={item}
              isActive={activeId === item.id}
            />
          ))}
        </nav>

        {/* Back to top link */}
        <div 
          className="mt-8 pt-4 border-t border-line"
          suppressHydrationWarning
        >
          <Link
            href="#"
            className="text-xs text-honey hover:text-honey-deep hover:underline"
            onClick={(e) => {
              e.preventDefault();
              window.scrollTo({ top: 0, behavior: 'smooth' });
            }}
            suppressHydrationWarning
          >
            ↑ Back to top
          </Link>
        </div>
      </div>
    </aside>
  );
}
