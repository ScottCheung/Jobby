"use client";

import { useState } from "react";
import { FileJson2, Minus, Plus, ScanLine } from "lucide-react";
import type { MasterResumeData } from "@/lib/types";
import type { ResumeTemplateConfig } from "../../templates/types";
import { useSmartOnePage } from "../../templates/use-smart-one-page";
import { ResumeHtmlDocument } from "./resume-html-document";

export function TemplateWorkbench({
  config,
  data,
}: {
  config: ResumeTemplateConfig;
  data: MasterResumeData;
}) {
  const [zoom, setZoom] = useState(0.9);
  const smartPage = useSmartOnePage(config, data);
  const changeZoom = (delta: number) =>
    setZoom((current) => Math.min(1.4, Math.max(0.5, current + delta)));

  return (
    <main className="relative z-10 flex h-screen min-h-0 w-full flex-col bg-zinc-200 text-zinc-900">
      <header className="flex h-14 shrink-0 items-center justify-between border-b border-zinc-300 bg-white px-4 shadow-sm">
        <div className="flex min-w-0 items-center gap-3">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-zinc-900 text-white">
            <FileJson2 className="h-4 w-4" />
          </div>
          <div className="min-w-0">
            <h1 className="truncate text-sm font-semibold">{config.name}</h1>
            <p className="truncate text-xs text-zinc-500">
              templates/{config.id}.json · {config.paper.format}
            </p>
          </div>
        </div>
        <div className="flex h-9 items-center rounded-md border border-zinc-300 bg-white">
          <div
            className="flex h-full items-center gap-1.5 border-r border-zinc-300 px-2 text-zinc-600"
            title={`Smart one page: ${Math.round(smartPage.scale * 100)}%`}
          >
            <ScanLine className="h-4 w-4" />
            <span className="hidden text-xs font-medium tabular-nums sm:inline">
              {smartPage.settled ? Math.round(smartPage.scale * 100) : "…"}%
            </span>
          </div>
          <button
            type="button"
            aria-label="Zoom out"
            title="Zoom out"
            onClick={() => changeZoom(-0.1)}
            className="flex h-full w-9 items-center justify-center text-zinc-600 hover:bg-zinc-100"
          >
            <Minus className="h-4 w-4" />
          </button>
          <span className="w-14 text-center text-xs font-medium tabular-nums">
            {Math.round(zoom * 100)}%
          </span>
          <button
            type="button"
            aria-label="Zoom in"
            title="Zoom in"
            onClick={() => changeZoom(0.1)}
            className="flex h-full w-9 items-center justify-center text-zinc-600 hover:bg-zinc-100"
          >
            <Plus className="h-4 w-4" />
          </button>
        </div>
      </header>
      <div className="min-h-0 flex-1 overflow-auto p-6 md:p-10">
        <div
          className="mx-auto origin-top transition-transform duration-150"
          style={{
            width: smartPage.config.paper.widthPx * zoom,
            height: smartPage.config.paper.heightPx * zoom,
          }}
        >
          <div
            style={{ transform: `scale(${zoom})`, transformOrigin: "top left" }}
          >
            <ResumeHtmlDocument
              config={smartPage.config}
              data={data}
              pageRef={smartPage.pageRef}
            />
          </div>
        </div>
      </div>
    </main>
  );
}
