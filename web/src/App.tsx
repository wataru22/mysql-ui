import { useState, useCallback } from "react";
import type { ConnectionConfig, ConnectionTab } from "@/lib/types";
import { saveConnection, clearConnection } from "@/lib/api";
import { ConnectionForm } from "@/components/connection-form";
import { ConnectionPanel } from "@/components/connection-panel";
import { Database, Plus, X, LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/theme-toggle";
import { cn } from "@/lib/utils";

export default function App() {
  const [tabs, setTabs] = useState<ConnectionTab[]>([]);
  const [activeTabId, setActiveTabId] = useState<string | null>(null);
  const [showNewConnection, setShowNewConnection] = useState(true);

  const activeTab = tabs.find((t) => t.id === activeTabId) || null;

  const handleConnect = useCallback((config: ConnectionConfig) => {
    const id = crypto.randomUUID();
    const name = config.database
      ? `${config.database}@${config.host}`
      : `${config.user}@${config.host}:${config.port}`;
    const tab: ConnectionTab = { id, name, config };

    saveConnection(config);
    setTabs((prev) => [...prev, tab]);
    setActiveTabId(id);
    setShowNewConnection(false);
  }, []);

  const handleCloseTab = useCallback((id: string) => {
    setTabs((prev) => {
      const next = prev.filter((t) => t.id !== id);
      // If we closed the active tab, switch to another or show new connection
      if (id === activeTabId) {
        if (next.length > 0) {
          const closedIdx = prev.findIndex((t) => t.id === id);
          const newIdx = Math.min(closedIdx, next.length - 1);
          setActiveTabId(next[newIdx].id);
          saveConnection(next[newIdx].config);
        } else {
          setActiveTabId(null);
          setShowNewConnection(true);
          clearConnection();
        }
      }
      return next;
    });
  }, [activeTabId]);

  const handleSwitchTab = useCallback((id: string) => {
    const tab = tabs.find((t) => t.id === id);
    if (tab) {
      saveConnection(tab.config);
      setActiveTabId(id);
      setShowNewConnection(false);
    }
  }, [tabs]);

  const handleNewTab = useCallback(() => {
    setShowNewConnection(true);
    setActiveTabId(null);
  }, []);

  const handleDisconnectAll = useCallback(() => {
    clearConnection();
    setTabs([]);
    setActiveTabId(null);
    setShowNewConnection(true);
  }, []);

  // No tabs open — show connection form full screen
  if (tabs.length === 0 && showNewConnection) {
    return <ConnectionForm onConnect={handleConnect} />;
  }

  return (
    <div className="flex flex-col h-screen bg-background">
      {/* Connection tabs bar */}
      <div className="h-10 bg-muted/50 border-b flex items-center shrink-0 overflow-hidden">
        <div className="flex-1 flex items-center overflow-x-auto min-w-0">
          {tabs.map((tab) => (
            <div
              key={tab.id}
              className={cn(
                "group flex items-center gap-1.5 px-3 h-10 border-r text-sm cursor-pointer shrink-0 max-w-[200px] transition-colors",
                activeTabId === tab.id && !showNewConnection
                  ? "bg-background text-foreground border-b-2 border-b-primary"
                  : "text-muted-foreground hover:bg-background/50 hover:text-foreground"
              )}
              onClick={() => handleSwitchTab(tab.id)}
            >
              <Database className="h-3.5 w-3.5 shrink-0" />
              <span className="truncate">{tab.name}</span>
              <button
                className="ml-auto shrink-0 rounded-sm p-0.5 opacity-0 group-hover:opacity-100 hover:bg-muted transition-opacity"
                onClick={(e) => {
                  e.stopPropagation();
                  handleCloseTab(tab.id);
                }}
              >
                <X className="h-3 w-3" />
              </button>
            </div>
          ))}

          {/* New connection tab */}
          <button
            className={cn(
              "flex items-center gap-1.5 px-3 h-10 border-r text-sm cursor-pointer shrink-0 transition-colors",
              showNewConnection
                ? "bg-background text-foreground border-b-2 border-b-primary"
                : "text-muted-foreground hover:bg-background/50 hover:text-foreground"
            )}
            onClick={handleNewTab}
          >
            <Plus className="h-3.5 w-3.5" />
            <span>New Connection</span>
          </button>
        </div>

        <div className="flex items-center gap-1 px-2 shrink-0">
          <ThemeToggle />
          {tabs.length > 0 && (
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={handleDisconnectAll}
              title="Disconnect all"
            >
              <LogOut className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>

      {/* Content */}
      {showNewConnection ? (
        <div className="flex-1 overflow-auto">
          <ConnectionForm onConnect={handleConnect} hideThemeToggle />
        </div>
      ) : activeTab ? (
        <ConnectionPanel key={activeTab.id} config={activeTab.config} />
      ) : null}
    </div>
  );
}
