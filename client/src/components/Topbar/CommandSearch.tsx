'use client';
import React, {
  useState,
  useMemo,
  useEffect,
  useRef,
  type KeyboardEvent,
  type FC,
} from 'react';
import type { ReactNode } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Search,
  User,
  Bell,
  HelpCircle,
  MessageSquare,
  ArrowRight,
} from 'lucide-react';

export interface CommandItem {
  id: string;
  title: string;
  section: 'Suggestions' | 'Settings' | 'Help';
  icon: ReactNode;
  shortcut?: string;
  action: () => void;
}

const DEFAULT_ITEMS: CommandItem[] = [
  {
    id: '1',
    title: 'Calendar',
    section: 'Suggestions',
    icon: <ArrowRight size={16} />,
    action: () => console.log('Calendar'),
  },
  {
    id: '2',
    title: 'Search Emoji',
    section: 'Suggestions',
    icon: <ArrowRight size={16} />,
    action: () => console.log('Emoji'),
  },
  {
    id: '3',
    title: 'Calculator',
    section: 'Suggestions',
    icon: <ArrowRight size={16} />,
    action: () => console.log('Calculator'),
  },
  {
    id: '4',
    title: 'Profile',
    section: 'Settings',
    icon: <User size={16} />,
    shortcut: '⌘ P',
    action: () => console.log('Profile'),
  },
  {
    id: '5',
    title: 'Notifications',
    section: 'Settings',
    icon: <Bell size={16} />,
    shortcut: '⌘ N',
    action: () => console.log('Notifications'),
  },
  {
    id: '6',
    title: 'FAQ',
    section: 'Help',
    icon: <HelpCircle size={16} />,
    action: () => console.log('FAQ'),
  },
  {
    id: '7',
    title: 'Messages',
    section: 'Help',
    icon: <MessageSquare size={16} />,
    action: () => console.log('Messages'),
  },
];

interface Props {
  items?: CommandItem[];
}

