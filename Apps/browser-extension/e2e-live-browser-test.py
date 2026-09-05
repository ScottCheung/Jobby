import os
import sys
import time
import tempfile
from typing import Dict, Any, List
from playwright.sync_api import sync_playwright

EXT_PATH = os.path.abspath(os.path.join(os.path.dirname(__file__), "dist"))
CHROME_EXEC = "/Users/xianzhezhang/Library/Caches/ms-playwright/chromium-1181/chrome-mac/Chromium.app/Contents/MacOS/Chromium"

TEST_SCENARIOS = [
    {
        "platform": "seek",
        "name": "SEEK Job Detail (Negative test: Should prompt Quick Apply, ignore search filters)",
        "url": "https://au.seek.com/job/93941097",
        "expected_kind": "not_application_form",
        "expected_platform": "seek",
        "forbidden_fields": ["Refine your search", "Strong applicant jobs", "Keywords", "Classification"],
    },
    {
        "platform": "seek",
        "name": "SEEK Search Results (Negative test: Should not detect application form)",
        "url": "https://www.seek.com.au/software-engineer-jobs/in-All-Sydney-NSW",
        "expected_kind": "not_application_form",
        "expected_platform": "seek",
        "forbidden_fields": ["Refine your search", "Strong applicant jobs"],
    },
    {
        "platform": "linkedin",
        "name": "LinkedIn Job View (Negative test: Should prompt Easy Apply, ignore Set job alert)",
        "url": "https://www.linkedin.com/jobs/view/4458160309",
        "expected_kind": "not_application_form",
        "expected_platform": "linkedin",
        "forbidden_fields": ["Set job alert for Full Stack Developer in Sydney", "Job alert", "Search by title"],
    },
    {
        "platform": "linkedin",
        "name": "LinkedIn Search Results (Negative test: Should not detect form on search)",
        "url": "https://www.linkedin.com/jobs/search/?keywords=full%20stack%20developer&location=Sydney",
        "expected_kind": "not_application_form",
        "expected_platform": "linkedin",
        "forbidden_fields": ["Set job alert for Full Stack Developer in Sydney", "Job alert"],
    },
    {
        "platform": "greenhouse",
        "name": "Greenhouse Embedded Form (Positive test: Should detect application form and fields)",
        "url": "https://boards.greenhouse.io/embed/job_app?for=canonical&token=5150422",
        "expected_kind": "application_form",
        "expected_platform": "greenhouse",
        "required_fields": ["First Name", "Last Name", "Email"],
    },
    {
        "platform": "ashby",
        "name": "Ashby Job Posting (Platform & Form detection test)",
        "url": "https://jobs.ashbyhq.com/workyard/b30b1976-3aad-47ce-a043-42e058e3dbdf",
        "expected_kind": None, # could be application_form if inline or not_application_form with prompt
        "expected_platform": "ashby",
    },
    {
        "platform": "lever",
        "name": "Lever Job Board (Platform & Form detection test)",
        "url": "https://jobs.lever.co/upguard",
        "expected_kind": "not_application_form",
        "expected_platform": "lever",
    },
    {
        "platform": "smartrecruiters",
        "name": "SmartRecruiters Job Page (Platform detection test)",
        "url": "https://jobs.smartrecruiters.com/carsales/744000121067717-senior-software-engineer",
        "expected_kind": None,
        "expected_platform": "smartrecruiters",
    },
    {
        "platform": "workable",
        "name": "Workable Direct Application (Positive test: Application Form)",
        "url": "https://apply.workable.com/1global/j/416C706063/apply/",
        "expected_kind": "application_form",
        "expected_platform": "workable",
    },
    {
        "platform": "indeed",
        "name": "Indeed Search (Negative test: Should not detect application form on search)",
        "url": "https://au.indeed.com/jobs?q=software+engineer&l=Sydney+NSW",
        "expected_kind": "not_application_form",
        "expected_platform": "indeed",
    },
]

