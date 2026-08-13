import argparse


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        description="Unified worker entry point. Start exactly one bot at a time.",
    )
    parser.add_argument(
        "--bot",
        choices=("linkedin", "seek"),
        required=True,
        help="Choose which bot to run.",
    )
    return parser


def run(bot: str) -> None:
    if bot == "linkedin":
        from linkedinBot.main import run as run_linkedin_bot
        run_linkedin_bot()
        return
    if bot == "seek":
        from seekBot.main import run as run_seek_bot
        run_seek_bot()
        return
    raise ValueError(f"Unsupported bot: {bot}")


def main() -> None:
    args = build_parser().parse_args()
    run(args.bot)


if __name__ == "__main__":
    main()