export const CommandSearch: FC<Props> = ({ items = DEFAULT_ITEMS }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [activeIndex, setActiveIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      const timeout = setTimeout(() => {
        inputRef.current?.focus();
      }, 100);
      return () => clearTimeout(timeout);
    }
  }, [isOpen]);

  useEffect(() => {
    const handleKeyDown = (e: any) => {
      if (
        e.key.toLowerCase() === 'k' &&
        (e.metaKey || e.ctrlKey) &&
        !isOpen &&
        document.activeElement?.tagName !== 'INPUT' &&
        document.activeElement?.tagName !== 'TEXTAREA'
      ) {
        e.preventDefault();
        setIsOpen(true);
      }
      if (e.key === 'Escape' && isOpen) {
        e.preventDefault();
        e.stopPropagation();
        setIsOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown, true);
    return () => window.removeEventListener('keydown', handleKeyDown, true);
  }, [isOpen]);

  const filteredItems = useMemo(() => {
    return items.filter((item) =>
      item.title.toLowerCase().includes(query.toLowerCase()),
    );
  }, [query, items]);

  useEffect(() => {
    requestAnimationFrame(() => setActiveIndex(0));
  }, [query]);

  const sections = useMemo(() => {
    const groups: { [key: string]: CommandItem[] } = {};
    filteredItems.forEach((item) => {
      if (!groups[item.section]) groups[item.section] = [];
      groups[item.section].push(item);
    });
    return Object.entries(groups).map(([name, items]) => ({
      name,
      items,
    }));
  }, [filteredItems]);

  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIndex((prev) => (prev + 1) % filteredItems.length);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIndex(
        (prev) => (prev - 1 + filteredItems.length) % filteredItems.length,
      );
    } else if (e.key === 'Enter') {
      const selectedItem = filteredItems[activeIndex];
      if (selectedItem) {
        selectedItem.action();
        setIsOpen(false);
      }
    }
  };

  const sharedTransition = {
    type: 'tween' as const,
    ease: 'easeOut' as const,
    duration: 0.15,
  };

  useEffect(() => {
    if (!isOpen) {
      setQuery('');
    }
  }, [isOpen]);

  return (
    <>
      <AnimatePresence mode="popLayout">
        {isOpen && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-[9999] bg-transparent"
              onClick={() => setIsOpen(false)}
            />
        )}
      </AnimatePresence>
      <div className="relative z-50 h-10 w-full max-w-[280px] md:w-64">
        <AnimatePresence mode="popLayout">
          {!isOpen ? (
            <motion.button
              key="trigger"
              layoutId="command-pallete"
              onClick={() => setIsOpen(true)}
              className="group absolute top-0 left-0 flex h-10 w-full items-center gap-3 overflow-hidden rounded-lg border bg-transparent px-4 py-2 text-[var(--text-2)] shadow-sm hover:text-[var(--text-1)] border-[var(--border)]"
              transition={sharedTransition}
            >
              <motion.div layoutId="search-icon" transition={sharedTransition}>
                <Search size={16} className="opacity-40" />
              </motion.div>
              <motion.span
                layoutId="search-text"
                transition={sharedTransition}
                className="pr-8 text-sm font-medium"
              >
                Search symbol...
              </motion.span>
              <motion.kbd
                layoutId="search-shortcut"
                transition={sharedTransition}
                className="absolute right-2 rounded border px-2 py-0.5 text-[14px] font-bold border-[var(--border)] bg-[var(--bg-surface)] text-[var(--text-2)] group-hover:text-[var(--text-1)]"
              >
                ⌘K
              </motion.kbd>
            </motion.button>
          ) : (
            <motion.div
              layoutId="command-pallete"
              transition={sharedTransition}
              className="absolute top-0 -left-2 z-[10000] flex h-80 w-xs flex-col overflow-hidden rounded-2xl border-[1.4px] shadow-2xl md:w-[400px] bg-[var(--bg-surface)] border-[var(--border)]"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center border-b-[1.4px] px-4 py-3.5 border-[var(--border)]">
                <motion.div
                  layoutId="search-icon"
                  transition={sharedTransition}
                >
                  <Search
                    size={18}
                    className="mr-3 text-[var(--text-2)]"
                    strokeWidth={2.5}
                  />
                </motion.div>
                <div className="relative flex flex-1 items-center">
                  <input
                    ref={inputRef}
                    type="text"
                    className="w-full bg-transparent text-base font-medium text-[var(--text-1)] outline-none md:text-[15px]"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    onKeyDown={handleKeyDown}
                  />
                  {!query && (
                    <motion.span
                      layoutId="search-text"
                      transition={sharedTransition}
                      className="pointer-events-none absolute left-0 text-[15px] font-medium text-[var(--text-2)]"
                    >
                      Search symbol...
                    </motion.span>
                  )}
                </div>
                <div className="ml-2 flex items-center gap-1.5">
                  <motion.span
                    layoutId="search-shortcut"
                    transition={sharedTransition}
                    className="rounded-[2px] border p-0.5 px-1 text-[11px] font-bold border-[var(--border)] bg-[var(--bg-primary)] text-[var(--text-2)]"
                  >
                    Esc
                  </motion.span>
                </div>
              </div>
              <div className="custom-scrollbar flex-1 overflow-y-auto p-1.5 md:max-h-[380px]">
                {filteredItems.length === 0 ? (
                  <div className="py-12 text-center text-sm text-[var(--text-2)]">
                    No results found for "{query}"
                  </div>
                ) : (
                  <div className="space-y-4 py-1">
                    {sections.map((section) => (
                      <div key={section.name} className="space-y-1">
                        <h3 className="px-3 py-1 text-[11px] font-semibold tracking-wider uppercase text-[var(--text-2)]">
                          {section.name}
                        </h3>
                        <div className="space-y-0.5">
                          {section.items.map((item) => {
                            const globalIndex = filteredItems.findIndex(
                              (fi) => fi.id === item.id,
                            );
                            const isActive = globalIndex === activeIndex;
                            return (
                              <button
                                key={item.id}
                                className={`group flex w-full items-center justify-between rounded-md px-3 py-2.5 text-left ${isActive ? 'bg-[var(--bg-surface-hover)] text-[var(--text-1)]' : 'text-[var(--text-2)] hover:text-[var(--text-1)]'} `}
                                onMouseEnter={() => setActiveIndex(globalIndex)}
                                onClick={() => {
                                  item.action();
                                  setIsOpen(false);
                                }}
                              >
                                <div className="flex items-center gap-3">
                                  <span
                                    className={`${isActive ? 'text-[var(--text-1)]' : 'text-[var(--text-2)] group-hover:text-[var(--text-1)]'}`}
                                  >
                                    {item.icon}
                                  </span>
                                  <span className="text-[14px] leading-none font-medium">
                                    {item.title}
                                  </span>
                                </div>
                                {item.shortcut && (
                                  <kbd
                                    className={`rounded border px-1.5 py-0.5 text-[10px] font-bold ${isActive ? 'border-[var(--border)] bg-[var(--bg-primary)] text-[var(--text-1)]' : 'border-transparent bg-transparent text-[var(--text-2)] group-hover:text-[var(--text-1)]'} `}
                                  >
                                    {item.shortcut}
                                  </kbd>
                                )}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </>
  );
};
