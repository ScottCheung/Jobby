import { describe, expect, it } from "vitest";
import {
  extractTechnologyKeywords,
  getSkillSearchTerms,
  mergeSkills,
} from "./technology-keywords";

describe("extractTechnologyKeywords", () => {
  it("returns catalog aliases when locating a normalized skill in the JD", () => {
    expect(getSkillSearchTerms("React")).toEqual([
      "React",
      "React.js",
      "ReactJS",
    ]);
    expect(getSkillSearchTerms("ReactJS")).toEqual([
      "ReactJS",
      "React",
      "React.js",
    ]);
  });

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
      "Google Analytics 4",
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

  it("extracts design, e-commerce, content management, and core workplace skills", () => {
    expect(
      extractTechnologyKeywords(
        "Looking for a Web Designer with UX, Responsive web design, E-commerce, Shopify, WordPress, SEO, Communication skills, UI design, and Time management.",
      ),
    ).toEqual([
      "Web Design",
      "UX",
      "Responsive Web Design",
      "E-commerce",
      "Shopify",
      "WordPress",
      "SEO",
      "Communication Skills",
      "UI Design",
      "Time Management",
    ]);
  });

  it("merges explicit DOM skills with text keywords, normalizing catalog hits and preserving novel skills", () => {
    const explicit = [
      "UX",
      "responsive web design",
      "WordPress",
      "InHouseCustomTool",
      "Communication skills",
    ];
    const textKeywords = ["Shopify", "HTML", "CSS", "WordPress"];

    expect(mergeSkills(explicit, textKeywords)).toEqual([
      "UX",
      "Responsive Web Design",
      "WordPress",
      "InHouseCustomTool",
      "Communication Skills",
      "Shopify",
      "HTML",
      "CSS",
    ]);
  });

  it("extracts modern cloud, data engineering, and agentic AI technologies", () => {
    const text = `
      Required Experience:
      - Expert Python Developer and Strong SQL Developer
      - Strong AWS Experience (Lambda, Glue, Fargate, RedShift)
      - Experience with Databricks (Delta Lake, Notebooks, SQL Analytics)
      - Kubernetes (Pod Management, Cluster Orchestration)
      - DevOps, CI/CD, Azure DevOps, Git
      - Agentic AI (LangGraph, MCP Servers, Agent Frameworks)
      - Data Handling (Pandas, NumPy, Apache Spark, Parquet)
    `;

    const keywords = extractTechnologyKeywords(text);
    expect(keywords).toContain("Python");
    expect(keywords).toContain("SQL");
    expect(keywords).toContain("AWS");
    expect(keywords).toContain("AWS Lambda");
    expect(keywords).toContain("AWS Glue");
    expect(keywords).toContain("AWS Fargate");
    expect(keywords).toContain("Amazon Redshift");
    expect(keywords).toContain("Databricks");
    expect(keywords).toContain("Delta Lake");
    expect(keywords).toContain("Kubernetes");
    expect(keywords).toContain("Pod Management");
    expect(keywords).toContain("Cluster Orchestration");
    expect(keywords).toContain("CI/CD");
    expect(keywords).toContain("Azure DevOps");
    expect(keywords).toContain("Git");
    expect(keywords).toContain("Agentic AI");
    expect(keywords).toContain("LangGraph");
    expect(keywords).toContain("MCP Server");
    expect(keywords).toContain("Agent Frameworks");
    expect(keywords).toContain("Pandas");
    expect(keywords).toContain("NumPy");
    expect(keywords).toContain("Apache Spark");
    expect(keywords).toContain("Parquet");
  });

  it("extracts comprehensive skills from multi-stack job descriptions", () => {
    const text = `
      Hiring: Senior .NET Developer
      We are looking for an experienced Senior .NET Developer with strong expertise in .NET Core/.NET 6+, C#, Microservices, REST APIs, Node.js, NestJS, AWS Cloud, and CI/CD practices.

      Key Skills:
      ✓ .NET Framework / .NET Core / C#
      ✓ Microservices & REST API Development
      ✓ Node.js & NestJS
      ✓ Kafka / IBM MQ
      ✓ SQL & NoSQL Databases
      ✓ AWS (Lambda, S3, IAM, CloudWatch, Step Functions)
      ✓ GitHub, GitHub Actions, TeamCity, UrbanCode Deploy
      ✓ Agile, Jira & Confluence

      Preferred: React.js, Next.js, TypeScript, Redux, Monitoring Tools (Grafana, Splunk), and Financial Services experience.
    `;

    const keywords = extractTechnologyKeywords(text);
    expect(keywords).toContain(".NET");
    expect(keywords).toContain(".NET Core");
    expect(keywords).toContain(".NET Framework");
    expect(keywords).toContain("C#");
    expect(keywords).toContain("Microservices");
    expect(keywords).toContain("REST APIs");
    expect(keywords).toContain("Node.js");
    expect(keywords).toContain("NestJS");
    expect(keywords).toContain("AWS");
    expect(keywords).toContain("CI/CD");
    expect(keywords).toContain("Kafka");
    expect(keywords).toContain("IBM MQ");
    expect(keywords).toContain("SQL");
    expect(keywords).toContain("NoSQL");
    expect(keywords).toContain("AWS Lambda");
    expect(keywords).toContain("Amazon S3");
    expect(keywords).toContain("IAM");
    expect(keywords).toContain("Amazon CloudWatch");
    expect(keywords).toContain("AWS Step Functions");
    expect(keywords).toContain("GitHub");
    expect(keywords).toContain("GitHub Actions");
    expect(keywords).toContain("TeamCity");
    expect(keywords).toContain("IBM UrbanCode");
    expect(keywords).toContain("Agile");
    expect(keywords).toContain("Jira");
    expect(keywords).toContain("Confluence");
    expect(keywords).toContain("React");
    expect(keywords).toContain("Next.js");
    expect(keywords).toContain("TypeScript");
    expect(keywords).toContain("Redux");
    expect(keywords).toContain("Grafana");
    expect(keywords).toContain("Splunk");
    expect(keywords).toContain("Financial Services");
  });

  it("extracts finely disambiguated frontend, mobile, and API skills", () => {
    const text = `
      - JavaScript (ES6+), React Hooks, Context API, JSX, Next.js App Router, Server Components, Vue Composition API.
      - HTML, Semantic HTML, DOM Manipulation, CSS Grid, Flexbox, CSS Animations.
      - Redux Toolkit, React Redux, API Design, API Integration, JSON:API, Apollo Client, Apollo Server, Android SDK, Android NDK.
    `;

    const keywords = extractTechnologyKeywords(text);
    expect(keywords).toContain("JavaScript");
    expect(keywords).toContain("ES6+");
    expect(keywords).toContain("React Hooks");
    expect(keywords).toContain("Context API");
    expect(keywords).toContain("JSX");
    expect(keywords).toContain("App Router");
    expect(keywords).toContain("React Server Components");
    expect(keywords).toContain("Composition API");
    expect(keywords).toContain("Semantic HTML");
    expect(keywords).toContain("DOM");
    expect(keywords).toContain("CSS Grid");
    expect(keywords).toContain("Flexbox");
    expect(keywords).toContain("CSS Animations");
    expect(keywords).toContain("Redux Toolkit");
    expect(keywords).toContain("React Redux");
    expect(keywords).toContain("API Design");
    expect(keywords).toContain("API Integration");
    expect(keywords).toContain("JSON:API");
    expect(keywords).toContain("Apollo Client");
    expect(keywords).toContain("Apollo Server");
    expect(keywords).toContain("Android SDK");
    expect(keywords).toContain("Android NDK");
  });

  it("extracts finely disambiguated infrastructure, networking, and security skills", () => {
    const text = `
      - Dockerfile, Docker Compose, Containerization, Ingress, Kubernetes Operator, Service Mesh, IaC.
      - Unix, Systemd, Git Flow, Version Control, TCP, UDP, CCNA, CCNP.
      - Security Architecture, Threat Hunting, Vulnerability Assessment, Red Teaming, Ethical Hacking, Log Analysis, OAuth 2.0, OpenID Connect, SSO, MFA, AppSec, XDR, Endpoint Protection.
    `;

    const keywords = extractTechnologyKeywords(text);
    expect(keywords).toContain("Dockerfile");
    expect(keywords).toContain("Docker Compose");
    expect(keywords).toContain("Containerization");
    expect(keywords).toContain("Kubernetes Ingress");
    expect(keywords).toContain("Kubernetes Operator");
    expect(keywords).toContain("Service Mesh");
    expect(keywords).toContain("Infrastructure as Code");
    expect(keywords).toContain("Unix");
    expect(keywords).toContain("Systemd");
    expect(keywords).toContain("Git Flow");
    expect(keywords).toContain("Version Control");
    expect(keywords).toContain("TCP");
    expect(keywords).toContain("UDP");
    expect(keywords).toContain("CCNA");
    expect(keywords).toContain("CCNP");
    expect(keywords).toContain("Security Architecture");
    expect(keywords).toContain("Threat Hunting");
    expect(keywords).toContain("Vulnerability Assessment");
    expect(keywords).toContain("Red Teaming");
    expect(keywords).toContain("Ethical Hacking");
    expect(keywords).toContain("Log Analysis");
    expect(keywords).toContain("OAuth 2.0");
    expect(keywords).toContain("OpenID Connect");
    expect(keywords).toContain("SSO");
    expect(keywords).toContain("MFA");
    expect(keywords).toContain("Application Security");
    expect(keywords).toContain("XDR");
    expect(keywords).toContain("Endpoint Protection");
  });

  it("extracts finely disambiguated data, AI/ML, and LLM skills", () => {
    const text = `
      - DataStax, ELK Stack, Cypher query, Firebase Auth, Supabase Storage.
      - Unity Catalog, Databricks Lakehouse, Snowpark, SnowSQL, Spark SQL, Spark Streaming, Kafka Streams, Confluent, Schema Registry.
      - Data Pipelines, Data Architecture, Data Lakehouse, Data Mesh, Data Lineage, ELT, Dimensional Modeling, Star Schema, Snowflake Schema, Data Vault, Erwin, DAX, Power Query.
      - LoRA, QLoRA, PEFT, RLAIF, Foundation Models, MCP Server, MCP Tool, AI Agents, Multi-agent systems, Hybrid Search, Vector Search, ChatGPT, GPT-4o, Transformers, Torchaudio, Model Deployment, Text Mining, RoBERTa, Object Detection, Image Segmentation.
    `;

    const keywords = extractTechnologyKeywords(text);
    expect(keywords).toContain("DataStax");
    expect(keywords).toContain("ELK Stack");
    expect(keywords).toContain("Cypher");
    expect(keywords).toContain("Firebase Auth");
    expect(keywords).toContain("Supabase Storage");
    expect(keywords).toContain("Unity Catalog");
    expect(keywords).toContain("Databricks Lakehouse");
    expect(keywords).toContain("Snowpark");
    expect(keywords).toContain("SnowSQL");
    expect(keywords).toContain("Spark SQL");
    expect(keywords).toContain("Spark Streaming");
    expect(keywords).toContain("Kafka Streams");
    expect(keywords).toContain("Confluent");
    expect(keywords).toContain("Schema Registry");
    expect(keywords).toContain("Data Pipelines");
    expect(keywords).toContain("Data Architecture");
    expect(keywords).toContain("Data Lakehouse");
    expect(keywords).toContain("Data Mesh");
    expect(keywords).toContain("Data Lineage");
    expect(keywords).toContain("ELT");
    expect(keywords).toContain("Dimensional Modeling");
    expect(keywords).toContain("Star Schema");
    expect(keywords).toContain("Snowflake Schema");
    expect(keywords).toContain("Data Vault");
    expect(keywords).toContain("Erwin");
    expect(keywords).toContain("DAX");
    expect(keywords).toContain("Power Query");
    expect(keywords).toContain("LoRA");
    expect(keywords).toContain("QLoRA");
    expect(keywords).toContain("PEFT");
    expect(keywords).toContain("RLAIF");
    expect(keywords).toContain("Foundation Models");
    expect(keywords).toContain("MCP Server");
    expect(keywords).toContain("MCP Tools");
    expect(keywords).toContain("AI Agents");
    expect(keywords).toContain("Multi-Agent Systems");
    expect(keywords).toContain("Hybrid Search");
    expect(keywords).toContain("Vector Search");
    expect(keywords).toContain("ChatGPT");
    expect(keywords).toContain("GPT-4");
    expect(keywords).toContain("Transformers");
    expect(keywords).toContain("Torchaudio");
    expect(keywords).toContain("Model Deployment");
    expect(keywords).toContain("Text Mining");
    expect(keywords).toContain("RoBERTa");
    expect(keywords).toContain("Object Detection");
    expect(keywords).toContain("Image Segmentation");
  });

  it("extracts finely disambiguated architecture, QA testing, documentation, and agile skills", () => {
    const text = `
      - Event Sourcing, CQRS, System Architecture, Software Design, Exploratory Testing, Acceptance Testing, Technical Writing, API Documentation, ITSM, Major Incident Management, Sprint Planning, Daily Standups, Scrum Master, Kanban Board.
    `;

    const keywords = extractTechnologyKeywords(text);
    expect(keywords).toContain("Event Sourcing");
    expect(keywords).toContain("CQRS");
    expect(keywords).toContain("System Architecture");
    expect(keywords).toContain("Software Design");
    expect(keywords).toContain("Exploratory Testing");
    expect(keywords).toContain("Acceptance Testing");
    expect(keywords).toContain("Technical Writing");
    expect(keywords).toContain("API Documentation");
    expect(keywords).toContain("ITSM");
    expect(keywords).toContain("Major Incident Management");
    expect(keywords).toContain("Sprint Planning");
    expect(keywords).toContain("Daily Standup");
    expect(keywords).toContain("Scrum Master");
    expect(keywords).toContain("Kanban Board");
  });

  it("handles compound terms appearing before standalone terms without false suppression", () => {
    const text = "We use GitHub Actions for deployment, and also host private repositories on GitHub.";
    const keywords = extractTechnologyKeywords(text);
    expect(keywords).toContain("GitHub Actions");
    expect(keywords).toContain("GitHub");
  });

  it("extracts backend, frontend, API, cloud, and DevOps skills requested", () => {
    const text = `
      Back End: .NET, .NET Core, ASP.NET Core, C#, backend services
      Front End: React, Next.js
      API: REST, OAuth, webhooks
      Architecture: Event-Driven, Microservices, Domain-Driven Design
      Cloud: AWS
      Infrastructure as Code: CloudFormation, CDK
      Containers: Docker, Kubernetes
      DevOps: CI/CD, GitHub Actions
      Observability: Prometheus, Grafana, ELK Stack, Datadog
    `;
    const keywords = extractTechnologyKeywords(text);
    expect(keywords).toContain(".NET");
    expect(keywords).toContain(".NET Core");
    expect(keywords).toContain("ASP.NET Core");
    expect(keywords).toContain("C#");
    expect(keywords).toContain("Backend Services");
    expect(keywords).toContain("React");
    expect(keywords).toContain("Next.js");
    expect(keywords).toContain("REST APIs");
    expect(keywords).toContain("OAuth 2.0");
    expect(keywords).toContain("Webhooks");
    expect(keywords).toContain("Event-Driven Architecture");
    expect(keywords).toContain("Microservices");
    expect(keywords).toContain("Domain-Driven Design");
    expect(keywords).toContain("AWS");
    expect(keywords).toContain("AWS CloudFormation");
    expect(keywords).toContain("AWS CDK");
    expect(keywords).toContain("Docker");
    expect(keywords).toContain("Kubernetes");
    expect(keywords).toContain("CI/CD");
    expect(keywords).toContain("GitHub Actions");
    expect(keywords).toContain("Prometheus");
    expect(keywords).toContain("Grafana");
    expect(keywords).toContain("ELK Stack");
    expect(keywords).toContain("Datadog");
  });

  it("extracts testing, AI/ML, Agentic AI, and data engineering skills requested", () => {
    const text = `
      Testing: TDD, unit testing, integration testing, API testing
      Quality Tools: JMeter, Selenium, Postman
      AI/ML & GenAI: LangChain, LangGraph, LlamaIndex, AutoGen, Semantic Kernel
      Agentic AI & GenAI: RAG, model evaluation, agent frameworks
      Data Engineering: AWS EMR, AWS Glue, Apache Flink, Amazon Kinesis, Data Pipelines, Distributed Data Processing
    `;
    const keywords = extractTechnologyKeywords(text);
    expect(keywords).toContain("TDD");
    expect(keywords).toContain("Unit Testing");
    expect(keywords).toContain("Integration Testing");
    expect(keywords).toContain("API Testing");
    expect(keywords).toContain("JMeter");
    expect(keywords).toContain("Selenium");
    expect(keywords).toContain("Postman");
    expect(keywords).toContain("LangChain");
    expect(keywords).toContain("LangGraph");
    expect(keywords).toContain("LlamaIndex");
    expect(keywords).toContain("AutoGen");
    expect(keywords).toContain("Semantic Kernel");
    expect(keywords).toContain("RAG");
    expect(keywords).toContain("Model Evaluation");
    expect(keywords).toContain("Agent Frameworks");
    expect(keywords).toContain("Amazon EMR");
    expect(keywords).toContain("AWS Glue");
    expect(keywords).toContain("Apache Flink");
    expect(keywords).toContain("Amazon Kinesis");
    expect(keywords).toContain("Data Pipelines");
    expect(keywords).toContain("Distributed Data Processing");
  });

  it("extracts TanStack, Nx, and monorepo technologies", () => {
    const text = `
      Required: Experience with TanStack (TanStack Query, TanStack Router, TanStack Table),
      NX monorepos, Turborepo, monorepo architectures, and modern frontend architectures.
    `;
    const keywords = extractTechnologyKeywords(text);
    expect(keywords).toContain("TanStack");
    expect(keywords).toContain("TanStack Query");
    expect(keywords).toContain("TanStack Router");
    expect(keywords).toContain("TanStack Table");
    expect(keywords).toContain("Nx");
    expect(keywords).toContain("Monorepo");
    expect(keywords).toContain("Turborepo");
  });
});


