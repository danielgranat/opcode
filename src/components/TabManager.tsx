import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence, Reorder } from 'framer-motion';
import { X, Plus, MessageSquare, Bot, AlertCircle, Loader2, Folder, BarChart, Server, Settings, FileText } from 'lucide-react';
import { useTabState } from '@/hooks/useTabState';
import { Tab, useTabContext } from '@/contexts/TabContext';
import { cn } from '@/lib/utils';
import { useTrackEvent } from '@/hooks';
import { useTheme } from '@/hooks';

interface TabItemProps {
  tab: Tab;
  isActive: boolean;
  onClose: (id: string) => void;
  onClick: (id: string) => void;
  isDragging?: boolean;
  setDraggedTabId?: (id: string | null) => void;
  orientation?: 'horizontal' | 'vertical';
}

const TabItem: React.FC<TabItemProps> = ({ tab, isActive, onClose, onClick, isDragging = false, setDraggedTabId, orientation = 'horizontal' }) => {
  const [isHovered, setIsHovered] = useState(false);
  
  const getIcon = () => {
    switch (tab.type) {
      case 'chat':
        return MessageSquare;
      case 'agent':
      case 'agents':
        return Bot;
      case 'projects':
        return Folder;
      case 'usage':
        return BarChart;
      case 'mcp':
        return Server;
      case 'settings':
        return Settings;
      case 'claude-md':
      case 'claude-file':
        return FileText;
      case 'agent-execution':
      case 'create-agent':
      case 'import-agent':
        return Bot;
      default:
        return MessageSquare;
    }
  };

  const getStatusIcon = () => {
    switch (tab.status) {
      case 'running':
        return <Loader2 className="w-3 h-3 animate-spin" />;
      case 'error':
        return <AlertCircle className="w-3 h-3 text-red-500" />;
      default:
        return null;
    }
  };

  const Icon = getIcon();
  const statusIcon = getStatusIcon();

  const isVertical = orientation === 'vertical';

  return (
    <Reorder.Item
      value={tab}
      id={tab.id}
      dragListener={true}
      transition={{ duration: 0.1 }} // Snappy reorder animation
      className={cn(
        "relative flex items-center gap-2 text-sm cursor-pointer select-none group",
        "transition-colors duration-100 overflow-hidden",
        // Active-indicator bar: bottom for horizontal, left for vertical
        isVertical
          ? "border-b border-border/20 before:absolute before:top-0 before:bottom-0 before:left-0 before:w-0.5 before:transition-colors before:duration-100"
          : "border-r border-border/20 before:absolute before:bottom-0 before:left-0 before:right-0 before:h-0.5 before:transition-colors before:duration-100",
        isActive
          ? "bg-card text-card-foreground before:bg-primary"
          : "bg-transparent text-muted-foreground hover:bg-muted/40 hover:text-foreground before:bg-transparent",
        isDragging && "bg-card border-primary/50 shadow-sm z-50",
        isVertical
          ? "w-full h-9 px-3"
          : "min-w-[120px] max-w-[220px] h-8 px-3"
      )}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onClick={() => onClick(tab.id)}
      onDragStart={() => setDraggedTabId?.(tab.id)}
      onDragEnd={() => setDraggedTabId?.(null)}
    >
      {/* Tab Icon */}
      <div className="flex-shrink-0">
        <Icon className="w-4 h-4" />
      </div>
      
      {/* Tab Title */}
      <span className="flex-1 truncate text-xs font-medium min-w-0">
        {tab.title}
      </span>

      {/* Status Indicators - always takes up space */}
      <div className="flex items-center gap-1.5 flex-shrink-0 w-6 justify-end">
        {statusIcon && (
          <span className="flex items-center justify-center">
            {statusIcon}
          </span>
        )}

        {tab.hasUnsavedChanges && !statusIcon && (
          <span 
            className="w-1.5 h-1.5 bg-primary rounded-full"
            title="Unsaved changes"
          />
        )}
      </div>

      {/* Close Button - Always reserves space */}
      <button
        onClick={(e) => {
          e.stopPropagation();
          onClose(tab.id);
        }}
        className={cn(
          "flex-shrink-0 w-4 h-4 flex items-center justify-center rounded-sm",
          "transition-all duration-100 hover:bg-destructive/20 hover:text-destructive",
          "focus:outline-none focus:ring-1 focus:ring-destructive/50",
          (isHovered || isActive) ? "opacity-100" : "opacity-0"
        )}
        title={`Close ${tab.title}`}
        tabIndex={-1}
      >
        <X className="w-3 h-3" />
      </button>

    </Reorder.Item>
  );
};

