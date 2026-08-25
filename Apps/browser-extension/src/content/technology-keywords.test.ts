import { describe, expect, it } from "vitest";
import { extractTechnologyKeywords } from "./technology-keywords";

describe("extractTechnologyKeywords", () => {
  it("keeps software and cloud technology extraction", () => {
    expect(
      extractTechnologyKeywords(
        "Build React and Node.js services with PostgreSQL, Docker, Kubernetes, and AWS.",
      ),
    ).toEqual(["React", "Node.js", "PostgreSQL", "Docker", "Kubernetes", "AWS"]);
  });

  it("extracts finance, accounting, and analytics tools", () => {
    expect(
      extractTechnologyKeywords(
        "Prepare IFRS reports in Xero and MYOB, then build executive dashboards in Power BI.",
      ),
    ).toEqual(["IFRS", "Xero", "MYOB", "Power BI"]);
  });

  it("extracts sales, marketing, design, and commerce tools", () => {
    expect(
      extractTechnologyKeywords(
        "Run campaigns in HubSpot and Google Analytics 4, improve SEO, create assets in Figma and Adobe Photoshop, and manage Shopify.",
      ),
    ).toEqual([
      "HubSpot",
      "Google Analytics",
      "SEO",
      "Figma",
      "Adobe Photoshop",
      "Shopify",
    ]);
  });

  it("extracts healthcare, engineering, and construction systems", () => {
    expect(
      extractTechnologyKeywords(
        "Integrate Cerner through HL7 and FHIR, while coordinating AutoCAD, Revit, and Primavera P6 deliverables.",
      ),
    ).toEqual(["Cerner", "HL7", "FHIR", "AutoCAD", "Revit", "Primavera P6"]);
  });

  it("extracts people, legal, education, and operations platforms", () => {
    expect(
      extractTechnologyKeywords(
        "Administer Workday, SAP SuccessFactors, and Employment Hero; support LexisNexis, Moodle, Jira, and ServiceNow.",
      ),
    ).toEqual([
      "Workday",
      "SAP SuccessFactors",
      "Employment Hero",
      "LexisNexis",
      "Moodle",
      "Jira",
      "ServiceNow",
    ]);
  });

  it("supports aliases and punctuation-heavy terms without matching ordinary prose", () => {
    expect(
      extractTechnologyKeywords(
        "Use C#, C++, .NET, NodeJS, K8s, and CI / CD. Candidates should go above and beyond for this epic opportunity.",
      ),
    ).toEqual(["C#", "C++", ".NET", "Node.js", "Kubernetes", "CI/CD"]);
  });
});
