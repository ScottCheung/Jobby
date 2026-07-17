<!-- @format -->

Beginner / Fundamentals (1-25)

What is ASP.NET Core Web API, and how does it differ from ASP.NET MVC?
Explain the request-response lifecycle in an ASP.NET Core Web API application.
What are the main HTTP verbs (methods) used in Web APIs, and when would you use each?
What is REST, and how do you design RESTful APIs in ASP.NET Core?
Explain routing in ASP.NET Core Web API. Compare attribute routing vs. conventional routing.
What is model binding? Describe attributes like [FromBody], [FromQuery], [FromRoute], and [FromHeader].
What is the purpose of the [ApiController] attribute?
How do you create a basic Web API controller and action method?
What are Data Transfer Objects (DTOs), and why are they used in Web APIs?
Explain content negotiation in ASP.NET Core Web API.
What is dependency injection (DI) in ASP.NET Core, and how is it configured?
Describe the differences between Transient, Scoped, and Singleton service lifetimes.
How do you return different HTTP status codes (e.g., 200, 201, 204, 400, 404) from a controller?
What is the difference between IActionResult and ActionResult<T>?
How does JSON serialization work in ASP.NET Core (System.Text.Json vs. Newtonsoft.Json)?
What is middleware, and how does the middleware pipeline work?
How do you handle exceptions globally in ASP.NET Core Web API?
What is CORS, and how do you configure it in ASP.NET Core?
Explain model validation and custom validation attributes.
How do you implement basic logging in ASP.NET Core?
What is the Program.cs file used for in .NET 6+ minimal hosting?
How do you add Swagger/OpenAPI documentation to a Web API?
What are minimal APIs in .NET, and when would you use them instead of controllers?
How do you bind configuration settings (appsettings.json) into classes?
Explain the difference between ControllerBase and Controller classes.

Intermediate (26-60)

How does the Repository Pattern work with ASP.NET Core Web API and EF Core?
What is the Unit of Work pattern, and how is it used?
How do you implement API versioning (URL, query string, header-based)?
Describe action filters and how to create custom ones.
What are authorization filters vs. exception filters?
How do you implement JWT Bearer authentication?
Explain the role of IHttpClientFactory for consuming other APIs.
How do you handle file uploads in a Web API?
What is response caching, and how do you implement it?
How would you implement pagination, sorting, and filtering?
Explain rate limiting in ASP.NET Core.
What is Health Checks, and how do you set it up?
How do you implement background tasks or hosted services?
Describe SignalR and its use with Web APIs.
How does dependency injection work with controllers and services?
What are Problem Details (RFC 7807) and how are they used for errors?
How do you secure APIs with API keys or custom authentication?
Explain middleware order and common pitfalls (e.g., CORS before/after auth).
What is auto-mapping (AutoMapper), and why use it with DTOs?
How do you implement partial updates (PATCH) with JsonPatchDocument?
Describe request size limits and how to configure them.
How do you test Web APIs (unit, integration)? Mention tools like xUnit, Moq.
What is the difference between synchronous and asynchronous controllers/actions?
How do you handle large request/response payloads efficiently?
Explain custom middleware creation and when to use IMiddleware.
What are endpoint conventions and route groups in minimal APIs?
How do you implement caching with IMemoryCache or distributed cache?
Describe gRPC vs. REST in .NET Core context.
How do you configure HTTPS and HSTS?
What is output caching in newer .NET versions?
How do you handle concurrency (e.g., ETags, optimistic locking)?
Explain DelegatingHandlers and message handlers.
What is the difference between Use and Run in middleware?
How do you implement feature flags?
Describe clean architecture or layered architecture patterns for Web APIs.

Advanced / Senior (61-100)

How would you debug N+1 query problems with EF Core in a Web API?
Explain performance optimization techniques for high-traffic Web APIs.
How do you implement distributed tracing (OpenTelemetry)?
What are the trade-offs of offset vs. cursor-based pagination?
How do you design idempotent APIs?
Describe microservices communication patterns using Web APIs.
How would you handle eventual consistency in distributed systems?
Explain circuit breakers, retries, and resilience patterns (Polly).
What is vertical slice architecture, and how does it apply to APIs?
How do you secure APIs in a multi-tenant environment?
Describe API gateway patterns and their benefits.
How do you implement event-driven architecture alongside Web APIs?
What challenges arise with GraphQL vs. REST in .NET?
How do you monitor and observe production Web APIs (metrics, logs)?
Explain Kestrel configuration and limits (e.g., request body size).
How do you handle database migrations in a zero-downtime deployment?
Describe strategies for blue-green or canary deployments of APIs.
What are the considerations for containerizing (Docker) a Web API?
How do you implement domain events in a Web API service?
Explain the differences between MediatR (CQRS) and traditional service layers.
How do you optimize cold starts and startup time?
What security best practices (OWASP) apply specifically to .NET Web APIs?
How would you implement soft deletes and auditing?
Describe strategies for API backward compatibility.
How do you handle long-running requests or background jobs?
What is the impact of middleware vs. filters vs. interceptors?
How do you benchmark and profile API endpoints?
Explain source generators in modern .NET for APIs.
How do you implement real-time features beyond SignalR?
What are common pitfalls with async/await in high-load scenarios?
How do you design APIs for mobile clients with offline support?
Describe internationalization (i18n) in Web APIs.
How do you implement request correlation IDs across services?
What role does Minimal API play in high-performance scenarios?
How do you handle schema evolution in databases with EF Core?
Explain rate limiting with distributed stores (Redis).
How would you migrate a legacy Web API to .NET 8/9+?
What are key considerations for public vs. internal APIs?
How do you implement contract-first development (e.g., with OpenAPI)?
Describe a complex production issue you faced with a Web API and how you resolved it (scenario-based).