interface TabManagerProps {
  className?: string;
}

export const TabManager: React.FC<TabManagerProps> = ({ className }) => {
  const {
    tabs,
    activeTabId,
    createChatTab,
    createProjectsTab,
    closeTab,
    switchToTab,
    canAddTab
  } = useTabState();

  // Access reorderTabs from context
  const { reorderTabs } = useTabContext();
  const { tabPosition } = useTheme();
  const isVertical = tabPosition === 'left';

  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [showLeftScroll, setShowLeftScroll] = useState(false);
  const [showRightScroll, setShowRightScroll] = useState(false);
  const [draggedTabId, setDraggedTabId] = useState<string | null>(null);
  
  // Analytics tracking
  const trackEvent = useTrackEvent();

  // Listen for tab switch events
  useEffect(() => {
    const handleSwitchToTab = (event: CustomEvent) => {
      const { tabId } = event.detail;
      switchToTab(tabId);
    };

    window.addEventListener('switch-to-tab', handleSwitchToTab as EventListener);
    return () => {
      window.removeEventListener('switch-to-tab', handleSwitchToTab as EventListener);
    };
  }, [switchToTab]);

  // Listen for keyboard shortcut events
  useEffect(() => {
    const handleCreateTab = () => {
      createProjectsTab();
      trackEvent.tabCreated('projects');
    };

    const handleCloseTab = async () => {
      if (activeTabId) {
        const tab = tabs.find(t => t.id === activeTabId);
        if (tab) {
          trackEvent.tabClosed(tab.type);
        }
        await closeTab(activeTabId);
      }
    };

    const handleNextTab = () => {
      const currentIndex = tabs.findIndex(tab => tab.id === activeTabId);
      const nextIndex = (currentIndex + 1) % tabs.length;
      if (tabs[nextIndex]) {
        switchToTab(tabs[nextIndex].id);
      }
    };

    const handlePreviousTab = () => {
      const currentIndex = tabs.findIndex(tab => tab.id === activeTabId);
      const previousIndex = currentIndex === 0 ? tabs.length - 1 : currentIndex - 1;
      if (tabs[previousIndex]) {
        switchToTab(tabs[previousIndex].id);
      }
    };

    const handleTabByIndex = (event: CustomEvent) => {
      const { index } = event.detail;
      if (tabs[index]) {
        switchToTab(tabs[index].id);
      }
    };

    window.addEventListener('create-chat-tab', handleCreateTab);
    window.addEventListener('close-current-tab', handleCloseTab);
    window.addEventListener('switch-to-next-tab', handleNextTab);
    window.addEventListener('switch-to-previous-tab', handlePreviousTab);
    window.addEventListener('switch-to-tab-by-index', handleTabByIndex as EventListener);

    return () => {
      window.removeEventListener('create-chat-tab', handleCreateTab);
      window.removeEventListener('close-current-tab', handleCloseTab);
      window.removeEventListener('switch-to-next-tab', handleNextTab);
      window.removeEventListener('switch-to-previous-tab', handlePreviousTab);
      window.removeEventListener('switch-to-tab-by-index', handleTabByIndex as EventListener);
    };
  }, [tabs, activeTabId, createChatTab, closeTab, switchToTab]);

  // Check scroll buttons visibility
  const checkScrollButtons = () => {
    const container = scrollContainerRef.current;
    if (!container) return;

    if (isVertical) {
      const { scrollTop, scrollHeight, clientHeight } = container;
      setShowLeftScroll(scrollTop > 0);
      setShowRightScroll(scrollTop + clientHeight < scrollHeight - 1);
    } else {
      const { scrollLeft, scrollWidth, clientWidth } = container;
      setShowLeftScroll(scrollLeft > 0);
      setShowRightScroll(scrollLeft + clientWidth < scrollWidth - 1);
    }
  };

  useEffect(() => {
    checkScrollButtons();
    const container = scrollContainerRef.current;
    if (!container) return;

    container.addEventListener('scroll', checkScrollButtons);
    window.addEventListener('resize', checkScrollButtons);

    return () => {
      container.removeEventListener('scroll', checkScrollButtons);
      window.removeEventListener('resize', checkScrollButtons);
    };
  }, [tabs, isVertical]);

  const handleReorder = (newOrder: Tab[]) => {
    // Find the positions that changed
    const oldOrder = tabs.map(tab => tab.id);
    const newOrderIds = newOrder.map(tab => tab.id);
    
    // Find what moved
    const movedTabId = newOrderIds.find((id, index) => oldOrder[index] !== id);
    if (!movedTabId) return;
    
    const oldIndex = oldOrder.indexOf(movedTabId);
    const newIndex = newOrderIds.indexOf(movedTabId);
    
    if (oldIndex !== -1 && newIndex !== -1 && oldIndex !== newIndex) {
      // Use the context's reorderTabs function
      reorderTabs(oldIndex, newIndex);
      // Track the reorder event
      trackEvent.featureUsed?.('tab_reorder', 'drag_drop', { 
        from_index: oldIndex, 
        to_index: newIndex 
      });
    }
  };

  const handleCloseTab = async (id: string) => {
    const tab = tabs.find(t => t.id === id);
    if (tab) {
      trackEvent.tabClosed(tab.type);
    }
    await closeTab(id);
  };

  const handleNewTab = () => {
    if (canAddTab()) {
      createProjectsTab();
      trackEvent.tabCreated('projects');
    }
  };

  const scrollTabs = (direction: 'left' | 'right') => {
    const container = scrollContainerRef.current;
    if (!container) return;

    const scrollAmount = 200;
    if (isVertical) {
      const newScrollTop = direction === 'left'
        ? container.scrollTop - scrollAmount
        : container.scrollTop + scrollAmount;
      container.scrollTo({ top: newScrollTop, behavior: 'smooth' });
    } else {
      const newScrollLeft = direction === 'left'
        ? container.scrollLeft - scrollAmount
        : container.scrollLeft + scrollAmount;
      container.scrollTo({ left: newScrollLeft, behavior: 'smooth' });
    }
  };

  if (isVertical) {
    return (
      <div className={cn("flex flex-col bg-muted/15 relative border-r border-border/50 w-56 h-full", className)}>
        {/* Top fade gradient */}
        {showLeftScroll && (
          <div className="absolute top-0 left-0 right-0 h-8 bg-gradient-to-b from-muted/15 to-transparent pointer-events-none z-10" />
        )}

        {/* Top scroll button */}
        <AnimatePresence>
          {showLeftScroll && (
            <motion.button
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => scrollTabs('left')}
              className={cn(
                "p-1.5 hover:bg-muted/80 rounded-sm z-20 mt-1 mx-auto",
                "transition-colors duration-200 flex items-center justify-center",
                "bg-background/80 backdrop-blur-sm shadow-sm border border-border/50"
              )}
              title="Scroll tabs up"
            >
              <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                <path d="M18 15l-6-6-6 6" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </motion.button>
          )}
        </AnimatePresence>

        {/* Tabs container */}
        <div
          ref={scrollContainerRef}
          className="flex-1 flex flex-col overflow-y-auto scrollbar-hide"
          style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
        >
          <Reorder.Group
            axis="y"
            values={tabs}
            onReorder={handleReorder}
            className="flex flex-col"
            layoutScroll={false}
          >
            {tabs.map((tab) => (
              <TabItem
                key={tab.id}
                tab={tab}
                isActive={tab.id === activeTabId}
                onClose={handleCloseTab}
                onClick={switchToTab}
                isDragging={draggedTabId === tab.id}
                setDraggedTabId={setDraggedTabId}
                orientation="vertical"
              />
            ))}
          </Reorder.Group>

          {/* New tab button */}
          <motion.button
            onClick={handleNewTab}
            disabled={!canAddTab()}
            whileTap={canAddTab() ? { scale: 0.97 } : {}}
            transition={{ duration: 0.15 }}
            className={cn(
              "mx-2 my-1 px-2 rounded-md flex items-center justify-center gap-2 flex-shrink-0",
              "bg-background/50 backdrop-blur-sm h-8",
              canAddTab()
                ? "hover:bg-muted/60 text-muted-foreground hover:text-foreground"
                : "opacity-50 cursor-not-allowed text-muted-foreground"
            )}
            title={canAddTab() ? "New project (Ctrl+T)" : "Maximum tabs reached"}
          >
            <Plus className="w-4 h-4" />
            <span className="text-xs">New tab</span>
          </motion.button>
        </div>

        {/* Bottom fade gradient */}
        {showRightScroll && (
          <div className="absolute bottom-0 left-0 right-0 h-8 bg-gradient-to-t from-muted/15 to-transparent pointer-events-none z-10" />
        )}

        {/* Bottom scroll button */}
        <AnimatePresence>
          {showRightScroll && (
            <motion.button
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => scrollTabs('right')}
              className={cn(
                "p-1.5 hover:bg-muted/80 rounded-sm z-20 mb-1 mx-auto",
                "transition-colors duration-200 flex items-center justify-center",
                "bg-background/80 backdrop-blur-sm shadow-sm border border-border/50"
              )}
              title="Scroll tabs down"
            >
              <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                <path d="M6 9l6 6 6-6" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </motion.button>
          )}
        </AnimatePresence>
      </div>
    );
  }

  return (
    <div className={cn("flex items-stretch bg-muted/15 relative border-b border-border/50", className)}>
      {/* Left fade gradient */}
      {showLeftScroll && (
        <div className="absolute left-0 top-0 bottom-0 w-8 bg-gradient-to-r from-muted/15 to-transparent pointer-events-none z-10" />
      )}

      {/* Left scroll button */}
      <AnimatePresence>
        {showLeftScroll && (
          <motion.button
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => scrollTabs('left')}
            className={cn(
              "p-1.5 hover:bg-muted/80 rounded-sm z-20 ml-1",
              "transition-colors duration-200 flex items-center justify-center",
              "bg-background/80 backdrop-blur-sm shadow-sm border border-border/50"
            )}
            title="Scroll tabs left"
          >
            <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor">
              <path d="M15 18l-6-6 6-6" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </motion.button>
        )}
      </AnimatePresence>

      {/* Tabs container */}
      <div
        ref={scrollContainerRef}
        className="flex-1 flex overflow-x-auto scrollbar-hide"
        style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
      >
        <div className="flex items-stretch h-8">
          <Reorder.Group
            axis="x"
            values={tabs}
            onReorder={handleReorder}
            className="flex items-stretch"
            layoutScroll={false}
          >
            {tabs.map((tab) => (
              <TabItem
                key={tab.id}
                tab={tab}
                isActive={tab.id === activeTabId}
                onClose={handleCloseTab}
                onClick={switchToTab}
                isDragging={draggedTabId === tab.id}
                setDraggedTabId={setDraggedTabId}
              />
            ))}
          </Reorder.Group>

          {/* New tab button - positioned right after tabs */}
          <motion.button
            onClick={handleNewTab}
            disabled={!canAddTab()}
            whileTap={canAddTab() ? { scale: 0.97 } : {}}
            transition={{ duration: 0.15 }}
            className={cn(
              "px-2 mx-1 rounded-md flex items-center justify-center flex-shrink-0",
              "bg-background/50 backdrop-blur-sm h-8",
              canAddTab()
                ? "hover:bg-muted/60 text-muted-foreground hover:text-foreground"
                : "opacity-50 cursor-not-allowed text-muted-foreground"
            )}
            title={canAddTab() ? "New project (Ctrl+T)" : "Maximum tabs reached"}
          >
            <Plus className="w-4 h-4" />
          </motion.button>
        </div>
      </div>

      {/* Right fade gradient */}
      {showRightScroll && (
        <div className="absolute right-0 top-0 bottom-0 w-8 bg-gradient-to-l from-muted/15 to-transparent pointer-events-none z-10" />
      )}

      {/* Right scroll button */}
      <AnimatePresence>
        {showRightScroll && (
          <motion.button
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => scrollTabs('right')}
            className={cn(
              "p-1.5 hover:bg-muted/80 rounded-sm z-20 mr-1",
              "transition-colors duration-200 flex items-center justify-center",
              "bg-background/80 backdrop-blur-sm shadow-sm border border-border/50"
            )}
            title="Scroll tabs right"
          >
            <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor">
              <path d="M9 18l6-6-6-6" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </motion.button>
        )}
      </AnimatePresence>

    </div>
  );
};

export default TabManager;