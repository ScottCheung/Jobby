from random import choice

import pyautogui
from selenium.common.exceptions import WebDriverException


_driver = None
_print_lg = None
_buffer = None
_sleep = None


def bind_context(driver=None, print_func=None, buffer_func=None, sleep_func=None) -> None:
    global _driver, _print_lg, _buffer, _sleep
    if driver is not None:
        _driver = driver
    if print_func is not None:
        _print_lg = print_func
    if buffer_func is not None:
        _buffer = buffer_func
    if sleep_func is not None:
        _sleep = sleep_func


def _log(*messages) -> None:
    if _print_lg:
        _print_lg(*messages)


def run_cycle(total_runs: int, daily_easy_apply_limit_reached: bool, date_posted: str, sort_by: str, search_terms: list[str], apply_to_jobs_func) -> int:
    if daily_easy_apply_limit_reached:
        return total_runs
    _log("\n########################################################################################################################\n")
    _log(f"Cycle number: {total_runs}")
    _log(f"Currently looking for jobs posted within '{date_posted}' and sorting them by '{sort_by}'")
    apply_to_jobs_func(search_terms)
    _log("########################################################################################################################\n")
    if not daily_easy_apply_limit_reached:
        _log("Sleeping for 10 min...")
        _sleep(300)
        _log("Few more min... Gonna start with in next 5 min...")
        _sleep(300)
    _buffer(3)
    return total_runs + 1


def advance_date_posted(current_value: str, stop_date_cycle_at_24hr: bool) -> str:
    date_options = ["Any time", "Past month", "Past week", "Past 24 hours"]
    next_index = date_options.index(current_value) + 1
    if stop_date_cycle_at_24hr:
        return date_options[next_index if next_index > len(date_options) else -1]
    if next_index >= len(date_options):
        return date_options[0]
    return date_options[next_index]


def toggle_sort(current_sort: str) -> str:
    return "Most recent" if current_sort == "Most relevant" else "Most relevant"


def show_final_summary(total_runs: int, easy_applied_count: int, external_jobs_count: int, failed_count: int, skip_count: int,
                       unanswered_questions: set, manual_learned: list, tabs_count: int) -> None:
    summary = "Total runs: {}\nJobs Easy Applied: {}\nExternal job links collected: {}\nTotal applied or collected: {}\nFailed jobs: {}\nIrrelevant jobs skipped: {}\n".format(
        total_runs, easy_applied_count, external_jobs_count, easy_applied_count + external_jobs_count, failed_count, skip_count
    )
    _log(summary)
    _log("\n\nTotal runs:                     {}".format(total_runs))
    _log("Jobs Easy Applied:              {}".format(easy_applied_count))
    _log("External job links collected:   {}".format(external_jobs_count))
    _log("                              ----------")
    _log("Total applied or collected:     {}".format(easy_applied_count + external_jobs_count))
    _log("\nFailed jobs:                    {}".format(failed_count))
    _log("Irrelevant jobs skipped:        {}\n".format(skip_count))
    if unanswered_questions:
        _log("\n\nUnanswered questions this session:\n  {}  \n\n".format(";\n".join(str(question) for question in unanswered_questions)))
    if manual_learned:
        _log("\n\nNew questions learned from manual input:\n  {}  \n\n".format(";\n".join(f'{q["label"]} -> {q["answer"]}' for q in manual_learned)))

    quotes = choice([
        "Never quit. You're one step closer than before. - Scott Cheung",
        "All the best with your future interviews, you've got this. - Scott Cheung",
        "Keep up with the progress. You got this. - Scott Cheung",
        "If you're tired, learn to take rest but never give up. - Scott Cheung",
        "Success is not final, failure is not fatal, It is the courage to continue that counts. - Winston Churchill (Not a sponsor)",
        "Believe in yourself and all that you are. Know that there is something inside you that is greater than any obstacle. - Christian D. Larson (Not a sponsor)",
        "Every job is a self-portrait of the person who does it. Autograph your work with excellence. - Jessica Guidobono (Not a sponsor)",
        "The only way to do great work is to love what you do. If you haven't found it yet, keep looking. Don't settle. - Steve Jobs (Not a sponsor)",
        "Opportunities don't happen, you create them. - Chris Grosser (Not a sponsor)",
        "The road to success and the road to failure are almost exactly the same. The difference is perseverance. - Colin R. Davis (Not a sponsor)",
        "Obstacles are those frightful things you see when you take your eyes off your goal. - Henry Ford (Not a sponsor)",
        "The only limit to our realization of tomorrow will be our doubts of today. - Franklin D. Roosevelt (Not a sponsor)",
    ])
    sponsors = "Be the first to have your name here!"
    time_saved = (easy_applied_count * 80) + (external_jobs_count * 20) + (skip_count * 10)
    time_saved_msg = ""
    if time_saved > 0:
        time_saved += 60
        time_saved_msg = f"In this run, you saved approx {round(time_saved/60)} mins ({time_saved} secs), please consider supporting the project."
    msg = f"{quotes}\n\n\n{time_saved_msg}\nYou can also get your quote and name shown here, or prioritize your bug reports by supporting the project at:\n\nhttps://github.com/sponsors/GodsScion\n\n\nSummary:\n{summary}\n\n\nBest regards,\nScott Cheung\nhttps://www.linkedin.com/in/scottcheung1110/\n\nTop Sponsors:\n{sponsors}"
    pyautogui.alert(msg, "Exiting..")
    _log(msg, "Closing the browser...")
    if tabs_count >= 10:
        note = "NOTE: IF YOU HAVE MORE THAN 10 TABS OPENED, PLEASE CLOSE OR BOOKMARK THEM!\n\nOr it's highly likely that application will just open browser and not do anything next time!"
        pyautogui.alert(note, "Info")
        _log("\n" + note)


def close_driver() -> None:
    try:
        if _driver:
            _driver.quit()
    except WebDriverException as e:
        _log("Browser already closed.", e)
