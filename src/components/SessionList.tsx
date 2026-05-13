import React, { useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Clock, MessageSquare, Search, X } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Pagination } from "@/components/ui/pagination";
import { ClaudeMemoriesDropdown } from "@/components/ClaudeMemoriesDropdown";
import { TooltipProvider } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { truncateText, getFirstLine } from "@/lib/date-utils";
import type { Session, ClaudeMdFile } from "@/lib/api";

interface SessionListProps {
  /**
   * Array of sessions to display
   */
  sessions: Session[];
  /**
   * The current project path being viewed
   */
  projectPath: string;
  /**
   * Optional callback to go back to project list (deprecated - use tabs instead)
   */
  onBack?: () => void;
  /**
   * Callback when a session is clicked
   */
  onSessionClick?: (session: Session) => void;
  /**
   * Callback when a CLAUDE.md file should be edited
   */
  onEditClaudeFile?: (file: ClaudeMdFile) => void;
  /**
   * Optional className for styling
   */
  className?: string;
}

const ITEMS_PER_PAGE = 12;

/**
 * SessionList component - Displays paginated sessions for a specific project
 * 
 * @example
 * <SessionList
 *   sessions={sessions}
 *   projectPath="/Users/example/project"
 *   onBack={() => setSelectedProject(null)}
 *   onSessionClick={(session) => console.log('Selected session:', session)}
 * />
 */
export const SessionList: React.FC<SessionListProps> = ({
  sessions,
  projectPath,
  onSessionClick,
  onEditClaudeFile,
  className,
}) => {
  const [currentPage, setCurrentPage] = useState(1);
  const [query, setQuery] = useState("");

  const trimmedQuery = query.trim().toLowerCase();

  const filteredSessions = useMemo(() => {
    if (!trimmedQuery) return sessions;
    return sessions.filter((s) => s.id.toLowerCase().includes(trimmedQuery));
  }, [sessions, trimmedQuery]);

  // Calculate pagination on the filtered list
  const totalPages = Math.max(1, Math.ceil(filteredSessions.length / ITEMS_PER_PAGE));
  const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
  const endIndex = startIndex + ITEMS_PER_PAGE;
  const currentSessions = filteredSessions.slice(startIndex, endIndex);

  // Reset to page 1 if sessions change or the query changes
  React.useEffect(() => {
    setCurrentPage(1);
  }, [sessions.length, trimmedQuery]);

  // Exact-match shortcut: when the user pastes a full UUID-style id that matches
  // exactly one session, open it. Skip for short queries to avoid surprises.
  React.useEffect(() => {
    if (trimmedQuery.length < 32) return;
    const exact = sessions.filter((s) => s.id.toLowerCase() === trimmedQuery);
    if (exact.length !== 1) return;
    const session = exact[0];
    const t = window.setTimeout(() => {
      const event = new CustomEvent("claude-session-selected", {
        detail: { session, projectPath },
      });
      window.dispatchEvent(event);
      onSessionClick?.(session);
    }, 150);
    return () => window.clearTimeout(t);
  }, [trimmedQuery, sessions, projectPath, onSessionClick]);
  
  return (
    <TooltipProvider>
      <div className={cn("space-y-4", className)}>
      {/* CLAUDE.md Memories Dropdown */}
      {onEditClaudeFile && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.1 }}
        >
          <ClaudeMemoriesDropdown
            projectPath={projectPath}
            onEditFile={onEditClaudeFile}
          />
        </motion.div>
      )}

      {/* Session ID search */}
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by session ID…"
            aria-label="Search sessions by ID"
            className={cn(
              "w-full h-9 rounded-md border bg-background pl-8 pr-8 text-sm",
              "placeholder:text-muted-foreground",
              "focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent",
            )}
            spellCheck={false}
            autoComplete="off"
          />
          {query && (
            <button
              type="button"
              onClick={() => setQuery("")}
              aria-label="Clear search"
              className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
        {trimmedQuery && (
          <p className="text-caption text-muted-foreground whitespace-nowrap">
            {filteredSessions.length} of {sessions.length}
          </p>
        )}
      </div>

      {filteredSessions.length === 0 && trimmedQuery && (
        <p className="text-caption text-muted-foreground italic text-center py-8">
          No sessions match <span className="font-mono">{query}</span>
        </p>
      )}

      <AnimatePresence mode="popLayout">
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {currentSessions.map((session, index) => (
            <motion.div
              key={session.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{
                duration: 0.3,
                delay: index * 0.05,
                ease: [0.4, 0, 0.2, 1],
              }}
            >
              <Card
                className={cn(
                  "p-3 hover:bg-accent/50 transition-all duration-200 cursor-pointer group h-full",
                  session.todo_data && "bg-primary/5"
                )}
                onClick={() => {
                  // Emit a special event for Claude Code session navigation
                  const event = new CustomEvent('claude-session-selected', { 
                    detail: { session, projectPath } 
                  });
                  window.dispatchEvent(event);
                  onSessionClick?.(session);
                }}
              >
                <div className="flex flex-col h-full">
                  <div className="flex-1">
                    {/* Session header */}
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex items-start gap-1.5 flex-1 min-w-0">
                        <Clock className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                        <div className="flex-1 min-w-0">
                          <p className="text-body-small font-medium">
                            Session on {session.message_timestamp 
                              ? new Date(session.message_timestamp).toLocaleDateString('en-US', { 
                                  month: 'short', 
                                  day: 'numeric',
                                  year: 'numeric'
                                })
                              : new Date(session.created_at * 1000).toLocaleDateString('en-US', { 
                                  month: 'short', 
                                  day: 'numeric',
                                  year: 'numeric'
                                })
                            }
                          </p>
                        </div>
                      </div>
                      {session.todo_data && (
                        <span className="inline-flex items-center px-1.5 py-0.5 rounded text-caption font-medium bg-primary/10 text-primary">
                          Todo
                        </span>
                      )}
                    </div>
                    
                    {/* First message preview */}
                    {session.first_message ? (
                      <p className="text-caption text-muted-foreground line-clamp-2 mb-2">
                        {truncateText(getFirstLine(session.first_message), 120)}
                      </p>
                    ) : (
                      <p className="text-caption text-muted-foreground/60 italic mb-2">
                        No messages yet
                      </p>
                    )}
                  </div>
                  
                  {/* Metadata footer */}
                  <div className="flex items-center justify-between pt-2 border-t">
                    <p className="text-caption text-muted-foreground font-mono">
                      {session.id.slice(-8)}
                    </p>
                    {session.todo_data && (
                      <MessageSquare className="h-3 w-3 text-primary" />
                    )}
                  </div>
                </div>
              </Card>
            </motion.div>
          ))}
        </div>
      </AnimatePresence>
      
        {filteredSessions.length > 0 && (
          <Pagination
            currentPage={currentPage}
            totalPages={totalPages}
            onPageChange={setCurrentPage}
          />
        )}
      </div>
    </TooltipProvider>
  );
}; 