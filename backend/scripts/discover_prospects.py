#!/usr/bin/env python3
"""
Jobby Real Prospect Discovery Script & Codex Agent CLI Tool

This script connects Jobby (System of Record) with Codex Agent / web search engines.
It accepts target roles, locations, and user profile data, then pushes real discovered
prospects to Jobby via REST API endpoint `POST http://localhost:8000/api/prospects`.

Usage:
    python backend/scripts/discover_prospects.py --api-url http://localhost:8000 --roles "Senior Full Stack Engineer" "Engineering Manager"
"""

import argparse
import json
import os
import sys
import urllib.request
from typing import Any, Dict, List


def push_prospect_to_jobby(api_url: str, prospect_data: Dict[str, Any], email: str = "admin@jobby.local") -> bool:
    endpoint = f"{api_url.rstrip('/')}/api/prospects"
    req = urllib.request.Request(
        endpoint,
        data=json.dumps(prospect_data).encode("utf-8"),
        headers={
            "Content-Type": "application/json",
            "X-User-Email": email,
        },
        method="POST",
    )
    try:
        with urllib.request.urlopen(req) as response:
            if response.status in (200, 201):
                res_body = json.loads(response.read().decode("utf-8"))
                print(f"[Jobby API] Successfully saved prospect: {res_body.get('name')} ({res_body.get('company')})")
                return True
    except Exception as err:
        print(f"[Jobby API Error] Could not save prospect to {endpoint}: {err}")
        return False
    return False


def main():
    parser = argparse.ArgumentParser(description="Jobby Prospect Discovery CLI Engine")
    parser.add_argument("--api-url", default="http://localhost:8000", help="Jobby backend API base URL")
    parser.add_argument("--roles", nargs="+", default=["Senior Full Stack Engineer"], help="Target job roles")
    parser.add_argument("--locations", nargs="+", default=["San Francisco, CA", "Remote"], help="Preferred locations")
    parser.add_argument("--email", default="admin@jobby.local", help="User authentication email header")
    args = parser.parse_args()

    print("======================================================")
    print("      Jobby Codex Prospect Discovery CLI Tool         ")
    print("======================================================")
    print(f"Target Roles    : {', '.join(args.roles)}")
    print(f"Locations       : {', '.join(args.locations)}")
    print(f"Target Jobby API: {args.api_url}")
    print("------------------------------------------------------")
    print("Sending discovery request to Jobby System of Record...")

    endpoint = f"{args.api_url.rstrip('/')}/api/prospects/discover"
    payload = {
        "target_roles": args.roles,
        "preferred_locations": args.locations,
        "limit": 6,
    }
    req = urllib.request.Request(
        endpoint,
        data=json.dumps(payload).encode("utf-8"),
        headers={
            "Content-Type": "application/json",
            "X-User-Email": args.email,
        },
        method="POST",
    )

    try:
        with urllib.request.urlopen(req) as response:
            result = json.loads(response.read().decode("utf-8"))
            print("\n[Discovery Complete]")
            print(f"Status          : {result.get('status')}")
            print(f"Prospects Found : {result.get('prospects_found')}")
            print(f"Prospects Added : {result.get('prospects_added')}")
            print(f"Summary         : {result.get('summary')}")
            print("\n[Execution Logs]")
            for log in result.get("logs", []):
                print(f" - [{log.get('level')}] {log.get('message')}")
    except Exception as err:
        print(f"\n[CLI Error] Could not trigger discovery via API: {err}")
        sys.exit(1)


if __name__ == "__main__":
    main()
