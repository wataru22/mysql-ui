import { useState, useRef, useMemo, useCallback } from "react";
import CodeMirror from "@uiw/react-codemirror";
import { sql, MySQL } from "@codemirror/lang-sql";
import { oneDark } from "@codemirror/theme-one-dark";
import type { Extension } from "@codemirror/state";
import { EditorView, keymap } from "@codemirror/view";
import { HighlightStyle, syntaxHighlighting } from "@codemirror/language";
import { tags as t } from "@lezer/highlight";
import { Button } from "@/components/ui/button";
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
import { Play, Loader2, Clock, Copy } from "lucide-react";
import { toast } from "sonner";
import { useResolvedTheme } from "@/hooks/use-theme";
import { cn } from "@/lib/utils";

const sqlLightTheme = EditorView.theme(
  {
    "&": {
      fontSize: "0.875rem",
      backgroundColor: "hsl(var(--background))",
      color: "hsl(var(--foreground))",
    },
    ".cm-scroller": {
      fontFamily:
        'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace',
    },
    ".cm-content": { caretColor: "hsl(var(--foreground))" },
    ".cm-cursor, .cm-dropCursor": { borderLeftColor: "hsl(var(--foreground))" },
    "&.cm-focused .cm-selectionLayer .cm-selectionBackground, .cm-selectionBackground": {
      background: "hsl(var(--accent) / 0.45)",
    },
    ".cm-gutters": {
      backgroundColor: "hsl(var(--muted))",
      color: "hsl(var(--muted-foreground))",
      border: "none",
    },
    ".cm-activeLineGutter": { backgroundColor: "transparent" },
    ".cm-activeLine": { backgroundColor: "hsl(var(--muted) / 0.35)" },
  },
  { dark: false }
);

const SQL_EDITOR_MIN_PX = 120;

function maxSqlEditorHeightPx() {
  return Math.min(Math.floor(window.innerHeight * 0.72), 560);
}

function clampSqlEditorHeight(view: EditorView) {
  const cap = maxSqlEditorHeightPx();
  const next = Math.max(SQL_EDITOR_MIN_PX, Math.min(view.contentHeight, cap));
  view.dom.style.height = `${next}px`;
}

/** Grow with document height; cap so very long scripts scroll inside the editor. */
function sqlEditorAutoHeight(): Extension[] {
  return [
    EditorView.theme({
      "&": { height: "auto", minHeight: `${SQL_EDITOR_MIN_PX}px` },
      ".cm-scroller": {
        height: "100% !important",
        overflowY: "auto",
      },
    }),
    EditorView.updateListener.of((update) => {
      if (update.geometryChanged || update.docChanged) {
        queueMicrotask(() => clampSqlEditorHeight(update.view));
      }
    }),
  ];
}

const sqlLightHighlight = syntaxHighlighting(
  HighlightStyle.define([
    { tag: t.keyword, color: "hsl(291 64% 42%)" },
    { tag: t.operator, color: "hsl(221 83% 40%)" },
    { tag: t.string, color: "hsl(161 94% 28%)" },
    { tag: t.number, color: "hsl(24 95% 38%)" },
    { tag: t.bool, color: "hsl(24 95% 38%)" },
    { tag: t.null, color: "hsl(280 65% 45%)", fontStyle: "italic" },
    { tag: t.comment, color: "hsl(var(--muted-foreground))", fontStyle: "italic" },
    { tag: t.variableName, color: "hsl(222 47% 40%)" },
    { tag: t.typeName, color: "hsl(262 83% 40%)" },
    { tag: t.bracket, color: "hsl(var(--foreground))" },
    { tag: t.punctuation, color: "hsl(var(--muted-foreground))" },
  ])
);

interface Props {
  defaultTable?: string;
}

