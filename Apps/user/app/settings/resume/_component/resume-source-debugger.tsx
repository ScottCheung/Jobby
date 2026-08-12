"use client";

import { useRef, useState } from "react";
import { FileSearch, FileUp } from "lucide-react";
import { api } from "@/lib/api";
import type { ResumeSource } from "@/lib/types";
import { Button } from "@jobby/ui";
import { Textarea } from "@/components/UI/textarea";

type ResumeSourceDebuggerProps = {
  onRunAiParse: (file: File) => Promise<void>;
  onRunAiRaw: (file: File) => Promise<Record<string, unknown>>;
  parsing: boolean;
};

export function ResumeSourceDebugger({
  onRunAiParse,
  onRunAiRaw,
  parsing,
}: ResumeSourceDebuggerProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [source, setSource] = useState<ResumeSource | null>(null);
  const [extracting, setExtracting] = useState(false);
  const [error, setError] = useState("");
  const [rawJson, setRawJson] = useState<Record<string, unknown> | null>(null);
  const [rawError, setRawError] = useState("");
  const [rawLoading, setRawLoading] = useState(false);

  if (process.env.NODE_ENV === "production") return null;

  const inspect = async (nextFile?: File) => {
    if (!nextFile) return;
    if (
      nextFile.type !== "application/pdf" &&
      !nextFile.name.toLowerCase().endsWith(".pdf")
    ) {
      setError("Upload a PDF resume.");
      return;
    }
    setFile(nextFile);
    setSource(null);
    setRawJson(null);
    setError("");
    setRawError("");
    setExtracting(true);
    try {
      setSource(await api.extractResumeSource(nextFile));
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Could not extract PDF text.",
      );
    } finally {
      setExtracting(false);
    }
  };

  const inspectRaw = async () => {
    if (!file) return;
    setRawError("");
    setRawJson(null);
    setRawLoading(true);
    try {
      setRawJson(await onRunAiRaw(file));
    } catch (err) {
      setRawError(
        err instanceof Error ? err.message : "Could not test AI output.",
      );
    } finally {
      setRawLoading(false);
    }
  };

  return (
    <section className="mt-6 hidden max-w-4xl border border-dashed border-amber-500/50 bg-amber-500/5 p-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-amber-700 dark:text-amber-300">
            <FileSearch className="size-4" />
            <h2 className="label">Development: PDF source check</h2>
          </div>
          <p className="body-sm mt-2 max-w-2xl text-ink-secondary">
            Extract the PDF text, then test the raw AI JSON without saving
            anything.
          </p>
        </div>
        <Button
          variant="secondary"
          size="md"
          Icon={FileSearch}
          isLoading={extracting}
          onClick={() => inputRef.current?.click()}
        >
          Test source extraction
        </Button>
      </div>
      <input
        ref={inputRef}
        className="hidden"
        type="file"
        accept="application/pdf,.pdf"
        onChange={(event) => void inspect(event.target.files?.[0])}
      />
      {error && (
        <p className="body-sm mt-4 rounded-md bg-red-500/10 p-3 text-red-600">
          {error}
        </p>
      )}
      {source && (
        <div className="mt-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="body-sm text-ink-secondary">
              {source.original_filename} · {source.page_count} pages ·{" "}
              {source.character_count.toLocaleString()} characters
            </p>
            {file && (
              <div className="flex flex-wrap gap-2">
                <Button
                  size="md"
                  Icon={FileUp}
                  isLoading={rawLoading}
                  onClick={() => void inspectRaw()}
                >
                  Test AI raw JSON
                </Button>
                <Button
                  variant="secondary"
                  size="md"
                  Icon={FileUp}
                  isLoading={parsing}
                  onClick={() => void onRunAiParse(file)}
                >
                  Run AI parser
                </Button>
              </div>
            )}
          </div>
          <Textarea
            readOnly
            value={source.text}
            minHeight={288}
            className="mt-3 w-full font-mono text-xs leading-5"
            aria-label="Extracted resume source text"
          />
          {rawError && (
            <p className="body-sm mt-4 rounded-md bg-red-500/10 p-3 text-red-600">
              {rawError}
            </p>
          )}
          {rawJson && (
            <div className="mt-4 border border-border bg-background-secondary p-4">
              <p className="label text-ink-primary">AI raw JSON</p>
              <p className="body-sm mt-1 text-ink-secondary">
                Direct model output before any server-side cleanup.
              </p>
              <Textarea
                readOnly
                value={JSON.stringify(rawJson, null, 2)}
                minHeight={288}
                className="mt-3 w-full font-mono text-xs leading-5"
                aria-label="AI raw JSON output"
              />
            </div>
          )}
        </div>
      )}
    </section>
  );
}
