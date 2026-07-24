#!/usr/bin/env python3
"""
seed_interview_data.py
----------------------
1. 清除历史遗留的多余分类、题目和答案，保持数据库干净。
2. 注入 5 个最通用的全行业分类：
   - AY (About Yourself)
   - EX (Experience)
   - BE (Behaviour)
   - RO (Role-specific)
   - CO (Company)
3. 为每个分类创建 5 道通用的高频面试题。
4. 注入作者官方解析和社区精选答案。

用法:
    python3 seed_interview_data.py --user-email YOUR@EMAIL.COM
"""
import argparse
import sys
import os

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "backend"))

from backend.services.shared.database import SessionLocal
from backend.services.shared.models import (
    User,
    InterviewCategory,
    InterviewQuestion,
    InterviewCollection,
    InterviewCollectionQuestion,
    QuestionAnswer,
    UserQuestion,
    UserCollection,
    PracticeRecord,
)

SEED_DATA = [
    # ── 1. About You (AY) ──
    {
        "category": "01 About You",
        "collection_title": "About You & Career Goals",
        "collection_slug": "about-you-essentials",
        "collection_desc": "Essential questions about your background, strengths, weaknesses, and future career path.",
        "questions": [
            {
                "title": "Walk me through your resume / Introduce yourself.",
                "author_answer": "Structure your intro chronologically or via Present-Past-Future: (1) Present: briefly state your current role and major focus, (2) Past: highlight 1 or 2 key accomplishments or experiences, (3) Future: explain why this specific opportunity is the perfect next step. Keep it under 2 minutes and tailor it directly to the job description.",
                "community_answers": [
                    "I always use the 30-60-90 second rule. 30s on my current status, 30s on a major career milestone, and 30s on why this team's mission aligns with my future.",
                    "Focus on the 'Why' behind your career choices, not just listing job titles. Explain what motivated each transition.",
                ],
            },
            {
                "title": "What are your greatest strengths and weaknesses?",
                "author_answer": "For strengths: choose 1-2 traits highly relevant to the role (e.g. analytical problem-solving, structured communication) and back them up with a mini-example. For weaknesses: pick a genuine area of improvement (not a fake weakness like 'perfectionism'), explain how it has impacted you, and demonstrate the active steps you are taking to overcome it.",
                "community_answers": [
                    "My weakness is public speaking. To improve, I joined Toastmasters and started presenting small updates in weekly team syncs, which built my confidence.",
                    "I tie my strength to a tangible business outcome. For example, my attention to detail helped reduce reporting errors on my team by 15%.",
                ],
            },
            {
                "title": "Where do you see yourself in five years?",
                "author_answer": "Show ambition paired with realism. State that you want to master the current role first, then expand your impact either by taking on deeper domain expertise or mentoring/leading others. Emphasise that you want this growth to happen within the company you are interviewing for.",
                "community_answers": [
                    "I want to develop deep expertise in this function first, then transition into a leadership or strategic mentoring role as the department grows.",
                ],
            },
            {
                "title": "Why are you interested in this position and our company?",
                "author_answer": "Show you did your homework. Align your answer with: (1) the company's mission/product/recent news that genuinely excites you, (2) the specific challenges of the role and how your skills can solve them, and (3) your personal values or career direction matching their culture.",
                "community_answers": [
                    "I followed your recent expansion. Your focus on user-centric design aligns with my belief that simple workflows drive customer retention.",
                ],
            },
            {
                "title": "How do you handle pressure, stress, and tight deadlines?",
                "author_answer": "Explain your proactive coping mechanisms: (1) prioritisation and triage (breaking projects into smaller milestones), (2) clear communication (managing expectations with stakeholders early), and (3) maintaining focus (blocking out distractions). Share a quick example where you successfully delivered under pressure.",
                "community_answers": [
                    "I write down everything, categorise by urgency, and communicate immediately if any deadline is at risk. Transparency eliminates most stress.",
                ],
            },
        ],
    },

    # ── 2. Experience (EX) ──
    {
        "category": "02 Experience",
        "collection_title": "Experience & Key Projects",
        "collection_slug": "experience-essentials",
        "collection_desc": "General questions regarding project execution, workflow efficiency, key achievements, and problem-solving.",
        "questions": [
            {
                "title": "Walk me through your most successful professional project.",
                "author_answer": "Structure clearly: (1) The Challenge: what was the problem and business impact? (2) Your Role: what did you lead or execute? (3) The Execution: how did you handle bottlenecks or trade-offs? (4) The Outcome: share tangible, quantitative metrics of success.",
                "community_answers": [
                    "I outline the project lifecycle from initiation to post-mortem. Sharing a metric (e.g. 15% cost reduction or 20% time savings) is crucial.",
                ],
            },
            {
                "title": "How do you structure your typical workflow or pipeline to stay organized?",
                "author_answer": "Explain your system: prioritizing tasks (e.g. Eisenhower Matrix), tracking progress (Kanban, calendar, lists), managing incoming requests, and setting boundaries for deep focus. Show you are organized, predictable, and reliable.",
                "community_answers": [
                    "I start each week with 3 core priorities. Everything else is scheduled around them. It prevents reactive firefighting.",
                ],
            },
            {
                "title": "Describe how you gather requirements or feedback before starting a new task.",
                "author_answer": "Detail your process: identifying key stakeholders, asking open-ended clarifying questions, documenting expectations, and confirming alignment before starting work. This prevents costly misalignment and rework.",
                "community_answers": [
                    "I always draft a brief 1-page summary of expectations and ask stakeholders to sign off before starting execution. It saves hours of revisions.",
                ],
            },
            {
                "title": "How do you balance quality and speed when working under tight deadlines?",
                "author_answer": "Explain how you handle trade-offs: (1) defining what 'good enough' or the MVP looks like, (2) focusing on core critical paths, (3) automating repetitive parts of the task, and (4) communicating transparently with stakeholders about what can be delivered.",
                "community_answers": [
                    "I negotiate a phased approach: deliver the high-impact core requirements on time, then refine and polish secondary details in phase two.",
                ],
            },
            {
                "title": "Tell me about a time you improved a process or workflow.",
                "author_answer": "Focus on identifying inefficiency, proposing a streamlined alternative, driving adoption, and measuring the resulting time or cost savings.",
                "community_answers": [
                    "I automated a manual weekly report using Python scripts, saving our team 3 hours every week.",
                ],
            },
        ],
    },

    # ── 3. Behaviour (BE) ──
    {
        "category": "Behaviour",
        "collection_title": "Behavioral Story Playbook",
        "collection_slug": "behavioral-stories-essentials",
        "collection_desc": "STAR-based questions designed to probe teamwork, conflict resolution, goal achievement, and resilience.",
        "questions": [
            {
                "title": "Tell me about a time you handled a difficult conflict at work.",
                "author_answer": "Use the STAR format. Set the situation without speaking negatively about others. Explain the root cause of the disagreement. Detail your action: listening to their side privately, identifying shared objectives, and proposing a compromise. End with a positive result and a lesson learned.",
                "community_answers": [
                    "I focused on data over opinions. By laying out the options side-by-side, we objectively agreed on a path forward, preserving our relationship.",
                    "I scheduled a brief coffee chat to clear the air. We realized it was a misunderstanding of role boundaries, which we quickly clarified.",
                ],
            },
            {
                "title": "Describe a situation where you had to make a tough decision under pressure.",
                "author_answer": "Detail a choice where information was incomplete or stakes were high. Focus on your logical decision-making process: what signals did you use, how did you assess risks, who did you consult, and how did you communicate the final decision. Show accountability for the outcome.",
                "community_answers": [
                    "I weighed the cost of delay against the risk of an imperfect launch. We made a calculated release with a rollback plan, saving crucial client trust.",
                ],
            },
            {
                "title": "Tell me about a time you made a mistake. How did you handle it?",
                "author_answer": "Take immediate ownership without excuses. Explain: (1) how you discovered the error, (2) how you immediately acted to mitigate the damage and communicated transparently with affected parties, and (3) what systematic changes you implemented to prevent it from happening again.",
                "community_answers": [
                    "I owned up immediately, which let the team patch the error within an hour. I then built a checklist that became standard for all future rollouts.",
                ],
            },
            {
                "title": "Give an example of working with someone whose working style was very different from yours.",
                "author_answer": "Show adaptability and empathy. Explain their style (e.g. highly analytical/introverted vs your collaborative/verbal style). Detail how you adapted your communication (e.g. sending written agendas beforehand) to collaborate effectively and deliver a successful result.",
                "community_answers": [
                    "I adjusted from ad-hoc syncs to structured weekly briefs, which matched their preference for deep focus. Our joint output increased significantly.",
                ],
            },
            {
                "title": "Describe a major professional goal you achieved. How did you plan it?",
                "author_answer": "Show your methodology for planning and execution. Talk about setting clear milestones, tracking progress, managing resources or bottlenecks, and keeping stakeholders aligned. Emphasise how you measured success at the end.",
                "community_answers": [
                    "I broke a 6-month goal into 2-week milestones. Having micro-targets kept the project visible and allowed us to adjust early when delays occurred.",
                ],
            },
        ],
    },

    # ── 4. Role-specific (RO) ──
    {
        "category": "04 Role-specific",
        "collection_title": "Role-Specific & Domain Mastery",
        "collection_slug": "role-specific-essentials",
        "collection_desc": "Probing domain expertise, technical capabilities, best practices, and role-specific problem-solving.",
        "questions": [
            {
                "title": "How do you approach learning a new domain, tool, or stack quickly?",
                "author_answer": "Explain a structured learning strategy: (1) identifying core fundamentals, (2) building a hands-on POC or mini-project, (3) referencing documentation and best practices, and (4) seeking feedback from experts.",
                "community_answers": [
                    "I build a small end-to-end prototype to learn by doing. Reading docs alone isn't enough; hands-on trial uncovers edge cases fast.",
                ],
            },
            {
                "title": "Walk me through how you design or execute a solution for a core requirement in your role.",
                "author_answer": "Focus on structured execution: understanding user/business requirements, breaking down components, evaluating trade-offs, testing, and monitoring.",
                "community_answers": [
                    "I start with the end outcome in mind, draw out the data flow or process map, and validate assumptions before writing code or finalizing designs.",
                ],
            },
            {
                "title": "How do you ensure high quality, accuracy, and standards in your work?",
                "author_answer": "Detail your quality assurance practices: peer reviews, automated testing/validation, checklist verification, and continuous feedback loops.",
                "community_answers": [
                    "I treat peer code reviews and pre-flight checklists as essential, non-negotiable steps before shipping any work.",
                ],
            },
            {
                "title": "How do you handle changing requirements or scope creep during execution?",
                "author_answer": "Demonstrate agility and clear stakeholder communication: evaluating the impact on timeline and resources, resetting expectations transparently, and agreeing on trade-offs.",
                "community_answers": [
                    "I highlight the cost of scope changes early: 'We can add X feature, but it will delay Y deliverable by 3 days.' This lets stakeholders make informed choices.",
                ],
            },
            {
                "title": "Explain a complex professional concept from your domain to someone non-technical.",
                "author_answer": "Choose a concept (e.g. API integration, data caching, funnel optimization). Avoid jargon entirely. Use a simple, relatable analogy (e.g. restaurant ordering, traffic lights). Highlight why the concept matters to the business in plain language.",
                "community_answers": [
                    "I explain caching like keeping a notepad on your desk instead of walking to the archive room every time you need common info.",
                ],
            },
        ],
    },


    # ── 6. Company (CO) ──
    {
        "category": "06 Company",
        "collection_title": "Company & Market Alignment",
        "collection_slug": "company-alignment-essentials",
        "collection_desc": "Demonstrating your pre-interview preparation, industry knowledge, and long-term interest in the company.",
        "questions": [
            {
                "title": "What do you know about our competitors and target market?",
                "author_answer": "Show active research. Identify 2-3 main competitors, outline their strengths/weaknesses compared to the company you are interviewing with, and name the target customer segments. Explain how you see this company winning in the marketplace.",
                "community_answers": [
                    "I look at user feedback for your competitors. Their main complaint is complexity, which highlights your product's simplicity as a key advantage.",
                ],
            },
            {
                "title": "What questions do you have for us?",
                "author_answer": "Always have questions prepared. Avoid basic questions easily answered by their website. Ask about: (1) team culture and daily dynamics, (2) definition of success in the first 90 days, or (3) strategic challenges/opportunities facing the department.",
                "community_answers": [
                    "I love asking: 'What does a top performer in this role do that distinguishes them from an average performer?' It shows drive.",
                    "Ask about the biggest pain point the team is facing right now that they hope the new hire will help resolve.",
                ],
            },
            {
                "title": "How do you keep up with changes, news, and trends in your industry?",
                "author_answer": "Name specific, high-quality sources: newsletters, industry reports, thought leaders, podcasts, or online communities. Explain how you apply this knowledge to your daily work or project planning.",
                "community_answers": [
                    "I dedicate 30 minutes every morning to industry newsletters and trade publications. It helps me spot shifts before they impact projects.",
                ],
            },
            {
                "title": "If you started on day one, what would you prioritize in your first 30 days?",
                "author_answer": "Focus on learning and alignment over making changes: (1) understand team dynamics and workflows, (2) build relationships with cross-functional partners, (3) absorb documentation/history, and (4) look for a low-risk 'quick win' to deliver early value.",
                "community_answers": [
                    "My goal is to listen and learn. I wouldn't propose major shifts until I've mapped the current processes and spoken to the team.",
                ],
            },
            {
                "title": "What is one recent initiative of our company that stood out to you and why?",
                "author_answer": "Reference a recent launch, marketing campaign, partnership, or community initiative. Explain why you find it strategically interesting or how it reflects the company's core values.",
                "community_answers": [
                    "Your recent focus on sustainability in packaging caught my eye. It shows your corporate values are integrated into the actual product line.",
                ],
            },
        ],
    },
]