export function SqlEditor({ defaultTable }: Props) {
  const [sqlText, setSqlText] = useState(
    defaultTable ? `SELECT * FROM \`${defaultTable}\` LIMIT 100;` : ""
  );
  const [result, setResult] = useState<(QueryResult & { executionTime?: number }) | null>(null);
  const [loading, setLoading] = useState(false);
  const [history, setHistory] = useState<string[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  const resolvedTheme = useResolvedTheme();
  const handleExecuteRef = useRef<() => void>(() => {});

  const handleExecute = useCallback(async () => {
    const trimmedSql = sqlText.trim();
    if (!trimmedSql) return;

    setLoading(true);
    try {
      const data = await executeQuery(trimmedSql);
      setResult(data);

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
  }, [sqlText]);

  handleExecuteRef.current = handleExecute;

  const extensions = useMemo(
    () => [
      sql({ dialect: MySQL, upperCaseKeywords: false }),
      EditorView.contentAttributes.of({ spellcheck: "false" }),
      keymap.of([
        {
          key: "Mod-Enter",
          preventDefault: true,
          run: () => {
            void handleExecuteRef.current();
            return true;
          },
        },
      ]),
      ...(resolvedTheme === "dark" ? [oneDark] : [sqlLightTheme, sqlLightHighlight]),
      ...sqlEditorAutoHeight(),
    ],
    [resolvedTheme]
  );

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
      <div className="p-4 border-b shrink-0">
        <div
          className={cn(
            "rounded-md border border-input bg-background ring-offset-background",
            "focus-within:outline-none focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2",
            "overflow-hidden"
          )}
        >
          <CodeMirror
            value={sqlText}
            theme="none"
            className="text-sm [&_.cm-editor.cm-focused]:outline-none"
            placeholder="Enter SQL query... (Ctrl+Enter to execute)"
            extensions={extensions}
            onChange={(v) => setSqlText(v)}
            onCreateEditor={(view) => {
              queueMicrotask(() => clampSqlEditorHeight(view));
            }}
            basicSetup={{
              lineNumbers: true,
              foldGutter: false,
              highlightActiveLine: resolvedTheme === "dark",
            }}
          />
        </div>
        <div className="flex items-center justify-between mt-2">
          <div className="flex gap-2">
            <Button onClick={handleExecute} disabled={loading || !sqlText.trim()} size="sm">
              {loading ? (
                <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
              ) : (
                <Play className="h-3.5 w-3.5 mr-1.5" />
              )}
              Execute
            </Button>
            <Button variant="outline" size="sm" onClick={() => setShowHistory(!showHistory)}>
              <Clock className="h-3.5 w-3.5 mr-1.5" />
              History ({history.length})
            </Button>
          </div>
          <span className="text-xs text-muted-foreground">Ctrl+Enter to run</span>
        </div>
      </div>

      {showHistory && history.length > 0 && (
        <div className="border-b max-h-48 overflow-auto bg-muted/30">
          {history.map((h, i) => (
            <button
              key={i}
              onClick={() => {
                setSqlText(h);
                setShowHistory(false);
              }}
              className="w-full text-left px-4 py-2 text-sm font-mono hover:bg-accent border-b last:border-0 truncate"
            >
              {h}
            </button>
          ))}
        </div>
      )}

      <div className="flex-1 overflow-auto">
        {result && (
          <>
            <div className="flex items-center justify-between px-4 py-2 border-b bg-muted/30 sticky top-0">
              <div className="flex items-center gap-3">
                {result.rows.length > 0 && (
                  <span className="text-sm text-muted-foreground">
                    {result.rows.length} row{result.rows.length !== 1 ? "s" : ""}
                  </span>
                )}
                {result.affectedRows !== undefined && (
                  <Badge variant="secondary">{result.affectedRows} affected</Badge>
                )}
                {result.insertId !== undefined && result.insertId > 0 && (
                  <Badge variant="secondary">Insert ID: {result.insertId}</Badge>
                )}
                {result.executionTime !== undefined && (
                  <span className="text-xs text-muted-foreground">{result.executionTime}ms</span>
                )}
              </div>
              {result.rows.length > 0 && (
                <Button variant="ghost" size="sm" onClick={copyResults}>
                  <Copy className="h-3.5 w-3.5 mr-1.5" />
                  Copy
                </Button>
              )}
            </div>

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
