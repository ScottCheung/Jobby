import { createHotContext as __vite__createHotContext } from "/vendor/vite-client.js";import.meta.hot = __vite__createHotContext("/vendor/fs-Users-xianzhezhang-Projects-Jobby-Jobby-packages-ui-src-components-UI-Resume-CoverLetterPdfPreview.tsx.js");import __vite__cjsImport0_react_jsxDevRuntime from "/vendor/.vite-deps-react_jsx-dev-runtime.js__v--f5b0ea50.js"; const Fragment = __vite__cjsImport0_react_jsxDevRuntime["Fragment"]; const jsxDEV = __vite__cjsImport0_react_jsxDevRuntime["jsxDEV"];
import * as RefreshRuntime from "/vendor/react-refresh.js";
const inWebWorker = typeof WorkerGlobalScope !== "undefined" && self instanceof WorkerGlobalScope;
let prevRefreshReg;
let prevRefreshSig;
if (import.meta.hot && !inWebWorker) {
  if (!window.$RefreshReg$) {
    throw new Error(
      "@vitejs/plugin-react can't detect preamble. Something is wrong."
    );
  }
  prevRefreshReg = window.$RefreshReg$;
  prevRefreshSig = window.$RefreshSig$;
  window.$RefreshReg$ = RefreshRuntime.getRefreshReg("/Users/xianzhezhang/Projects/Jobby/Jobby/packages/ui/src/components/UI/Resume/CoverLetterPdfPreview.tsx");
  window.$RefreshSig$ = RefreshRuntime.createSignatureFunctionForTransform;
}
"use client";
var _s = $RefreshSig$();
import __vite__cjsImport3_react from "/vendor/.vite-deps-react.js__v--f5b0ea50.js"; const useEffect = __vite__cjsImport3_react["useEffect"]; const useMemo = __vite__cjsImport3_react["useMemo"]; const useRef = __vite__cjsImport3_react["useRef"]; const useState = __vite__cjsImport3_react["useState"];
import __vite__cjsImport4_reactDom from "/vendor/.vite-deps-react-dom.js__v--f5b0ea50.js"; const createPortal = __vite__cjsImport4_reactDom["createPortal"];
import {
  Download,
  Edit3,
  ExternalLink,
  FileText,
  Loader2,
  Maximize2,
  X
} from "/vendor/.vite-deps-lucide-react.js__v--d47d6985.js";
import {
  Document,
  Link as PdfLink,
  Page,
  Path as PdfPath,
  Svg as PdfSvg,
  Text,
  View,
  pdf
} from "/vendor/.vite-deps-@react-pdf_renderer.js__v--e810af01.js";
import { Button } from "/vendor/fs-Users-xianzhezhang-Projects-Jobby-Jobby-packages-ui-src-components-UI-Button-index.tsx.js";
import { Mail, Phone, MapPin, FolderGit2, Globe } from "/vendor/.vite-deps-lucide-react.js__v--d47d6985.js";
import {
  formatCoverLetterFilename,
  resumeContactItems,
  resumeFullName
} from "/vendor/fs-Users-xianzhezhang-Projects-Jobby-Jobby-packages-ui-src-components-UI-Resume-helpers.ts.js";
import {
  CLBG_MAIN_PATH_D,
  COVER_LETTER_GOLD_SVG_DATA_URI
} from "/vendor/fs-Users-xianzhezhang-Projects-Jobby-Jobby-packages-ui-src-components-UI-Resume-cover-letter-contour.ts.js";
export const COVER_LETTER_SIGNATURE_STYLE = {
  fontFamily: "'Times New Roman', Times, serif",
  fontStyle: "italic",
  fontWeight: 600
};
function computeLayoutMetrics(text) {
  const wordCount = text.trim().split(/\s+/).filter(Boolean).length;
  const charCount = text.length;
  if (wordCount < 160 || charCount < 950) {
    return {
      bodyFontSize: 11.5,
      bodyLineHeight: 1.85,
      paragraphGap: 20,
      paddingTop: 50,
      paddingBottom: 45,
      paddingX: 50,
      headerGap: 20,
      namePaddingBottom: 5,
      ruleMarginTop: 9,
      salutationGapTop: 16,
      salutationGapBottom: 16,
      signatureGapTop: 28
    };
  } else if (wordCount < 260 || charCount < 1600) {
    return {
      bodyFontSize: 10.8,
      bodyLineHeight: 1.72,
      paragraphGap: 15,
      paddingTop: 115,
      paddingBottom: 40,
      paddingX: 48,
      headerGap: 18,
      namePaddingBottom: 4,
      ruleMarginTop: 8,
      salutationGapTop: 14,
      salutationGapBottom: 14,
      signatureGapTop: 22
    };
  } else {
    return {
      bodyFontSize: 9.8,
      bodyLineHeight: 1.58,
      paragraphGap: 10,
      paddingTop: 90,
      paddingBottom: 35,
      paddingX: 46,
      headerGap: 14,
      namePaddingBottom: 4,
      ruleMarginTop: 7,
      salutationGapTop: 12,
      salutationGapBottom: 10,
      signatureGapTop: 16
    };
  }
}
function parseCoverLetterContent(text, candidateData, company) {
  const rawParagraphs = text.split(/\n\s*\n/).map((p) => p.trim()).filter((p) => Boolean(p));
  let salutation = "";
  let signoff = "Sincerely";
  let signoffName = candidateData ? resumeFullName(candidateData) : "Scott Zhang";
  const remainingParagraphs = [];
  for (let i = 0; i < rawParagraphs.length; i++) {
    const p = rawParagraphs[i];
    if (!p) continue;
    if (i === 0 && /^Dear\b/i.test(p)) {
      salutation = p.replace(/,\s*$/, "");
      continue;
    }
    if (i === rawParagraphs.length - 1 && /^(Sincerely|Best regards|Kind regards|Warm regards|Regards|Respectfully|Yours sincerely)/i.test(
      p
    )) {
      const lines = p.split("\n").map((l) => l.trim()).filter((l) => Boolean(l));
      const firstLine = lines[0];
      if (firstLine) {
        signoff = firstLine.replace(/,\s*$/, "") || "Sincerely";
      }
      if (lines.length > 1) {
        signoffName = lines.slice(1).join(" ");
      }
      continue;
    }
    remainingParagraphs.push(p);
  }
  if (!salutation) {
    salutation = company ? `Dear Hiring Team at ${company}` : "Dear Hiring Manager";
  }
  return {
    salutation,
    paragraphs: remainingParagraphs.length > 0 ? remainingParagraphs : rawParagraphs,
    signoff,
    signoffName
  };
}
function renderPdfFormattedParagraph(text, fontSize, lineHeight, marginBottom, keyPrefix) {
  const parts = text.split(/(\*\*.*?\*\*)/g);
  return /* @__PURE__ */ jsxDEV(
    Text,
    {
      style: {
        fontSize,
        lineHeight,
        marginBottom,
        color: "#292524",
        textAlign: "justify"
      },
      children: parts.map((part, index) => {
        if (part.startsWith("**") && part.endsWith("**")) {
          return /* @__PURE__ */ jsxDEV(
            Text,
            {
              style: {
                fontFamily: "Helvetica-Bold",
                color: "#1C1917"
              },
              children: part.slice(2, -2)
            },
            index,
            false,
            {
              fileName: "/Users/xianzhezhang/Projects/Jobby/Jobby/packages/ui/src/components/UI/Resume/CoverLetterPdfPreview.tsx",
              lineNumber: 245,
              columnNumber: 13
            },
            this
          );
        }
        return /* @__PURE__ */ jsxDEV(Text, { children: part }, index, false, {
          fileName: "/Users/xianzhezhang/Projects/Jobby/Jobby/packages/ui/src/components/UI/Resume/CoverLetterPdfPreview.tsx",
          lineNumber: 256,
          columnNumber: 16
        }, this);
      })
    },
    keyPrefix,
    false,
    {
      fileName: "/Users/xianzhezhang/Projects/Jobby/Jobby/packages/ui/src/components/UI/Resume/CoverLetterPdfPreview.tsx",
      lineNumber: 232,
      columnNumber: 5
    },
    this
  );
}
function PdfContactIcon({ type, color }) {
  const size = 7.5;
  const svgStyle = {
    width: size,
    height: size,
    marginRight: 2.5,
    marginTop: -0.1
  };
  switch (type) {
    case "email":
      return /* @__PURE__ */ jsxDEV(PdfSvg, { viewBox: "0 0 24 24", style: svgStyle, children: /* @__PURE__ */ jsxDEV(
        PdfPath,
        {
          fill: "none",
          stroke: color,
          strokeWidth: "2",
          strokeLinecap: "round",
          strokeLinejoin: "round",
          d: "M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z M22 6l-10 7L2 6"
        },
        void 0,
        false,
        {
          fileName: "/Users/xianzhezhang/Projects/Jobby/Jobby/packages/ui/src/components/UI/Resume/CoverLetterPdfPreview.tsx",
          lineNumber: 275,
          columnNumber: 11
        },
        this
      ) }, void 0, false, {
        fileName: "/Users/xianzhezhang/Projects/Jobby/Jobby/packages/ui/src/components/UI/Resume/CoverLetterPdfPreview.tsx",
        lineNumber: 274,
        columnNumber: 9
      }, this);
    case "phone":
      return /* @__PURE__ */ jsxDEV(PdfSvg, { viewBox: "0 0 24 24", style: svgStyle, children: /* @__PURE__ */ jsxDEV(
        PdfPath,
        {
          fill: "none",
          stroke: color,
          strokeWidth: "2",
          strokeLinecap: "round",
          strokeLinejoin: "round",
          d: "M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"
        },
        void 0,
        false,
        {
          fileName: "/Users/xianzhezhang/Projects/Jobby/Jobby/packages/ui/src/components/UI/Resume/CoverLetterPdfPreview.tsx",
          lineNumber: 288,
          columnNumber: 11
        },
        this
      ) }, void 0, false, {
        fileName: "/Users/xianzhezhang/Projects/Jobby/Jobby/packages/ui/src/components/UI/Resume/CoverLetterPdfPreview.tsx",
        lineNumber: 287,
        columnNumber: 9
      }, this);
    case "location":
      return /* @__PURE__ */ jsxDEV(PdfSvg, { viewBox: "0 0 24 24", style: svgStyle, children: /* @__PURE__ */ jsxDEV(
        PdfPath,
        {
          fill: "none",
          stroke: color,
          strokeWidth: "2",
          strokeLinecap: "round",
          strokeLinejoin: "round",
          d: "M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z M12 10a3 3 0 1 0 0-6 3 3 0 0 0 0 6z"
        },
        void 0,
        false,
        {
          fileName: "/Users/xianzhezhang/Projects/Jobby/Jobby/packages/ui/src/components/UI/Resume/CoverLetterPdfPreview.tsx",
          lineNumber: 301,
          columnNumber: 11
        },
        this
      ) }, void 0, false, {
        fileName: "/Users/xianzhezhang/Projects/Jobby/Jobby/packages/ui/src/components/UI/Resume/CoverLetterPdfPreview.tsx",
        lineNumber: 300,
        columnNumber: 9
      }, this);
    case "linkedin":
      return /* @__PURE__ */ jsxDEV(PdfSvg, { viewBox: "0 0 24 24", style: svgStyle, children: /* @__PURE__ */ jsxDEV(
        PdfPath,
        {
          fill: "none",
          stroke: color,
          strokeWidth: "2",
          strokeLinecap: "round",
          strokeLinejoin: "round",
          d: "M16 8a6 6 0 0 1 6 6v7h-4v-7a2 2 0 0 0-2-2 2 2 0 0 0-2 2v7h-4v-7a6 6 0 0 1 6-6z M2 9h4v12H2z M4 6a2 2 0 1 0 0-4 2 2 0 0 0 0 4z"
        },
        void 0,
        false,
        {
          fileName: "/Users/xianzhezhang/Projects/Jobby/Jobby/packages/ui/src/components/UI/Resume/CoverLetterPdfPreview.tsx",
          lineNumber: 314,
          columnNumber: 11
        },
        this
      ) }, void 0, false, {
        fileName: "/Users/xianzhezhang/Projects/Jobby/Jobby/packages/ui/src/components/UI/Resume/CoverLetterPdfPreview.tsx",
        lineNumber: 313,
        columnNumber: 9
      }, this);
    case "portfolio":
      return /* @__PURE__ */ jsxDEV(PdfSvg, { viewBox: "0 0 24 24", style: svgStyle, children: /* @__PURE__ */ jsxDEV(
        PdfPath,
        {
          fill: "none",
          stroke: color,
          strokeWidth: "2",
          strokeLinecap: "round",
          strokeLinejoin: "round",
          d: "M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"
        },
        void 0,
        false,
        {
          fileName: "/Users/xianzhezhang/Projects/Jobby/Jobby/packages/ui/src/components/UI/Resume/CoverLetterPdfPreview.tsx",
          lineNumber: 327,
          columnNumber: 11
        },
        this
      ) }, void 0, false, {
        fileName: "/Users/xianzhezhang/Projects/Jobby/Jobby/packages/ui/src/components/UI/Resume/CoverLetterPdfPreview.tsx",
        lineNumber: 326,
        columnNumber: 9
      }, this);
    case "website":
      return /* @__PURE__ */ jsxDEV(PdfSvg, { viewBox: "0 0 24 24", style: svgStyle, children: /* @__PURE__ */ jsxDEV(
        PdfPath,
        {
          fill: "none",
          stroke: color,
          strokeWidth: "2",
          strokeLinecap: "round",
          strokeLinejoin: "round",
          d: "M12 22C17.5228 22 22 17.5228 22 12C22 6.47715 17.5228 2 12 2C6.47715 2 2 6.47715 2 12C2 17.5228 6.47715 22 12 22Z M2 12h20"
        },
        void 0,
        false,
        {
          fileName: "/Users/xianzhezhang/Projects/Jobby/Jobby/packages/ui/src/components/UI/Resume/CoverLetterPdfPreview.tsx",
          lineNumber: 340,
          columnNumber: 11
        },
        this
      ) }, void 0, false, {
        fileName: "/Users/xianzhezhang/Projects/Jobby/Jobby/packages/ui/src/components/UI/Resume/CoverLetterPdfPreview.tsx",
        lineNumber: 339,
        columnNumber: 9
      }, this);
    default:
      return null;
  }
}
_c = PdfContactIcon;
export function CoverLetterPdfDocument({
  coverLetter,
  candidateData,
  company,
  jobTitle
}) {
  const name = candidateData ? resumeFullName(candidateData) : "Scott Zhang";
  const headline = candidateData?.basics?.headline;
  const contacts = candidateData ? resumeContactItems(candidateData) : [];
  const metrics = computeLayoutMetrics(coverLetter);
  const { salutation, paragraphs, signoff, signoffName } = parseCoverLetterContent(coverLetter, candidateData, company);
  const formattedDate = (/* @__PURE__ */ new Date()).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric"
  });
  const subjectTitle = jobTitle ? `RE: Application for ${jobTitle}${company ? ` — ${company}` : ""}` : `RE: Job Application${company ? ` — ${company}` : ""}`;
  return /* @__PURE__ */ jsxDEV(Document, { title: `${name} - Cover Letter`, children: /* @__PURE__ */ jsxDEV(
    Page,
    {
      size: "A4",
      style: {
        paddingTop: metrics.paddingTop,
        paddingBottom: metrics.paddingBottom,
        paddingLeft: metrics.paddingX,
        paddingRight: metrics.paddingX,
        backgroundColor: "#ffffff",
        fontFamily: "Helvetica",
        color: "#292524",
        position: "relative"
      },
      children: [
        /* @__PURE__ */ jsxDEV(
          PdfSvg,
          {
            viewBox: "0 0 928 888",
            style: {
              position: "absolute",
              top: -50,
              right: -30,
              width: 150,
              height: 150,
              opacity: 1,
              transform: "rotate(-85deg)"
            },
            children: /* @__PURE__ */ jsxDEV(
              PdfPath,
              {
                d: CLBG_MAIN_PATH_D,
                fill: "#D4A853",
                transform: "matrix(0.866025, 0.5, -0.500207, 0.866384, 309.4571, 6.361)"
              },
              void 0,
              false,
              {
                fileName: "/Users/xianzhezhang/Projects/Jobby/Jobby/packages/ui/src/components/UI/Resume/CoverLetterPdfPreview.tsx",
                lineNumber: 412,
                columnNumber: 11
              },
              this
            )
          },
          void 0,
          false,
          {
            fileName: "/Users/xianzhezhang/Projects/Jobby/Jobby/packages/ui/src/components/UI/Resume/CoverLetterPdfPreview.tsx",
            lineNumber: 400,
            columnNumber: 9
          },
          this
        ),
        /* @__PURE__ */ jsxDEV(
          PdfSvg,
          {
            viewBox: "0 0 928 888",
            style: {
              position: "absolute",
              bottom: -110,
              left: -100,
              width: 370,
              height: 370,
              opacity: 0.28,
              transform: "rotate(-25deg)"
            },
            children: /* @__PURE__ */ jsxDEV(
              PdfPath,
              {
                d: CLBG_MAIN_PATH_D,
                fill: "#D4A853",
                transform: "matrix(0.866025, 0.5, -0.500207, 0.866384, 309.4571, 6.361)"
              },
              void 0,
              false,
              {
                fileName: "/Users/xianzhezhang/Projects/Jobby/Jobby/packages/ui/src/components/UI/Resume/CoverLetterPdfPreview.tsx",
                lineNumber: 432,
                columnNumber: 11
              },
              this
            )
          },
          void 0,
          false,
          {
            fileName: "/Users/xianzhezhang/Projects/Jobby/Jobby/packages/ui/src/components/UI/Resume/CoverLetterPdfPreview.tsx",
            lineNumber: 420,
            columnNumber: 9
          },
          this
        ),
        /* @__PURE__ */ jsxDEV(
          View,
          {
            style: {
              marginBottom: 30,
              marginTop: -10,
              position: "relative",
              zIndex: 10
            },
            children: /* @__PURE__ */ jsxDEV(
              View,
              {
                style: {
                  backgroundColor: "#FAF5EC",
                  // borderWidth: 0.8,
                  // borderColor: '#DEC8A0',
                  borderRadius: 9999,
                  paddingHorizontal: 18,
                  paddingVertical: 8,
                  marginLeft: -10,
                  alignSelf: "flex-start"
                },
                children: /* @__PURE__ */ jsxDEV(
                  Text,
                  {
                    style: {
                      fontSize: 8.8,
                      fontFamily: "Helvetica-Bold",
                      color: "#784508",
                      letterSpacing: 0.2
                    },
                    children: subjectTitle
                  },
                  void 0,
                  false,
                  {
                    fileName: "/Users/xianzhezhang/Projects/Jobby/Jobby/packages/ui/src/components/UI/Resume/CoverLetterPdfPreview.tsx",
                    lineNumber: 459,
                    columnNumber: 13
                  },
                  this
                )
              },
              void 0,
              false,
              {
                fileName: "/Users/xianzhezhang/Projects/Jobby/Jobby/packages/ui/src/components/UI/Resume/CoverLetterPdfPreview.tsx",
                lineNumber: 447,
                columnNumber: 11
              },
              this
            )
          },
          void 0,
          false,
          {
            fileName: "/Users/xianzhezhang/Projects/Jobby/Jobby/packages/ui/src/components/UI/Resume/CoverLetterPdfPreview.tsx",
            lineNumber: 439,
            columnNumber: 9
          },
          this
        ),
        /* @__PURE__ */ jsxDEV(
          View,
          {
            style: {
              marginBottom: metrics.headerGap,
              position: "relative",
              zIndex: 10
            },
            children: [
              /* @__PURE__ */ jsxDEV(
                Text,
                {
                  style: {
                    fontSize: 23,
                    fontFamily: "Helvetica-Bold",
                    color: "#1C1917",
                    lineHeight: 1.1,
                    letterSpacing: -0.2,
                    marginBottom: metrics.namePaddingBottom
                  },
                  children: name
                },
                void 0,
                false,
                {
                  fileName: "/Users/xianzhezhang/Projects/Jobby/Jobby/packages/ui/src/components/UI/Resume/CoverLetterPdfPreview.tsx",
                  lineNumber: 479,
                  columnNumber: 11
                },
                this
              ),
              headline && /* @__PURE__ */ jsxDEV(
                Text,
                {
                  style: {
                    fontSize: 9.8,
                    fontFamily: "Helvetica-Bold",
                    color: "#784508",
                    marginBottom: 3
                  },
                  children: headline
                },
                void 0,
                false,
                {
                  fileName: "/Users/xianzhezhang/Projects/Jobby/Jobby/packages/ui/src/components/UI/Resume/CoverLetterPdfPreview.tsx",
                  lineNumber: 493,
                  columnNumber: 11
                },
                this
              ),
              contacts.length > 0 && /* @__PURE__ */ jsxDEV(
                View,
                {
                  style: {
                    flexDirection: "row",
                    flexWrap: "wrap",
                    alignItems: "center",
                    marginTop: 2,
                    marginBottom: 2
                  },
                  children: contacts.map(
                    (item, idx) => /* @__PURE__ */ jsxDEV(
                      View,
                      {
                        style: {
                          flexDirection: "row",
                          alignItems: "center"
                        },
                        children: [
                          idx > 0 && /* @__PURE__ */ jsxDEV(
                            Text,
                            {
                              style: {
                                marginHorizontal: 4,
                                color: "#DEC8A0",
                                fontSize: 8.5
                              },
                              children: "|"
                            },
                            void 0,
                            false,
                            {
                              fileName: "/Users/xianzhezhang/Projects/Jobby/Jobby/packages/ui/src/components/UI/Resume/CoverLetterPdfPreview.tsx",
                              lineNumber: 524,
                              columnNumber: 15
                            },
                            this
                          ),
                          /* @__PURE__ */ jsxDEV(PdfContactIcon, { type: item.type, color: "#784508" }, void 0, false, {
                            fileName: "/Users/xianzhezhang/Projects/Jobby/Jobby/packages/ui/src/components/UI/Resume/CoverLetterPdfPreview.tsx",
                            lineNumber: 534,
                            columnNumber: 19
                          }, this),
                          item.href ? /* @__PURE__ */ jsxDEV(
                            PdfLink,
                            {
                              src: item.href,
                              style: {
                                fontSize: 8.5,
                                color: "#57534E",
                                textDecoration: "none"
                              },
                              children: item.text
                            },
                            void 0,
                            false,
                            {
                              fileName: "/Users/xianzhezhang/Projects/Jobby/Jobby/packages/ui/src/components/UI/Resume/CoverLetterPdfPreview.tsx",
                              lineNumber: 536,
                              columnNumber: 15
                            },
                            this
                          ) : /* @__PURE__ */ jsxDEV(Text, { style: { fontSize: 8.5, color: "#57534E" }, children: item.text }, void 0, false, {
                            fileName: "/Users/xianzhezhang/Projects/Jobby/Jobby/packages/ui/src/components/UI/Resume/CoverLetterPdfPreview.tsx",
                            lineNumber: 546,
                            columnNumber: 15
                          }, this)
                        ]
                      },
                      idx,
                      true,
                      {
                        fileName: "/Users/xianzhezhang/Projects/Jobby/Jobby/packages/ui/src/components/UI/Resume/CoverLetterPdfPreview.tsx",
                        lineNumber: 516,
                        columnNumber: 13
                      },
                      this
                    )
                  )
                },
                void 0,
                false,
                {
                  fileName: "/Users/xianzhezhang/Projects/Jobby/Jobby/packages/ui/src/components/UI/Resume/CoverLetterPdfPreview.tsx",
                  lineNumber: 506,
                  columnNumber: 11
                },
                this
              ),
              /* @__PURE__ */ jsxDEV(
                View,
                {
                  style: {
                    width: "100%",
                    height: 1.5,
                    backgroundColor: "#D4A853",
                    marginTop: metrics.ruleMarginTop
                  }
                },
                void 0,
                false,
                {
                  fileName: "/Users/xianzhezhang/Projects/Jobby/Jobby/packages/ui/src/components/UI/Resume/CoverLetterPdfPreview.tsx",
                  lineNumber: 556,
                  columnNumber: 11
                },
                this
              )
            ]
          },
          void 0,
          true,
          {
            fileName: "/Users/xianzhezhang/Projects/Jobby/Jobby/packages/ui/src/components/UI/Resume/CoverLetterPdfPreview.tsx",
            lineNumber: 472,
            columnNumber: 9
          },
          this
        ),
        /* @__PURE__ */ jsxDEV(
          View,
          {
            style: {
              flexDirection: "row",
              justifyContent: "space-between",
              alignItems: "baseline",
              marginBottom: metrics.salutationGapBottom,
              position: "relative",
              zIndex: 10
            },
            children: [
              /* @__PURE__ */ jsxDEV(
                Text,
                {
                  style: {
                    fontSize: 13,
                    fontFamily: "Helvetica-Bold",
                    color: "#1C1917",
                    lineHeight: 1.1,
                    letterSpacing: -0.2,
                    marginBottom: metrics.namePaddingBottom
                    // textTransform: 'uppercase',
                  },
                  children: [
                    salutation,
                    ","
                  ]
                },
                void 0,
                true,
                {
                  fileName: "/Users/xianzhezhang/Projects/Jobby/Jobby/packages/ui/src/components/UI/Resume/CoverLetterPdfPreview.tsx",
                  lineNumber: 577,
                  columnNumber: 11
                },
                this
              ),
              /* @__PURE__ */ jsxDEV(
                Text,
                {
                  style: {
                    fontSize: 8.8,
                    color: "#78716C",
                    fontFamily: "Helvetica"
                  },
                  children: formattedDate
                },
                void 0,
                false,
                {
                  fileName: "/Users/xianzhezhang/Projects/Jobby/Jobby/packages/ui/src/components/UI/Resume/CoverLetterPdfPreview.tsx",
                  lineNumber: 591,
                  columnNumber: 11
                },
                this
              )
            ]
          },
          void 0,
          true,
          {
            fileName: "/Users/xianzhezhang/Projects/Jobby/Jobby/packages/ui/src/components/UI/Resume/CoverLetterPdfPreview.tsx",
            lineNumber: 567,
            columnNumber: 9
          },
          this
        ),
        /* @__PURE__ */ jsxDEV(View, { style: { position: "relative", zIndex: 10 }, children: paragraphs.map(
          (para, i) => renderPdfFormattedParagraph(
            para,
            metrics.bodyFontSize,
            metrics.bodyLineHeight,
            metrics.paragraphGap,
            `para-${i}`
          )
        ) }, void 0, false, {
          fileName: "/Users/xianzhezhang/Projects/Jobby/Jobby/packages/ui/src/components/UI/Resume/CoverLetterPdfPreview.tsx",
          lineNumber: 603,
          columnNumber: 9
        }, this),
        /* @__PURE__ */ jsxDEV(
          View,
          {
            style: {
              marginTop: metrics.signatureGapTop,
              alignSelf: "flex-end",
              alignItems: "flex-end",
              position: "relative",
              zIndex: 10
            },
            children: [
              /* @__PURE__ */ jsxDEV(
                Text,
                {
                  style: {
                    fontSize: metrics.bodyFontSize * 0.95,
                    color: "#44403C",
                    marginBottom: 2,
                    fontFamily: "Helvetica"
                  },
                  children: [
                    signoff,
                    ","
                  ]
                },
                void 0,
                true,
                {
                  fileName: "/Users/xianzhezhang/Projects/Jobby/Jobby/packages/ui/src/components/UI/Resume/CoverLetterPdfPreview.tsx",
                  lineNumber: 625,
                  columnNumber: 11
                },
                this
              ),
              /* @__PURE__ */ jsxDEV(
                Text,
                {
                  style: {
                    fontSize: 22,
                    fontFamily: "Times-Italic",
                    color: "#784508",
                    transform: "rotate(-2deg)"
                  },
                  children: signoffName
                },
                void 0,
                false,
                {
                  fileName: "/Users/xianzhezhang/Projects/Jobby/Jobby/packages/ui/src/components/UI/Resume/CoverLetterPdfPreview.tsx",
                  lineNumber: 635,
                  columnNumber: 11
                },
                this
              )
            ]
          },
          void 0,
          true,
          {
            fileName: "/Users/xianzhezhang/Projects/Jobby/Jobby/packages/ui/src/components/UI/Resume/CoverLetterPdfPreview.tsx",
            lineNumber: 616,
            columnNumber: 9
          },
          this
        )
      ]
    },
    void 0,
    true,
    {
      fileName: "/Users/xianzhezhang/Projects/Jobby/Jobby/packages/ui/src/components/UI/Resume/CoverLetterPdfPreview.tsx",
      lineNumber: 386,
      columnNumber: 7
    },
    this
  ) }, void 0, false, {
    fileName: "/Users/xianzhezhang/Projects/Jobby/Jobby/packages/ui/src/components/UI/Resume/CoverLetterPdfPreview.tsx",
    lineNumber: 385,
    columnNumber: 5
  }, this);
}
_c2 = CoverLetterPdfDocument;
export async function renderCoverLetterPdfOnce(coverLetter, candidateData, company, jobTitle) {
  const instance = pdf(
    /* @__PURE__ */ jsxDEV(
      CoverLetterPdfDocument,
      {
        coverLetter,
        candidateData,
        company,
        jobTitle
      },
      void 0,
      false,
      {
        fileName: "/Users/xianzhezhang/Projects/Jobby/Jobby/packages/ui/src/components/UI/Resume/CoverLetterPdfPreview.tsx",
        lineNumber: 658,
        columnNumber: 5
      },
      this
    )
  );
  const blob = await instance.toBlob();
  return { blob, pages: 1 };
}
function renderHtmlFormattedParagraph(text, fontSize, lineHeight, marginBottom, key) {
  const parts = text.split(/(\*\*.*?\*\*)/g);
  return /* @__PURE__ */ jsxDEV(
    "p",
    {
      style: {
        fontSize: `${fontSize * 1.32}px`,
        lineHeight,
        marginBottom: `${marginBottom * 1.25}px`
      },
      className: "text-stone-800 dark:text-stone-200 text-justify tracking-normal",
      children: parts.map((part, index) => {
        if (part.startsWith("**") && part.endsWith("**")) {
          return /* @__PURE__ */ jsxDEV(
            "strong",
            {
              className: "font-bold text-stone-950 dark:text-white",
              children: part.slice(2, -2)
            },
            index,
            false,
            {
              fileName: "/Users/xianzhezhang/Projects/Jobby/Jobby/packages/ui/src/components/UI/Resume/CoverLetterPdfPreview.tsx",
              lineNumber: 690,
              columnNumber: 13
            },
            this
          );
        }
        return /* @__PURE__ */ jsxDEV("span", { children: part }, index, false, {
          fileName: "/Users/xianzhezhang/Projects/Jobby/Jobby/packages/ui/src/components/UI/Resume/CoverLetterPdfPreview.tsx",
          lineNumber: 698,
          columnNumber: 16
        }, this);
      })
    },
    key,
    false,
    {
      fileName: "/Users/xianzhezhang/Projects/Jobby/Jobby/packages/ui/src/components/UI/Resume/CoverLetterPdfPreview.tsx",
      lineNumber: 678,
      columnNumber: 5
    },
    this
  );
}
function LinkedinHtmlIcon({
  className,
  style
}) {
  return /* @__PURE__ */ jsxDEV(
    "svg",
    {
      className,
      style: {
        width: "0.9em",
        height: "0.9em",
        display: "inline-block",
        verticalAlign: "middle",
        ...style
      },
      viewBox: "0 0 24 24",
      fill: "none",
      stroke: "currentColor",
      strokeWidth: "2",
      strokeLinecap: "round",
      strokeLinejoin: "round",
      children: [
        /* @__PURE__ */ jsxDEV("path", { d: "M16 8a6 6 0 0 1 6 6v7h-4v-7a2 2 0 0 0-2-2 2 2 0 0 0-2 2v7h-4v-7a6 6 0 0 1 6-6z" }, void 0, false, {
          fileName: "/Users/xianzhezhang/Projects/Jobby/Jobby/packages/ui/src/components/UI/Resume/CoverLetterPdfPreview.tsx",
          lineNumber: 728,
          columnNumber: 7
        }, this),
        /* @__PURE__ */ jsxDEV("rect", { x: "2", y: "9", width: "4", height: "12" }, void 0, false, {
          fileName: "/Users/xianzhezhang/Projects/Jobby/Jobby/packages/ui/src/components/UI/Resume/CoverLetterPdfPreview.tsx",
          lineNumber: 729,
          columnNumber: 7
        }, this),
        /* @__PURE__ */ jsxDEV("circle", { cx: "4", cy: "4", r: "2" }, void 0, false, {
          fileName: "/Users/xianzhezhang/Projects/Jobby/Jobby/packages/ui/src/components/UI/Resume/CoverLetterPdfPreview.tsx",
          lineNumber: 730,
          columnNumber: 7
        }, this)
      ]
    },
    void 0,
    true,
    {
      fileName: "/Users/xianzhezhang/Projects/Jobby/Jobby/packages/ui/src/components/UI/Resume/CoverLetterPdfPreview.tsx",
      lineNumber: 712,
      columnNumber: 5
    },
    this
  );
}
_c3 = LinkedinHtmlIcon;
function HtmlContactIcon({ type }) {
  const iconStyle = {
    width: "0.92em",
    height: "0.92em",
    display: "inline-block",
    verticalAlign: "middle"
  };
  const className = "shrink-0 text-[#784508] -translate-y-[0.5px]";
  switch (type) {
    case "email":
      return /* @__PURE__ */ jsxDEV(Mail, { className, style: iconStyle }, void 0, false, {
        fileName: "/Users/xianzhezhang/Projects/Jobby/Jobby/packages/ui/src/components/UI/Resume/CoverLetterPdfPreview.tsx",
        lineNumber: 745,
        columnNumber: 14
      }, this);
    case "phone":
      return /* @__PURE__ */ jsxDEV(Phone, { className, style: iconStyle }, void 0, false, {
        fileName: "/Users/xianzhezhang/Projects/Jobby/Jobby/packages/ui/src/components/UI/Resume/CoverLetterPdfPreview.tsx",
        lineNumber: 747,
        columnNumber: 14
      }, this);
    case "location":
      return /* @__PURE__ */ jsxDEV(MapPin, { className, style: iconStyle }, void 0, false, {
        fileName: "/Users/xianzhezhang/Projects/Jobby/Jobby/packages/ui/src/components/UI/Resume/CoverLetterPdfPreview.tsx",
        lineNumber: 749,
        columnNumber: 14
      }, this);
    case "linkedin":
      return /* @__PURE__ */ jsxDEV(LinkedinHtmlIcon, { className, style: iconStyle }, void 0, false, {
        fileName: "/Users/xianzhezhang/Projects/Jobby/Jobby/packages/ui/src/components/UI/Resume/CoverLetterPdfPreview.tsx",
        lineNumber: 751,
        columnNumber: 14
      }, this);
    case "portfolio":
      return /* @__PURE__ */ jsxDEV(FolderGit2, { className, style: iconStyle }, void 0, false, {
        fileName: "/Users/xianzhezhang/Projects/Jobby/Jobby/packages/ui/src/components/UI/Resume/CoverLetterPdfPreview.tsx",
        lineNumber: 753,
        columnNumber: 14
      }, this);
    case "website":
      return /* @__PURE__ */ jsxDEV(Globe, { className, style: iconStyle }, void 0, false, {
        fileName: "/Users/xianzhezhang/Projects/Jobby/Jobby/packages/ui/src/components/UI/Resume/CoverLetterPdfPreview.tsx",
        lineNumber: 755,
        columnNumber: 14
      }, this);
    default:
      return null;
  }
}
_c4 = HtmlContactIcon;
export function CoverLetterHtmlDocument({
  coverLetter,
  candidateData,
  company,
  jobTitle
}) {
  const name = candidateData ? resumeFullName(candidateData) : "Scott Zhang";
  const headline = candidateData?.basics?.headline;
  const contacts = candidateData ? resumeContactItems(candidateData) : [];
  const metrics = computeLayoutMetrics(coverLetter);
  const { salutation, paragraphs, signoff, signoffName } = parseCoverLetterContent(coverLetter, candidateData, company);
  const formattedDate = (/* @__PURE__ */ new Date()).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric"
  });
  const subjectTitle = jobTitle ? `RE: Application for ${jobTitle}${company ? ` — ${company}` : ""}` : `RE: Job Application${company ? ` — ${company}` : ""}`;
  return /* @__PURE__ */ jsxDEV(
    "div",
    {
      style: {
        width: 816,
        minHeight: 1056,
        paddingTop: `${metrics.paddingTop * 1.35}px`,
        paddingBottom: `${metrics.paddingBottom * 1.35}px`,
        paddingLeft: `${metrics.paddingX * 1.35}px`,
        paddingRight: `${metrics.paddingX * 1.35}px`,
        backgroundColor: "#ffffff",
        color: "#292524",
        fontFamily: 'Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
        boxSizing: "border-box",
        position: "relative",
        overflow: "hidden"
      },
      className: "flex flex-col text-left select-none",
      children: [
        /* @__PURE__ */ jsxDEV(
          "img",
          {
            src: COVER_LETTER_GOLD_SVG_DATA_URI,
            alt: "",
            className: "absolute -top-10 -right-8 w-[235px] h-[235px] object-contain pointer-events-none opacity-35 rotate-[35deg] select-none"
          },
          void 0,
          false,
          {
            fileName: "/Users/xianzhezhang/Projects/Jobby/Jobby/packages/ui/src/components/UI/Resume/CoverLetterPdfPreview.tsx",
            lineNumber: 810,
            columnNumber: 7
          },
          this
        ),
        /* @__PURE__ */ jsxDEV(
          "img",
          {
            src: COVER_LETTER_GOLD_SVG_DATA_URI,
            alt: "",
            className: "absolute -bottom-36 -left-32 w-[510px] h-[510px] object-contain pointer-events-none opacity-28 -rotate-[25deg] select-none"
          },
          void 0,
          false,
          {
            fileName: "/Users/xianzhezhang/Projects/Jobby/Jobby/packages/ui/src/components/UI/Resume/CoverLetterPdfPreview.tsx",
            lineNumber: 817,
            columnNumber: 7
          },
          this
        ),
        /* @__PURE__ */ jsxDEV("div", { className: "relative z-10 flex flex-col", children: [
          /* @__PURE__ */ jsxDEV("div", { style: { marginBottom: `${metrics.headerGap * 1.3}px` }, children: [
            /* @__PURE__ */ jsxDEV(
              "h1",
              {
                style: { marginBottom: `${metrics.namePaddingBottom * 1.3}px` },
                className: "text-[29px] font-black tracking-tight text-stone-900 m-0 leading-tight",
                children: name
              },
              void 0,
              false,
              {
                fileName: "/Users/xianzhezhang/Projects/Jobby/Jobby/packages/ui/src/components/UI/Resume/CoverLetterPdfPreview.tsx",
                lineNumber: 826,
                columnNumber: 11
              },
              this
            ),
            headline && /* @__PURE__ */ jsxDEV("p", { className: "text-[12.5px] font-bold text-[#784508] mt-0.5 mb-1.5", children: headline }, void 0, false, {
              fileName: "/Users/xianzhezhang/Projects/Jobby/Jobby/packages/ui/src/components/UI/Resume/CoverLetterPdfPreview.tsx",
              lineNumber: 834,
              columnNumber: 11
            }, this),
            contacts.length > 0 && /* @__PURE__ */ jsxDEV("div", { className: "flex flex-wrap items-center gap-x-2.5 gap-y-1 text-[12px] text-stone-600 mt-1 mb-1", children: contacts.map(
              (item, idx) => /* @__PURE__ */ jsxDEV("span", { className: "inline-flex items-center gap-1.5", children: [
                idx > 0 && /* @__PURE__ */ jsxDEV("span", { className: "text-[#DEC8A0] font-normal", children: "|" }, void 0, false, {
                  fileName: "/Users/xianzhezhang/Projects/Jobby/Jobby/packages/ui/src/components/UI/Resume/CoverLetterPdfPreview.tsx",
                  lineNumber: 844,
                  columnNumber: 15
                }, this),
                /* @__PURE__ */ jsxDEV(HtmlContactIcon, { type: item.type }, void 0, false, {
                  fileName: "/Users/xianzhezhang/Projects/Jobby/Jobby/packages/ui/src/components/UI/Resume/CoverLetterPdfPreview.tsx",
                  lineNumber: 846,
                  columnNumber: 19
                }, this),
                item.href ? /* @__PURE__ */ jsxDEV(
                  "a",
                  {
                    href: item.href,
                    target: "_blank",
                    rel: "noreferrer",
                    className: "text-stone-600 hover:text-stone-900",
                    children: item.text
                  },
                  void 0,
                  false,
                  {
                    fileName: "/Users/xianzhezhang/Projects/Jobby/Jobby/packages/ui/src/components/UI/Resume/CoverLetterPdfPreview.tsx",
                    lineNumber: 848,
                    columnNumber: 15
                  },
                  this
                ) : /* @__PURE__ */ jsxDEV("span", { children: item.text }, void 0, false, {
                  fileName: "/Users/xianzhezhang/Projects/Jobby/Jobby/packages/ui/src/components/UI/Resume/CoverLetterPdfPreview.tsx",
                  lineNumber: 856,
                  columnNumber: 15
                }, this)
              ] }, idx, true, {
                fileName: "/Users/xianzhezhang/Projects/Jobby/Jobby/packages/ui/src/components/UI/Resume/CoverLetterPdfPreview.tsx",
                lineNumber: 842,
                columnNumber: 13
              }, this)
            ) }, void 0, false, {
              fileName: "/Users/xianzhezhang/Projects/Jobby/Jobby/packages/ui/src/components/UI/Resume/CoverLetterPdfPreview.tsx",
              lineNumber: 840,
              columnNumber: 11
            }, this),
            /* @__PURE__ */ jsxDEV(
              "div",
              {
                style: { marginTop: `${metrics.ruleMarginTop * 1.3}px` },
                className: "w-full h-[2px] bg-[#D4A853]"
              },
              void 0,
              false,
              {
                fileName: "/Users/xianzhezhang/Projects/Jobby/Jobby/packages/ui/src/components/UI/Resume/CoverLetterPdfPreview.tsx",
                lineNumber: 863,
                columnNumber: 11
              },
              this
            )
          ] }, void 0, true, {
            fileName: "/Users/xianzhezhang/Projects/Jobby/Jobby/packages/ui/src/components/UI/Resume/CoverLetterPdfPreview.tsx",
            lineNumber: 825,
            columnNumber: 9
          }, this),
          /* @__PURE__ */ jsxDEV("div", { className: "mb-3", children: /* @__PURE__ */ jsxDEV("div", { className: "inline-flex items-center px-3 py-1 rounded bg-[#FAF5EC] border border-[#DEC8A0] text-[#784508] text-[11.5px] font-bold shadow-2xs", children: subjectTitle }, void 0, false, {
            fileName: "/Users/xianzhezhang/Projects/Jobby/Jobby/packages/ui/src/components/UI/Resume/CoverLetterPdfPreview.tsx",
            lineNumber: 871,
            columnNumber: 11
          }, this) }, void 0, false, {
            fileName: "/Users/xianzhezhang/Projects/Jobby/Jobby/packages/ui/src/components/UI/Resume/CoverLetterPdfPreview.tsx",
            lineNumber: 870,
            columnNumber: 9
          }, this),
          /* @__PURE__ */ jsxDEV("div", { className: "flex items-baseline justify-between gap-3 mb-3.5", children: [
            /* @__PURE__ */ jsxDEV(
              "h2",
              {
                style: { fontSize: `${metrics.bodyFontSize * 1.4}px` },
                className: "font-bold text-stone-900 m-0",
                children: [
                  salutation,
                  ","
                ]
              },
              void 0,
              true,
              {
                fileName: "/Users/xianzhezhang/Projects/Jobby/Jobby/packages/ui/src/components/UI/Resume/CoverLetterPdfPreview.tsx",
                lineNumber: 878,
                columnNumber: 11
              },
              this
            ),
            /* @__PURE__ */ jsxDEV("span", { className: "text-stone-500 font-medium text-[11.5px] shrink-0", children: formattedDate }, void 0, false, {
              fileName: "/Users/xianzhezhang/Projects/Jobby/Jobby/packages/ui/src/components/UI/Resume/CoverLetterPdfPreview.tsx",
              lineNumber: 884,
              columnNumber: 11
            }, this)
          ] }, void 0, true, {
            fileName: "/Users/xianzhezhang/Projects/Jobby/Jobby/packages/ui/src/components/UI/Resume/CoverLetterPdfPreview.tsx",
            lineNumber: 877,
            columnNumber: 9
          }, this),
          /* @__PURE__ */ jsxDEV("div", { className: "flex flex-col text-justify", children: paragraphs.map(
            (para, i) => renderHtmlFormattedParagraph(
              para,
              metrics.bodyFontSize,
              metrics.bodyLineHeight,
              metrics.paragraphGap,
              i
            )
          ) }, void 0, false, {
            fileName: "/Users/xianzhezhang/Projects/Jobby/Jobby/packages/ui/src/components/UI/Resume/CoverLetterPdfPreview.tsx",
            lineNumber: 890,
            columnNumber: 9
          }, this),
          /* @__PURE__ */ jsxDEV(
            "div",
            {
              style: { marginTop: `${metrics.signatureGapTop * 1.3}px` },
              className: "self-end flex flex-col items-end",
              children: [
                /* @__PURE__ */ jsxDEV(
                  "p",
                  {
                    style: { fontSize: `${metrics.bodyFontSize * 1.25}px` },
                    className: "text-stone-700 m-0 mb-1 font-medium",
                    children: [
                      signoff,
                      ","
                    ]
                  },
                  void 0,
                  true,
                  {
                    fileName: "/Users/xianzhezhang/Projects/Jobby/Jobby/packages/ui/src/components/UI/Resume/CoverLetterPdfPreview.tsx",
                    lineNumber: 907,
                    columnNumber: 11
                  },
                  this
                ),
                /* @__PURE__ */ jsxDEV(
                  "span",
                  {
                    className: "text-[36px] text-[#784508] -rotate-2 select-none leading-none",
                    style: COVER_LETTER_SIGNATURE_STYLE,
                    children: signoffName
                  },
                  void 0,
                  false,
                  {
                    fileName: "/Users/xianzhezhang/Projects/Jobby/Jobby/packages/ui/src/components/UI/Resume/CoverLetterPdfPreview.tsx",
                    lineNumber: 913,
                    columnNumber: 11
                  },
                  this
                )
              ]
            },
            void 0,
            true,
            {
              fileName: "/Users/xianzhezhang/Projects/Jobby/Jobby/packages/ui/src/components/UI/Resume/CoverLetterPdfPreview.tsx",
              lineNumber: 903,
              columnNumber: 9
            },
            this
          )
        ] }, void 0, true, {
          fileName: "/Users/xianzhezhang/Projects/Jobby/Jobby/packages/ui/src/components/UI/Resume/CoverLetterPdfPreview.tsx",
          lineNumber: 823,
          columnNumber: 7
        }, this)
      ]
    },
    void 0,
    true,
    {
      fileName: "/Users/xianzhezhang/Projects/Jobby/Jobby/packages/ui/src/components/UI/Resume/CoverLetterPdfPreview.tsx",
      lineNumber: 791,
      columnNumber: 5
    },
    this
  );
}
_c5 = CoverLetterHtmlDocument;
function formatBytes(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
export function CoverLetterPdfPreview({
  coverLetter,
  candidateData,
  company,
  jobTitle,
  filename,
  onOpenModal,
  onPreview,
  onNewWindow,
  onEdit,
  onDownload
}) {
  _s();
  const activeUrlRef = useRef(null);
  const [pdfUrl, setPdfUrl] = useState(null);
  const [fileSize, setFileSize] = useState(null);
  const [error, setError] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const containerRef = useRef(null);
  const [containerSize, setContainerSize] = useState({ width: 0, height: 0 });
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const updateSize = () => {
      const rect = el.getBoundingClientRect();
      const nextW = Math.round(rect.width);
      const nextH = Math.round(rect.height);
      if (nextW > 0 && nextH > 0) {
        setContainerSize((prev) => {
          if (Math.abs(prev.width - nextW) <= 2 && Math.abs(prev.height - nextH) <= 2) {
            return prev;
          }
          return { width: nextW, height: nextH };
        });
      }
    };
    updateSize();
    const observer = new ResizeObserver(updateSize);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);
  const pageWidth = 816;
  const pageHeight = 1056;
  const thumbnailScale = useMemo(() => {
    if (!containerSize.width || !containerSize.height) return 0.165;
    const availableWidth = Math.max(80, containerSize.width - 24);
    const availableHeight = Math.max(80, containerSize.height - 20);
    return Math.min(availableWidth / pageWidth, availableHeight / pageHeight);
  }, [containerSize.width, containerSize.height]);
  const resolvedFilename = filename || formatCoverLetterFilename(candidateData, company, jobTitle);
  const generatePdfBlob = async () => {
    if (pdfUrl) return pdfUrl;
    setIsGenerating(true);
    setError("");
    try {
      const { blob } = await renderCoverLetterPdfOnce(
        coverLetter,
        candidateData,
        company,
        jobTitle
      );
      const nextUrl = URL.createObjectURL(blob);
      if (activeUrlRef.current) URL.revokeObjectURL(activeUrlRef.current);
      activeUrlRef.current = nextUrl;
      setPdfUrl(nextUrl);
      setFileSize(blob.size);
      setIsGenerating(false);
      return nextUrl;
    } catch {
      setError("Could not generate cover letter PDF.");
      setIsGenerating(false);
      return null;
    }
  };
  useEffect(
    () => () => {
      if (activeUrlRef.current) URL.revokeObjectURL(activeUrlRef.current);
    },
    []
  );
  const download = async () => {
    if (onDownload) {
      onDownload();
      return;
    }
    const url = pdfUrl || await generatePdfBlob();
    if (!url) return;
    const link = document.createElement("a");
    link.href = url;
    link.download = resolvedFilename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };
  const openPreview = () => {
    if (onPreview) {
      onPreview();
      return;
    }
    if (onOpenModal) {
      void generatePdfBlob();
      onOpenModal(
        /* @__PURE__ */ jsxDEV("div", { className: "flex h-full flex-col bg-background", children: [
          /* @__PURE__ */ jsxDEV("header", { className: "flex shrink-0 items-center justify-between border-b border-primary/60 px-6 py-3.5 bg-panel/80 backdrop-blur-md", children: [
            /* @__PURE__ */ jsxDEV("div", { className: "flex items-center gap-3 min-w-0", children: [
              /* @__PURE__ */ jsxDEV("div", { className: "flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary", children: /* @__PURE__ */ jsxDEV(FileText, { className: "h-4.5 w-4.5" }, void 0, false, {
                fileName: "/Users/xianzhezhang/Projects/Jobby/Jobby/packages/ui/src/components/UI/Resume/CoverLetterPdfPreview.tsx",
                lineNumber: 1052,
                columnNumber: 17
              }, this) }, void 0, false, {
                fileName: "/Users/xianzhezhang/Projects/Jobby/Jobby/packages/ui/src/components/UI/Resume/CoverLetterPdfPreview.tsx",
                lineNumber: 1051,
                columnNumber: 15
              }, this),
              /* @__PURE__ */ jsxDEV("div", { className: "min-w-0", children: [
                /* @__PURE__ */ jsxDEV("p", { className: "label font-semibold text-ink-primary truncate", children: resolvedFilename }, void 0, false, {
                  fileName: "/Users/xianzhezhang/Projects/Jobby/Jobby/packages/ui/src/components/UI/Resume/CoverLetterPdfPreview.tsx",
                  lineNumber: 1055,
                  columnNumber: 17
                }, this),
                /* @__PURE__ */ jsxDEV("div", { className: "flex items-center gap-2 text-xs text-ink-secondary mt-0.5 truncate", children: [
                  /* @__PURE__ */ jsxDEV("span", { children: "1 page" }, void 0, false, {
                    fileName: "/Users/xianzhezhang/Projects/Jobby/Jobby/packages/ui/src/components/UI/Resume/CoverLetterPdfPreview.tsx",
                    lineNumber: 1059,
                    columnNumber: 19
                  }, this),
                  fileSize ? /* @__PURE__ */ jsxDEV(Fragment, { children: [
                    /* @__PURE__ */ jsxDEV("span", { className: "opacity-40", children: "•" }, void 0, false, {
                      fileName: "/Users/xianzhezhang/Projects/Jobby/Jobby/packages/ui/src/components/UI/Resume/CoverLetterPdfPreview.tsx",
                      lineNumber: 1062,
                      columnNumber: 23
                    }, this),
                    /* @__PURE__ */ jsxDEV("span", { children: formatBytes(fileSize) }, void 0, false, {
                      fileName: "/Users/xianzhezhang/Projects/Jobby/Jobby/packages/ui/src/components/UI/Resume/CoverLetterPdfPreview.tsx",
                      lineNumber: 1063,
                      columnNumber: 23
                    }, this)
                  ] }, void 0, true, {
                    fileName: "/Users/xianzhezhang/Projects/Jobby/Jobby/packages/ui/src/components/UI/Resume/CoverLetterPdfPreview.tsx",
                    lineNumber: 1061,
                    columnNumber: 19
                  }, this) : null
                ] }, void 0, true, {
                  fileName: "/Users/xianzhezhang/Projects/Jobby/Jobby/packages/ui/src/components/UI/Resume/CoverLetterPdfPreview.tsx",
                  lineNumber: 1058,
                  columnNumber: 17
                }, this)
              ] }, void 0, true, {
                fileName: "/Users/xianzhezhang/Projects/Jobby/Jobby/packages/ui/src/components/UI/Resume/CoverLetterPdfPreview.tsx",
                lineNumber: 1054,
                columnNumber: 15
              }, this)
            ] }, void 0, true, {
              fileName: "/Users/xianzhezhang/Projects/Jobby/Jobby/packages/ui/src/components/UI/Resume/CoverLetterPdfPreview.tsx",
              lineNumber: 1050,
              columnNumber: 13
            }, this),
            /* @__PURE__ */ jsxDEV("div", { className: "flex items-center gap-2 shrink-0", children: /* @__PURE__ */ jsxDEV(
              Button,
              {
                variant: "secondary",
                size: "sm",
                Icon: Download,
                onClick: download,
                disabled: isGenerating,
                children: isGenerating ? "Compiling PDF..." : "Download PDF"
              },
              void 0,
              false,
              {
                fileName: "/Users/xianzhezhang/Projects/Jobby/Jobby/packages/ui/src/components/UI/Resume/CoverLetterPdfPreview.tsx",
                lineNumber: 1071,
                columnNumber: 15
              },
              this
            ) }, void 0, false, {
              fileName: "/Users/xianzhezhang/Projects/Jobby/Jobby/packages/ui/src/components/UI/Resume/CoverLetterPdfPreview.tsx",
              lineNumber: 1070,
              columnNumber: 13
            }, this)
          ] }, void 0, true, {
            fileName: "/Users/xianzhezhang/Projects/Jobby/Jobby/packages/ui/src/components/UI/Resume/CoverLetterPdfPreview.tsx",
            lineNumber: 1049,
            columnNumber: 11
          }, this),
          pdfUrl ? /* @__PURE__ */ jsxDEV(
            "iframe",
            {
              title: "Cover Letter PDF preview",
              src: pdfUrl,
              className: "h-full w-full border-0 bg-background-secondary transform-gpu"
            },
            void 0,
            false,
            {
              fileName: "/Users/xianzhezhang/Projects/Jobby/Jobby/packages/ui/src/components/UI/Resume/CoverLetterPdfPreview.tsx",
              lineNumber: 1084,
              columnNumber: 11
            },
            this
          ) : /* @__PURE__ */ jsxDEV("div", { className: "flex h-full flex-col items-center justify-center gap-2 text-ink-secondary", children: [
            /* @__PURE__ */ jsxDEV(Loader2, { className: "h-6 w-6 animate-spin text-primary" }, void 0, false, {
              fileName: "/Users/xianzhezhang/Projects/Jobby/Jobby/packages/ui/src/components/UI/Resume/CoverLetterPdfPreview.tsx",
              lineNumber: 1090,
              columnNumber: 15
            }, this),
            /* @__PURE__ */ jsxDEV("p", { className: "text-xs font-medium", children: "Loading PDF engine..." }, void 0, false, {
              fileName: "/Users/xianzhezhang/Projects/Jobby/Jobby/packages/ui/src/components/UI/Resume/CoverLetterPdfPreview.tsx",
              lineNumber: 1091,
              columnNumber: 15
            }, this)
          ] }, void 0, true, {
            fileName: "/Users/xianzhezhang/Projects/Jobby/Jobby/packages/ui/src/components/UI/Resume/CoverLetterPdfPreview.tsx",
            lineNumber: 1089,
            columnNumber: 11
          }, this)
        ] }, void 0, true, {
          fileName: "/Users/xianzhezhang/Projects/Jobby/Jobby/packages/ui/src/components/UI/Resume/CoverLetterPdfPreview.tsx",
          lineNumber: 1048,
          columnNumber: 9
        }, this)
      );
    } else {
      setIsModalOpen(true);
      void generatePdfBlob();
    }
  };
  return /* @__PURE__ */ jsxDEV("div", { className: "flex flex-col gap-2 w-full min-w-0", children: [
    /* @__PURE__ */ jsxDEV(
      "div",
      {
        ref: containerRef,
        onClick: openPreview,
        className: "group relative h-36 sm:h-40 w-full cursor-zoom-in overflow-hidden rounded-xl border border-black/[0.06] dark:border-white/[0.08] bg-background-secondary/80 flex items-center justify-center p-1.5 shadow-xs transition-all hover:border-primary/40",
        children: [
          /* @__PURE__ */ jsxDEV("div", { className: "pointer-events-none flex items-center justify-center", children: /* @__PURE__ */ jsxDEV(
            "div",
            {
              style: {
                width: pageWidth * thumbnailScale,
                height: pageHeight * thumbnailScale
              },
              className: "relative shrink-0 select-none",
              children: /* @__PURE__ */ jsxDEV(
                "div",
                {
                  style: {
                    width: pageWidth,
                    height: pageHeight,
                    transform: `scale(${thumbnailScale})`,
                    transformOrigin: "top left"
                  },
                  className: "absolute left-0 top-0 overflow-hidden rounded-xs bg-white shadow-md",
                  children: /* @__PURE__ */ jsxDEV(
                    CoverLetterHtmlDocument,
                    {
                      coverLetter,
                      candidateData,
                      company,
                      jobTitle
                    },
                    void 0,
                    false,
                    {
                      fileName: "/Users/xianzhezhang/Projects/Jobby/Jobby/packages/ui/src/components/UI/Resume/CoverLetterPdfPreview.tsx",
                      lineNumber: 1127,
                      columnNumber: 15
                    },
                    this
                  )
                },
                void 0,
                false,
                {
                  fileName: "/Users/xianzhezhang/Projects/Jobby/Jobby/packages/ui/src/components/UI/Resume/CoverLetterPdfPreview.tsx",
                  lineNumber: 1118,
                  columnNumber: 13
                },
                this
              )
            },
            void 0,
            false,
            {
              fileName: "/Users/xianzhezhang/Projects/Jobby/Jobby/packages/ui/src/components/UI/Resume/CoverLetterPdfPreview.tsx",
              lineNumber: 1111,
              columnNumber: 11
            },
            this
          ) }, void 0, false, {
            fileName: "/Users/xianzhezhang/Projects/Jobby/Jobby/packages/ui/src/components/UI/Resume/CoverLetterPdfPreview.tsx",
            lineNumber: 1110,
            columnNumber: 9
          }, this),
          error && /* @__PURE__ */ jsxDEV("p", { className: "absolute inset-x-4 top-1/2 -translate-y-1/2 text-center text-xs text-red-600 bg-panel/95 py-2 px-3 rounded-lg border border-red-200 dark:border-red-900/40 shadow-xs", children: error }, void 0, false, {
            fileName: "/Users/xianzhezhang/Projects/Jobby/Jobby/packages/ui/src/components/UI/Resume/CoverLetterPdfPreview.tsx",
            lineNumber: 1138,
            columnNumber: 9
          }, this),
          isGenerating && /* @__PURE__ */ jsxDEV("div", { className: "absolute right-2 top-2 rounded-full bg-white/90 dark:bg-slate-900/90 p-1 text-ink-secondary shadow-sm", children: /* @__PURE__ */ jsxDEV(Loader2, { className: "size-2.5 animate-spin text-primary" }, void 0, false, {
            fileName: "/Users/xianzhezhang/Projects/Jobby/Jobby/packages/ui/src/components/UI/Resume/CoverLetterPdfPreview.tsx",
            lineNumber: 1145,
            columnNumber: 13
          }, this) }, void 0, false, {
            fileName: "/Users/xianzhezhang/Projects/Jobby/Jobby/packages/ui/src/components/UI/Resume/CoverLetterPdfPreview.tsx",
            lineNumber: 1144,
            columnNumber: 9
          }, this),
          /* @__PURE__ */ jsxDEV("div", { className: "absolute inset-0 z-20 flex items-center justify-center gap-1.5 bg-slate-950/20 opacity-0 transition-opacity group-hover:opacity-100 backdrop-blur-xs", children: [
            /* @__PURE__ */ jsxDEV(
              "button",
              {
                type: "button",
                title: "In-Page Preview",
                "aria-label": "Preview Cover Letter PDF",
                onClick: (e) => {
                  e.stopPropagation();
                  openPreview();
                },
                className: "flex h-8 w-8 items-center justify-center rounded-lg bg-white/95 dark:bg-slate-900/95 text-slate-800 dark:text-slate-100 hover:scale-110 hover:text-primary hover:border-primary/40 border border-black/[0.06] dark:border-white/[0.1] cursor-pointer shadow-md transition-all",
                children: /* @__PURE__ */ jsxDEV(Maximize2, { className: "h-3.5 w-3.5" }, void 0, false, {
                  fileName: "/Users/xianzhezhang/Projects/Jobby/Jobby/packages/ui/src/components/UI/Resume/CoverLetterPdfPreview.tsx",
                  lineNumber: 1161,
                  columnNumber: 13
                }, this)
              },
              void 0,
              false,
              {
                fileName: "/Users/xianzhezhang/Projects/Jobby/Jobby/packages/ui/src/components/UI/Resume/CoverLetterPdfPreview.tsx",
                lineNumber: 1151,
                columnNumber: 11
              },
              this
            ),
            /* @__PURE__ */ jsxDEV(
              "button",
              {
                type: "button",
                title: "Open in New Window",
                "aria-label": "Open in new window",
                onClick: (e) => {
                  e.stopPropagation();
                  if (onNewWindow) {
                    onNewWindow();
                  } else if (pdfUrl) {
                    window.open(pdfUrl, "_blank");
                  } else {
                    openPreview();
                  }
                },
                className: "flex h-8 w-8 items-center justify-center rounded-lg bg-white/95 dark:bg-slate-900/95 text-slate-800 dark:text-slate-100 hover:scale-110 hover:text-primary hover:border-primary/40 border border-black/[0.06] dark:border-white/[0.1] cursor-pointer shadow-md transition-all",
                children: /* @__PURE__ */ jsxDEV(ExternalLink, { className: "h-3.5 w-3.5" }, void 0, false, {
                  fileName: "/Users/xianzhezhang/Projects/Jobby/Jobby/packages/ui/src/components/UI/Resume/CoverLetterPdfPreview.tsx",
                  lineNumber: 1180,
                  columnNumber: 13
                }, this)
              },
              void 0,
              false,
              {
                fileName: "/Users/xianzhezhang/Projects/Jobby/Jobby/packages/ui/src/components/UI/Resume/CoverLetterPdfPreview.tsx",
                lineNumber: 1164,
                columnNumber: 11
              },
              this
            ),
            onEdit && /* @__PURE__ */ jsxDEV(
              "button",
              {
                type: "button",
                title: "Edit on Web",
                "aria-label": "Edit cover letter",
                onClick: (e) => {
                  e.stopPropagation();
                  onEdit();
                },
                className: "flex h-8 w-8 items-center justify-center rounded-lg bg-white/95 dark:bg-slate-900/95 text-slate-800 dark:text-slate-100 hover:scale-110 hover:text-primary hover:border-primary/40 border border-black/[0.06] dark:border-white/[0.1] cursor-pointer shadow-md transition-all",
                children: /* @__PURE__ */ jsxDEV(Edit3, { className: "h-3.5 w-3.5" }, void 0, false, {
                  fileName: "/Users/xianzhezhang/Projects/Jobby/Jobby/packages/ui/src/components/UI/Resume/CoverLetterPdfPreview.tsx",
                  lineNumber: 1194,
                  columnNumber: 15
                }, this)
              },
              void 0,
              false,
              {
                fileName: "/Users/xianzhezhang/Projects/Jobby/Jobby/packages/ui/src/components/UI/Resume/CoverLetterPdfPreview.tsx",
                lineNumber: 1184,
                columnNumber: 11
              },
              this
            ),
            /* @__PURE__ */ jsxDEV(
              "button",
              {
                type: "button",
                title: "Download PDF",
                "aria-label": "Download cover letter PDF",
                onClick: (e) => {
                  e.stopPropagation();
                  if (onDownload) {
                    onDownload();
                  } else {
                    download();
                  }
                },
                className: "flex h-8 w-8 items-center justify-center rounded-lg bg-white/95 dark:bg-slate-900/95 text-slate-800 dark:text-slate-100 hover:scale-110 hover:text-primary hover:border-primary/40 border border-black/[0.06] dark:border-white/[0.1] cursor-pointer shadow-md disabled:opacity-50 transition-all",
                disabled: !onDownload && (!pdfUrl || isGenerating),
                children: /* @__PURE__ */ jsxDEV(Download, { className: "h-3.5 w-3.5" }, void 0, false, {
                  fileName: "/Users/xianzhezhang/Projects/Jobby/Jobby/packages/ui/src/components/UI/Resume/CoverLetterPdfPreview.tsx",
                  lineNumber: 1213,
                  columnNumber: 13
                }, this)
              },
              void 0,
              false,
              {
                fileName: "/Users/xianzhezhang/Projects/Jobby/Jobby/packages/ui/src/components/UI/Resume/CoverLetterPdfPreview.tsx",
                lineNumber: 1198,
                columnNumber: 11
              },
              this
            )
          ] }, void 0, true, {
            fileName: "/Users/xianzhezhang/Projects/Jobby/Jobby/packages/ui/src/components/UI/Resume/CoverLetterPdfPreview.tsx",
            lineNumber: 1150,
            columnNumber: 9
          }, this),
          /* @__PURE__ */ jsxDEV("div", { className: "absolute bottom-1.5 left-1.5 z-10 flex items-center gap-1 rounded-md bg-panel/60 backdrop-blur-xs px-1.5 py-0.5 text-[9.5px] font-medium text-ink-primary", children: [
            /* @__PURE__ */ jsxDEV(FileText, { className: "h-3 w-3 text-primary shrink-0" }, void 0, false, {
              fileName: "/Users/xianzhezhang/Projects/Jobby/Jobby/packages/ui/src/components/UI/Resume/CoverLetterPdfPreview.tsx",
              lineNumber: 1219,
              columnNumber: 11
            }, this),
            /* @__PURE__ */ jsxDEV("span", { children: [
              "1 page · PDF ",
              fileSize ? `· ${formatBytes(fileSize)}` : ""
            ] }, void 0, true, {
              fileName: "/Users/xianzhezhang/Projects/Jobby/Jobby/packages/ui/src/components/UI/Resume/CoverLetterPdfPreview.tsx",
              lineNumber: 1220,
              columnNumber: 11
            }, this)
          ] }, void 0, true, {
            fileName: "/Users/xianzhezhang/Projects/Jobby/Jobby/packages/ui/src/components/UI/Resume/CoverLetterPdfPreview.tsx",
            lineNumber: 1218,
            columnNumber: 9
          }, this)
        ]
      },
      void 0,
      true,
      {
        fileName: "/Users/xianzhezhang/Projects/Jobby/Jobby/packages/ui/src/components/UI/Resume/CoverLetterPdfPreview.tsx",
        lineNumber: 1105,
        columnNumber: 7
      },
      this
    ),
    isModalOpen && typeof document !== "undefined" && createPortal(
      /* @__PURE__ */ jsxDEV(
        "div",
        {
          className: "fixed inset-0 z-[99999] flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs animate-in fade-in-50 duration-150",
          onClick: () => setIsModalOpen(false),
          children: /* @__PURE__ */ jsxDEV(
            "div",
            {
              className: "flex h-[90vh] w-[88vw] max-w-6xl flex-col rounded-2xl overflow-hidden shadow-2xl border border-primary/80 bg-background",
              onClick: (e) => e.stopPropagation(),
              children: [
                /* @__PURE__ */ jsxDEV("header", { className: "flex shrink-0 items-center justify-between border-b border-primary/60 px-3.5 py-3.5 bg-panel/80 backdrop-blur-md", children: [
                  /* @__PURE__ */ jsxDEV("div", { className: "flex items-center gap-3 min-w-0", children: [
                    /* @__PURE__ */ jsxDEV("div", { className: "flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary", children: /* @__PURE__ */ jsxDEV("div", { className: "text-[11px] font-bold", children: "PDF" }, void 0, false, {
                      fileName: "/Users/xianzhezhang/Projects/Jobby/Jobby/packages/ui/src/components/UI/Resume/CoverLetterPdfPreview.tsx",
                      lineNumber: 1242,
                      columnNumber: 21
                    }, this) }, void 0, false, {
                      fileName: "/Users/xianzhezhang/Projects/Jobby/Jobby/packages/ui/src/components/UI/Resume/CoverLetterPdfPreview.tsx",
                      lineNumber: 1241,
                      columnNumber: 19
                    }, this),
                    /* @__PURE__ */ jsxDEV("div", { className: "min-w-0", children: [
                      /* @__PURE__ */ jsxDEV("p", { className: "label font-semibold text-ink-primary truncate", children: resolvedFilename }, void 0, false, {
                        fileName: "/Users/xianzhezhang/Projects/Jobby/Jobby/packages/ui/src/components/UI/Resume/CoverLetterPdfPreview.tsx",
                        lineNumber: 1245,
                        columnNumber: 21
                      }, this),
                      /* @__PURE__ */ jsxDEV("div", { className: "flex flex-wrap items-center gap-1 text-[10px] text-ink-secondary", children: [
                        /* @__PURE__ */ jsxDEV("span", { children: "1 page" }, void 0, false, {
                          fileName: "/Users/xianzhezhang/Projects/Jobby/Jobby/packages/ui/src/components/UI/Resume/CoverLetterPdfPreview.tsx",
                          lineNumber: 1249,
                          columnNumber: 23
                        }, this),
                        fileSize && /* @__PURE__ */ jsxDEV(Fragment, { children: [
                          /* @__PURE__ */ jsxDEV("span", { className: "opacity-40", children: "•" }, void 0, false, {
                            fileName: "/Users/xianzhezhang/Projects/Jobby/Jobby/packages/ui/src/components/UI/Resume/CoverLetterPdfPreview.tsx",
                            lineNumber: 1252,
                            columnNumber: 27
                          }, this),
                          /* @__PURE__ */ jsxDEV("span", { children: formatBytes(fileSize) }, void 0, false, {
                            fileName: "/Users/xianzhezhang/Projects/Jobby/Jobby/packages/ui/src/components/UI/Resume/CoverLetterPdfPreview.tsx",
                            lineNumber: 1253,
                            columnNumber: 27
                          }, this)
                        ] }, void 0, true, {
                          fileName: "/Users/xianzhezhang/Projects/Jobby/Jobby/packages/ui/src/components/UI/Resume/CoverLetterPdfPreview.tsx",
                          lineNumber: 1251,
                          columnNumber: 21
                        }, this)
                      ] }, void 0, true, {
                        fileName: "/Users/xianzhezhang/Projects/Jobby/Jobby/packages/ui/src/components/UI/Resume/CoverLetterPdfPreview.tsx",
                        lineNumber: 1248,
                        columnNumber: 21
                      }, this)
                    ] }, void 0, true, {
                      fileName: "/Users/xianzhezhang/Projects/Jobby/Jobby/packages/ui/src/components/UI/Resume/CoverLetterPdfPreview.tsx",
                      lineNumber: 1244,
                      columnNumber: 19
                    }, this)
                  ] }, void 0, true, {
                    fileName: "/Users/xianzhezhang/Projects/Jobby/Jobby/packages/ui/src/components/UI/Resume/CoverLetterPdfPreview.tsx",
                    lineNumber: 1240,
                    columnNumber: 17
                  }, this),
                  /* @__PURE__ */ jsxDEV("div", { className: "flex items-center gap-2 shrink-0", children: [
                    /* @__PURE__ */ jsxDEV(
                      Button,
                      {
                        size: "sm",
                        Icon: Download,
                        onClick: download,
                        disabled: !pdfUrl || isGenerating,
                        children: isGenerating ? "Compiling PDF..." : "Download PDF"
                      },
                      void 0,
                      false,
                      {
                        fileName: "/Users/xianzhezhang/Projects/Jobby/Jobby/packages/ui/src/components/UI/Resume/CoverLetterPdfPreview.tsx",
                        lineNumber: 1261,
                        columnNumber: 19
                      },
                      this
                    ),
                    /* @__PURE__ */ jsxDEV(
                      "button",
                      {
                        type: "button",
                        "aria-label": "Close preview",
                        onClick: () => setIsModalOpen(false),
                        className: "flex h-9 w-9 items-center justify-center rounded-lg text-ink-secondary hover:bg-background-secondary transition cursor-pointer",
                        children: /* @__PURE__ */ jsxDEV(X, { className: "h-4 w-4" }, void 0, false, {
                          fileName: "/Users/xianzhezhang/Projects/Jobby/Jobby/packages/ui/src/components/UI/Resume/CoverLetterPdfPreview.tsx",
                          lineNumber: 1275,
                          columnNumber: 21
                        }, this)
                      },
                      void 0,
                      false,
                      {
                        fileName: "/Users/xianzhezhang/Projects/Jobby/Jobby/packages/ui/src/components/UI/Resume/CoverLetterPdfPreview.tsx",
                        lineNumber: 1269,
                        columnNumber: 19
                      },
                      this
                    )
                  ] }, void 0, true, {
                    fileName: "/Users/xianzhezhang/Projects/Jobby/Jobby/packages/ui/src/components/UI/Resume/CoverLetterPdfPreview.tsx",
                    lineNumber: 1260,
                    columnNumber: 17
                  }, this)
                ] }, void 0, true, {
                  fileName: "/Users/xianzhezhang/Projects/Jobby/Jobby/packages/ui/src/components/UI/Resume/CoverLetterPdfPreview.tsx",
                  lineNumber: 1239,
                  columnNumber: 15
                }, this),
                pdfUrl ? /* @__PURE__ */ jsxDEV(
                  "iframe",
                  {
                    title: "Cover Letter PDF preview",
                    src: pdfUrl,
                    className: "h-full w-full border-0 bg-background-secondary transform-gpu"
                  },
                  void 0,
                  false,
                  {
                    fileName: "/Users/xianzhezhang/Projects/Jobby/Jobby/packages/ui/src/components/UI/Resume/CoverLetterPdfPreview.tsx",
                    lineNumber: 1282,
                    columnNumber: 13
                  },
                  this
                ) : /* @__PURE__ */ jsxDEV("div", { className: "flex h-full flex-col items-center justify-center gap-2 text-ink-secondary", children: [
                  /* @__PURE__ */ jsxDEV(Loader2, { className: "h-6 w-6 animate-spin text-primary" }, void 0, false, {
                    fileName: "/Users/xianzhezhang/Projects/Jobby/Jobby/packages/ui/src/components/UI/Resume/CoverLetterPdfPreview.tsx",
                    lineNumber: 1288,
                    columnNumber: 19
                  }, this),
                  /* @__PURE__ */ jsxDEV("p", { className: "text-xs font-medium", children: "Loading PDF engine..." }, void 0, false, {
                    fileName: "/Users/xianzhezhang/Projects/Jobby/Jobby/packages/ui/src/components/UI/Resume/CoverLetterPdfPreview.tsx",
                    lineNumber: 1289,
                    columnNumber: 19
                  }, this)
                ] }, void 0, true, {
                  fileName: "/Users/xianzhezhang/Projects/Jobby/Jobby/packages/ui/src/components/UI/Resume/CoverLetterPdfPreview.tsx",
                  lineNumber: 1287,
                  columnNumber: 13
                }, this)
              ]
            },
            void 0,
            true,
            {
              fileName: "/Users/xianzhezhang/Projects/Jobby/Jobby/packages/ui/src/components/UI/Resume/CoverLetterPdfPreview.tsx",
              lineNumber: 1234,
              columnNumber: 13
            },
            this
          )
        },
        void 0,
        false,
        {
          fileName: "/Users/xianzhezhang/Projects/Jobby/Jobby/packages/ui/src/components/UI/Resume/CoverLetterPdfPreview.tsx",
          lineNumber: 1230,
          columnNumber: 9
        },
        this
      ),
      document.body
    )
  ] }, void 0, true, {
    fileName: "/Users/xianzhezhang/Projects/Jobby/Jobby/packages/ui/src/components/UI/Resume/CoverLetterPdfPreview.tsx",
    lineNumber: 1103,
    columnNumber: 5
  }, this);
}
_s(CoverLetterPdfPreview, "hCBaDyP0RHatNFVIUjI1N1gYw60=");
_c6 = CoverLetterPdfPreview;
var _c, _c2, _c3, _c4, _c5, _c6;
$RefreshReg$(_c, "PdfContactIcon");
$RefreshReg$(_c2, "CoverLetterPdfDocument");
$RefreshReg$(_c3, "LinkedinHtmlIcon");
$RefreshReg$(_c4, "HtmlContactIcon");
$RefreshReg$(_c5, "CoverLetterHtmlDocument");
$RefreshReg$(_c6, "CoverLetterPdfPreview");
if (import.meta.hot && !inWebWorker) {
  window.$RefreshReg$ = prevRefreshReg;
  window.$RefreshSig$ = prevRefreshSig;
}
if (import.meta.hot && !inWebWorker) {
  RefreshRuntime.__hmr_import(import.meta.url).then((currentExports) => {
    RefreshRuntime.registerExportsForReactRefresh("/Users/xianzhezhang/Projects/Jobby/Jobby/packages/ui/src/components/UI/Resume/CoverLetterPdfPreview.tsx", currentExports);
    import.meta.hot.accept((nextExports) => {
      if (!nextExports) return;
      const invalidateMessage = RefreshRuntime.validateRefreshBoundaryAndEnqueueUpdate("/Users/xianzhezhang/Projects/Jobby/Jobby/packages/ui/src/components/UI/Resume/CoverLetterPdfPreview.tsx", currentExports, nextExports);
      if (invalidateMessage) import.meta.hot.invalidate(invalidateMessage);
    });
  });
}
