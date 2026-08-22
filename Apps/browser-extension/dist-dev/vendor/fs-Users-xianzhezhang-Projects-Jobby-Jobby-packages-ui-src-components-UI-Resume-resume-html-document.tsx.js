import { createHotContext as __vite__createHotContext } from "/vendor/vite-client.js";import.meta.hot = __vite__createHotContext("/vendor/fs-Users-xianzhezhang-Projects-Jobby-Jobby-packages-ui-src-components-UI-Resume-resume-html-document.tsx.js");import __vite__cjsImport0_react_jsxDevRuntime from "/vendor/.vite-deps-react_jsx-dev-runtime.js__v--f5b0ea50.js"; const Fragment = __vite__cjsImport0_react_jsxDevRuntime["Fragment"]; const jsxDEV = __vite__cjsImport0_react_jsxDevRuntime["jsxDEV"];
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
  window.$RefreshReg$ = RefreshRuntime.getRefreshReg("/Users/xianzhezhang/Projects/Jobby/Jobby/packages/ui/src/components/UI/Resume/resume-html-document.tsx");
  window.$RefreshSig$ = RefreshRuntime.createSignatureFunctionForTransform;
}
"use client";
import { Mail, Phone, MapPin, FolderGit2, Globe } from "/vendor/.vite-deps-lucide-react.js__v--d47d6985.js";
import __vite__cjsImport4_react from "/vendor/.vite-deps-react.js__v--f5b0ea50.js"; const Fragment2 = __vite__cjsImport4_react["Fragment"];
import {
  resumeContactItems,
  resumeDateRange,
  resumeFullName,
  templateCssVariables
} from "/vendor/fs-Users-xianzhezhang-Projects-Jobby-Jobby-packages-ui-src-components-UI-Resume-helpers.ts.js";
import {
  createResumeHighlightRules,
  tokenizeResumeText
} from "/vendor/fs-Users-xianzhezhang-Projects-Jobby-Jobby-packages-ui-src-components-UI-Resume-highlights.ts.js";
function LinkedinIcon({
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
          fileName: "/Users/xianzhezhang/Projects/Jobby/Jobby/packages/ui/src/components/UI/Resume/resume-html-document.tsx",
          lineNumber: 72,
          columnNumber: 7
        }, this),
        /* @__PURE__ */ jsxDEV("rect", { x: "2", y: "9", width: "4", height: "12" }, void 0, false, {
          fileName: "/Users/xianzhezhang/Projects/Jobby/Jobby/packages/ui/src/components/UI/Resume/resume-html-document.tsx",
          lineNumber: 73,
          columnNumber: 7
        }, this),
        /* @__PURE__ */ jsxDEV("circle", { cx: "4", cy: "4", r: "2" }, void 0, false, {
          fileName: "/Users/xianzhezhang/Projects/Jobby/Jobby/packages/ui/src/components/UI/Resume/resume-html-document.tsx",
          lineNumber: 74,
          columnNumber: 7
        }, this)
      ]
    },
    void 0,
    true,
    {
      fileName: "/Users/xianzhezhang/Projects/Jobby/Jobby/packages/ui/src/components/UI/Resume/resume-html-document.tsx",
      lineNumber: 56,
      columnNumber: 5
    },
    this
  );
}
_c = LinkedinIcon;
function ContactIcon({ type }) {
  const iconStyle = {
    width: "0.9em",
    height: "0.9em",
    display: "inline-block",
    verticalAlign: "middle"
  };
  const className = "shrink-0 text-[var(--resume-primary)] -translate-y-[0.5px]";
  switch (type) {
    case "email":
      return /* @__PURE__ */ jsxDEV(Mail, { className, style: iconStyle }, void 0, false, {
        fileName: "/Users/xianzhezhang/Projects/Jobby/Jobby/packages/ui/src/components/UI/Resume/resume-html-document.tsx",
        lineNumber: 89,
        columnNumber: 14
      }, this);
    case "phone":
      return /* @__PURE__ */ jsxDEV(Phone, { className, style: iconStyle }, void 0, false, {
        fileName: "/Users/xianzhezhang/Projects/Jobby/Jobby/packages/ui/src/components/UI/Resume/resume-html-document.tsx",
        lineNumber: 91,
        columnNumber: 14
      }, this);
    case "location":
      return /* @__PURE__ */ jsxDEV(MapPin, { className, style: iconStyle }, void 0, false, {
        fileName: "/Users/xianzhezhang/Projects/Jobby/Jobby/packages/ui/src/components/UI/Resume/resume-html-document.tsx",
        lineNumber: 93,
        columnNumber: 14
      }, this);
    case "linkedin":
      return /* @__PURE__ */ jsxDEV(LinkedinIcon, { className, style: iconStyle }, void 0, false, {
        fileName: "/Users/xianzhezhang/Projects/Jobby/Jobby/packages/ui/src/components/UI/Resume/resume-html-document.tsx",
        lineNumber: 95,
        columnNumber: 14
      }, this);
    case "portfolio":
      return /* @__PURE__ */ jsxDEV(FolderGit2, { className, style: iconStyle }, void 0, false, {
        fileName: "/Users/xianzhezhang/Projects/Jobby/Jobby/packages/ui/src/components/UI/Resume/resume-html-document.tsx",
        lineNumber: 97,
        columnNumber: 14
      }, this);
    case "website":
      return /* @__PURE__ */ jsxDEV(Globe, { className, style: iconStyle }, void 0, false, {
        fileName: "/Users/xianzhezhang/Projects/Jobby/Jobby/packages/ui/src/components/UI/Resume/resume-html-document.tsx",
        lineNumber: 99,
        columnNumber: 14
      }, this);
    default:
      return null;
  }
}
_c2 = ContactIcon;
function Section({ title, children }) {
  return /* @__PURE__ */ jsxDEV("section", { className: "mt-[var(--resume-section-gap)]", children: [
    /* @__PURE__ */ jsxDEV(
      "h2",
      {
        className: "flex items-center gap-2 border-[var(--resume-rule)] pb-[var(--resume-section-title-padding)] text-[length:var(--resume-section-title-size)] font-extrabold uppercase tracking-[0.14em] leading-none break-inside-avoid break-after-avoid",
        style: {
          borderBottomWidth: "var(--resume-section-rule-width)",
          borderBottomStyle: "solid",
          breakAfter: "avoid",
          pageBreakAfter: "avoid"
        },
        children: [
          /* @__PURE__ */ jsxDEV(
            "svg",
            {
              viewBox: "0 0 24 24",
              width: 16,
              height: 16,
              className: "h-[0.72em] w-[0.72em] min-w-[0.72em] max-w-[0.72em] shrink-0 rounded-[2.5px] shadow-xs overflow-hidden",
              style: {
                display: "inline-block",
                width: "0.72em",
                height: "0.72em",
                verticalAlign: "middle"
              },
              children: [
                /* @__PURE__ */ jsxDEV("defs", { children: [
                  /* @__PURE__ */ jsxDEV("linearGradient", { id: "goldLightGradShared", x1: "0", y1: "0", x2: "1", y2: "1", children: [
                    /* @__PURE__ */ jsxDEV("stop", { offset: "0%", stopColor: "#F5CB72" }, void 0, false, {
                      fileName: "/Users/xianzhezhang/Projects/Jobby/Jobby/packages/ui/src/components/UI/Resume/resume-html-document.tsx",
                      lineNumber: 131,
                      columnNumber: 15
                    }, this),
                    /* @__PURE__ */ jsxDEV("stop", { offset: "100%", stopColor: "#DE992E" }, void 0, false, {
                      fileName: "/Users/xianzhezhang/Projects/Jobby/Jobby/packages/ui/src/components/UI/Resume/resume-html-document.tsx",
                      lineNumber: 132,
                      columnNumber: 15
                    }, this)
                  ] }, void 0, true, {
                    fileName: "/Users/xianzhezhang/Projects/Jobby/Jobby/packages/ui/src/components/UI/Resume/resume-html-document.tsx",
                    lineNumber: 130,
                    columnNumber: 13
                  }, this),
                  /* @__PURE__ */ jsxDEV("linearGradient", { id: "goldDarkGradShared", x1: "0", y1: "0", x2: "1", y2: "1", children: [
                    /* @__PURE__ */ jsxDEV("stop", { offset: "0%", stopColor: "#BA751A" }, void 0, false, {
                      fileName: "/Users/xianzhezhang/Projects/Jobby/Jobby/packages/ui/src/components/UI/Resume/resume-html-document.tsx",
                      lineNumber: 135,
                      columnNumber: 15
                    }, this),
                    /* @__PURE__ */ jsxDEV("stop", { offset: "100%", stopColor: "#8A510A" }, void 0, false, {
                      fileName: "/Users/xianzhezhang/Projects/Jobby/Jobby/packages/ui/src/components/UI/Resume/resume-html-document.tsx",
                      lineNumber: 136,
                      columnNumber: 15
                    }, this)
                  ] }, void 0, true, {
                    fileName: "/Users/xianzhezhang/Projects/Jobby/Jobby/packages/ui/src/components/UI/Resume/resume-html-document.tsx",
                    lineNumber: 134,
                    columnNumber: 13
                  }, this)
                ] }, void 0, true, {
                  fileName: "/Users/xianzhezhang/Projects/Jobby/Jobby/packages/ui/src/components/UI/Resume/resume-html-document.tsx",
                  lineNumber: 129,
                  columnNumber: 11
                }, this),
                /* @__PURE__ */ jsxDEV("rect", { width: "24", height: "24", rx: "4.5", fill: "url(#goldLightGradShared)" }, void 0, false, {
                  fileName: "/Users/xianzhezhang/Projects/Jobby/Jobby/packages/ui/src/components/UI/Resume/resume-html-document.tsx",
                  lineNumber: 139,
                  columnNumber: 11
                }, this),
                /* @__PURE__ */ jsxDEV("path", { d: "M 0,0 L 24,24 L 0,24 Z", fill: "url(#goldDarkGradShared)" }, void 0, false, {
                  fileName: "/Users/xianzhezhang/Projects/Jobby/Jobby/packages/ui/src/components/UI/Resume/resume-html-document.tsx",
                  lineNumber: 140,
                  columnNumber: 11
                }, this)
              ]
            },
            void 0,
            true,
            {
              fileName: "/Users/xianzhezhang/Projects/Jobby/Jobby/packages/ui/src/components/UI/Resume/resume-html-document.tsx",
              lineNumber: 117,
              columnNumber: 9
            },
            this
          ),
          /* @__PURE__ */ jsxDEV(
            "span",
            {
              className: "leading-none",
              style: {
                backgroundImage: "linear-gradient(135deg, #6E4006 0%, #A86D16 28%, #D4962C 50%, #9E6412 75%, #573103 100%)",
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent"
              },
              children: title
            },
            void 0,
            false,
            {
              fileName: "/Users/xianzhezhang/Projects/Jobby/Jobby/packages/ui/src/components/UI/Resume/resume-html-document.tsx",
              lineNumber: 142,
              columnNumber: 9
            },
            this
          )
        ]
      },
      void 0,
      true,
      {
        fileName: "/Users/xianzhezhang/Projects/Jobby/Jobby/packages/ui/src/components/UI/Resume/resume-html-document.tsx",
        lineNumber: 108,
        columnNumber: 7
      },
      this
    ),
    children
  ] }, void 0, true, {
    fileName: "/Users/xianzhezhang/Projects/Jobby/Jobby/packages/ui/src/components/UI/Resume/resume-html-document.tsx",
    lineNumber: 107,
    columnNumber: 5
  }, this);
}
_c3 = Section;
function HighlightedText({
  value,
  rules
}) {
  return tokenizeResumeText(value, rules).map(
    (token, index) => token.kind === "plain" ? token.value : /* @__PURE__ */ jsxDEV(
      "mark",
      {
        className: "bg-transparent font-bold text-[var(--resume-ink)]",
        children: token.value
      },
      `${token.value}-${index}`,
      false,
      {
        fileName: "/Users/xianzhezhang/Projects/Jobby/Jobby/packages/ui/src/components/UI/Resume/resume-html-document.tsx",
        lineNumber: 170,
        columnNumber: 3
      },
      this
    )
  );
}
_c4 = HighlightedText;
function stringItems(value) {
  if (Array.isArray(value)) {
    return value.filter((item) => typeof item === "string").map((item) => item.trim()).filter(Boolean);
  }
  return typeof value === "string" && value.trim() ? [value.trim()] : [];
}
function Bullets({
  items,
  rules
}) {
  const list = stringItems(items);
  if (!list.length) return null;
  return /* @__PURE__ */ jsxDEV("ul", { className: "mt-[var(--resume-bullet-gap)] list-none pl-0", children: list.map(
    (item, index) => /* @__PURE__ */ jsxDEV(
      "li",
      {
        className: "relative flex items-baseline pl-[var(--resume-bullet-indent)] text-[var(--resume-body)] break-inside-avoid",
        style: { breakInside: "avoid", pageBreakInside: "avoid" },
        children: [
          /* @__PURE__ */ jsxDEV(
            "span",
            {
              "aria-hidden": "true",
              className: "absolute left-0 inline-block text-[var(--resume-muted)] select-none",
              style: { width: "var(--resume-bullet-mark-width)" },
              children: "•"
            },
            void 0,
            false,
            {
              fileName: "/Users/xianzhezhang/Projects/Jobby/Jobby/packages/ui/src/components/UI/Resume/resume-html-document.tsx",
              lineNumber: 208,
              columnNumber: 11
            },
            this
          ),
          /* @__PURE__ */ jsxDEV("span", { className: "min-w-0 flex-1 leading-normal", children: /* @__PURE__ */ jsxDEV(HighlightedText, { value: item, rules }, void 0, false, {
            fileName: "/Users/xianzhezhang/Projects/Jobby/Jobby/packages/ui/src/components/UI/Resume/resume-html-document.tsx",
            lineNumber: 216,
            columnNumber: 13
          }, this) }, void 0, false, {
            fileName: "/Users/xianzhezhang/Projects/Jobby/Jobby/packages/ui/src/components/UI/Resume/resume-html-document.tsx",
            lineNumber: 215,
            columnNumber: 11
          }, this)
        ]
      },
      index,
      true,
      {
        fileName: "/Users/xianzhezhang/Projects/Jobby/Jobby/packages/ui/src/components/UI/Resume/resume-html-document.tsx",
        lineNumber: 203,
        columnNumber: 7
      },
      this
    )
  ) }, void 0, false, {
    fileName: "/Users/xianzhezhang/Projects/Jobby/Jobby/packages/ui/src/components/UI/Resume/resume-html-document.tsx",
    lineNumber: 201,
    columnNumber: 5
  }, this);
}
_c5 = Bullets;
function Technologies({
  items,
  separator
}) {
  const list = (items ?? []).filter((i) => Boolean(i));
  if (!list.length) return null;
  return /* @__PURE__ */ jsxDEV(
    "p",
    {
      className: "mt-[var(--resume-technology-gap)] text-[length:var(--resume-meta-size)] text-[var(--resume-muted)] break-inside-avoid",
      style: { breakInside: "avoid", pageBreakInside: "avoid" },
      children: [
        /* @__PURE__ */ jsxDEV("span", { className: "font-bold text-[var(--resume-ink)]", children: "Technologies:" }, void 0, false, {
          fileName: "/Users/xianzhezhang/Projects/Jobby/Jobby/packages/ui/src/components/UI/Resume/resume-html-document.tsx",
          lineNumber: 239,
          columnNumber: 7
        }, this),
        " ",
        list.join(separator)
      ]
    },
    void 0,
    true,
    {
      fileName: "/Users/xianzhezhang/Projects/Jobby/Jobby/packages/ui/src/components/UI/Resume/resume-html-document.tsx",
      lineNumber: 235,
      columnNumber: 5
    },
    this
  );
}
_c6 = Technologies;
export function ResumeHtmlDocument({
  config,
  data,
  coreCompetencies = [],
  keyQualifications = [],
  pageRef
}) {
  const basics = data.basics ?? {};
  const contactItems = resumeContactItems(data);
  const inline = config.separators.inline;
  const highlightRules = createResumeHighlightRules(data);
  const effectiveCompetencies = coreCompetencies.length > 0 ? coreCompetencies : keyQualifications.length > 0 ? keyQualifications : data.core_competencies?.length ? data.core_competencies : data.key_qualifications ?? [];
  const sections = {
    summary: data.summary || effectiveCompetencies.length ? /* @__PURE__ */ jsxDEV(Fragment, { children: [
      data.summary ? /* @__PURE__ */ jsxDEV(Section, { title: config.sectionLabels.summary, children: /* @__PURE__ */ jsxDEV("p", { className: "mt-[var(--resume-content-inset)] text-[var(--resume-body)]", children: /* @__PURE__ */ jsxDEV(HighlightedText, { value: data.summary, rules: highlightRules }, void 0, false, {
        fileName: "/Users/xianzhezhang/Projects/Jobby/Jobby/packages/ui/src/components/UI/Resume/resume-html-document.tsx",
        lineNumber: 272,
        columnNumber: 17
      }, this) }, void 0, false, {
        fileName: "/Users/xianzhezhang/Projects/Jobby/Jobby/packages/ui/src/components/UI/Resume/resume-html-document.tsx",
        lineNumber: 271,
        columnNumber: 15
      }, this) }, void 0, false, {
        fileName: "/Users/xianzhezhang/Projects/Jobby/Jobby/packages/ui/src/components/UI/Resume/resume-html-document.tsx",
        lineNumber: 270,
        columnNumber: 7
      }, this) : null,
      effectiveCompetencies.length ? /* @__PURE__ */ jsxDEV(Section, { title: "Core Competencies", children: /* @__PURE__ */ jsxDEV("div", { className: "mt-[var(--resume-content-inset)] flex flex-wrap items-center gap-2", children: effectiveCompetencies.map(
        (item, idx) => /* @__PURE__ */ jsxDEV(
          "span",
          {
            className: "inline-flex items-center justify-center rounded-md px-2.5 pt-[3px] pb-[3.5px] text-[length:var(--resume-meta-size)] font-bold leading-none",
            style: {
              background: "linear-gradient(135deg, rgba(243, 195, 99, 0.22) 0%, rgba(217, 147, 39, 0.10) 50%, rgba(138, 81, 10, 0.16) 100%)",
              border: "1px solid rgba(186, 117, 26, 0.35)",
              color: "#784508",
              boxShadow: "0 1px 2px rgba(120, 69, 8, 0.06)"
            },
            children: item
          },
          idx,
          false,
          {
            fileName: "/Users/xianzhezhang/Projects/Jobby/Jobby/packages/ui/src/components/UI/Resume/resume-html-document.tsx",
            lineNumber: 280,
            columnNumber: 11
          },
          this
        )
      ) }, void 0, false, {
        fileName: "/Users/xianzhezhang/Projects/Jobby/Jobby/packages/ui/src/components/UI/Resume/resume-html-document.tsx",
        lineNumber: 278,
        columnNumber: 15
      }, this) }, void 0, false, {
        fileName: "/Users/xianzhezhang/Projects/Jobby/Jobby/packages/ui/src/components/UI/Resume/resume-html-document.tsx",
        lineNumber: 277,
        columnNumber: 7
      }, this) : null
    ] }, void 0, true, {
      fileName: "/Users/xianzhezhang/Projects/Jobby/Jobby/packages/ui/src/components/UI/Resume/resume-html-document.tsx",
      lineNumber: 268,
      columnNumber: 5
    }, this) : null,
    experience: data.experience?.length ? /* @__PURE__ */ jsxDEV(Section, { title: config.sectionLabels.experience, children: data.experience.map(
      (item, index) => /* @__PURE__ */ jsxDEV(
        "article",
        {
          className: "mt-[var(--resume-entry-gap)]",
          children: [
            /* @__PURE__ */ jsxDEV(
              "div",
              {
                className: "break-inside-avoid break-after-avoid",
                style: {
                  breakInside: "avoid",
                  breakAfter: "avoid",
                  pageBreakInside: "avoid",
                  pageBreakAfter: "avoid"
                },
                children: [
                  /* @__PURE__ */ jsxDEV("div", { className: "flex items-baseline justify-between gap-[var(--resume-row-gap)]", children: [
                    /* @__PURE__ */ jsxDEV("h3", { className: "min-w-0 flex-1 text-[length:var(--resume-body-size)]", children: [
                      item.company && /* @__PURE__ */ jsxDEV("span", { className: "font-bold text-[var(--resume-ink)]", children: item.company }, void 0, false, {
                        fileName: "/Users/xianzhezhang/Projects/Jobby/Jobby/packages/ui/src/components/UI/Resume/resume-html-document.tsx",
                        lineNumber: 318,
                        columnNumber: 15
                      }, this),
                      item.company && item.title && /* @__PURE__ */ jsxDEV("span", { className: "mx-1.5 text-[var(--resume-muted)] font-normal", children: inline }, void 0, false, {
                        fileName: "/Users/xianzhezhang/Projects/Jobby/Jobby/packages/ui/src/components/UI/Resume/resume-html-document.tsx",
                        lineNumber: 323,
                        columnNumber: 15
                      }, this),
                      item.title && /* @__PURE__ */ jsxDEV("span", { className: "font-normal text-[var(--resume-primary)]", children: item.title }, void 0, false, {
                        fileName: "/Users/xianzhezhang/Projects/Jobby/Jobby/packages/ui/src/components/UI/Resume/resume-html-document.tsx",
                        lineNumber: 328,
                        columnNumber: 15
                      }, this)
                    ] }, void 0, true, {
                      fileName: "/Users/xianzhezhang/Projects/Jobby/Jobby/packages/ui/src/components/UI/Resume/resume-html-document.tsx",
                      lineNumber: 316,
                      columnNumber: 17
                    }, this),
                    /* @__PURE__ */ jsxDEV("span", { className: "shrink-0 text-[length:var(--resume-date-size)] text-[var(--resume-muted)]", children: resumeDateRange(item.start_date, item.end_date) }, void 0, false, {
                      fileName: "/Users/xianzhezhang/Projects/Jobby/Jobby/packages/ui/src/components/UI/Resume/resume-html-document.tsx",
                      lineNumber: 333,
                      columnNumber: 17
                    }, this)
                  ] }, void 0, true, {
                    fileName: "/Users/xianzhezhang/Projects/Jobby/Jobby/packages/ui/src/components/UI/Resume/resume-html-document.tsx",
                    lineNumber: 315,
                    columnNumber: 15
                  }, this),
                  item.location && /* @__PURE__ */ jsxDEV("p", { className: "mt-[var(--resume-detail-gap)] text-[length:var(--resume-date-size)] text-[var(--resume-muted)]", children: item.location }, void 0, false, {
                    fileName: "/Users/xianzhezhang/Projects/Jobby/Jobby/packages/ui/src/components/UI/Resume/resume-html-document.tsx",
                    lineNumber: 338,
                    columnNumber: 11
                  }, this)
                ]
              },
              void 0,
              true,
              {
                fileName: "/Users/xianzhezhang/Projects/Jobby/Jobby/packages/ui/src/components/UI/Resume/resume-html-document.tsx",
                lineNumber: 306,
                columnNumber: 13
              },
              this
            ),
            /* @__PURE__ */ jsxDEV(Bullets, { items: item.description, rules: highlightRules }, void 0, false, {
              fileName: "/Users/xianzhezhang/Projects/Jobby/Jobby/packages/ui/src/components/UI/Resume/resume-html-document.tsx",
              lineNumber: 343,
              columnNumber: 13
            }, this),
            /* @__PURE__ */ jsxDEV(
              Technologies,
              {
                items: item.technologies,
                separator: config.separators.technologies
              },
              void 0,
              false,
              {
                fileName: "/Users/xianzhezhang/Projects/Jobby/Jobby/packages/ui/src/components/UI/Resume/resume-html-document.tsx",
                lineNumber: 344,
                columnNumber: 13
              },
              this
            )
          ]
        },
        `${item.company}-${index}`,
        true,
        {
          fileName: "/Users/xianzhezhang/Projects/Jobby/Jobby/packages/ui/src/components/UI/Resume/resume-html-document.tsx",
          lineNumber: 302,
          columnNumber: 7
        },
        this
      )
    ) }, void 0, false, {
      fileName: "/Users/xianzhezhang/Projects/Jobby/Jobby/packages/ui/src/components/UI/Resume/resume-html-document.tsx",
      lineNumber: 300,
      columnNumber: 5
    }, this) : null,
    education: data.education?.length ? /* @__PURE__ */ jsxDEV(Section, { title: config.sectionLabels.education, children: data.education.map((item, index) => {
      const hasDegreeInfo = Boolean(item.degree || item.field_of_study);
      const subInfo = hasDegreeInfo ? [item.institution, item.location].filter(Boolean).join(inline) : item.location;
      return /* @__PURE__ */ jsxDEV(
        "article",
        {
          className: "mt-[var(--resume-entry-gap)]",
          children: [
            /* @__PURE__ */ jsxDEV(
              "div",
              {
                className: "break-inside-avoid break-after-avoid",
                style: {
                  breakInside: "avoid",
                  breakAfter: "avoid",
                  pageBreakInside: "avoid",
                  pageBreakAfter: "avoid"
                },
                children: [
                  /* @__PURE__ */ jsxDEV("div", { className: "flex items-baseline justify-between gap-[var(--resume-row-gap)]", children: [
                    /* @__PURE__ */ jsxDEV("h3", { className: "min-w-0 flex-1 text-[length:var(--resume-body-size)]", children: [
                      item.degree && /* @__PURE__ */ jsxDEV("span", { className: "font-bold text-[var(--resume-ink)]", children: item.degree }, void 0, false, {
                        fileName: "/Users/xianzhezhang/Projects/Jobby/Jobby/packages/ui/src/components/UI/Resume/resume-html-document.tsx",
                        lineNumber: 377,
                        columnNumber: 19
                      }, this),
                      item.degree && item.field_of_study && /* @__PURE__ */ jsxDEV("span", { className: "mx-1.5 font-normal text-[var(--resume-muted)]", children: inline }, void 0, false, {
                        fileName: "/Users/xianzhezhang/Projects/Jobby/Jobby/packages/ui/src/components/UI/Resume/resume-html-document.tsx",
                        lineNumber: 382,
                        columnNumber: 19
                      }, this),
                      item.field_of_study && /* @__PURE__ */ jsxDEV("span", { className: "font-medium text-[var(--resume-primary)]", children: item.field_of_study }, void 0, false, {
                        fileName: "/Users/xianzhezhang/Projects/Jobby/Jobby/packages/ui/src/components/UI/Resume/resume-html-document.tsx",
                        lineNumber: 387,
                        columnNumber: 19
                      }, this),
                      !hasDegreeInfo && item.institution && /* @__PURE__ */ jsxDEV("span", { className: "font-bold text-[var(--resume-ink)]", children: item.institution }, void 0, false, {
                        fileName: "/Users/xianzhezhang/Projects/Jobby/Jobby/packages/ui/src/components/UI/Resume/resume-html-document.tsx",
                        lineNumber: 392,
                        columnNumber: 19
                      }, this)
                    ] }, void 0, true, {
                      fileName: "/Users/xianzhezhang/Projects/Jobby/Jobby/packages/ui/src/components/UI/Resume/resume-html-document.tsx",
                      lineNumber: 375,
                      columnNumber: 19
                    }, this),
                    /* @__PURE__ */ jsxDEV("span", { className: "shrink-0 text-[length:var(--resume-date-size)] text-[var(--resume-muted)]", children: resumeDateRange(item.start_date, item.end_date) }, void 0, false, {
                      fileName: "/Users/xianzhezhang/Projects/Jobby/Jobby/packages/ui/src/components/UI/Resume/resume-html-document.tsx",
                      lineNumber: 397,
                      columnNumber: 19
                    }, this)
                  ] }, void 0, true, {
                    fileName: "/Users/xianzhezhang/Projects/Jobby/Jobby/packages/ui/src/components/UI/Resume/resume-html-document.tsx",
                    lineNumber: 374,
                    columnNumber: 17
                  }, this),
                  subInfo && /* @__PURE__ */ jsxDEV("p", { className: "mt-[var(--resume-detail-gap)] text-[length:var(--resume-date-size)] text-[var(--resume-muted)]", children: subInfo }, void 0, false, {
                    fileName: "/Users/xianzhezhang/Projects/Jobby/Jobby/packages/ui/src/components/UI/Resume/resume-html-document.tsx",
                    lineNumber: 402,
                    columnNumber: 15
                  }, this)
                ]
              },
              void 0,
              true,
              {
                fileName: "/Users/xianzhezhang/Projects/Jobby/Jobby/packages/ui/src/components/UI/Resume/resume-html-document.tsx",
                lineNumber: 365,
                columnNumber: 15
              },
              this
            ),
            /* @__PURE__ */ jsxDEV(Bullets, { items: item.highlights, rules: highlightRules }, void 0, false, {
              fileName: "/Users/xianzhezhang/Projects/Jobby/Jobby/packages/ui/src/components/UI/Resume/resume-html-document.tsx",
              lineNumber: 407,
              columnNumber: 15
            }, this)
          ]
        },
        `${item.institution}-${index}`,
        true,
        {
          fileName: "/Users/xianzhezhang/Projects/Jobby/Jobby/packages/ui/src/components/UI/Resume/resume-html-document.tsx",
          lineNumber: 361,
          columnNumber: 11
        },
        this
      );
    }) }, void 0, false, {
      fileName: "/Users/xianzhezhang/Projects/Jobby/Jobby/packages/ui/src/components/UI/Resume/resume-html-document.tsx",
      lineNumber: 353,
      columnNumber: 5
    }, this) : null,
    projects: data.projects?.length ? /* @__PURE__ */ jsxDEV(Section, { title: config.sectionLabels.projects, children: data.projects.map(
      (item, index) => /* @__PURE__ */ jsxDEV(
        "article",
        {
          className: "mt-[var(--resume-entry-gap)]",
          children: [
            /* @__PURE__ */ jsxDEV(
              "div",
              {
                className: "break-inside-avoid break-after-avoid",
                style: {
                  breakInside: "avoid",
                  breakAfter: "avoid",
                  pageBreakInside: "avoid",
                  pageBreakAfter: "avoid"
                },
                children: [
                  /* @__PURE__ */ jsxDEV("div", { className: "flex items-baseline justify-between gap-[var(--resume-row-gap)]", children: [
                    /* @__PURE__ */ jsxDEV("h3", { className: "min-w-0 flex-1 font-bold text-[var(--resume-ink)]", children: item.name }, void 0, false, {
                      fileName: "/Users/xianzhezhang/Projects/Jobby/Jobby/packages/ui/src/components/UI/Resume/resume-html-document.tsx",
                      lineNumber: 430,
                      columnNumber: 17
                    }, this),
                    /* @__PURE__ */ jsxDEV("span", { className: "shrink-0 text-[length:var(--resume-date-size)] text-[var(--resume-muted)]", children: resumeDateRange(item.start_date, item.end_date) }, void 0, false, {
                      fileName: "/Users/xianzhezhang/Projects/Jobby/Jobby/packages/ui/src/components/UI/Resume/resume-html-document.tsx",
                      lineNumber: 433,
                      columnNumber: 17
                    }, this)
                  ] }, void 0, true, {
                    fileName: "/Users/xianzhezhang/Projects/Jobby/Jobby/packages/ui/src/components/UI/Resume/resume-html-document.tsx",
                    lineNumber: 429,
                    columnNumber: 15
                  }, this),
                  item.url && /* @__PURE__ */ jsxDEV(
                    "a",
                    {
                      className: "mt-[var(--resume-bullet-gap)] block text-[length:var(--resume-url-size)] text-[var(--resume-muted)] hover:text-[var(--resume-ink)]",
                      href: item.url.startsWith("http") ? item.url : `https://${item.url}`,
                      target: "_blank",
                      rel: "noreferrer",
                      children: item.url.replace(/^https?:\/\//i, "").replace(/\/$/, "")
                    },
                    void 0,
                    false,
                    {
                      fileName: "/Users/xianzhezhang/Projects/Jobby/Jobby/packages/ui/src/components/UI/Resume/resume-html-document.tsx",
                      lineNumber: 438,
                      columnNumber: 11
                    },
                    this
                  )
                ]
              },
              void 0,
              true,
              {
                fileName: "/Users/xianzhezhang/Projects/Jobby/Jobby/packages/ui/src/components/UI/Resume/resume-html-document.tsx",
                lineNumber: 420,
                columnNumber: 13
              },
              this
            ),
            /* @__PURE__ */ jsxDEV(Bullets, { items: item.description, rules: highlightRules }, void 0, false, {
              fileName: "/Users/xianzhezhang/Projects/Jobby/Jobby/packages/ui/src/components/UI/Resume/resume-html-document.tsx",
              lineNumber: 452,
              columnNumber: 13
            }, this),
            /* @__PURE__ */ jsxDEV(
              Technologies,
              {
                items: item.technologies,
                separator: config.separators.technologies
              },
              void 0,
              false,
              {
                fileName: "/Users/xianzhezhang/Projects/Jobby/Jobby/packages/ui/src/components/UI/Resume/resume-html-document.tsx",
                lineNumber: 453,
                columnNumber: 13
              },
              this
            )
          ]
        },
        `${item.name}-${index}`,
        true,
        {
          fileName: "/Users/xianzhezhang/Projects/Jobby/Jobby/packages/ui/src/components/UI/Resume/resume-html-document.tsx",
          lineNumber: 416,
          columnNumber: 7
        },
        this
      )
    ) }, void 0, false, {
      fileName: "/Users/xianzhezhang/Projects/Jobby/Jobby/packages/ui/src/components/UI/Resume/resume-html-document.tsx",
      lineNumber: 414,
      columnNumber: 5
    }, this) : null,
    skills: data.skills?.length ? /* @__PURE__ */ jsxDEV(Section, { title: config.sectionLabels.skills, children: data.skills.map(
      (group, index) => /* @__PURE__ */ jsxDEV(
        "div",
        {
          className: "mt-[var(--resume-skill-gap)] flex items-baseline break-inside-avoid",
          style: { breakInside: "avoid", pageBreakInside: "avoid" },
          children: [
            group.type && /* @__PURE__ */ jsxDEV("span", { className: "w-[var(--resume-skill-label-width)] shrink-0 text-[length:var(--resume-date-size)] font-bold text-[var(--resume-ink)]", children: group.type }, void 0, false, {
              fileName: "/Users/xianzhezhang/Projects/Jobby/Jobby/packages/ui/src/components/UI/Resume/resume-html-document.tsx",
              lineNumber: 470,
              columnNumber: 9
            }, this),
            /* @__PURE__ */ jsxDEV("span", { className: "min-w-0 flex-1 text-[var(--resume-body)]", children: stringItems(group.skills).join(inline) }, void 0, false, {
              fileName: "/Users/xianzhezhang/Projects/Jobby/Jobby/packages/ui/src/components/UI/Resume/resume-html-document.tsx",
              lineNumber: 474,
              columnNumber: 13
            }, this)
          ]
        },
        `${group.type}-${index}`,
        true,
        {
          fileName: "/Users/xianzhezhang/Projects/Jobby/Jobby/packages/ui/src/components/UI/Resume/resume-html-document.tsx",
          lineNumber: 464,
          columnNumber: 7
        },
        this
      )
    ) }, void 0, false, {
      fileName: "/Users/xianzhezhang/Projects/Jobby/Jobby/packages/ui/src/components/UI/Resume/resume-html-document.tsx",
      lineNumber: 462,
      columnNumber: 5
    }, this) : null,
    certifications: data.certifications?.length ? /* @__PURE__ */ jsxDEV(Section, { title: config.sectionLabels.certifications, children: data.certifications.flatMap((group) => group.certifications ?? []).map(
      (item, index) => /* @__PURE__ */ jsxDEV(
        "p",
        {
          className: "mt-[var(--resume-skill-gap)] break-inside-avoid",
          style: { breakInside: "avoid", pageBreakInside: "avoid" },
          children: [
            item.name,
            item.issuer,
            resumeDateRange(item.issue_date, item.expiry_date)
          ].filter(Boolean).join(inline)
        },
        `${item.name}-${index}`,
        false,
        {
          fileName: "/Users/xianzhezhang/Projects/Jobby/Jobby/packages/ui/src/components/UI/Resume/resume-html-document.tsx",
          lineNumber: 486,
          columnNumber: 7
        },
        this
      )
    ) }, void 0, false, {
      fileName: "/Users/xianzhezhang/Projects/Jobby/Jobby/packages/ui/src/components/UI/Resume/resume-html-document.tsx",
      lineNumber: 482,
      columnNumber: 5
    }, this) : null,
    languages: data.languages?.length ? /* @__PURE__ */ jsxDEV(Section, { title: config.sectionLabels.languages, children: /* @__PURE__ */ jsxDEV(
      "p",
      {
        className: "mt-[var(--resume-skill-gap)] break-inside-avoid",
        style: { breakInside: "avoid", pageBreakInside: "avoid" },
        children: data.languages.map(
          (item) => [item.name, item.proficiency].filter(Boolean).join(" - ")
        ).join(inline)
      },
      void 0,
      false,
      {
        fileName: "/Users/xianzhezhang/Projects/Jobby/Jobby/packages/ui/src/components/UI/Resume/resume-html-document.tsx",
        lineNumber: 504,
        columnNumber: 9
      },
      this
    ) }, void 0, false, {
      fileName: "/Users/xianzhezhang/Projects/Jobby/Jobby/packages/ui/src/components/UI/Resume/resume-html-document.tsx",
      lineNumber: 503,
      columnNumber: 5
    }, this) : null,
    other: data.other?.length ? /* @__PURE__ */ jsxDEV(Section, { title: config.sectionLabels.other, children: data.other.map(
      (item, index) => /* @__PURE__ */ jsxDEV(
        "article",
        {
          className: "mt-[var(--resume-entry-gap)]",
          children: [
            /* @__PURE__ */ jsxDEV(
              "div",
              {
                className: "break-inside-avoid break-after-avoid",
                style: {
                  breakInside: "avoid",
                  breakAfter: "avoid",
                  pageBreakInside: "avoid",
                  pageBreakAfter: "avoid"
                },
                children: /* @__PURE__ */ jsxDEV("div", { className: "flex items-baseline justify-between gap-[var(--resume-row-gap)]", children: [
                  /* @__PURE__ */ jsxDEV("h3", { className: "min-w-0 flex-1 font-bold text-[var(--resume-ink)]", children: [item.title, item.organization].filter(Boolean).join(inline) }, void 0, false, {
                    fileName: "/Users/xianzhezhang/Projects/Jobby/Jobby/packages/ui/src/components/UI/Resume/resume-html-document.tsx",
                    lineNumber: 533,
                    columnNumber: 17
                  }, this),
                  item.date && /* @__PURE__ */ jsxDEV("span", { className: "shrink-0 text-[length:var(--resume-date-size)] text-[var(--resume-muted)]", children: item.date }, void 0, false, {
                    fileName: "/Users/xianzhezhang/Projects/Jobby/Jobby/packages/ui/src/components/UI/Resume/resume-html-document.tsx",
                    lineNumber: 539,
                    columnNumber: 13
                  }, this)
                ] }, void 0, true, {
                  fileName: "/Users/xianzhezhang/Projects/Jobby/Jobby/packages/ui/src/components/UI/Resume/resume-html-document.tsx",
                  lineNumber: 532,
                  columnNumber: 15
                }, this)
              },
              void 0,
              false,
              {
                fileName: "/Users/xianzhezhang/Projects/Jobby/Jobby/packages/ui/src/components/UI/Resume/resume-html-document.tsx",
                lineNumber: 523,
                columnNumber: 13
              },
              this
            ),
            /* @__PURE__ */ jsxDEV(Bullets, { items: item.description, rules: highlightRules }, void 0, false, {
              fileName: "/Users/xianzhezhang/Projects/Jobby/Jobby/packages/ui/src/components/UI/Resume/resume-html-document.tsx",
              lineNumber: 545,
              columnNumber: 13
            }, this)
          ]
        },
        `${item.title}-${index}`,
        true,
        {
          fileName: "/Users/xianzhezhang/Projects/Jobby/Jobby/packages/ui/src/components/UI/Resume/resume-html-document.tsx",
          lineNumber: 519,
          columnNumber: 7
        },
        this
      )
    ) }, void 0, false, {
      fileName: "/Users/xianzhezhang/Projects/Jobby/Jobby/packages/ui/src/components/UI/Resume/resume-html-document.tsx",
      lineNumber: 517,
      columnNumber: 5
    }, this) : null
  };
  return /* @__PURE__ */ jsxDEV(
    "article",
    {
      ref: pageRef,
      style: {
        ...templateCssVariables(config),
        width: `${config.paper.widthPx}px`,
        minHeight: `${config.paper.heightPx}px`,
        paddingTop: `calc(${config.paper.paddingTop} * ${config.paper.cssPixelsPerPoint}px)`,
        paddingRight: `calc(${config.paper.paddingRight} * ${config.paper.cssPixelsPerPoint}px)`,
        paddingBottom: `calc(${config.paper.paddingBottom} * ${config.paper.cssPixelsPerPoint}px)`,
        paddingLeft: `calc(${config.paper.paddingLeft} * ${config.paper.cssPixelsPerPoint}px)`
      },
      className: "box-border bg-white text-[length:var(--resume-body-size)] leading-[var(--resume-line-height)] text-[var(--resume-ink)] shadow-2xs font-[var(--resume-font)] select-text",
      children: /* @__PURE__ */ jsxDEV("div", { "data-resume-content": "true", children: [
        /* @__PURE__ */ jsxDEV(
          "header",
          {
            className: "border-[var(--resume-header-rule)] pb-[var(--resume-header-rule-width)]",
            style: {
              borderBottomWidth: "var(--resume-header-rule-width)",
              borderBottomStyle: "solid"
            },
            children: [
              /* @__PURE__ */ jsxDEV("h1", { className: "text-[length:var(--resume-name-size)] font-extrabold tracking-tight text-[var(--resume-ink)] leading-none", children: resumeFullName(data) }, void 0, false, {
                fileName: "/Users/xianzhezhang/Projects/Jobby/Jobby/packages/ui/src/components/UI/Resume/resume-html-document.tsx",
                lineNumber: 574,
                columnNumber: 11
              }, this),
              basics.headline && /* @__PURE__ */ jsxDEV("p", { className: "mt-[var(--resume-headline-gap)] text-[length:var(--resume-headline-size)] font-semibold text-[var(--resume-muted)]", children: basics.headline }, void 0, false, {
                fileName: "/Users/xianzhezhang/Projects/Jobby/Jobby/packages/ui/src/components/UI/Resume/resume-html-document.tsx",
                lineNumber: 578,
                columnNumber: 11
              }, this),
              contactItems.length ? /* @__PURE__ */ jsxDEV("div", { className: "mt-[var(--resume-contact-gap)] flex flex-wrap items-center gap-x-2.5 gap-y-1 text-[length:var(--resume-contact-size)] text-[var(--resume-muted)]", children: contactItems.map(
                (item, index) => /* @__PURE__ */ jsxDEV(Fragment2, { children: [
                  index > 0 && /* @__PURE__ */ jsxDEV("span", { className: "opacity-40 select-none", children: "•" }, void 0, false, {
                    fileName: "/Users/xianzhezhang/Projects/Jobby/Jobby/packages/ui/src/components/UI/Resume/resume-html-document.tsx",
                    lineNumber: 587,
                    columnNumber: 15
                  }, this),
                  /* @__PURE__ */ jsxDEV("span", { className: "inline-flex items-center gap-1", children: [
                    /* @__PURE__ */ jsxDEV(ContactIcon, { type: item.type }, void 0, false, {
                      fileName: "/Users/xianzhezhang/Projects/Jobby/Jobby/packages/ui/src/components/UI/Resume/resume-html-document.tsx",
                      lineNumber: 590,
                      columnNumber: 21
                    }, this),
                    item.href ? /* @__PURE__ */ jsxDEV(
                      "a",
                      {
                        href: item.href,
                        target: "_blank",
                        rel: "noreferrer",
                        className: "text-[var(--resume-muted)] hover:text-[var(--resume-ink)]",
                        children: item.text
                      },
                      void 0,
                      false,
                      {
                        fileName: "/Users/xianzhezhang/Projects/Jobby/Jobby/packages/ui/src/components/UI/Resume/resume-html-document.tsx",
                        lineNumber: 592,
                        columnNumber: 17
                      },
                      this
                    ) : item.text
                  ] }, void 0, true, {
                    fileName: "/Users/xianzhezhang/Projects/Jobby/Jobby/packages/ui/src/components/UI/Resume/resume-html-document.tsx",
                    lineNumber: 589,
                    columnNumber: 19
                  }, this)
                ] }, `${item.type}-${index}`, true, {
                  fileName: "/Users/xianzhezhang/Projects/Jobby/Jobby/packages/ui/src/components/UI/Resume/resume-html-document.tsx",
                  lineNumber: 585,
                  columnNumber: 13
                }, this)
              ) }, void 0, false, {
                fileName: "/Users/xianzhezhang/Projects/Jobby/Jobby/packages/ui/src/components/UI/Resume/resume-html-document.tsx",
                lineNumber: 583,
                columnNumber: 11
              }, this) : null
            ]
          },
          void 0,
          true,
          {
            fileName: "/Users/xianzhezhang/Projects/Jobby/Jobby/packages/ui/src/components/UI/Resume/resume-html-document.tsx",
            lineNumber: 567,
            columnNumber: 9
          },
          this
        ),
        config.sectionOrder.map(
          (key) => /* @__PURE__ */ jsxDEV(Fragment2, { children: sections[key] }, key, false, {
            fileName: "/Users/xianzhezhang/Projects/Jobby/Jobby/packages/ui/src/components/UI/Resume/resume-html-document.tsx",
            lineNumber: 611,
            columnNumber: 9
          }, this)
        )
      ] }, void 0, true, {
        fileName: "/Users/xianzhezhang/Projects/Jobby/Jobby/packages/ui/src/components/UI/Resume/resume-html-document.tsx",
        lineNumber: 566,
        columnNumber: 7
      }, this)
    },
    void 0,
    false,
    {
      fileName: "/Users/xianzhezhang/Projects/Jobby/Jobby/packages/ui/src/components/UI/Resume/resume-html-document.tsx",
      lineNumber: 553,
      columnNumber: 5
    },
    this
  );
}
_c7 = ResumeHtmlDocument;
var _c, _c2, _c3, _c4, _c5, _c6, _c7;
$RefreshReg$(_c, "LinkedinIcon");
$RefreshReg$(_c2, "ContactIcon");
$RefreshReg$(_c3, "Section");
$RefreshReg$(_c4, "HighlightedText");
$RefreshReg$(_c5, "Bullets");
$RefreshReg$(_c6, "Technologies");
$RefreshReg$(_c7, "ResumeHtmlDocument");
if (import.meta.hot && !inWebWorker) {
  window.$RefreshReg$ = prevRefreshReg;
  window.$RefreshSig$ = prevRefreshSig;
}
if (import.meta.hot && !inWebWorker) {
  RefreshRuntime.__hmr_import(import.meta.url).then((currentExports) => {
    RefreshRuntime.registerExportsForReactRefresh("/Users/xianzhezhang/Projects/Jobby/Jobby/packages/ui/src/components/UI/Resume/resume-html-document.tsx", currentExports);
    import.meta.hot.accept((nextExports) => {
      if (!nextExports) return;
      const invalidateMessage = RefreshRuntime.validateRefreshBoundaryAndEnqueueUpdate("/Users/xianzhezhang/Projects/Jobby/Jobby/packages/ui/src/components/UI/Resume/resume-html-document.tsx", currentExports, nextExports);
      if (invalidateMessage) import.meta.hot.invalidate(invalidateMessage);
    });
  });
}