def seed(user_email: str | None = None):
    db = SessionLocal()
    try:
        # Find seed user
        if user_email:
            seed_user = db.query(User).filter(User.email == user_email).first()
            if not seed_user:
                print(f"❌ User not found: {user_email}")
                return
        else:
            seed_user = db.query(User).filter(User.role == "admin").first()
            if not seed_user:
                seed_user = db.query(User).first()
            if not seed_user:
                print("❌ No users found in database.")
                return

        print(f"🧹 Cleaning old practice data and categories for user: {seed_user.email}...")

        # ── Clean old categories, questions, and associated answers to prevent clutter ──
        # Find category IDs owned by this user
        cats = db.query(InterviewCategory).filter_by(user_id=seed_user.id).all()
        cat_ids = [c.id for c in cats]

        # Delete practice records, answers, and links associated with user questions
        q_ids = [q.id for q in db.query(InterviewQuestion).filter(InterviewQuestion.category_id.in_(cat_ids)).all()]
        
        if q_ids:
            db.query(PracticeRecord).filter(PracticeRecord.question_id.in_(q_ids)).delete(synchronize_session=False)
            db.query(QuestionAnswer).filter(QuestionAnswer.question_id.in_(q_ids)).delete(synchronize_session=False)
            db.query(UserQuestion).filter(UserQuestion.question_id.in_(q_ids)).delete(synchronize_session=False)
            db.query(InterviewCollectionQuestion).filter(InterviewCollectionQuestion.question_id.in_(q_ids)).delete(synchronize_session=False)
            db.query(InterviewQuestion).filter(InterviewQuestion.id.in_(q_ids)).delete(synchronize_session=False)

        # Delete categories themselves
        if cat_ids:
            db.query(InterviewCategory).filter(InterviewCategory.id.in_(cat_ids)).delete(synchronize_session=False)

        db.flush()
        print("✅ Clean complete. Seeding new general collections & questions...")

        total_questions = 0
        total_answers = 0
        total_collections = 0

        for block in SEED_DATA:
            cat_name = block["category"]
            
            # Create category
            category = InterviewCategory(user_id=seed_user.id, name=cat_name)
            db.add(category)
            db.flush()
            print(f"  📁 Created Category: {cat_name}")

            # Create Collection
            collection = (
                db.query(InterviewCollection)
                .filter_by(slug=block["collection_slug"])
                .first()
            )
            if collection:
                # Clean old questions linked to this collection
                db.query(InterviewCollectionQuestion).filter_by(collection_id=collection.id).delete(synchronize_session=False)
                collection.title = block["collection_title"]
                collection.description = block["collection_desc"]
            else:
                collection = InterviewCollection(
                    title=block["collection_title"],
                    slug=block["collection_slug"],
                    description=block["collection_desc"],
                    creator_user_id=seed_user.id,
                    collection_type="community",
                    status="published",
                    price_coins=0,
                )
                db.add(collection)
                db.flush()
                total_collections += 1
                
            print(f"  📦 Collection: {block['collection_title']}")

            # User collection mapping
            existing_sub = (
                db.query(UserCollection)
                .filter_by(user_id=seed_user.id, collection_id=collection.id)
                .first()
            )
            if not existing_sub:
                db.add(UserCollection(
                    user_id=seed_user.id,
                    collection_id=collection.id,
                    is_purchased=False,
                ))

            # Seed Questions
            for idx, q_data in enumerate(block["questions"]):
                title = q_data["title"]

                question = InterviewQuestion(
                    user_id=seed_user.id,
                    category_id=category.id,
                    title=title,
                    frequency="common",
                    importance_score=4,
                    author_importance_score=4,
                    source_collection_id=collection.id,
                    is_library_copy=False,
                )
                db.add(question)
                db.flush()
                total_questions += 1
                print(f"    ✨ Question: {title[:50]}...")

                # UserQuestion mapping
                db.add(UserQuestion(
                    user_id=seed_user.id,
                    question_id=question.id,
                    collection_id=collection.id,
                    status="active",
                ))

                # Collection link
                db.add(InterviewCollectionQuestion(
                    collection_id=collection.id,
                    question_id=question.id,
                    sort_order=idx,
                    is_approved=True,
                ))

                # Author reference answer
                if q_data.get("author_answer"):
                    db.add(QuestionAnswer(
                        question_id=question.id,
                        author_user_id=seed_user.id,
                        source="author",
                        answer_type="reference",
                        status="published",
                        title="Official Reference Answer",
                        body=q_data["author_answer"],
                        is_recommended=False,
                        metadata_={"seeded": True},
                    ))
                    total_answers += 1

                # Community answers
                for i, comm_body in enumerate(q_data.get("community_answers", [])):
                    db.add(QuestionAnswer(
                        question_id=question.id,
                        author_user_id=seed_user.id,
                        source="community",
                        answer_type="reference",
                        status="published",
                        title=f"Featured Community Answer {i + 1}",
                        body=comm_body,
                        is_recommended=True,
                        recommended_by_user_id=seed_user.id,
                        metadata_={"seeded": True},
                    ))
                    total_answers += 1

        db.commit()
        print()
        print("=" * 60)
        print(f"🎉 Clean Seed Successful!")
        print(f"   Categories seeded : {len(SEED_DATA)}")
        print(f"   Questions seeded  : {total_questions}")
        print(f"   Answers seeded    : {total_answers}")
        print("=" * 60)

    except Exception as e:
        db.rollback()
        print(f"❌ Error during seed: {e}")
        raise
    finally:
        db.close()


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Seed generic interview questions")
    parser.add_argument(
        "--user-email",
        type=str,
        default=None,
        help="Email of the user to seed data for",
    )
    args = parser.parse_args()
    seed(user_email=args.user_email)
