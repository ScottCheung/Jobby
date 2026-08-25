# Jobby Platform Test Links

> Verified: 26 Aug 2026  
> Purpose: platform detection + autofill regression testing.
>
> **Important:** Job ads expire quickly. For ATS platforms I prioritised direct application/job pages. For Indeed and Glassdoor, native listings are often indexed/redirected inconsistently, so I included stable search entry points as fallback discovery links. SEEK links below are current direct job pages.

## 1. SEEK

1. [NinjaTech AI — Senior Full Stack Engineer](https://au.seek.com/job/93941097)
2. [The Onset — Software Engineer](https://au.seek.com/job/94120995)
3. [Opus Recruitment Solutions — AI Software Engineer](https://au.seek.com/job/94159899)
4. [Coadys Personnel — Software Engineer (Developer)](https://au.seek.com/job/93953663)
5. [BioScout — Full Stack Software Engineer](https://au.seek.com/job/94020228)

**Detection:** `seek.com`, `seek.com.au`, `au.seek.com`

---

## 2. LinkedIn

1. [Stake — Software Engineer](https://au.linkedin.com/jobs/view/software-engineer-at-stake-4458160309)
2. [CORTO — Software Engineer (.NET/AI)](https://au.linkedin.com/jobs/view/software-engineer-net-ai-at-corto-4455221406)
3. [Macquarie Group — Software Engineer](https://au.linkedin.com/jobs/view/software-engineer-at-macquarie-group-4448451118)
4. [Propeller — Software Engineer](https://au.linkedin.com/jobs/view/software-engineer-at-propeller-4434953356)
5. [weave. Recruitment — Software Engineer](https://au.linkedin.com/jobs/view/software-engineer-at-weave-recruitment-4452894753)

**Detection:** `linkedin.com/jobs`

---

## 3. Indeed

These are stable search entry points; open a result that uses Indeed Apply when testing autofill.

1. [Software Engineer — Sydney](https://au.indeed.com/jobs?q=software+engineer&l=Sydney+NSW)
2. [Frontend Developer — Sydney](https://au.indeed.com/jobs?q=frontend+developer&l=Sydney+NSW)
3. [React Developer — Sydney](https://au.indeed.com/jobs?q=react+developer&l=Sydney+NSW)
4. [.NET Developer — Sydney](https://au.indeed.com/jobs?q=.net+developer&l=Sydney+NSW)
5. [Full Stack Developer — Sydney](https://au.indeed.com/jobs?q=full+stack+developer&l=Sydney+NSW)

**Detection:** `indeed.com`, `au.indeed.com`

---

## 4. Glassdoor

These are stable discovery pages because individual Glassdoor job URLs frequently expire or redirect.

1. [Software Engineer — Sydney](https://www.glassdoor.com.au/Job/sydney-software-engineer-jobs-SRCH_IL.0,6_IC2235932_KO7,24.htm)
2. [Frontend Developer — Sydney](https://www.glassdoor.com.au/Job/sydney-frontend-developer-jobs-SRCH_IL.0,6_IC2235932_KO7,25.htm)
3. [React Developer — Sydney](https://www.glassdoor.com.au/Job/sydney-react-developer-jobs-SRCH_IL.0,6_IC2235932_KO7,22.htm)
4. [.NET Developer — Sydney](https://www.glassdoor.com.au/Job/sydney-net-developer-jobs-SRCH_IL.0,6_IC2235932_KO7,20.htm)
5. [Full Stack Developer — Sydney](https://www.glassdoor.com.au/Job/sydney-full-stack-developer-jobs-SRCH_IL.0,6_IC2235932_KO7,27.htm)

**Detection:** `glassdoor.com`, `glassdoor.com.au`

---

## 5. Greenhouse

These are especially useful for autofill because they expose real application forms with text inputs, selects, resume upload, custom questions, etc.

1. [Easygo — Senior Frontend Engineer, KICK Video/Ads](https://job-boards.greenhouse.io/easygo/jobs/5202608007)
2. [IMC — Software Engineer, Application Platform](https://job-boards.greenhouse.io/imc/jobs/4918138101)
3. [Dubber — Software Engineer](https://job-boards.greenhouse.io/dubber/jobs/6118638004)
4. [Canonical — Web Frontend Engineer](https://boards.greenhouse.io/embed/job_app?for=canonical&token=5150422)
5. [Optiver — Expression of Interest, Software Engineer](https://job-boards.greenhouse.io/optiverprivate/jobs/7038301002)

**Detection:** `greenhouse.io`, `boards.greenhouse.io`

---

## 6. Lever

1. [UpGuard — Software Engineer / Engineering jobs](https://jobs.lever.co/upguard?location=Sydney)
2. [SafetyCulture — Engineering jobs](https://jobs.lever.co/safetyculture-2?department=Engineering)
3. [Kasada — Engineering jobs](https://jobs.lever.co/kasada/)
4. [Objective Corporation — Sydney jobs](https://jobs.lever.co/objective?location=Sydney)
5. [Megaport — Technology jobs](https://jobs.lever.co/megaport/?department=Technology)

**Detection:** `jobs.lever.co`

> Tip: click **Apply** after opening each role to test the actual Lever application form.

---

## 7. Workday

1. [ResMed — Software Engineer JR_051411](https://resmed.wd3.myworkdayjobs.com/en-US/ResMed_External_Careers/job/Sydney-NSW-Australia/Software-Engineer_JR_051411)
2. [ResMed — Software Engineer JR_052271](https://resmed.wd3.myworkdayjobs.com/en-US/ResMed_External_Careers/job/Software-Engineer_JR_052271-1)
3. [ResMed — Graduate Software Engineer](https://resmed.wd3.myworkdayjobs.com/en-US/ResMed_External_Careers/job/Software-Engineer_JR_041169)
4. [KBR — Software Engineer](https://kbr.wd5.myworkdayjobs.com/en-US/KBR_Careers/job/Melbourne-Victoria-Australia/Software-Engineer_R2127145)
5. [Leidos — Junior Software Engineer](https://leidos.wd5.myworkdayjobs.com/en-US/External/job/Junior-Software-Engineer_R-00182914)

**Detection:** hostname contains `myworkdayjobs.com`; don't hardcode only `wd3` / `wd5` because Workday tenants use many `wd*` subdomains.

---

## 8. Ashby

1. [Workyard — Software Engineer (Sydney)](https://jobs.ashbyhq.com/workyard/b30b1976-3aad-47ce-a043-42e058e3dbdf)
2. [Powerline — Senior Software Engineer, Australia](https://jobs.ashbyhq.com/powerline/4c721307-bb99-4cff-87ce-9d7d5ad25cfb)
3. [Airtasker — Senior Software Engineer](https://jobs.ashbyhq.com/airtasker/9c673176-8d48-4c7e-af79-3fd96ecc5b84)
4. [coreflow — Software Engineer](https://jobs.ashbyhq.com/coreflow/480802c3-8675-4560-87c7-bf4d953b2408)
5. [NinjaTech AI — Full Stack Software Engineer, Agentic AI](https://jobs.ashbyhq.com/ninjatech.ai/5d0158a0-b9b1-46ce-b78c-995b0c2e036e)

**Detection:** `jobs.ashbyhq.com`

---

## 9. SmartRecruiters

1. [carsales — Senior Software Engineer](https://jobs.smartrecruiters.com/carsales/744000121067717-senior-software-engineer)
2. [SEEK — Software Engineer](https://jobs.smartrecruiters.com/SEEK/744000117771106-software-engineer)
3. [Luxury Escapes — Software Engineer](https://jobs.smartrecruiters.com/LuxuryEscapes/6000000000804422-software-engineer)
4. [NCS Australia — Software Engineer, Senior/Mid](https://jobs.smartrecruiters.com/NCSAustralia/6000000001218612-software-engineer-senior-mid-level)
5. [Visa — Software Engineer](https://jobs.smartrecruiters.com/visa/744000120015357-software-engineer)

**Detection:** `jobs.smartrecruiters.com`

---

## 10. Taleo

Taleo is older and many employers are migrating away from it, but it is useful for testing legacy enterprise forms.

1. [CAPPS — Web Developer](https://capps.taleo.net/careersection/ex/jobdetail.ftl?job=00058916)
2. [CAPPS — Applications Architect](https://capps.taleo.net/careersection/ex/jobdetail.ftl?job=00054560)
3. [CAPPS — Contract Developer](https://capps.taleo.net/careersection/ex/jobdetail.ftl?job=00058821)
4. [CAPPS — Systems Analyst VI](https://capps.taleo.net/careersection/ex/jobdetail.ftl?job=00058714)
5. [CAPPS — Contract Specialist IV](https://capps.taleo.net/careersection/ex/jobdetail.ftl?job=00058210)

**Detection:** `taleo.net` plus paths such as `/careersection/.../jobdetail.ftl`

---

# Suggested Regression Order

For autofill development, I would test in this order:

1. Greenhouse
2. Lever
3. Ashby
4. SmartRecruiters
5. SEEK Quick Apply
6. LinkedIn Easy Apply
7. Workday
8. Indeed Apply
9. Taleo
10. Glassdoor / external redirects

The first four give you relatively repeatable forms. Workday and Taleo are much better stress tests for dynamic controls, multi-step flows, custom selects, uploads, and employer-specific questions.

## Useful test matrix

For each URL, record:

- Platform detected correctly
- Job title/company extracted
- Apply surface detected
- First/last name
- Email
- Phone + country code
- Location/address
- Resume upload
- LinkedIn/GitHub/portfolio
- Work authorization
- Visa sponsorship
- Salary expectation
- Notice period/start date
- Radio buttons
- Checkboxes
- Native select
- Custom combobox/listbox
- Multi-select
- Long-text/custom questions
- Required-field detection
- Next/Previous navigation
- Submit detection
- Unknown-field fallback
- No accidental submission
