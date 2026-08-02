type TechnologyRule = {
  label: string;
  pattern: RegExp;
};

// Keep this list intentionally conservative: a false positive is less useful
// than omitting a term that can be added in a later update.
const TECHNOLOGY_RULES: readonly TechnologyRule[] = [
  { label: "ASP.NET Core", pattern: /(?:^|[^A-Za-z0-9])ASP\.NET\s+Core(?:$|[^A-Za-z0-9])/i },
  { label: "Azure DevOps", pattern: /(?:^|[^A-Za-z0-9])Azure\s+DevOps(?:$|[^A-Za-z0-9])/i },
  { label: "GitHub Actions", pattern: /(?:^|[^A-Za-z0-9])GitHub\s+Actions(?:$|[^A-Za-z0-9])/i },
  { label: "GitLab CI/CD", pattern: /(?:^|[^A-Za-z0-9])GitLab\s+CI\s*\/\s*CD(?:$|[^A-Za-z0-9])/i },
  { label: "Microsoft SQL Server", pattern: /(?:^|[^A-Za-z0-9])Microsoft\s+SQL\s+Server(?:$|[^A-Za-z0-9])/i },
  { label: "Google Cloud", pattern: /(?:^|[^A-Za-z0-9])Google\s+Cloud(?:$|[^A-Za-z0-9])/i },
  { label: "Spring Boot", pattern: /(?:^|[^A-Za-z0-9])Spring\s+Boot(?:$|[^A-Za-z0-9])/i },
  { label: "React Native", pattern: /(?:^|[^A-Za-z0-9])React\s+Native(?:$|[^A-Za-z0-9])/i },
  { label: "Node.js", pattern: /(?:^|[^A-Za-z0-9])Node\.js(?:$|[^A-Za-z0-9])/i },
  { label: "Next.js", pattern: /(?:^|[^A-Za-z0-9])Next\.js(?:$|[^A-Za-z0-9])/i },
  { label: "Express.js", pattern: /(?:^|[^A-Za-z0-9])Express(?:\.js)?(?:$|[^A-Za-z0-9])/i },
  { label: "REST APIs", pattern: /(?:^|[^A-Za-z0-9])REST(?:ful)?\s+APIs?(?:$|[^A-Za-z0-9])/i },
  { label: "CI/CD", pattern: /(?:^|[^A-Za-z0-9])CI\s*\/\s*CD(?:$|[^A-Za-z0-9])/i },
  { label: "C#", pattern: /(?:^|[^A-Za-z0-9])C#(?:$|[^A-Za-z0-9])/i },
  { label: "C++", pattern: /(?:^|[^A-Za-z0-9])C\+\+(?:$|[^A-Za-z0-9])/i },
  { label: ".NET", pattern: /(?:^|[^A-Za-z0-9])\.NET(?:$|[^A-Za-z0-9])/i },
  { label: "JavaScript", pattern: /\bJavaScript\b/i },
  { label: "TypeScript", pattern: /\bTypeScript\b/i },
  { label: "Python", pattern: /\bPython\b/i },
  { label: "Java", pattern: /\bJava\b/i },
  { label: "Kotlin", pattern: /\bKotlin\b/i },
  { label: "Swift", pattern: /\bSwift\b/i },
  { label: "Dart", pattern: /\bDart\b/i },
  { label: "PHP", pattern: /\bPHP\b/i },
  { label: "Ruby", pattern: /\bRuby\b/i },
  { label: "Go", pattern: /\bGolang\b|\bGo\s+(?:programming|language)\b/i },
  { label: "Rust", pattern: /\bRust\b/i },
  { label: "SQL", pattern: /\bSQL\b/i },
  { label: "HTML", pattern: /\bHTML\b/i },
  { label: "CSS", pattern: /\bCSS\b/i },
  { label: "GraphQL", pattern: /\bGraphQL\b/i },
  { label: "gRPC", pattern: /\bgRPC\b/i },
  { label: "Angular", pattern: /\bAngular\b/i },
  { label: "React", pattern: /\bReact\b/i },
  { label: "Vue.js", pattern: /\bVue(?:\.js)?\b/i },
  { label: "Flutter", pattern: /\bFlutter\b/i },
  { label: "Django", pattern: /\bDjango\b/i },
  { label: "Flask", pattern: /\bFlask\b/i },
  { label: "FastAPI", pattern: /\bFastAPI\b/i },
  { label: "Laravel", pattern: /\bLaravel\b/i },
  { label: "AWS", pattern: /\bAWS\b/i },
  { label: "Azure", pattern: /\bAzure\b/i },
  { label: "Docker", pattern: /\bDocker\b/i },
  { label: "Kubernetes", pattern: /\bKubernetes\b/i },
  { label: "Terraform", pattern: /\bTerraform\b/i },
  { label: "Jenkins", pattern: /\bJenkins\b/i },
  { label: "Git", pattern: /\bGit\b/i },
  { label: "Linux", pattern: /\bLinux\b/i },
  { label: "PostgreSQL", pattern: /\bPostgreSQL\b/i },
  { label: "MySQL", pattern: /\bMySQL\b/i },
  { label: "MongoDB", pattern: /\bMongoDB\b/i },
  { label: "Redis", pattern: /\bRedis\b/i },
  { label: "DynamoDB", pattern: /\bDynamoDB\b/i },
  { label: "Oracle", pattern: /\bOracle\b/i },
  { label: "Kafka", pattern: /\bKafka\b/i },
  { label: "RabbitMQ", pattern: /\bRabbitMQ\b/i },
  { label: "Elasticsearch", pattern: /\bElasticsearch\b/i },
  { label: "Agile", pattern: /\bAgile\b/i },
  { label: "Scrum", pattern: /\bScrum\b/i },
  { label: "TDD", pattern: /\bTDD\b|test[- ]driven development/i },
  { label: "Microservices", pattern: /\bmicroservices?\b/i },
];

function cleanText(value: string | null | undefined): string {
  return (value || "").replace(/\s+/g, " ").trim();
}

export function extractTechnologyKeywords(value: string | null | undefined): string[] {
  const text = cleanText(value);
  if (!text) return [];

  return TECHNOLOGY_RULES.map((rule, order) => {
    const match = rule.pattern.exec(text);
    return match ? { label: rule.label, index: match.index, order } : undefined;
  })
    .filter((item): item is { label: string; index: number; order: number } => Boolean(item))
    .sort((left, right) => left.index - right.index || left.order - right.order)
    .map((item) => item.label)
    .filter((label, index, labels) => labels.indexOf(label) === index)
    .slice(0, 30);
}
