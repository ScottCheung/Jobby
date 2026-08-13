import { describe, expect, it } from "vitest";
import { parseAndFormatJobDate } from "./date-formatter";
import { extractLinkedInPostedDate } from "../../content/platforms/linkedin/date-parser";

describe("extractLinkedInPostedDate", () => {
  it("extracts standard relative phrases", () => {
    expect(extractLinkedInPostedDate("Posted 2 weeks ago")).toBe("Posted 2 weeks ago");
    expect(extractLinkedInPostedDate("Reposted 3 days ago")).toBe("Reposted 3 days ago");
    expect(extractLinkedInPostedDate("Posted 1 month ago")).toBe("Posted 1 month ago");
  });

  it("extracts short unit relative phrases", () => {
    expect(extractLinkedInPostedDate("Posted 2d ago")).toBe("Posted 2d ago");
    expect(extractLinkedInPostedDate("Posted 3h ago")).toBe("Posted 3h ago");
    expect(extractLinkedInPostedDate("Posted 1w ago")).toBe("Posted 1w ago");
    expect(extractLinkedInPostedDate("Posted 1mo ago")).toBe("Posted 1mo ago");
    expect(extractLinkedInPostedDate("Posted 30+d ago")).toBe("Posted 30+d ago");
  });

  it("extracts phrases with prefixes like Over / More than", () => {
    expect(extractLinkedInPostedDate("Over 4 weeks ago")).toBe("Over 4 weeks ago");
    expect(extractLinkedInPostedDate("More than 30 days ago")).toBe("More than 30 days ago");
    expect(extractLinkedInPostedDate("Posted over 2 weeks ago")).toBe("Posted over 2 weeks ago");
  });

  it("extracts Chinese relative phrases", () => {
    expect(extractLinkedInPostedDate("发布于3天前")).toBe("发布于3天前");
    expect(extractLinkedInPostedDate("3周前")).toBe("3周前");
    expect(extractLinkedInPostedDate("1个月前")).toBe("1个月前");
    expect(extractLinkedInPostedDate("刚刚")).toBe("刚刚");
  });

  it("extracts ISO dates", () => {
    expect(extractLinkedInPostedDate("Date: 2026-08-10")).toBe("2026-08-10");
  });

  it("extracts date from complex metadata text and prefixes", () => {
    expect(
      extractLinkedInPostedDate("Sydney, New South Wales, Australia · 2 weeks ago · 45 applicants")
    ).toBe("2 weeks ago");
    expect(
      extractLinkedInPostedDate("Actively hiring · Posted 2 days ago · 45 applicants")
    ).toBe("Posted 2 days ago");
    expect(
      extractLinkedInPostedDate("Be an early applicant · 4 hours ago")
    ).toBe("4 hours ago");
    expect(
      extractLinkedInPostedDate("Easy Apply · 3 weeks ago")
    ).toBe("3 weeks ago");
    expect(
      extractLinkedInPostedDate("Promoted · Posted 1mo ago")
    ).toBe("Posted 1mo ago");
  });
});

describe("parseAndFormatJobDate", () => {
  const refDate = new Date("2026-08-13T00:00:00Z");

  it("parses hours and minutes ago", () => {
    const resH = parseAndFormatJobDate("Posted 3 hours ago", refDate);
    expect(resH.displayText).toBe("3 hours ago");
    expect(resH.isNotFresh).toBe(false);

    const resM = parseAndFormatJobDate("Posted 24 minutes ago", refDate);
    expect(resM.displayText).toBe("24 minutes ago");
    expect(resM.isNotFresh).toBe(false);
  });

  it("parses days ago and short forms (2d, 3d ago)", () => {
    const res2d = parseAndFormatJobDate("Posted 2d ago", refDate);
    expect(res2d.displayText).toBe("2 days ago");
    expect(res2d.isNotFresh).toBe(false);

    const res3d = parseAndFormatJobDate("3 days ago", refDate);
    expect(res3d.displayText).toBe("3 days ago");
    expect(res3d.isNotFresh).toBe(false);
  });

  it("parses weeks ago (1w, 2 weeks)", () => {
    const res1w = parseAndFormatJobDate("Posted 1w ago", refDate);
    expect(res1w.displayText).toBe("1 week ago");
    expect(res1w.isNotFresh).toBe(false);

    const res2w = parseAndFormatJobDate("2 weeks ago", refDate);
    expect(res2w.displayText).toBe("2 weeks ago");
    expect(res2w.isNotFresh).toBe(false);
  });

  it("marks postings older than 2 weeks as Not Fresh", () => {
    const res3w = parseAndFormatJobDate("Posted 3 weeks ago", refDate);
    expect(res3w.isNotFresh).toBe(true);
    expect(res3w.displayText).toBe("3 weeks ago");

    const res1mo = parseAndFormatJobDate("Posted 1 month ago", refDate);
    expect(res1mo.isNotFresh).toBe(true);
    expect(res1mo.displayText).toBe("1 month ago");

    const res30d = parseAndFormatJobDate("30+ days ago", refDate);
    expect(res30d.isNotFresh).toBe(true);
    expect(res30d.displayText).toBe("1 month ago");
  });

  it("parses explicit ISO date string and calculates age", () => {
    const resIso = parseAndFormatJobDate("2026-08-10", refDate);
    expect(resIso.displayText).toBe("3 days ago");
    expect(resIso.isNotFresh).toBe(false);

    const resIsoPosted = parseAndFormatJobDate("Posted 2026-08-10", refDate);
    expect(resIsoPosted.displayText).toBe("3 days ago");
    expect(resIsoPosted.isNotFresh).toBe(false);
  });

  it("parses Chinese dates correctly", () => {
    const resZh = parseAndFormatJobDate("发布于3天前", refDate);
    expect(resZh.displayText).toBe("3 days ago");
    expect(resZh.isNotFresh).toBe(false);
  });
});
