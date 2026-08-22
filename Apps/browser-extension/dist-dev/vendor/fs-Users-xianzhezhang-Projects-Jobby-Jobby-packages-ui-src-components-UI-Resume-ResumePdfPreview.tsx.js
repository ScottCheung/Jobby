import { createHotContext as __vite__createHotContext } from "/vendor/vite-client.js";import.meta.hot = __vite__createHotContext("/vendor/fs-Users-xianzhezhang-Projects-Jobby-Jobby-packages-ui-src-components-UI-Resume-ResumePdfPreview.tsx.js");import __vite__cjsImport0_react_jsxDevRuntime from "/vendor/.vite-deps-react_jsx-dev-runtime.js__v--f5b0ea50.js"; const Fragment = __vite__cjsImport0_react_jsxDevRuntime["Fragment"]; const jsxDEV = __vite__cjsImport0_react_jsxDevRuntime["jsxDEV"];
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
  window.$RefreshReg$ = RefreshRuntime.getRefreshReg("/Users/xianzhezhang/Projects/Jobby/Jobby/packages/ui/src/components/UI/Resume/ResumePdfPreview.tsx");
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
  Defs,
  Document,
  LinearGradient,
  Link,
  Page,
  Path,
  Rect,
  Stop,
  StyleSheet,
  Svg,
  Text,
  View,
  pdf
} from "/vendor/.vite-deps-@react-pdf_renderer.js__v--e810af01.js";
import { Button } from "/vendor/fs-Users-xianzhezhang-Projects-Jobby-Jobby-packages-ui-src-components-UI-Button-index.tsx.js";
import { defaultResumeTemplate } from "/vendor/fs-Users-xianzhezhang-Projects-Jobby-Jobby-packages-ui-src-components-UI-Resume-registry.ts.js";
import { ResumeHtmlDocument } from "/vendor/fs-Users-xianzhezhang-Projects-Jobby-Jobby-packages-ui-src-components-UI-Resume-resume-html-document.tsx.js";
import { scaleResumeTemplate } from "/vendor/fs-Users-xianzhezhang-Projects-Jobby-Jobby-packages-ui-src-components-UI-Resume-scale.ts.js";
import { formatResumeFilename, resumeContactItems } from "/vendor/fs-Users-xianzhezhang-Projects-Jobby-Jobby-packages-ui-src-components-UI-Resume-helpers.ts.js";
import {
  createResumeHighlightRules,
  tokenizeResumeText
} from "/vendor/fs-Users-xianzhezhang-Projects-Jobby-Jobby-packages-ui-src-components-UI-Resume-highlights.ts.js";
import { useSmartOnePage } from "/vendor/fs-Users-xianzhezhang-Projects-Jobby-Jobby-packages-ui-src-components-UI-Resume-use-smart-one-page.ts.js";
function createPdfStyles(template) {
  return StyleSheet.create({
    page: {
      paddingTop: template.paper.paddingTop,
      paddingRight: template.paper.paddingRight,
      paddingBottom: template.paper.paddingBottom,
      paddingLeft: template.paper.paddingLeft,
      color: template.colors.ink,
      fontFamily: template.typography.pdfFontFamily,
      fontSize: template.typography.bodySize,
      lineHeight: template.typography.bodyLineHeight
    },
    header: {
      borderBottomWidth: template.spacing.headerRuleWidth,
      borderBottomColor: template.colors.headerRule,
      paddingBottom: template.spacing.headerPaddingBottom
    },
    name: {
      fontSize: template.typography.nameSize,
      fontFamily: "Helvetica-Bold",
      lineHeight: 1.1
    },
    headline: {
      marginTop: template.spacing.headlineGap,
      color: template.colors.muted,
      fontSize: template.typography.headlineSize
    },
    contact: {
      marginTop: template.spacing.contactGap,
      color: template.colors.muted,
      fontSize: template.typography.contactSize,
      lineHeight: 1,
      flexDirection: "row",
      flexWrap: "wrap",
      alignItems: "center"
    },
    contactItem: {
      flexDirection: "row",
      alignItems: "center"
    },
    contactLink: {
      color: template.colors.muted,
      textDecoration: "none",
      fontSize: template.typography.contactSize,
      lineHeight: 1
    },
    contactText: {
      color: template.colors.muted,
      fontSize: template.typography.contactSize,
      lineHeight: 1
    },
    contactDivider: {
      marginHorizontal: 4,
      color: template.colors.rule,
      fontSize: template.typography.contactSize,
      lineHeight: 1
    },
    section: { marginTop: template.spacing.sectionGap },
    sectionTitleRow: {
      flexDirection: "row",
      alignItems: "center",
      borderBottomWidth: template.spacing.sectionRuleWidth,
      borderBottomColor: template.colors.rule,
      paddingBottom: template.spacing.sectionTitlePadding
    },
    sectionTitleBlock: {
      width: 7.5,
      height: 7.5,
      marginRight: 5,
      borderRadius: 1.8,
      overflow: "hidden"
    },
    sectionTitle: {
      fontFamily: "Helvetica-Bold",
      fontSize: template.typography.sectionTitleSize,
      lineHeight: 1,
      textTransform: "uppercase",
      color: "#784508",
      letterSpacing: 1.2
    },
    skillPillContainer: {
      flexDirection: "row",
      flexWrap: "wrap",
      alignItems: "center"
    },
    skillPill: {
      backgroundColor: "#FAF5EC",
      borderWidth: 0.6,
      borderColor: "#DEC8A0",
      borderRadius: 3.5,
      paddingHorizontal: 7,
      paddingTop: 2,
      paddingBottom: 2.5,
      marginRight: 6,
      marginBottom: 5
    },
    skillPillText: {
      fontSize: template.typography.metaSize,
      color: "#784508",
      fontFamily: "Helvetica-Bold",
      lineHeight: 1
    },
    entry: { marginTop: template.spacing.entryGap },
    row: {
      flexDirection: "row",
      justifyContent: "space-between",
      columnGap: template.spacing.rowGap
    },
    entryTitle: {
      flexGrow: 1,
      fontSize: template.typography.bodySize
    },
    companyTitle: {
      fontFamily: "Helvetica-Bold",
      color: template.colors.ink
    },
    titleSeparator: {
      fontFamily: "Helvetica",
      color: template.colors.muted
    },
    jobTitle: {
      fontFamily: "Helvetica",
      color: template.colors.primary || "#8A6220"
    },
    date: {
      color: template.colors.muted,
      fontSize: template.typography.dateSize,
      flexShrink: 0
    },
    detail: {
      marginTop: template.spacing.detailGap,
      color: template.colors.muted,
      fontSize: template.typography.dateSize
    },
    url: {
      marginTop: template.spacing.bulletGap,
      color: template.colors.muted,
      fontSize: template.typography.urlSize,
      textDecoration: "underline"
    },
    bullet: {
      flexDirection: "row",
      marginTop: template.spacing.bulletGap,
      paddingLeft: template.spacing.bulletIndent ?? 10
    },
    bulletMark: {
      width: template.spacing.bulletMarkWidth,
      fontSize: template.typography.sectionTitleSize
    },
    bodyText: {
      fontSize: template.typography.bodySize,
      lineHeight: template.typography.bodyLineHeight,
      color: template.colors.body
    },
    bulletText: {
      flex: 1,
      fontSize: template.typography.bodySize,
      lineHeight: template.typography.bodyLineHeight,
      color: template.colors.body
    },
    technologies: {
      marginTop: template.spacing.technologyGap,
      color: template.colors.muted,
      fontSize: template.typography.metaSize
    },
    technologiesLabel: {
      fontFamily: "Helvetica-Bold",
      color: template.colors.body
    },
    highlightSkill: {
      fontFamily: "Helvetica-Bold",
      color: template.colors.ink
    },
    highlightMetric: {
      fontFamily: "Helvetica-Bold",
      color: template.colors.ink
    },
    skillGroup: {
      flexDirection: "row",
      marginTop: template.spacing.skillGap
    },
    skillLabel: {
      width: template.spacing.skillLabelWidth,
      flexShrink: 0,
      fontFamily: "Helvetica-Bold",
      fontSize: template.typography.dateSize,
      color: template.colors.ink
    },
    skillValues: {
      flex: 1,
      fontSize: template.typography.bodySize,
      lineHeight: template.typography.bodyLineHeight,
      color: template.colors.body
    },
    footer: {
      position: "absolute",
      bottom: template.spacing.footerBottom,
      left: template.spacing.footerInset,
      right: template.spacing.footerInset,
      textAlign: "right",
      color: template.colors.subtle,
      fontSize: template.typography.footerSize
    }
  });
}
function fullName(data) {
  const basics = data.basics ?? {};
  return [basics.first_name, basics.middle_name, basics.last_name].filter(Boolean).join(" ") || "Resume";
}
function dateRange(start, end) {
  return [start, end].filter(Boolean).join(" - ");
}
function PdfHighlightedText({
  value,
  rules,
  style,
  styles
}) {
  return /* @__PURE__ */ jsxDEV(Text, { style, children: tokenizeResumeText(value, rules).map(
    (token, index) => token.kind === "plain" ? token.value : /* @__PURE__ */ jsxDEV(
      Text,
      {
        style: token.kind === "skill" ? styles.highlightSkill : styles.highlightMetric,
        children: token.value
      },
      `${token.value}-${index}`,
      false,
      {
        fileName: "/Users/xianzhezhang/Projects/Jobby/Jobby/packages/ui/src/components/UI/Resume/ResumePdfPreview.tsx",
        lineNumber: 320,
        columnNumber: 7
      },
      this
    )
  ) }, void 0, false, {
    fileName: "/Users/xianzhezhang/Projects/Jobby/Jobby/packages/ui/src/components/UI/Resume/ResumePdfPreview.tsx",
    lineNumber: 316,
    columnNumber: 5
  }, this);
}
_c = PdfHighlightedText;
function PdfBullets({
  items,
  styles,
  rules
}) {
  return /* @__PURE__ */ jsxDEV(Fragment, { children: (items ?? []).filter(Boolean).map(
    (item, index) => /* @__PURE__ */ jsxDEV(View, { style: styles.bullet, wrap: false, children: [
      /* @__PURE__ */ jsxDEV(Text, { style: styles.bulletMark, children: "•" }, void 0, false, {
        fileName: "/Users/xianzhezhang/Projects/Jobby/Jobby/packages/ui/src/components/UI/Resume/ResumePdfPreview.tsx",
        lineNumber: 348,
        columnNumber: 11
      }, this),
      /* @__PURE__ */ jsxDEV(
        PdfHighlightedText,
        {
          value: item,
          rules,
          style: styles.bulletText,
          styles
        },
        void 0,
        false,
        {
          fileName: "/Users/xianzhezhang/Projects/Jobby/Jobby/packages/ui/src/components/UI/Resume/ResumePdfPreview.tsx",
          lineNumber: 349,
          columnNumber: 11
        },
        this
      )
    ] }, `${item}-${index}`, true, {
      fileName: "/Users/xianzhezhang/Projects/Jobby/Jobby/packages/ui/src/components/UI/Resume/ResumePdfPreview.tsx",
      lineNumber: 347,
      columnNumber: 7
    }, this)
  ) }, void 0, false, {
    fileName: "/Users/xianzhezhang/Projects/Jobby/Jobby/packages/ui/src/components/UI/Resume/ResumePdfPreview.tsx",
    lineNumber: 345,
    columnNumber: 5
  }, this);
}
_c2 = PdfBullets;
function PdfTechnologies({
  technologies,
  styles,
  template
}) {
  if (!technologies?.length) return null;
  return /* @__PURE__ */ jsxDEV(Text, { style: styles.technologies, wrap: false, children: [
    /* @__PURE__ */ jsxDEV(Text, { style: styles.technologiesLabel, children: "Technologies: " }, void 0, false, {
      fileName: "/Users/xianzhezhang/Projects/Jobby/Jobby/packages/ui/src/components/UI/Resume/ResumePdfPreview.tsx",
      lineNumber: 373,
      columnNumber: 7
    }, this),
    technologies.join(template.separators.technologies)
  ] }, void 0, true, {
    fileName: "/Users/xianzhezhang/Projects/Jobby/Jobby/packages/ui/src/components/UI/Resume/ResumePdfPreview.tsx",
    lineNumber: 372,
    columnNumber: 5
  }, this);
}
_c3 = PdfTechnologies;
function PdfSection({
  title,
  children,
  styles
}) {
  return /* @__PURE__ */ jsxDEV(View, { style: styles.section, children: [
    /* @__PURE__ */ jsxDEV(View, { style: styles.sectionTitleRow, wrap: false, minPresenceAhead: 40, children: [
      /* @__PURE__ */ jsxDEV(
        Svg,
        {
          width: 7.5,
          height: 7.5,
          viewBox: "0 0 24 24",
          style: styles.sectionTitleBlock,
          children: [
            /* @__PURE__ */ jsxDEV(Defs, { children: [
              /* @__PURE__ */ jsxDEV(LinearGradient, { id: "goldLightGradPdf", x1: "0", y1: "0", x2: "1", y2: "1", children: [
                /* @__PURE__ */ jsxDEV(Stop, { offset: "0%", stopColor: "#F5CB72" }, void 0, false, {
                  fileName: "/Users/xianzhezhang/Projects/Jobby/Jobby/packages/ui/src/components/UI/Resume/ResumePdfPreview.tsx",
                  lineNumber: 399,
                  columnNumber: 15
                }, this),
                /* @__PURE__ */ jsxDEV(Stop, { offset: "100%", stopColor: "#DE992E" }, void 0, false, {
                  fileName: "/Users/xianzhezhang/Projects/Jobby/Jobby/packages/ui/src/components/UI/Resume/ResumePdfPreview.tsx",
                  lineNumber: 400,
                  columnNumber: 15
                }, this)
              ] }, void 0, true, {
                fileName: "/Users/xianzhezhang/Projects/Jobby/Jobby/packages/ui/src/components/UI/Resume/ResumePdfPreview.tsx",
                lineNumber: 398,
                columnNumber: 13
              }, this),
              /* @__PURE__ */ jsxDEV(LinearGradient, { id: "goldDarkGradPdf", x1: "0", y1: "0", x2: "1", y2: "1", children: [
                /* @__PURE__ */ jsxDEV(Stop, { offset: "0%", stopColor: "#BA751A" }, void 0, false, {
                  fileName: "/Users/xianzhezhang/Projects/Jobby/Jobby/packages/ui/src/components/UI/Resume/ResumePdfPreview.tsx",
                  lineNumber: 403,
                  columnNumber: 15
                }, this),
                /* @__PURE__ */ jsxDEV(Stop, { offset: "100%", stopColor: "#8A510A" }, void 0, false, {
                  fileName: "/Users/xianzhezhang/Projects/Jobby/Jobby/packages/ui/src/components/UI/Resume/ResumePdfPreview.tsx",
                  lineNumber: 404,
                  columnNumber: 15
                }, this)
              ] }, void 0, true, {
                fileName: "/Users/xianzhezhang/Projects/Jobby/Jobby/packages/ui/src/components/UI/Resume/ResumePdfPreview.tsx",
                lineNumber: 402,
                columnNumber: 13
              }, this)
            ] }, void 0, true, {
              fileName: "/Users/xianzhezhang/Projects/Jobby/Jobby/packages/ui/src/components/UI/Resume/ResumePdfPreview.tsx",
              lineNumber: 397,
              columnNumber: 11
            }, this),
            /* @__PURE__ */ jsxDEV(Rect, { width: 24, height: 24, rx: 4.5, fill: "url(#goldLightGradPdf)" }, void 0, false, {
              fileName: "/Users/xianzhezhang/Projects/Jobby/Jobby/packages/ui/src/components/UI/Resume/ResumePdfPreview.tsx",
              lineNumber: 407,
              columnNumber: 11
            }, this),
            /* @__PURE__ */ jsxDEV(Path, { d: "M 0,0 L 24,24 L 0,24 Z", fill: "url(#goldDarkGradPdf)" }, void 0, false, {
              fileName: "/Users/xianzhezhang/Projects/Jobby/Jobby/packages/ui/src/components/UI/Resume/ResumePdfPreview.tsx",
              lineNumber: 408,
              columnNumber: 11
            }, this)
          ]
        },
        void 0,
        true,
        {
          fileName: "/Users/xianzhezhang/Projects/Jobby/Jobby/packages/ui/src/components/UI/Resume/ResumePdfPreview.tsx",
          lineNumber: 391,
          columnNumber: 9
        },
        this
      ),
      /* @__PURE__ */ jsxDEV(Text, { style: styles.sectionTitle, children: title }, void 0, false, {
        fileName: "/Users/xianzhezhang/Projects/Jobby/Jobby/packages/ui/src/components/UI/Resume/ResumePdfPreview.tsx",
        lineNumber: 410,
        columnNumber: 9
      }, this)
    ] }, void 0, true, {
      fileName: "/Users/xianzhezhang/Projects/Jobby/Jobby/packages/ui/src/components/UI/Resume/ResumePdfPreview.tsx",
      lineNumber: 390,
      columnNumber: 7
    }, this),
    children
  ] }, void 0, true, {
    fileName: "/Users/xianzhezhang/Projects/Jobby/Jobby/packages/ui/src/components/UI/Resume/ResumePdfPreview.tsx",
    lineNumber: 389,
    columnNumber: 5
  }, this);
}
_c4 = PdfSection;
function PdfResumeSection({
  section,
  data,
  coreCompetencies,
  keyQualifications,
  styles,
  template,
  rules
}) {
  switch (section) {
    case "summary": {
      const effectiveCompetencies = coreCompetencies.length ? coreCompetencies : keyQualifications.length ? keyQualifications : (data.core_competencies?.length ? data.core_competencies : data.key_qualifications) ?? [];
      return data.summary || effectiveCompetencies.length ? /* @__PURE__ */ jsxDEV(Fragment, { children: [
        data.summary ? /* @__PURE__ */ jsxDEV(
          PdfSection,
          {
            title: template.sectionLabels.summary,
            styles,
            children: /* @__PURE__ */ jsxDEV(
              PdfHighlightedText,
              {
                value: data.summary,
                rules,
                style: [
                  styles.bodyText,
                  { marginTop: template.spacing.contentInset }
                ],
                styles
              },
              void 0,
              false,
              {
                fileName: "/Users/xianzhezhang/Projects/Jobby/Jobby/packages/ui/src/components/UI/Resume/ResumePdfPreview.tsx",
                lineNumber: 449,
                columnNumber: 17
              },
              this
            )
          },
          void 0,
          false,
          {
            fileName: "/Users/xianzhezhang/Projects/Jobby/Jobby/packages/ui/src/components/UI/Resume/ResumePdfPreview.tsx",
            lineNumber: 445,
            columnNumber: 11
          },
          this
        ) : null,
        effectiveCompetencies.length ? /* @__PURE__ */ jsxDEV(PdfSection, { title: "Core Competencies", styles, children: /* @__PURE__ */ jsxDEV(
          View,
          {
            style: [
              styles.skillPillContainer,
              { marginTop: template.spacing.contentInset }
            ],
            children: effectiveCompetencies.map(
              (item, idx) => /* @__PURE__ */ jsxDEV(View, { style: styles.skillPill, wrap: false, children: /* @__PURE__ */ jsxDEV(Text, { style: styles.skillPillText, children: item }, void 0, false, {
                fileName: "/Users/xianzhezhang/Projects/Jobby/Jobby/packages/ui/src/components/UI/Resume/ResumePdfPreview.tsx",
                lineNumber: 470,
                columnNumber: 23
              }, this) }, idx, false, {
                fileName: "/Users/xianzhezhang/Projects/Jobby/Jobby/packages/ui/src/components/UI/Resume/ResumePdfPreview.tsx",
                lineNumber: 469,
                columnNumber: 15
              }, this)
            )
          },
          void 0,
          false,
          {
            fileName: "/Users/xianzhezhang/Projects/Jobby/Jobby/packages/ui/src/components/UI/Resume/ResumePdfPreview.tsx",
            lineNumber: 462,
            columnNumber: 17
          },
          this
        ) }, void 0, false, {
          fileName: "/Users/xianzhezhang/Projects/Jobby/Jobby/packages/ui/src/components/UI/Resume/ResumePdfPreview.tsx",
          lineNumber: 461,
          columnNumber: 11
        }, this) : null
      ] }, void 0, true, {
        fileName: "/Users/xianzhezhang/Projects/Jobby/Jobby/packages/ui/src/components/UI/Resume/ResumePdfPreview.tsx",
        lineNumber: 443,
        columnNumber: 9
      }, this) : null;
    }
    case "experience":
      return data.experience?.length ? /* @__PURE__ */ jsxDEV(PdfSection, { title: template.sectionLabels.experience, styles, children: data.experience.map(
        (item, index) => /* @__PURE__ */ jsxDEV(View, { style: styles.entry, children: [
          /* @__PURE__ */ jsxDEV(View, { wrap: false, minPresenceAhead: 32, children: [
            /* @__PURE__ */ jsxDEV(View, { style: styles.row, children: [
              /* @__PURE__ */ jsxDEV(Text, { style: styles.entryTitle, children: [
                item.company ? /* @__PURE__ */ jsxDEV(Text, { style: styles.companyTitle, children: item.company }, void 0, false, {
                  fileName: "/Users/xianzhezhang/Projects/Jobby/Jobby/packages/ui/src/components/UI/Resume/ResumePdfPreview.tsx",
                  lineNumber: 488,
                  columnNumber: 17
                }, this) : null,
                item.company && item.title ? /* @__PURE__ */ jsxDEV(Text, { style: styles.titleSeparator, children: template.separators.inline }, void 0, false, {
                  fileName: "/Users/xianzhezhang/Projects/Jobby/Jobby/packages/ui/src/components/UI/Resume/ResumePdfPreview.tsx",
                  lineNumber: 491,
                  columnNumber: 17
                }, this) : null,
                item.title ? /* @__PURE__ */ jsxDEV(Text, { style: styles.jobTitle, children: item.title }, void 0, false, {
                  fileName: "/Users/xianzhezhang/Projects/Jobby/Jobby/packages/ui/src/components/UI/Resume/ResumePdfPreview.tsx",
                  lineNumber: 496,
                  columnNumber: 17
                }, this) : null
              ] }, void 0, true, {
                fileName: "/Users/xianzhezhang/Projects/Jobby/Jobby/packages/ui/src/components/UI/Resume/ResumePdfPreview.tsx",
                lineNumber: 486,
                columnNumber: 21
              }, this),
              /* @__PURE__ */ jsxDEV(Text, { style: styles.date, children: dateRange(item.start_date, item.end_date) }, void 0, false, {
                fileName: "/Users/xianzhezhang/Projects/Jobby/Jobby/packages/ui/src/components/UI/Resume/ResumePdfPreview.tsx",
                lineNumber: 499,
                columnNumber: 21
              }, this)
            ] }, void 0, true, {
              fileName: "/Users/xianzhezhang/Projects/Jobby/Jobby/packages/ui/src/components/UI/Resume/ResumePdfPreview.tsx",
              lineNumber: 485,
              columnNumber: 19
            }, this),
            item.location && /* @__PURE__ */ jsxDEV(Text, { style: styles.detail, children: item.location }, void 0, false, {
              fileName: "/Users/xianzhezhang/Projects/Jobby/Jobby/packages/ui/src/components/UI/Resume/ResumePdfPreview.tsx",
              lineNumber: 504,
              columnNumber: 13
            }, this)
          ] }, void 0, true, {
            fileName: "/Users/xianzhezhang/Projects/Jobby/Jobby/packages/ui/src/components/UI/Resume/ResumePdfPreview.tsx",
            lineNumber: 484,
            columnNumber: 17
          }, this),
          /* @__PURE__ */ jsxDEV(
            PdfBullets,
            {
              items: item.description,
              styles,
              rules
            },
            void 0,
            false,
            {
              fileName: "/Users/xianzhezhang/Projects/Jobby/Jobby/packages/ui/src/components/UI/Resume/ResumePdfPreview.tsx",
              lineNumber: 507,
              columnNumber: 17
            },
            this
          ),
          /* @__PURE__ */ jsxDEV(
            PdfTechnologies,
            {
              technologies: item.technologies,
              styles,
              template
            },
            void 0,
            false,
            {
              fileName: "/Users/xianzhezhang/Projects/Jobby/Jobby/packages/ui/src/components/UI/Resume/ResumePdfPreview.tsx",
              lineNumber: 512,
              columnNumber: 17
            },
            this
          )
        ] }, `${item.company}-${index}`, true, {
          fileName: "/Users/xianzhezhang/Projects/Jobby/Jobby/packages/ui/src/components/UI/Resume/ResumePdfPreview.tsx",
          lineNumber: 483,
          columnNumber: 9
        }, this)
      ) }, void 0, false, {
        fileName: "/Users/xianzhezhang/Projects/Jobby/Jobby/packages/ui/src/components/UI/Resume/ResumePdfPreview.tsx",
        lineNumber: 481,
        columnNumber: 7
      }, this) : null;
    case "education":
      return data.education?.length ? /* @__PURE__ */ jsxDEV(PdfSection, { title: template.sectionLabels.education, styles, children: data.education.map((item, index) => {
        const hasDegreeInfo = Boolean(item.degree || item.field_of_study);
        const subInfo = hasDegreeInfo ? [item.institution, item.location].filter(Boolean).join(template.separators.inline) : item.location;
        return /* @__PURE__ */ jsxDEV(View, { style: styles.entry, children: [
          /* @__PURE__ */ jsxDEV(View, { wrap: false, minPresenceAhead: 32, children: [
            /* @__PURE__ */ jsxDEV(View, { style: styles.row, children: [
              /* @__PURE__ */ jsxDEV(Text, { style: styles.entryTitle, children: [
                item.degree ? /* @__PURE__ */ jsxDEV(Text, { style: styles.companyTitle, children: item.degree }, void 0, false, {
                  fileName: "/Users/xianzhezhang/Projects/Jobby/Jobby/packages/ui/src/components/UI/Resume/ResumePdfPreview.tsx",
                  lineNumber: 539,
                  columnNumber: 21
                }, this) : null,
                item.degree && item.field_of_study ? /* @__PURE__ */ jsxDEV(Text, { style: styles.titleSeparator, children: template.separators.inline }, void 0, false, {
                  fileName: "/Users/xianzhezhang/Projects/Jobby/Jobby/packages/ui/src/components/UI/Resume/ResumePdfPreview.tsx",
                  lineNumber: 542,
                  columnNumber: 21
                }, this) : null,
                item.field_of_study ? /* @__PURE__ */ jsxDEV(Text, { style: styles.jobTitle, children: item.field_of_study }, void 0, false, {
                  fileName: "/Users/xianzhezhang/Projects/Jobby/Jobby/packages/ui/src/components/UI/Resume/ResumePdfPreview.tsx",
                  lineNumber: 547,
                  columnNumber: 21
                }, this) : null,
                !hasDegreeInfo && item.institution ? /* @__PURE__ */ jsxDEV(Text, { style: styles.companyTitle, children: item.institution }, void 0, false, {
                  fileName: "/Users/xianzhezhang/Projects/Jobby/Jobby/packages/ui/src/components/UI/Resume/ResumePdfPreview.tsx",
                  lineNumber: 552,
                  columnNumber: 21
                }, this) : null
              ] }, void 0, true, {
                fileName: "/Users/xianzhezhang/Projects/Jobby/Jobby/packages/ui/src/components/UI/Resume/ResumePdfPreview.tsx",
                lineNumber: 537,
                columnNumber: 23
              }, this),
              /* @__PURE__ */ jsxDEV(Text, { style: styles.date, children: dateRange(item.start_date, item.end_date) }, void 0, false, {
                fileName: "/Users/xianzhezhang/Projects/Jobby/Jobby/packages/ui/src/components/UI/Resume/ResumePdfPreview.tsx",
                lineNumber: 557,
                columnNumber: 23
              }, this)
            ] }, void 0, true, {
              fileName: "/Users/xianzhezhang/Projects/Jobby/Jobby/packages/ui/src/components/UI/Resume/ResumePdfPreview.tsx",
              lineNumber: 536,
              columnNumber: 21
            }, this),
            subInfo ? /* @__PURE__ */ jsxDEV(Text, { style: styles.detail, children: subInfo }, void 0, false, {
              fileName: "/Users/xianzhezhang/Projects/Jobby/Jobby/packages/ui/src/components/UI/Resume/ResumePdfPreview.tsx",
              lineNumber: 562,
              columnNumber: 17
            }, this) : null
          ] }, void 0, true, {
            fileName: "/Users/xianzhezhang/Projects/Jobby/Jobby/packages/ui/src/components/UI/Resume/ResumePdfPreview.tsx",
            lineNumber: 535,
            columnNumber: 19
          }, this),
          /* @__PURE__ */ jsxDEV(
            PdfBullets,
            {
              items: item.highlights,
              styles,
              rules
            },
            void 0,
            false,
            {
              fileName: "/Users/xianzhezhang/Projects/Jobby/Jobby/packages/ui/src/components/UI/Resume/ResumePdfPreview.tsx",
              lineNumber: 565,
              columnNumber: 19
            },
            this
          )
        ] }, `${item.institution}-${index}`, true, {
          fileName: "/Users/xianzhezhang/Projects/Jobby/Jobby/packages/ui/src/components/UI/Resume/ResumePdfPreview.tsx",
          lineNumber: 534,
          columnNumber: 13
        }, this);
      }) }, void 0, false, {
        fileName: "/Users/xianzhezhang/Projects/Jobby/Jobby/packages/ui/src/components/UI/Resume/ResumePdfPreview.tsx",
        lineNumber: 523,
        columnNumber: 7
      }, this) : null;
    case "projects":
      return data.projects?.length ? /* @__PURE__ */ jsxDEV(PdfSection, { title: template.sectionLabels.projects, styles, children: data.projects.map(
        (item, index) => /* @__PURE__ */ jsxDEV(View, { style: styles.entry, children: [
          /* @__PURE__ */ jsxDEV(View, { wrap: false, minPresenceAhead: 32, children: [
            /* @__PURE__ */ jsxDEV(View, { style: styles.row, children: [
              /* @__PURE__ */ jsxDEV(Text, { style: styles.entryTitle, children: item.name }, void 0, false, {
                fileName: "/Users/xianzhezhang/Projects/Jobby/Jobby/packages/ui/src/components/UI/Resume/ResumePdfPreview.tsx",
                lineNumber: 582,
                columnNumber: 21
              }, this),
              /* @__PURE__ */ jsxDEV(Text, { style: styles.date, children: dateRange(item.start_date, item.end_date) }, void 0, false, {
                fileName: "/Users/xianzhezhang/Projects/Jobby/Jobby/packages/ui/src/components/UI/Resume/ResumePdfPreview.tsx",
                lineNumber: 583,
                columnNumber: 21
              }, this)
            ] }, void 0, true, {
              fileName: "/Users/xianzhezhang/Projects/Jobby/Jobby/packages/ui/src/components/UI/Resume/ResumePdfPreview.tsx",
              lineNumber: 581,
              columnNumber: 19
            }, this),
            item.url && /* @__PURE__ */ jsxDEV(Link, { src: item.url, style: styles.url, children: item.url }, void 0, false, {
              fileName: "/Users/xianzhezhang/Projects/Jobby/Jobby/packages/ui/src/components/UI/Resume/ResumePdfPreview.tsx",
              lineNumber: 588,
              columnNumber: 13
            }, this)
          ] }, void 0, true, {
            fileName: "/Users/xianzhezhang/Projects/Jobby/Jobby/packages/ui/src/components/UI/Resume/ResumePdfPreview.tsx",
            lineNumber: 580,
            columnNumber: 17
          }, this),
          /* @__PURE__ */ jsxDEV(
            PdfBullets,
            {
              items: item.description,
              styles,
              rules
            },
            void 0,
            false,
            {
              fileName: "/Users/xianzhezhang/Projects/Jobby/Jobby/packages/ui/src/components/UI/Resume/ResumePdfPreview.tsx",
              lineNumber: 593,
              columnNumber: 17
            },
            this
          ),
          /* @__PURE__ */ jsxDEV(
            PdfTechnologies,
            {
              technologies: item.technologies,
              styles,
              template
            },
            void 0,
            false,
            {
              fileName: "/Users/xianzhezhang/Projects/Jobby/Jobby/packages/ui/src/components/UI/Resume/ResumePdfPreview.tsx",
              lineNumber: 598,
              columnNumber: 17
            },
            this
          )
        ] }, `${item.name}-${index}`, true, {
          fileName: "/Users/xianzhezhang/Projects/Jobby/Jobby/packages/ui/src/components/UI/Resume/ResumePdfPreview.tsx",
          lineNumber: 579,
          columnNumber: 9
        }, this)
      ) }, void 0, false, {
        fileName: "/Users/xianzhezhang/Projects/Jobby/Jobby/packages/ui/src/components/UI/Resume/ResumePdfPreview.tsx",
        lineNumber: 577,
        columnNumber: 7
      }, this) : null;
    case "skills":
      return data.skills?.length ? /* @__PURE__ */ jsxDEV(PdfSection, { title: template.sectionLabels.skills, styles, children: data.skills.map(
        (group, index) => /* @__PURE__ */ jsxDEV(
          View,
          {
            style: styles.skillGroup,
            wrap: false,
            children: [
              group.type && /* @__PURE__ */ jsxDEV(Text, { style: styles.skillLabel, children: group.type }, void 0, false, {
                fileName: "/Users/xianzhezhang/Projects/Jobby/Jobby/packages/ui/src/components/UI/Resume/ResumePdfPreview.tsx",
                lineNumber: 617,
                columnNumber: 11
              }, this),
              /* @__PURE__ */ jsxDEV(Text, { style: styles.skillValues, children: (group.skills ?? []).join(template.separators.inline) }, void 0, false, {
                fileName: "/Users/xianzhezhang/Projects/Jobby/Jobby/packages/ui/src/components/UI/Resume/ResumePdfPreview.tsx",
                lineNumber: 619,
                columnNumber: 17
              }, this)
            ]
          },
          `${group.type}-${index}`,
          true,
          {
            fileName: "/Users/xianzhezhang/Projects/Jobby/Jobby/packages/ui/src/components/UI/Resume/ResumePdfPreview.tsx",
            lineNumber: 611,
            columnNumber: 9
          },
          this
        )
      ) }, void 0, false, {
        fileName: "/Users/xianzhezhang/Projects/Jobby/Jobby/packages/ui/src/components/UI/Resume/ResumePdfPreview.tsx",
        lineNumber: 609,
        columnNumber: 7
      }, this) : null;
    case "certifications":
      return data.certifications?.length ? /* @__PURE__ */ jsxDEV(
        PdfSection,
        {
          title: template.sectionLabels.certifications,
          styles,
          children: data.certifications.flatMap((group) => group.certifications ?? []).map(
            (item, index) => /* @__PURE__ */ jsxDEV(
              Text,
              {
                wrap: false,
                style: [
                  styles.bodyText,
                  { marginTop: template.spacing.skillGap }
                ],
                children: [
                  item.name,
                  item.issuer,
                  dateRange(item.issue_date, item.expiry_date)
                ].filter(Boolean).join(template.separators.inline)
              },
              `${item.name}-${index}`,
              false,
              {
                fileName: "/Users/xianzhezhang/Projects/Jobby/Jobby/packages/ui/src/components/UI/Resume/ResumePdfPreview.tsx",
                lineNumber: 635,
                columnNumber: 9
              },
              this
            )
          )
        },
        void 0,
        false,
        {
          fileName: "/Users/xianzhezhang/Projects/Jobby/Jobby/packages/ui/src/components/UI/Resume/ResumePdfPreview.tsx",
          lineNumber: 628,
          columnNumber: 7
        },
        this
      ) : null;
    case "languages":
      return data.languages?.length ? /* @__PURE__ */ jsxDEV(PdfSection, { title: template.sectionLabels.languages, styles, children: /* @__PURE__ */ jsxDEV(
        Text,
        {
          wrap: false,
          style: [
            styles.bodyText,
            { marginTop: template.spacing.skillGap }
          ],
          children: data.languages.map(
            (item) => [item.name, item.proficiency].filter(Boolean).join(" - ")
          ).join(template.separators.inline)
        },
        void 0,
        false,
        {
          fileName: "/Users/xianzhezhang/Projects/Jobby/Jobby/packages/ui/src/components/UI/Resume/ResumePdfPreview.tsx",
          lineNumber: 657,
          columnNumber: 13
        },
        this
      ) }, void 0, false, {
        fileName: "/Users/xianzhezhang/Projects/Jobby/Jobby/packages/ui/src/components/UI/Resume/ResumePdfPreview.tsx",
        lineNumber: 656,
        columnNumber: 7
      }, this) : null;
    case "other":
      return data.other?.length ? /* @__PURE__ */ jsxDEV(PdfSection, { title: template.sectionLabels.other, styles, children: data.other.map((item, index) => {
        const itemLocation = item.location;
        return /* @__PURE__ */ jsxDEV(View, { style: styles.entry, children: [
          /* @__PURE__ */ jsxDEV(View, { wrap: false, minPresenceAhead: 32, children: [
            /* @__PURE__ */ jsxDEV(Text, { style: styles.entryTitle, children: [item.title, item.organization].filter(Boolean).join(template.separators.inline) || item.type || template.sectionLabels.other }, void 0, false, {
              fileName: "/Users/xianzhezhang/Projects/Jobby/Jobby/packages/ui/src/components/UI/Resume/ResumePdfPreview.tsx",
              lineNumber: 680,
              columnNumber: 21
            }, this),
            (itemLocation || item.date) && /* @__PURE__ */ jsxDEV(Text, { style: styles.detail, children: [itemLocation, item.date].filter(Boolean).join(template.separators.inline) }, void 0, false, {
              fileName: "/Users/xianzhezhang/Projects/Jobby/Jobby/packages/ui/src/components/UI/Resume/ResumePdfPreview.tsx",
              lineNumber: 688,
              columnNumber: 17
            }, this)
          ] }, void 0, true, {
            fileName: "/Users/xianzhezhang/Projects/Jobby/Jobby/packages/ui/src/components/UI/Resume/ResumePdfPreview.tsx",
            lineNumber: 679,
            columnNumber: 19
          }, this),
          /* @__PURE__ */ jsxDEV(
            PdfBullets,
            {
              items: item.description,
              styles,
              rules
            },
            void 0,
            false,
            {
              fileName: "/Users/xianzhezhang/Projects/Jobby/Jobby/packages/ui/src/components/UI/Resume/ResumePdfPreview.tsx",
              lineNumber: 695,
              columnNumber: 19
            },
            this
          )
        ] }, `${item.title}-${index}`, true, {
          fileName: "/Users/xianzhezhang/Projects/Jobby/Jobby/packages/ui/src/components/UI/Resume/ResumePdfPreview.tsx",
          lineNumber: 678,
          columnNumber: 13
        }, this);
      }) }, void 0, false, {
        fileName: "/Users/xianzhezhang/Projects/Jobby/Jobby/packages/ui/src/components/UI/Resume/ResumePdfPreview.tsx",
        lineNumber: 674,
        columnNumber: 7
      }, this) : null;
  }
}
_c5 = PdfResumeSection;
function isDesktopApp() {
  if (typeof window === "undefined") return false;
  const win = window;
  const ua = navigator.userAgent || "";
  return Boolean(
    win.electron || win.electronAPI || win.ipcRenderer || win.__TAURI__ || /Electron|Tauri|Jobby|Desktop/i.test(ua)
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
      return /* @__PURE__ */ jsxDEV(Svg, { viewBox: "0 0 24 24", style: svgStyle, children: /* @__PURE__ */ jsxDEV(
        Path,
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
          fileName: "/Users/xianzhezhang/Projects/Jobby/Jobby/packages/ui/src/components/UI/Resume/ResumePdfPreview.tsx",
          lineNumber: 734,
          columnNumber: 11
        },
        this
      ) }, void 0, false, {
        fileName: "/Users/xianzhezhang/Projects/Jobby/Jobby/packages/ui/src/components/UI/Resume/ResumePdfPreview.tsx",
        lineNumber: 733,
        columnNumber: 9
      }, this);
    case "phone":
      return /* @__PURE__ */ jsxDEV(Svg, { viewBox: "0 0 24 24", style: svgStyle, children: /* @__PURE__ */ jsxDEV(
        Path,
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
          fileName: "/Users/xianzhezhang/Projects/Jobby/Jobby/packages/ui/src/components/UI/Resume/ResumePdfPreview.tsx",
          lineNumber: 747,
          columnNumber: 11
        },
        this
      ) }, void 0, false, {
        fileName: "/Users/xianzhezhang/Projects/Jobby/Jobby/packages/ui/src/components/UI/Resume/ResumePdfPreview.tsx",
        lineNumber: 746,
        columnNumber: 9
      }, this);
    case "location":
      return /* @__PURE__ */ jsxDEV(Svg, { viewBox: "0 0 24 24", style: svgStyle, children: /* @__PURE__ */ jsxDEV(
        Path,
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
          fileName: "/Users/xianzhezhang/Projects/Jobby/Jobby/packages/ui/src/components/UI/Resume/ResumePdfPreview.tsx",
          lineNumber: 760,
          columnNumber: 11
        },
        this
      ) }, void 0, false, {
        fileName: "/Users/xianzhezhang/Projects/Jobby/Jobby/packages/ui/src/components/UI/Resume/ResumePdfPreview.tsx",
        lineNumber: 759,
        columnNumber: 9
      }, this);
    case "linkedin":
      return /* @__PURE__ */ jsxDEV(Svg, { viewBox: "0 0 24 24", style: svgStyle, children: /* @__PURE__ */ jsxDEV(
        Path,
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
          fileName: "/Users/xianzhezhang/Projects/Jobby/Jobby/packages/ui/src/components/UI/Resume/ResumePdfPreview.tsx",
          lineNumber: 773,
          columnNumber: 11
        },
        this
      ) }, void 0, false, {
        fileName: "/Users/xianzhezhang/Projects/Jobby/Jobby/packages/ui/src/components/UI/Resume/ResumePdfPreview.tsx",
        lineNumber: 772,
        columnNumber: 9
      }, this);
    case "portfolio":
      return /* @__PURE__ */ jsxDEV(Svg, { viewBox: "0 0 24 24", style: svgStyle, children: /* @__PURE__ */ jsxDEV(
        Path,
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
          fileName: "/Users/xianzhezhang/Projects/Jobby/Jobby/packages/ui/src/components/UI/Resume/ResumePdfPreview.tsx",
          lineNumber: 786,
          columnNumber: 11
        },
        this
      ) }, void 0, false, {
        fileName: "/Users/xianzhezhang/Projects/Jobby/Jobby/packages/ui/src/components/UI/Resume/ResumePdfPreview.tsx",
        lineNumber: 785,
        columnNumber: 9
      }, this);
    case "website":
      return /* @__PURE__ */ jsxDEV(Svg, { viewBox: "0 0 24 24", style: svgStyle, children: /* @__PURE__ */ jsxDEV(
        Path,
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
          fileName: "/Users/xianzhezhang/Projects/Jobby/Jobby/packages/ui/src/components/UI/Resume/ResumePdfPreview.tsx",
          lineNumber: 799,
          columnNumber: 11
        },
        this
      ) }, void 0, false, {
        fileName: "/Users/xianzhezhang/Projects/Jobby/Jobby/packages/ui/src/components/UI/Resume/ResumePdfPreview.tsx",
        lineNumber: 798,
        columnNumber: 9
      }, this);
    default:
      return null;
  }
}
_c6 = PdfContactIcon;
function ResumePdfDocument({
  data,
  template,
  coreCompetencies,
  keyQualifications
}) {
  const styles = createPdfStyles(template);
  const highlightRules = createResumeHighlightRules(data);
  const basics = data.basics ?? {};
  const contactItems = resumeContactItems(data);
  return /* @__PURE__ */ jsxDEV(
    Document,
    {
      title: fullName(data),
      author: fullName(data),
      creator: "Jobby",
      producer: "Jobby",
      children: /* @__PURE__ */ jsxDEV(Page, { size: template.paper.format, style: styles.page, children: [
        /* @__PURE__ */ jsxDEV(View, { style: styles.header, wrap: false, children: [
          /* @__PURE__ */ jsxDEV(Text, { style: styles.name, children: fullName(data) }, void 0, false, {
            fileName: "/Users/xianzhezhang/Projects/Jobby/Jobby/packages/ui/src/components/UI/Resume/ResumePdfPreview.tsx",
            lineNumber: 839,
            columnNumber: 11
          }, this),
          basics.headline && /* @__PURE__ */ jsxDEV(Text, { style: styles.headline, children: basics.headline }, void 0, false, {
            fileName: "/Users/xianzhezhang/Projects/Jobby/Jobby/packages/ui/src/components/UI/Resume/ResumePdfPreview.tsx",
            lineNumber: 841,
            columnNumber: 11
          }, this),
          contactItems.length > 0 && /* @__PURE__ */ jsxDEV(View, { style: styles.contact, children: contactItems.map(
            (item, index) => /* @__PURE__ */ jsxDEV(View, { style: styles.contactItem, children: [
              index > 0 && /* @__PURE__ */ jsxDEV(Text, { style: styles.contactDivider, children: "|" }, void 0, false, {
                fileName: "/Users/xianzhezhang/Projects/Jobby/Jobby/packages/ui/src/components/UI/Resume/ResumePdfPreview.tsx",
                lineNumber: 847,
                columnNumber: 33
              }, this),
              /* @__PURE__ */ jsxDEV(
                PdfContactIcon,
                {
                  type: item.type,
                  color: template.colors.primary || "#8A6220"
                },
                void 0,
                false,
                {
                  fileName: "/Users/xianzhezhang/Projects/Jobby/Jobby/packages/ui/src/components/UI/Resume/ResumePdfPreview.tsx",
                  lineNumber: 848,
                  columnNumber: 19
                },
                this
              ),
              item.href ? /* @__PURE__ */ jsxDEV(Link, { src: item.href, style: styles.contactLink, children: item.text }, void 0, false, {
                fileName: "/Users/xianzhezhang/Projects/Jobby/Jobby/packages/ui/src/components/UI/Resume/ResumePdfPreview.tsx",
                lineNumber: 853,
                columnNumber: 15
              }, this) : /* @__PURE__ */ jsxDEV(Text, { style: styles.contactText, children: item.text }, void 0, false, {
                fileName: "/Users/xianzhezhang/Projects/Jobby/Jobby/packages/ui/src/components/UI/Resume/ResumePdfPreview.tsx",
                lineNumber: 856,
                columnNumber: 15
              }, this)
            ] }, index, true, {
              fileName: "/Users/xianzhezhang/Projects/Jobby/Jobby/packages/ui/src/components/UI/Resume/ResumePdfPreview.tsx",
              lineNumber: 846,
              columnNumber: 13
            }, this)
          ) }, void 0, false, {
            fileName: "/Users/xianzhezhang/Projects/Jobby/Jobby/packages/ui/src/components/UI/Resume/ResumePdfPreview.tsx",
            lineNumber: 844,
            columnNumber: 11
          }, this)
        ] }, void 0, true, {
          fileName: "/Users/xianzhezhang/Projects/Jobby/Jobby/packages/ui/src/components/UI/Resume/ResumePdfPreview.tsx",
          lineNumber: 838,
          columnNumber: 9
        }, this),
        template.sectionOrder.map(
          (section) => /* @__PURE__ */ jsxDEV(
            PdfResumeSection,
            {
              section,
              data,
              coreCompetencies,
              keyQualifications,
              styles,
              template,
              rules: highlightRules
            },
            section,
            false,
            {
              fileName: "/Users/xianzhezhang/Projects/Jobby/Jobby/packages/ui/src/components/UI/Resume/ResumePdfPreview.tsx",
              lineNumber: 864,
              columnNumber: 9
            },
            this
          )
        ),
        template.showPageNumbers && /* @__PURE__ */ jsxDEV(
          Text,
          {
            fixed: true,
            style: styles.footer,
            render: ({ pageNumber, totalPages }) => `Page ${pageNumber} of ${totalPages}`
          },
          void 0,
          false,
          {
            fileName: "/Users/xianzhezhang/Projects/Jobby/Jobby/packages/ui/src/components/UI/Resume/ResumePdfPreview.tsx",
            lineNumber: 877,
            columnNumber: 9
          },
          this
        )
      ] }, void 0, true, {
        fileName: "/Users/xianzhezhang/Projects/Jobby/Jobby/packages/ui/src/components/UI/Resume/ResumePdfPreview.tsx",
        lineNumber: 837,
        columnNumber: 7
      }, this)
    },
    void 0,
    false,
    {
      fileName: "/Users/xianzhezhang/Projects/Jobby/Jobby/packages/ui/src/components/UI/Resume/ResumePdfPreview.tsx",
      lineNumber: 831,
      columnNumber: 5
    },
    this
  );
}
_c7 = ResumePdfDocument;
async function pageCountFromPdf(blob) {
  const source = new TextDecoder().decode(await blob.arrayBuffer());
  return Math.max(1, (source.match(/\/Type\s*\/Page\b/g) ?? []).length);
}
async function renderResumePdf(data, template, coreCompetencies, keyQualifications) {
  const blob = await pdf(
    /* @__PURE__ */ jsxDEV(
      ResumePdfDocument,
      {
        data,
        template,
        coreCompetencies,
        keyQualifications
      },
      void 0,
      false,
      {
        fileName: "/Users/xianzhezhang/Projects/Jobby/Jobby/packages/ui/src/components/UI/Resume/ResumePdfPreview.tsx",
        lineNumber: 902,
        columnNumber: 5
      },
      this
    )
  ).toBlob();
  return { blob, pages: await pageCountFromPdf(blob) };
}
export async function renderResumePdfOnce(data, scale, coreCompetencies = [], keyQualifications = []) {
  const template = scaleResumeTemplate(defaultResumeTemplate, scale);
  const { blob, pages } = await renderResumePdf(
    data,
    template,
    coreCompetencies,
    keyQualifications
  );
  return { blob, pages, scale };
}
export function formatBytes(bytes, decimals = 1) {
  if (!bytes || bytes === 0) return "0 B";
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(dm))} ${sizes[i]}`;
}
export function formatTime(date) {
  return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}
export function ResumePdfPreview({
  data,
  filename,
  coreCompetencies = [],
  keyQualifications = [],
  company,
  jobTitle,
  showSectionHeader = false,
  onOpenModal,
  onPreview,
  onNewWindow,
  onEdit,
  onDownload
}) {
  _s();
  const activeUrlRef = useRef(null);
  const [pdfUrl, setPdfUrl] = useState(null);
  const [pages, setPages] = useState(null);
  const [fileSize, setFileSize] = useState(null);
  const [pdfScale, setPdfScale] = useState(null);
  const [generatedAt, setGeneratedAt] = useState(null);
  const [error, setError] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const smartPage = useSmartOnePage(defaultResumeTemplate, data);
  const containerRef = useRef(null);
  const [containerSize, setContainerSize] = useState({
    width: 0,
    height: 0
  });
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const updateSize = () => {
      const rect = el.getBoundingClientRect();
      if (rect.width > 0 && rect.height > 0) {
        setContainerSize({ width: rect.width, height: rect.height });
      }
    };
    updateSize();
    const observer = new ResizeObserver(updateSize);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);
  const pageWidth = smartPage.config.paper.widthPx || 816;
  const pageHeight = smartPage.config.paper.heightPx || 1056;
  const thumbnailScale = useMemo(() => {
    if (!containerSize.width || !containerSize.height) {
      return 0.165;
    }
    const availableWidth = Math.max(80, containerSize.width - 24);
    const availableHeight = Math.max(80, containerSize.height - 20);
    return Math.min(availableWidth / pageWidth, availableHeight / pageHeight);
  }, [containerSize.width, containerSize.height, pageWidth, pageHeight]);
  const resolvedFilename = filename || formatResumeFilename(data, company, jobTitle);
  const downloadName = `${resolvedFilename.replace(/\.pdf$/i, "") || "resume"}.pdf`;
  const qualificationSignature = [
    ...coreCompetencies,
    ...keyQualifications
  ].join("|");
  useEffect(() => {
    if (!smartPage.settled) return;
    let cancelled = false;
    const timer = window.setTimeout(() => {
      setIsGenerating(true);
      setError("");
      void renderResumePdfOnce(
        data,
        smartPage.scale,
        coreCompetencies,
        keyQualifications
      ).then(({ blob, pages: pageCount, scale }) => {
        const nextUrl = URL.createObjectURL(blob);
        if (cancelled) {
          URL.revokeObjectURL(nextUrl);
          return;
        }
        if (activeUrlRef.current) URL.revokeObjectURL(activeUrlRef.current);
        activeUrlRef.current = nextUrl;
        setPdfUrl(nextUrl);
        setPages(pageCount);
        setFileSize(blob.size);
        setPdfScale(scale);
        setGeneratedAt(/* @__PURE__ */ new Date());
        setIsGenerating(false);
      }).catch(() => {
        if (cancelled) return;
        setError("Could not generate this resume PDF.");
        setIsGenerating(false);
      });
    }, 400);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [data, qualificationSignature, smartPage.scale, smartPage.settled]);
  useEffect(
    () => () => {
      if (activeUrlRef.current) URL.revokeObjectURL(activeUrlRef.current);
    },
    []
  );
  const download = () => {
    if (!pdfUrl) return;
    const link = document.createElement("a");
    link.href = pdfUrl;
    link.download = downloadName;
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
      onOpenModal(
        /* @__PURE__ */ jsxDEV("div", { className: "flex h-full flex-col bg-background", children: [
          /* @__PURE__ */ jsxDEV("header", { className: "flex shrink-0 items-center justify-between border-b border-primary/60 px-6 py-3.5 bg-panel/80 backdrop-blur-md", children: [
            /* @__PURE__ */ jsxDEV("div", { className: "flex items-center gap-3 min-w-0", children: [
              /* @__PURE__ */ jsxDEV("div", { className: "flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary", children: /* @__PURE__ */ jsxDEV(FileText, { className: "h-4.5 w-4.5" }, void 0, false, {
                fileName: "/Users/xianzhezhang/Projects/Jobby/Jobby/packages/ui/src/components/UI/Resume/ResumePdfPreview.tsx",
                lineNumber: 1082,
                columnNumber: 17
              }, this) }, void 0, false, {
                fileName: "/Users/xianzhezhang/Projects/Jobby/Jobby/packages/ui/src/components/UI/Resume/ResumePdfPreview.tsx",
                lineNumber: 1081,
                columnNumber: 15
              }, this),
              /* @__PURE__ */ jsxDEV("div", { className: "min-w-0", children: [
                /* @__PURE__ */ jsxDEV("p", { className: "label font-semibold text-ink-primary truncate", children: downloadName }, void 0, false, {
                  fileName: "/Users/xianzhezhang/Projects/Jobby/Jobby/packages/ui/src/components/UI/Resume/ResumePdfPreview.tsx",
                  lineNumber: 1085,
                  columnNumber: 17
                }, this),
                /* @__PURE__ */ jsxDEV("div", { className: "flex items-center gap-2 text-xs text-ink-secondary mt-0.5 truncate", children: [
                  /* @__PURE__ */ jsxDEV("span", { children: [
                    pages ?? 1,
                    " page",
                    pages === 1 ? "" : "s"
                  ] }, void 0, true, {
                    fileName: "/Users/xianzhezhang/Projects/Jobby/Jobby/packages/ui/src/components/UI/Resume/ResumePdfPreview.tsx",
                    lineNumber: 1089,
                    columnNumber: 19
                  }, this),
                  fileSize ? /* @__PURE__ */ jsxDEV(Fragment, { children: [
                    /* @__PURE__ */ jsxDEV("span", { className: "opacity-40", children: "•" }, void 0, false, {
                      fileName: "/Users/xianzhezhang/Projects/Jobby/Jobby/packages/ui/src/components/UI/Resume/ResumePdfPreview.tsx",
                      lineNumber: 1094,
                      columnNumber: 23
                    }, this),
                    /* @__PURE__ */ jsxDEV("span", { children: formatBytes(fileSize) }, void 0, false, {
                      fileName: "/Users/xianzhezhang/Projects/Jobby/Jobby/packages/ui/src/components/UI/Resume/ResumePdfPreview.tsx",
                      lineNumber: 1095,
                      columnNumber: 23
                    }, this)
                  ] }, void 0, true, {
                    fileName: "/Users/xianzhezhang/Projects/Jobby/Jobby/packages/ui/src/components/UI/Resume/ResumePdfPreview.tsx",
                    lineNumber: 1093,
                    columnNumber: 19
                  }, this) : null,
                  pdfScale ? /* @__PURE__ */ jsxDEV(Fragment, { children: [
                    /* @__PURE__ */ jsxDEV("span", { className: "opacity-40", children: "•" }, void 0, false, {
                      fileName: "/Users/xianzhezhang/Projects/Jobby/Jobby/packages/ui/src/components/UI/Resume/ResumePdfPreview.tsx",
                      lineNumber: 1100,
                      columnNumber: 23
                    }, this),
                    /* @__PURE__ */ jsxDEV("span", { children: [
                      "Fit Scale: ",
                      Math.round(pdfScale * 100),
                      "%"
                    ] }, void 0, true, {
                      fileName: "/Users/xianzhezhang/Projects/Jobby/Jobby/packages/ui/src/components/UI/Resume/ResumePdfPreview.tsx",
                      lineNumber: 1101,
                      columnNumber: 23
                    }, this)
                  ] }, void 0, true, {
                    fileName: "/Users/xianzhezhang/Projects/Jobby/Jobby/packages/ui/src/components/UI/Resume/ResumePdfPreview.tsx",
                    lineNumber: 1099,
                    columnNumber: 19
                  }, this) : null,
                  generatedAt ? /* @__PURE__ */ jsxDEV(Fragment, { children: [
                    /* @__PURE__ */ jsxDEV("span", { className: "opacity-40", children: "•" }, void 0, false, {
                      fileName: "/Users/xianzhezhang/Projects/Jobby/Jobby/packages/ui/src/components/UI/Resume/ResumePdfPreview.tsx",
                      lineNumber: 1106,
                      columnNumber: 23
                    }, this),
                    /* @__PURE__ */ jsxDEV("span", { children: [
                      "Generated ",
                      formatTime(generatedAt)
                    ] }, void 0, true, {
                      fileName: "/Users/xianzhezhang/Projects/Jobby/Jobby/packages/ui/src/components/UI/Resume/ResumePdfPreview.tsx",
                      lineNumber: 1107,
                      columnNumber: 23
                    }, this)
                  ] }, void 0, true, {
                    fileName: "/Users/xianzhezhang/Projects/Jobby/Jobby/packages/ui/src/components/UI/Resume/ResumePdfPreview.tsx",
                    lineNumber: 1105,
                    columnNumber: 19
                  }, this) : null
                ] }, void 0, true, {
                  fileName: "/Users/xianzhezhang/Projects/Jobby/Jobby/packages/ui/src/components/UI/Resume/ResumePdfPreview.tsx",
                  lineNumber: 1088,
                  columnNumber: 17
                }, this)
              ] }, void 0, true, {
                fileName: "/Users/xianzhezhang/Projects/Jobby/Jobby/packages/ui/src/components/UI/Resume/ResumePdfPreview.tsx",
                lineNumber: 1084,
                columnNumber: 15
              }, this)
            ] }, void 0, true, {
              fileName: "/Users/xianzhezhang/Projects/Jobby/Jobby/packages/ui/src/components/UI/Resume/ResumePdfPreview.tsx",
              lineNumber: 1080,
              columnNumber: 13
            }, this),
            /* @__PURE__ */ jsxDEV("div", { className: "flex items-center gap-2 shrink-0", children: /* @__PURE__ */ jsxDEV(
              Button,
              {
                variant: "secondary",
                size: "sm",
                Icon: Download,
                onClick: download,
                disabled: !pdfUrl || isGenerating,
                children: isGenerating ? "Compiling PDF..." : "Download PDF"
              },
              void 0,
              false,
              {
                fileName: "/Users/xianzhezhang/Projects/Jobby/Jobby/packages/ui/src/components/UI/Resume/ResumePdfPreview.tsx",
                lineNumber: 1115,
                columnNumber: 15
              },
              this
            ) }, void 0, false, {
              fileName: "/Users/xianzhezhang/Projects/Jobby/Jobby/packages/ui/src/components/UI/Resume/ResumePdfPreview.tsx",
              lineNumber: 1114,
              columnNumber: 13
            }, this)
          ] }, void 0, true, {
            fileName: "/Users/xianzhezhang/Projects/Jobby/Jobby/packages/ui/src/components/UI/Resume/ResumePdfPreview.tsx",
            lineNumber: 1079,
            columnNumber: 11
          }, this),
          isDesktopApp() ? /* @__PURE__ */ jsxDEV("div", { className: "flex-1 overflow-y-auto bg-background-secondary/80 p-8 flex justify-center", children: /* @__PURE__ */ jsxDEV("div", { className: "shadow-2xl rounded-sm overflow-hidden bg-panel max-w-[816px] w-full h-fit", children: /* @__PURE__ */ jsxDEV(
            ResumeHtmlDocument,
            {
              config: smartPage.config,
              data,
              coreCompetencies,
              keyQualifications
            },
            void 0,
            false,
            {
              fileName: "/Users/xianzhezhang/Projects/Jobby/Jobby/packages/ui/src/components/UI/Resume/ResumePdfPreview.tsx",
              lineNumber: 1130,
              columnNumber: 17
            },
            this
          ) }, void 0, false, {
            fileName: "/Users/xianzhezhang/Projects/Jobby/Jobby/packages/ui/src/components/UI/Resume/ResumePdfPreview.tsx",
            lineNumber: 1129,
            columnNumber: 15
          }, this) }, void 0, false, {
            fileName: "/Users/xianzhezhang/Projects/Jobby/Jobby/packages/ui/src/components/UI/Resume/ResumePdfPreview.tsx",
            lineNumber: 1128,
            columnNumber: 11
          }, this) : pdfUrl ? /* @__PURE__ */ jsxDEV(
            "iframe",
            {
              title: "Resume PDF preview",
              src: pdfUrl,
              className: "h-full w-full border-0 bg-background-secondary transform-gpu"
            },
            void 0,
            false,
            {
              fileName: "/Users/xianzhezhang/Projects/Jobby/Jobby/packages/ui/src/components/UI/Resume/ResumePdfPreview.tsx",
              lineNumber: 1139,
              columnNumber: 11
            },
            this
          ) : /* @__PURE__ */ jsxDEV("div", { className: "flex h-full flex-col items-center justify-center gap-2 text-ink-secondary", children: [
            /* @__PURE__ */ jsxDEV(Loader2, { className: "h-6 w-6 animate-spin text-primary" }, void 0, false, {
              fileName: "/Users/xianzhezhang/Projects/Jobby/Jobby/packages/ui/src/components/UI/Resume/ResumePdfPreview.tsx",
              lineNumber: 1145,
              columnNumber: 15
            }, this),
            /* @__PURE__ */ jsxDEV("p", { className: "text-xs font-medium", children: "Loading PDF engine..." }, void 0, false, {
              fileName: "/Users/xianzhezhang/Projects/Jobby/Jobby/packages/ui/src/components/UI/Resume/ResumePdfPreview.tsx",
              lineNumber: 1146,
              columnNumber: 15
            }, this)
          ] }, void 0, true, {
            fileName: "/Users/xianzhezhang/Projects/Jobby/Jobby/packages/ui/src/components/UI/Resume/ResumePdfPreview.tsx",
            lineNumber: 1144,
            columnNumber: 11
          }, this)
        ] }, void 0, true, {
          fileName: "/Users/xianzhezhang/Projects/Jobby/Jobby/packages/ui/src/components/UI/Resume/ResumePdfPreview.tsx",
          lineNumber: 1078,
          columnNumber: 9
        }, this)
      );
    } else {
      setIsModalOpen(true);
    }
  };
  return /* @__PURE__ */ jsxDEV("div", { className: "flex flex-col gap-2 w-full min-w-0", children: [
    showSectionHeader && /* @__PURE__ */ jsxDEV("div", { className: "flex items-center justify-between border-b border-primary/40 pb-3", children: /* @__PURE__ */ jsxDEV("div", { children: /* @__PURE__ */ jsxDEV("h3", { className: "text-sm font-bold text-ink-primary", children: "Resume Preview" }, void 0, false, {
      fileName: "/Users/xianzhezhang/Projects/Jobby/Jobby/packages/ui/src/components/UI/Resume/ResumePdfPreview.tsx",
      lineNumber: 1161,
      columnNumber: 13
    }, this) }, void 0, false, {
      fileName: "/Users/xianzhezhang/Projects/Jobby/Jobby/packages/ui/src/components/UI/Resume/ResumePdfPreview.tsx",
      lineNumber: 1160,
      columnNumber: 11
    }, this) }, void 0, false, {
      fileName: "/Users/xianzhezhang/Projects/Jobby/Jobby/packages/ui/src/components/UI/Resume/ResumePdfPreview.tsx",
      lineNumber: 1159,
      columnNumber: 7
    }, this),
    /* @__PURE__ */ jsxDEV(
      "div",
      {
        "aria-hidden": "true",
        className: "pointer-events-none fixed left-[-10000px] top-0 opacity-0",
        children: /* @__PURE__ */ jsxDEV(
          ResumeHtmlDocument,
          {
            config: smartPage.config,
            data,
            coreCompetencies,
            keyQualifications,
            pageRef: smartPage.pageRef
          },
          void 0,
          false,
          {
            fileName: "/Users/xianzhezhang/Projects/Jobby/Jobby/packages/ui/src/components/UI/Resume/ResumePdfPreview.tsx",
            lineNumber: 1173,
            columnNumber: 9
          },
          this
        )
      },
      void 0,
      false,
      {
        fileName: "/Users/xianzhezhang/Projects/Jobby/Jobby/packages/ui/src/components/UI/Resume/ResumePdfPreview.tsx",
        lineNumber: 1169,
        columnNumber: 7
      },
      this
    ),
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
                    ResumeHtmlDocument,
                    {
                      config: smartPage.config,
                      data,
                      coreCompetencies,
                      keyQualifications
                    },
                    void 0,
                    false,
                    {
                      fileName: "/Users/xianzhezhang/Projects/Jobby/Jobby/packages/ui/src/components/UI/Resume/ResumePdfPreview.tsx",
                      lineNumber: 1205,
                      columnNumber: 15
                    },
                    this
                  )
                },
                void 0,
                false,
                {
                  fileName: "/Users/xianzhezhang/Projects/Jobby/Jobby/packages/ui/src/components/UI/Resume/ResumePdfPreview.tsx",
                  lineNumber: 1196,
                  columnNumber: 13
                },
                this
              )
            },
            void 0,
            false,
            {
              fileName: "/Users/xianzhezhang/Projects/Jobby/Jobby/packages/ui/src/components/UI/Resume/ResumePdfPreview.tsx",
              lineNumber: 1189,
              columnNumber: 11
            },
            this
          ) }, void 0, false, {
            fileName: "/Users/xianzhezhang/Projects/Jobby/Jobby/packages/ui/src/components/UI/Resume/ResumePdfPreview.tsx",
            lineNumber: 1188,
            columnNumber: 9
          }, this),
          error && /* @__PURE__ */ jsxDEV("p", { className: "absolute inset-x-4 top-1/2 -translate-y-1/2 text-center text-xs text-red-600 bg-panel/95 py-2 px-3 rounded-lg border border-red-200 dark:border-red-900/40 shadow-xs", children: error }, void 0, false, {
            fileName: "/Users/xianzhezhang/Projects/Jobby/Jobby/packages/ui/src/components/UI/Resume/ResumePdfPreview.tsx",
            lineNumber: 1216,
            columnNumber: 9
          }, this),
          isGenerating && /* @__PURE__ */ jsxDEV("div", { className: "absolute right-2 top-2 rounded-full bg-white/90 dark:bg-slate-900/90 p-1 text-ink-secondary shadow-sm", children: /* @__PURE__ */ jsxDEV(Loader2, { className: "size-2.5 animate-spin text-primary" }, void 0, false, {
            fileName: "/Users/xianzhezhang/Projects/Jobby/Jobby/packages/ui/src/components/UI/Resume/ResumePdfPreview.tsx",
            lineNumber: 1223,
            columnNumber: 13
          }, this) }, void 0, false, {
            fileName: "/Users/xianzhezhang/Projects/Jobby/Jobby/packages/ui/src/components/UI/Resume/ResumePdfPreview.tsx",
            lineNumber: 1222,
            columnNumber: 9
          }, this),
          /* @__PURE__ */ jsxDEV("div", { className: "absolute inset-0 z-20 flex items-center justify-center gap-1.5 bg-slate-950/20 opacity-0 transition-opacity group-hover:opacity-100 backdrop-blur-xs", children: [
            /* @__PURE__ */ jsxDEV(
              "button",
              {
                type: "button",
                title: "In-Page Preview",
                "aria-label": "Preview resume PDF",
                onClick: (event) => {
                  event.stopPropagation();
                  openPreview();
                },
                className: "flex h-8 w-8 items-center justify-center rounded-lg bg-white/95 dark:bg-slate-900/95 text-slate-800 dark:text-slate-100 hover:scale-110 hover:text-primary hover:border-primary/40 border border-black/[0.06] dark:border-white/[0.1] cursor-pointer shadow-md transition-all",
                children: /* @__PURE__ */ jsxDEV(Maximize2, { className: "h-3.5 w-3.5" }, void 0, false, {
                  fileName: "/Users/xianzhezhang/Projects/Jobby/Jobby/packages/ui/src/components/UI/Resume/ResumePdfPreview.tsx",
                  lineNumber: 1239,
                  columnNumber: 13
                }, this)
              },
              void 0,
              false,
              {
                fileName: "/Users/xianzhezhang/Projects/Jobby/Jobby/packages/ui/src/components/UI/Resume/ResumePdfPreview.tsx",
                lineNumber: 1229,
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
                onClick: (event) => {
                  event.stopPropagation();
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
                  fileName: "/Users/xianzhezhang/Projects/Jobby/Jobby/packages/ui/src/components/UI/Resume/ResumePdfPreview.tsx",
                  lineNumber: 1257,
                  columnNumber: 13
                }, this)
              },
              void 0,
              false,
              {
                fileName: "/Users/xianzhezhang/Projects/Jobby/Jobby/packages/ui/src/components/UI/Resume/ResumePdfPreview.tsx",
                lineNumber: 1241,
                columnNumber: 11
              },
              this
            ),
            onEdit && /* @__PURE__ */ jsxDEV(
              "button",
              {
                type: "button",
                title: "Edit on Web",
                "aria-label": "Edit resume",
                onClick: (event) => {
                  event.stopPropagation();
                  onEdit();
                },
                className: "flex h-8 w-8 items-center justify-center rounded-lg bg-white/95 dark:bg-slate-900/95 text-slate-800 dark:text-slate-100 hover:scale-110 hover:text-primary hover:border-primary/40 border border-black/[0.06] dark:border-white/[0.1] cursor-pointer shadow-md transition-all",
                children: /* @__PURE__ */ jsxDEV(Edit3, { className: "h-3.5 w-3.5" }, void 0, false, {
                  fileName: "/Users/xianzhezhang/Projects/Jobby/Jobby/packages/ui/src/components/UI/Resume/ResumePdfPreview.tsx",
                  lineNumber: 1270,
                  columnNumber: 15
                }, this)
              },
              void 0,
              false,
              {
                fileName: "/Users/xianzhezhang/Projects/Jobby/Jobby/packages/ui/src/components/UI/Resume/ResumePdfPreview.tsx",
                lineNumber: 1260,
                columnNumber: 11
              },
              this
            ),
            /* @__PURE__ */ jsxDEV(
              "button",
              {
                type: "button",
                title: "Download PDF",
                "aria-label": "Download resume PDF",
                onClick: (event) => {
                  event.stopPropagation();
                  if (onDownload) {
                    onDownload();
                  } else {
                    download();
                  }
                },
                className: "flex h-8 w-8 items-center justify-center rounded-lg bg-white/95 dark:bg-slate-900/95 text-slate-800 dark:text-slate-100 hover:scale-110 hover:text-primary hover:border-primary/40 border border-black/[0.06] dark:border-white/[0.1] cursor-pointer shadow-md disabled:opacity-50 transition-all",
                disabled: !onDownload && (!pdfUrl || isGenerating),
                children: /* @__PURE__ */ jsxDEV(Download, { className: "h-3.5 w-3.5" }, void 0, false, {
                  fileName: "/Users/xianzhezhang/Projects/Jobby/Jobby/packages/ui/src/components/UI/Resume/ResumePdfPreview.tsx",
                  lineNumber: 1288,
                  columnNumber: 13
                }, this)
              },
              void 0,
              false,
              {
                fileName: "/Users/xianzhezhang/Projects/Jobby/Jobby/packages/ui/src/components/UI/Resume/ResumePdfPreview.tsx",
                lineNumber: 1273,
                columnNumber: 11
              },
              this
            )
          ] }, void 0, true, {
            fileName: "/Users/xianzhezhang/Projects/Jobby/Jobby/packages/ui/src/components/UI/Resume/ResumePdfPreview.tsx",
            lineNumber: 1228,
            columnNumber: 9
          }, this),
          /* @__PURE__ */ jsxDEV("div", { className: "absolute bottom-1.5 left-1.5 z-10 flex items-center gap-1 rounded-md bg-panel/60 backdrop-blur-xs px-1.5 py-0.5 text-[9.5px] font-medium text-ink-primary", children: [
            /* @__PURE__ */ jsxDEV(FileText, { className: "h-3 w-3 text-primary shrink-0" }, void 0, false, {
              fileName: "/Users/xianzhezhang/Projects/Jobby/Jobby/packages/ui/src/components/UI/Resume/ResumePdfPreview.tsx",
              lineNumber: 1294,
              columnNumber: 11
            }, this),
            /* @__PURE__ */ jsxDEV("span", { children: [
              pages ?? 1,
              " page",
              pages === 1 ? "" : "s",
              fileSize ? ` · ${formatBytes(fileSize)}` : ""
            ] }, void 0, true, {
              fileName: "/Users/xianzhezhang/Projects/Jobby/Jobby/packages/ui/src/components/UI/Resume/ResumePdfPreview.tsx",
              lineNumber: 1295,
              columnNumber: 11
            }, this)
          ] }, void 0, true, {
            fileName: "/Users/xianzhezhang/Projects/Jobby/Jobby/packages/ui/src/components/UI/Resume/ResumePdfPreview.tsx",
            lineNumber: 1293,
            columnNumber: 9
          }, this)
        ]
      },
      void 0,
      true,
      {
        fileName: "/Users/xianzhezhang/Projects/Jobby/Jobby/packages/ui/src/components/UI/Resume/ResumePdfPreview.tsx",
        lineNumber: 1183,
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
                      fileName: "/Users/xianzhezhang/Projects/Jobby/Jobby/packages/ui/src/components/UI/Resume/ResumePdfPreview.tsx",
                      lineNumber: 1318,
                      columnNumber: 21
                    }, this) }, void 0, false, {
                      fileName: "/Users/xianzhezhang/Projects/Jobby/Jobby/packages/ui/src/components/UI/Resume/ResumePdfPreview.tsx",
                      lineNumber: 1317,
                      columnNumber: 19
                    }, this),
                    /* @__PURE__ */ jsxDEV("div", { className: "min-w-0", children: [
                      /* @__PURE__ */ jsxDEV("div", { className: "flex items-center gap-2", children: /* @__PURE__ */ jsxDEV("p", { className: "label font-semibold text-ink-primary truncate", children: downloadName }, void 0, false, {
                        fileName: "/Users/xianzhezhang/Projects/Jobby/Jobby/packages/ui/src/components/UI/Resume/ResumePdfPreview.tsx",
                        lineNumber: 1322,
                        columnNumber: 23
                      }, this) }, void 0, false, {
                        fileName: "/Users/xianzhezhang/Projects/Jobby/Jobby/packages/ui/src/components/UI/Resume/ResumePdfPreview.tsx",
                        lineNumber: 1321,
                        columnNumber: 21
                      }, this),
                      /* @__PURE__ */ jsxDEV("div", { className: "flex flex-wrap items-center gap-1 text-[10px] text-ink-secondary ", children: [
                        /* @__PURE__ */ jsxDEV("span", { children: [
                          pages ?? 1,
                          " page",
                          pages === 1 ? "" : "s"
                        ] }, void 0, true, {
                          fileName: "/Users/xianzhezhang/Projects/Jobby/Jobby/packages/ui/src/components/UI/Resume/ResumePdfPreview.tsx",
                          lineNumber: 1327,
                          columnNumber: 23
                        }, this),
                        fileSize ? /* @__PURE__ */ jsxDEV(Fragment, { children: [
                          /* @__PURE__ */ jsxDEV("span", { className: "opacity-40", children: "•" }, void 0, false, {
                            fileName: "/Users/xianzhezhang/Projects/Jobby/Jobby/packages/ui/src/components/UI/Resume/ResumePdfPreview.tsx",
                            lineNumber: 1332,
                            columnNumber: 27
                          }, this),
                          /* @__PURE__ */ jsxDEV("span", { children: formatBytes(fileSize) }, void 0, false, {
                            fileName: "/Users/xianzhezhang/Projects/Jobby/Jobby/packages/ui/src/components/UI/Resume/ResumePdfPreview.tsx",
                            lineNumber: 1333,
                            columnNumber: 27
                          }, this)
                        ] }, void 0, true, {
                          fileName: "/Users/xianzhezhang/Projects/Jobby/Jobby/packages/ui/src/components/UI/Resume/ResumePdfPreview.tsx",
                          lineNumber: 1331,
                          columnNumber: 21
                        }, this) : null,
                        generatedAt ? /* @__PURE__ */ jsxDEV(Fragment, { children: [
                          /* @__PURE__ */ jsxDEV("span", { className: "opacity-40", children: "•" }, void 0, false, {
                            fileName: "/Users/xianzhezhang/Projects/Jobby/Jobby/packages/ui/src/components/UI/Resume/ResumePdfPreview.tsx",
                            lineNumber: 1338,
                            columnNumber: 27
                          }, this),
                          /* @__PURE__ */ jsxDEV("span", { children: [
                            formatTime(generatedAt),
                            " Generated"
                          ] }, void 0, true, {
                            fileName: "/Users/xianzhezhang/Projects/Jobby/Jobby/packages/ui/src/components/UI/Resume/ResumePdfPreview.tsx",
                            lineNumber: 1339,
                            columnNumber: 27
                          }, this)
                        ] }, void 0, true, {
                          fileName: "/Users/xianzhezhang/Projects/Jobby/Jobby/packages/ui/src/components/UI/Resume/ResumePdfPreview.tsx",
                          lineNumber: 1337,
                          columnNumber: 21
                        }, this) : null
                      ] }, void 0, true, {
                        fileName: "/Users/xianzhezhang/Projects/Jobby/Jobby/packages/ui/src/components/UI/Resume/ResumePdfPreview.tsx",
                        lineNumber: 1326,
                        columnNumber: 21
                      }, this)
                    ] }, void 0, true, {
                      fileName: "/Users/xianzhezhang/Projects/Jobby/Jobby/packages/ui/src/components/UI/Resume/ResumePdfPreview.tsx",
                      lineNumber: 1320,
                      columnNumber: 19
                    }, this)
                  ] }, void 0, true, {
                    fileName: "/Users/xianzhezhang/Projects/Jobby/Jobby/packages/ui/src/components/UI/Resume/ResumePdfPreview.tsx",
                    lineNumber: 1316,
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
                        fileName: "/Users/xianzhezhang/Projects/Jobby/Jobby/packages/ui/src/components/UI/Resume/ResumePdfPreview.tsx",
                        lineNumber: 1347,
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
                          fileName: "/Users/xianzhezhang/Projects/Jobby/Jobby/packages/ui/src/components/UI/Resume/ResumePdfPreview.tsx",
                          lineNumber: 1362,
                          columnNumber: 21
                        }, this)
                      },
                      void 0,
                      false,
                      {
                        fileName: "/Users/xianzhezhang/Projects/Jobby/Jobby/packages/ui/src/components/UI/Resume/ResumePdfPreview.tsx",
                        lineNumber: 1356,
                        columnNumber: 19
                      },
                      this
                    )
                  ] }, void 0, true, {
                    fileName: "/Users/xianzhezhang/Projects/Jobby/Jobby/packages/ui/src/components/UI/Resume/ResumePdfPreview.tsx",
                    lineNumber: 1346,
                    columnNumber: 17
                  }, this)
                ] }, void 0, true, {
                  fileName: "/Users/xianzhezhang/Projects/Jobby/Jobby/packages/ui/src/components/UI/Resume/ResumePdfPreview.tsx",
                  lineNumber: 1315,
                  columnNumber: 15
                }, this),
                isDesktopApp() ? /* @__PURE__ */ jsxDEV("div", { className: "flex-1 overflow-y-auto bg-background-secondary/80 p-8 flex justify-center", children: /* @__PURE__ */ jsxDEV("div", { className: "shadow-2xl rounded-sm overflow-hidden bg-panel max-w-[816px] w-full h-fit", children: /* @__PURE__ */ jsxDEV(
                  ResumeHtmlDocument,
                  {
                    config: smartPage.config,
                    data,
                    coreCompetencies,
                    keyQualifications
                  },
                  void 0,
                  false,
                  {
                    fileName: "/Users/xianzhezhang/Projects/Jobby/Jobby/packages/ui/src/components/UI/Resume/ResumePdfPreview.tsx",
                    lineNumber: 1371,
                    columnNumber: 21
                  },
                  this
                ) }, void 0, false, {
                  fileName: "/Users/xianzhezhang/Projects/Jobby/Jobby/packages/ui/src/components/UI/Resume/ResumePdfPreview.tsx",
                  lineNumber: 1370,
                  columnNumber: 19
                }, this) }, void 0, false, {
                  fileName: "/Users/xianzhezhang/Projects/Jobby/Jobby/packages/ui/src/components/UI/Resume/ResumePdfPreview.tsx",
                  lineNumber: 1369,
                  columnNumber: 13
                }, this) : pdfUrl ? /* @__PURE__ */ jsxDEV(
                  "iframe",
                  {
                    title: "Resume PDF preview",
                    src: pdfUrl,
                    className: "h-full w-full border-0 bg-background-secondary transform-gpu"
                  },
                  void 0,
                  false,
                  {
                    fileName: "/Users/xianzhezhang/Projects/Jobby/Jobby/packages/ui/src/components/UI/Resume/ResumePdfPreview.tsx",
                    lineNumber: 1380,
                    columnNumber: 13
                  },
                  this
                ) : /* @__PURE__ */ jsxDEV("div", { className: "flex h-full flex-col items-center justify-center gap-2 text-ink-secondary", children: [
                  /* @__PURE__ */ jsxDEV(Loader2, { className: "h-6 w-6 animate-spin text-primary" }, void 0, false, {
                    fileName: "/Users/xianzhezhang/Projects/Jobby/Jobby/packages/ui/src/components/UI/Resume/ResumePdfPreview.tsx",
                    lineNumber: 1386,
                    columnNumber: 19
                  }, this),
                  /* @__PURE__ */ jsxDEV("p", { className: "text-xs font-medium", children: "Loading PDF engine..." }, void 0, false, {
                    fileName: "/Users/xianzhezhang/Projects/Jobby/Jobby/packages/ui/src/components/UI/Resume/ResumePdfPreview.tsx",
                    lineNumber: 1387,
                    columnNumber: 19
                  }, this)
                ] }, void 0, true, {
                  fileName: "/Users/xianzhezhang/Projects/Jobby/Jobby/packages/ui/src/components/UI/Resume/ResumePdfPreview.tsx",
                  lineNumber: 1385,
                  columnNumber: 13
                }, this)
              ]
            },
            void 0,
            true,
            {
              fileName: "/Users/xianzhezhang/Projects/Jobby/Jobby/packages/ui/src/components/UI/Resume/ResumePdfPreview.tsx",
              lineNumber: 1310,
              columnNumber: 13
            },
            this
          )
        },
        void 0,
        false,
        {
          fileName: "/Users/xianzhezhang/Projects/Jobby/Jobby/packages/ui/src/components/UI/Resume/ResumePdfPreview.tsx",
          lineNumber: 1306,
          columnNumber: 9
        },
        this
      ),
      document.body
    )
  ] }, void 0, true, {
    fileName: "/Users/xianzhezhang/Projects/Jobby/Jobby/packages/ui/src/components/UI/Resume/ResumePdfPreview.tsx",
    lineNumber: 1157,
    columnNumber: 5
  }, this);
}
_s(ResumePdfPreview, "EMdma2wj9sdq9+D1WxJW266ddIk=", false, function() {
  return [useSmartOnePage];
});
_c8 = ResumePdfPreview;
var _c, _c2, _c3, _c4, _c5, _c6, _c7, _c8;
$RefreshReg$(_c, "PdfHighlightedText");
$RefreshReg$(_c2, "PdfBullets");
$RefreshReg$(_c3, "PdfTechnologies");
$RefreshReg$(_c4, "PdfSection");
$RefreshReg$(_c5, "PdfResumeSection");
$RefreshReg$(_c6, "PdfContactIcon");
$RefreshReg$(_c7, "ResumePdfDocument");
$RefreshReg$(_c8, "ResumePdfPreview");
if (import.meta.hot && !inWebWorker) {
  window.$RefreshReg$ = prevRefreshReg;
  window.$RefreshSig$ = prevRefreshSig;
}
if (import.meta.hot && !inWebWorker) {
  RefreshRuntime.__hmr_import(import.meta.url).then((currentExports) => {
    RefreshRuntime.registerExportsForReactRefresh("/Users/xianzhezhang/Projects/Jobby/Jobby/packages/ui/src/components/UI/Resume/ResumePdfPreview.tsx", currentExports);
    import.meta.hot.accept((nextExports) => {
      if (!nextExports) return;
      const invalidateMessage = RefreshRuntime.validateRefreshBoundaryAndEnqueueUpdate("/Users/xianzhezhang/Projects/Jobby/Jobby/packages/ui/src/components/UI/Resume/ResumePdfPreview.tsx", currentExports, nextExports);
      if (invalidateMessage) import.meta.hot.invalidate(invalidateMessage);
    });
  });
}
