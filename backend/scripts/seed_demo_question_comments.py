#!/usr/bin/env python3
"""Seed replaceable demo discussion data for an interview question."""

from __future__ import annotations

import argparse
import os
import random
import sys
from datetime import datetime, timedelta, timezone

from sqlalchemy import delete, select

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from services.shared.database import SessionLocal
from services.shared.models import (
    InterviewQuestion,
    QuestionComment,
    QuestionCommentLike,
    User,
)


DEMO_EMAIL_PREFIX = "demo-intro-tips-"
DEMO_USER_COUNT = 48
TOP_LEVEL_COMMENT_COUNT = 150
REPLY_COUNT = 90

NAMES = [
    "Avery Chen",
    "Jordan Patel",
    "Morgan Lee",
    "Casey Nguyen",
    "Riley Brooks",
    "Samira Khan",
    "Noah Kim",
    "Taylor Reed",
    "Mia Santos",
    "Elliot Park",
    "Harper Wilson",
    "Devon Ross",
]

OPENERS = [
    "My best tip is to use present, past, future.",
    "I keep this answer to about ninety seconds.",
    "I stopped treating this as a biography and it got much better.",
    "I start with the problem I solve, not my job title.",
    "The answer became easier once I picked one clear career theme.",
    "I write a version for every role instead of reusing the same script.",
    "A useful test is whether a stranger can repeat your headline after hearing it.",
    "I lead with the work that is most relevant to this interview.",
    "I avoid starting with where I went to school unless it is central to the role.",
    "I now prepare a short version and a longer version before every interview.",
]

DETAILS = [
    "Then I add one concrete result so it does not sound generic.",
    "The middle is one decision or project that explains how I got here.",
    "I finish with why this specific role is the logical next step.",
    "I cut anything that does not help the interviewer picture me in this job.",
    "A simple number helps, but I explain the context behind it.",
    "It feels more conversational when I use signposts such as 'what brought me here'.",
    "The company research only needs one genuine connection, not a long list of facts.",
    "I keep the language plain enough that a non-specialist could follow it.",
    "The answer should make the transition between past experience and this role feel intentional.",
    "Practicing aloud showed me which sentences sounded like resume bullet points.",
]

FOLLOW_UPS = [
    "It is amazing how much stronger it sounds after removing the first two sentences.",
    "A friend timed mine and helped me cut the detours.",
    "This also makes the common follow-up questions much easier to answer.",
    "I try to leave space for the interviewer to ask about the project I mention.",
    "The goal is to give them a useful map, not every stop on the journey.",
    "I revise it whenever the job description changes.",
]

REPLIES = [
    "This is helpful. Did you write it out first or practice from bullet points?",
    "Agreed. The future part is where I connect it back to the team.",
    "I use the same structure, but I keep my current role to one sentence.",
    "The timing tip matters. I used to take nearly four minutes.",
    "That is a good reminder that a metric needs context.",
    "I like the idea of a career theme. It gives the answer a thread.",
    "Yes, and I found that one specific project is easier to remember than a list of achievements.",
    "I have been practicing the first line until it sounds natural rather than memorized.",
    "For career changers, I think the bridge sentence is especially important.",
    "This is exactly why I tailor the last sentence for every company.",
    "I ask myself what the interviewer should be curious about when I finish.",
    "A short answer feels confident when the details are chosen well.",
]


def demo_email(index: int) -> str:
    return f"{DEMO_EMAIL_PREFIX}{index:03d}@example.test"


def get_or_create_demo_users(db) -> list[User]:
    users: list[User] = []
    for index in range(DEMO_USER_COUNT):
        email = demo_email(index)
        user = db.scalar(select(User).where(User.email == email))
        if not user:
            user = User(
                email=email,
                display_name=NAMES[index % len(NAMES)],
                role="user",
                status="active",
                can_use_auto_apply=False,
            )
            db.add(user)
            db.flush()
        users.append(user)
    return users


def remove_existing_demo_comments(db, question_id, demo_user_ids) -> None:
    comment_ids = select(QuestionComment.id).where(
        QuestionComment.question_id == question_id,
        QuestionComment.user_id.in_(demo_user_ids),
    )
    db.execute(
        delete(QuestionCommentLike).where(
            QuestionCommentLike.comment_id.in_(comment_ids)
        )
    )
    db.execute(
        delete(QuestionComment).where(
            QuestionComment.question_id == question_id,
            QuestionComment.user_id.in_(demo_user_ids),
        )
    )
    db.flush()


def set_comment_time(comment: QuestionComment, created_at: datetime) -> None:
    comment.created_at = created_at
    comment.updated_at = created_at


def seed_comments(db, question: InterviewQuestion, users: list[User]) -> tuple[int, int]:
    rng = random.Random(question.display_number or 16)
    now = datetime.now(timezone.utc)
    comments: list[QuestionComment] = []

    for index in range(TOP_LEVEL_COMMENT_COUNT):
        age_hours = rng.uniform(0.15, 24 * 28)
        body = " ".join(
            [
                OPENERS[index % len(OPENERS)],
                DETAILS[(index * 3) % len(DETAILS)],
                FOLLOW_UPS[(index * 5) % len(FOLLOW_UPS)],
            ]
        )
        comment = QuestionComment(
            question_id=question.id,
            user_id=users[index % len(users)].id,
            kind="discussion",
            body=body,
            is_anonymous=False,
        )
        set_comment_time(comment, now - timedelta(hours=age_hours))
        db.add(comment)
        comments.append(comment)
    db.flush()

    reply_targets = sorted(
        comments,
        key=lambda comment: (comment.created_at, str(comment.id)),
        reverse=True,
    )
    for index in range(REPLY_COUNT):
        parent = reply_targets[index % 45]
        reply = QuestionComment(
            question_id=question.id,
            user_id=users[(index + 7) % len(users)].id,
            parent_id=parent.id,
            kind="discussion",
            body=REPLIES[index % len(REPLIES)],
            is_anonymous=False,
        )
        reply_time = parent.created_at + timedelta(
            minutes=rng.randint(8, max(9, int((now - parent.created_at).total_seconds() // 60)))
        )
        set_comment_time(reply, min(reply_time, now - timedelta(minutes=1)))
        db.add(reply)
    db.flush()

    like_count = 0
    ranked_comments = sorted(
        comments,
        key=lambda comment: (comment.created_at, str(comment.id)),
        reverse=True,
    )
    for index, comment in enumerate(ranked_comments):
        max_likes = 30 if index < 12 else 14 if index < 50 else 5
        for user in rng.sample(users, rng.randint(0, max_likes)):
            if user.id == comment.user_id:
                continue
            db.add(QuestionCommentLike(comment_id=comment.id, user_id=user.id))
            like_count += 1

    return TOP_LEVEL_COMMENT_COUNT + REPLY_COUNT, like_count


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--display-number", type=int, default=16)
    args = parser.parse_args()

    with SessionLocal() as db:
        question = db.scalar(
            select(InterviewQuestion).where(
                InterviewQuestion.display_number == args.display_number
            )
        )
        if not question:
            raise SystemExit(
                f"No question found with display number {args.display_number}."
            )

        users = get_or_create_demo_users(db)
        remove_existing_demo_comments(db, question.id, [user.id for user in users])
        comment_count, like_count = seed_comments(db, question, users)
        db.commit()

    print(
        f"Seeded {comment_count} demo comments and {like_count} likes "
        f'for "{question.title}" (display number {args.display_number}).'
    )


if __name__ == "__main__":
    main()