def run_e2e_tests():
    print("=" * 80)
    print("🚀 Starting End-to-End Live Browser Form Recognition Test Suite")
    print(f"Browser: Chromium ({CHROME_EXEC})")
    print(f"Extension: {EXT_PATH}")
    print("=" * 80)

    results: List[Dict[str, Any]] = []

    with tempfile.TemporaryDirectory() as tmpdir:
        with sync_playwright() as p:
            context = p.chromium.launch_persistent_context(
                user_data_dir=tmpdir,
                executable_path=CHROME_EXEC,
                headless=False,
                args=[
                    f"--disable-extensions-except={EXT_PATH}",
                    f"--load-extension={EXT_PATH}",
                    "--no-sandbox",
                ],
            )

            # Wait for background service worker
            sw = context.service_workers[0] if context.service_workers else context.wait_for_event("serviceworker", timeout=10000)
            page = context.new_page()

            for idx, scenario in enumerate(TEST_SCENARIOS, 1):
                name = scenario["name"]
                url = scenario["url"]
                expected_kind = scenario.get("expected_kind")
                expected_platform = scenario.get("expected_platform")
                forbidden = scenario.get("forbidden_fields", [])
                required = scenario.get("required_fields", [])

                print(f"\n[{idx}/{len(TEST_SCENARIOS)}] Testing: {name}")
                print(f"     URL: {url}")

                try:
                    page.goto(url, timeout=25000)
                    time.sleep(3)

                    # Send inspect-form command to the tab via service worker
                    inspect_res = sw.evaluate("""async () => {
                        const tabs = await chrome.tabs.query({ active: true });
                        const tab = tabs[0];
                        if (!tab) return { ok: false, error: 'No active tab' };
                        try {
                            return await chrome.tabs.sendMessage(tab.id, { type: 'content.inspect-form' }, { frameId: 0 });
                        } catch (err) {
                            return { ok: false, error: err.message };
                        }
                    }""")

                    if not inspect_res.get("ok"):
                        print(f"     ❌ Failed to inspect: {inspect_res.get('error')}")
                        results.append({
                            "name": name,
                            "platform": scenario["platform"],
                            "passed": False,
                            "error": inspect_res.get("error"),
                        })
                        continue

                    form = inspect_res.get("form", {})
                    actual_kind = form.get("kind")
                    actual_platform = form.get("platform")
                    fields = form.get("fields", [])
                    field_labels = [f.get("label", "") for f in fields]
                    reason = form.get("reason", "")

                    print(f"     Detected Platform: {actual_platform} (Expected: {expected_platform})")
                    print(f"     Detected Kind:     {actual_kind} (Expected: {expected_kind or 'any'})")
                    if field_labels:
                        print(f"     Fields count:      {len(field_labels)} ({field_labels[:4]}...)")
                    else:
                        print(f"     Reason:            {reason[:70]}...")

                    # Verification checks
                    passed = True
                    fail_reasons = []

                    if expected_platform and actual_platform != expected_platform:
                        passed = False
                        fail_reasons.append(f"Platform mismatch: got {actual_platform}, expected {expected_platform}")

                    if expected_kind and actual_kind != expected_kind:
                        passed = False
                        fail_reasons.append(f"Kind mismatch: got {actual_kind}, expected {expected_kind}")

                    # Check forbidden fields (e.g. search filters or job alerts)
                    for f_field in forbidden:
                        if any(f_field.lower() in label.lower() for label in field_labels):
                            passed = False
                            fail_reasons.append(f"Forbidden field detected: '{f_field}'")

                    # Check required fields
                    for r_field in required:
                        if not any(r_field.lower() in label.lower() for label in field_labels):
                            passed = False
                            fail_reasons.append(f"Required field missing: '{r_field}'")

                    if passed:
                        print("     ✅ PASS")
                    else:
                        print(f"     ❌ FAIL: {', '.join(fail_reasons)}")

                    results.append({
                        "name": name,
                        "platform": scenario["platform"],
                        "passed": passed,
                        "kind": actual_kind,
                        "fields_count": len(field_labels),
                        "fail_reasons": fail_reasons,
                    })

                except Exception as ex:
                    print(f"     ❌ Exception: {ex}")
                    results.append({
                        "name": name,
                        "platform": scenario["platform"],
                        "passed": False,
                        "error": str(ex),
                    })

            context.close()

    # Print Summary Report
    print("\n" + "=" * 80)
    print("📊 END-TO-END BROWSER TEST ACCURACY REPORT")
    print("=" * 80)
    total = len(results)
    passed_count = sum(1 for r in results if r.get("passed"))
    accuracy = (passed_count / total * 100) if total > 0 else 0

    for r in results:
        status_icon = "✅ PASS" if r.get("passed") else "❌ FAIL"
        details = f"({r.get('kind', 'N/A')}, {r.get('fields_count', 0)} fields)" if r.get("passed") else f"({', '.join(r.get('fail_reasons', [])) or r.get('error', 'Error')})"
        print(f"{status_icon} | {r['platform']:<15} | {r['name']:<55} {details}")

    print("-" * 80)
    print(f"Total Scenarios Tested: {total}")
    print(f"Passed:                 {passed_count}")
    print(f"Failed:                 {total - passed_count}")
    print(f"Accuracy Rate:          {accuracy:.1f}%")
    print("=" * 80)

if __name__ == "__main__":
    run_e2e_tests()
