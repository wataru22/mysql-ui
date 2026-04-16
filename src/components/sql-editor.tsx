import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { executeQuery } from "@/lib/api";
import type { QueryResult } from "@/lib/types";
import { Play, Loader2, Clock, RotateCcw, Copy } from "lucide-react";
import { toast } from "sonner";

interface Props {
  defaultTable?: string;
}

export function SqlEditor({ defaultTable }: Props) {
  const [sql, setSql] = useState(defaultTable ? `SELECT * FROM \`${defaultTable}\` LIMIT 100;` : "");
  const [result, setResult] = useState<(QueryResult & { executionTime?: number }) | null>(null);
  const [loading, setLoading] = useState(false);
  const [history, setHistory] = useState<string[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const handleExecute = async () => {
    const trimmedSql = sql.trim();
    if (!trimmedSql) return;

    setLoading(true);
    try {
      const data = await executeQuery(trimmedSql);
      setResult(data);

      // Add to history (dedup)
      setHistory((prev) => {
        const filtered = prev.filter((h) => h !== trimmedSql);
        return [trimmedSql, ...filtered].slice(0, 50);
      });

      if (data.message) {
        toast.success(data.message);
      }
    } catch (err) {
      toast.error("Query failed", {
        description: err instanceof Error ? err.message : "Unknown error",
      });
      setResult(null);
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    // Cmd/Ctrl + Enter to execute
    if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
      e.preventDefault();
      handleExecute();
    }
  };

  const copyResults = () => {
    if (!result || result.rows.length === 0) return;
    const fields = result.fields.map((f) => f.name);
    const header = fields.join("\t");
    const rows = result.rows.map((row) =>
      fields.map((f) => {
        const v = row[f];
        return v === null ? "NULL" : String(v);
      }).join("\t")
    );
    navigator.clipboard.writeText([header, ...rows].join("\n"));
    toast.success("Copied to clipboard");
  };

  return (
    <div className="flex flex-col h-full">
      {/* SQL input */}
      <div className="p-4 border-b shrink-0">
        <div className="relative">
          <Textarea
            ref={textareaRef}
            value={sql}
            onChange={(e) => setSql(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Enter SQL query... (Ctrl+Enter to execute)"
            className="min-h-[120px] font-mono text-sm resize-y pr-4"
            spellCheck={false}
          />
        </div>
        <div className="flex items-center justify-between mt-2">
          <div className="flex gap-2">
            <Button onClick={handleExecute} disabled={loading || !sql.trim()} size="sm">
              {loading ? (
                <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
              ) : (
                <Play className="h-3.5 w-3.5 mr-1.5" />
              )}
              Execute
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowHistory(!showHistory)}
            >
              <Clock className="h-3.5 w-3.5 mr-1.5" />
              History ({history.length})
            </Button>
          </div>
          <span className="text-xs text-muted-foreground">Ctrl+Enter to run</span>
        </div>
      </div>

      {/* History */}
      {showHistory && history.length > 0 && (
        <div className="border-b max-h-48 overflow-auto bg-muted/30">
          {history.map((h, i) => (
            <button
              key={i}
              onClick={() => {
                setSql(h);
                setShowHistory(false);
              }}
              className="w-full text-left px-4 py-2 text-sm font-mono hover:bg-accent border-b last:border-0 truncate"
            >
              {h}
            </button>
          ))}
        </div>
      )}

      {/* Results */}
      <div className="flex-1 overflow-auto">
        {result && (
          <>
            {/* Results header */}
            <div className="flex items-center justify-between px-4 py-2 border-b bg-muted/30 sticky top-0">
              <div className="flex items-center gap-3">
                {result.rows.length > 0 && (
                  <span className="text-sm text-muted-foreground">
                    {result.rows.length} row{result.rows.length !== 1 ? "s" : ""}
                  </span>
                )}
                {result.affectedRows !== undefined && (
                  <Badge variant="secondary">
                    {result.affectedRows} affected
                  </Badge>
                )}
                {result.insertId !== undefined && result.insertId > 0 && (
                  <Badge variant="secondary">
                    Insert ID: {result.insertId}
                  </Badge>
                )}
                {result.executionTime !== undefined && (
                  <span className="text-xs text-muted-foreground">
                    {result.executionTime}ms
                  </span>
                )}
              </div>
              {result.rows.length > 0 && (
                <Button variant="ghost" size="sm" onClick={copyResults}>
                  <Copy className="h-3.5 w-3.5 mr-1.5" />
                  Copy
                </Button>
              )}
            </div>

            {/* Results table */}
            {result.rows.length > 0 && result.fields.length > 0 && (
              <Table>
                <TableHeader>
                  <TableRow>
                    {result.fields.map((f, i) => (
                      <TableHead key={i} className="min-w-[100px]">
                        {f.name}
                      </TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {result.rows.map((row, rowIdx) => (
                    <TableRow key={rowIdx}>
                      {result.fields.map((f, colIdx) => (
                        <TableCell key={colIdx} className="font-mono-data max-w-[300px] truncate">
                          {row[f.name] === null ? (
                            <span className="text-muted-foreground italic">NULL</span>
                          ) : typeof row[f.name] === "object" ? (
                            JSON.stringify(row[f.name])
                          ) : (
                            String(row[f.name])
                          )}
                        </TableCell>
                      ))}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}

            {/* Message only (no rows) */}
            {result.rows.length === 0 && result.message && (
              <div className="p-8 text-center text-muted-foreground">
                <p>{result.message}</p>
              </div>
            )}
          </>
        )}

        {!result && !loading && (
          <div className="flex items-center justify-center h-full text-muted-foreground">
            <div className="text-center">
              <p className="text-lg font-medium">Run a query to see results</p>
              <p className="text-sm mt-1">Use Ctrl+Enter for quick execution</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
