import { describe, expect, it } from "vitest";
import { parseAndFormatJobDate } from "./date-formatter";
import { extractLinkedInPostedDate } from "../../content/platforms/linkedin/date-parser";

describe("extractLinkedInPostedDate", () => {
  it("extracts standard relative phrases", () => {
    expect(extractLinkedInPostedDate("Posted 2 weeks ago")).toBe("2 weeks ago");
    expect(extractLinkedInPostedDate("Reposted 3 days ago")).toBe("3 days ago");
    expect(extractLinkedInPostedDate("Posted 1 month ago")).toBe("1 month ago");
  });

  it("extracts short unit relative phrases", () => {
    expect(extractLinkedInPostedDate("Posted 2d ago")).toBe("2d ago");
    expect(extractLinkedInPostedDate("Posted 3h ago")).toBe("3h ago");
    expect(extractLinkedInPostedDate("Posted 1w ago")).toBe("1w ago");
    expect(extractLinkedInPostedDate("Posted 1mo ago")).toBe("1mo ago");
    expect(extractLinkedInPostedDate("Posted 30+d ago")).toBe("30+d ago");
  });

  it("extracts phrases with prefixes like Over / More than", () => {
    expect(extractLinkedInPostedDate("Over 4 weeks ago")).toBe("4 weeks ago");
    expect(extractLinkedInPostedDate("More than 30 days ago")).toBe("30 days ago");
    expect(extractLinkedInPostedDate("Posted over 2 weeks ago")).toBe("2 weeks ago");
  });

  it("extracts Chinese relative phrases", () => {
    expect(extractLinkedInPostedDate("发布于3天前")).toBe("3天前");
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
    ).toBe("2 days ago");
    expect(
      extractLinkedInPostedDate("Be an early applicant · 4 hours ago")
    ).toBe("4 hours ago");
    expect(
      extractLinkedInPostedDate("Easy Apply · 3 weeks ago")
    ).toBe("3 weeks ago");
    expect(
      extractLinkedInPostedDate("Promoted · Posted 1mo ago")
    ).toBe("1mo ago");
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

  it("parses days ago and assigns correct freshnessTier (0-4 new, 4-7 aging, >7 stale)", () => {
    const res2d = parseAndFormatJobDate("Posted 2d ago", refDate);
    expect(res2d.displayText).toBe("2 days ago");
    expect(res2d.freshnessTier).toBe("new");

    const res3d = parseAndFormatJobDate("3 days ago", refDate);
    expect(res3d.displayText).toBe("3 days ago");
    expect(res3d.freshnessTier).toBe("new");

    const res5d = parseAndFormatJobDate("5 days ago", refDate);
    expect(res5d.displayText).toBe("5 days ago");
    expect(res5d.freshnessTier).toBe("aging");
  });

  it("parses weeks ago (1w, 2 weeks)", () => {
    const res1w = parseAndFormatJobDate("Posted 1w ago", refDate);
    expect(res1w.displayText).toBe("1 week ago");
    expect(res1w.freshnessTier).toBe("aging");

    const res2w = parseAndFormatJobDate("2 weeks ago", refDate);
    expect(res2w.displayText).toBe("2 weeks ago");
    expect(res2w.freshnessTier).toBe("stale");
  });

  it("marks postings older than 7 days as Stale", () => {
    const res8d = parseAndFormatJobDate("8 days ago", refDate);
    expect(res8d.freshnessTier).toBe("stale");

    const res3w = parseAndFormatJobDate("Posted 3 weeks ago", refDate);
    expect(res3w.freshnessTier).toBe("stale");
    expect(res3w.displayText).toBe("3 weeks ago");

    const res1mo = parseAndFormatJobDate("Posted 1 month ago", refDate);
    expect(res1mo.freshnessTier).toBe("stale");
    expect(res1mo.displayText).toBe("1 month ago");

    const res30d = parseAndFormatJobDate("30+ days ago", refDate);
    expect(res30d.freshnessTier).toBe("stale");
    expect(res30d.displayText).toBe("1 month ago");
  });

  it("parses explicit ISO date string and calculates age", () => {
    const resIso = parseAndFormatJobDate("2026-08-10", refDate);
    expect(resIso.displayText).toBe("3 days ago");
    expect(resIso.isTooOld).toBe(false);
    expect(resIso.isNotFresh).toBe(false);

    const resIsoPosted = parseAndFormatJobDate("Posted 2026-08-10", refDate);
    expect(resIsoPosted.displayText).toBe("3 days ago");
    expect(resIsoPosted.isTooOld).toBe(false);
    expect(resIsoPosted.isNotFresh).toBe(false);
  });

  it("parses Chinese dates correctly", () => {
    const resZh = parseAndFormatJobDate("发布于3天前", refDate);
    expect(resZh.displayText).toBe("3 days ago");
    expect(resZh.isTooOld).toBe(false);
    expect(resZh.isNotFresh).toBe(false);
  });
});
