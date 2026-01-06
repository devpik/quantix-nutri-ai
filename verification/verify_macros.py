
import time
from playwright.sync_api import sync_playwright
import json

def verify(page):
    page.on("console", lambda msg: print(f"CONSOLE: {msg.text}"))

    # 1. Load app
    page.goto("http://localhost:8080")

    # 2. Setup Profile via localStorage (simplest way to bypass onboarding)
    profile = {
        "name": "Test User",
        "weight": 70,
        "height": 175,
        "age": 30,
        "target": 2000,
        "onboardingDone": True,
        "notificationsEnabled": False
    }
    page.evaluate(f"localStorage.setItem('quantix_ultimate_v2_profile', '{json.dumps(profile)}');")

    # 3. Reload to load profile
    page.reload()
    page.wait_for_selector("#hero-cals-left") # Wait for dashboard

    # 4. Add Meal with floats via App API
    # P: 20.9 -> 21, C: 30.1 -> 30, F: 10.5 -> 11
    # Cals: 300
    page.evaluate("""() => {
        App.addMealToDB({
            desc: "Floaty Meal",
            cals: 300,
            macros: {p: 20.9, c: 30.1, f: 10.5},
            category: "Café da Manhã",
            timestamp: Date.now(),
            type: "food",
            score: 7
        });
    }""")

    # 5. Wait for feed item
    page.wait_for_selector(".fa-mug-hot") # Breakfast icon

    # 6. Screenshot
    page.screenshot(path="verification/macro_fix.png")

    # 7. Assertions
    content = page.content()

    print("Checking for rounded values...")
    if "P:21 C:30 G:11" in content:
        print("SUCCESS: Found 'P:21 C:30 G:11'")
    else:
        print("FAILURE: Did not find 'P:21 C:30 G:11'")

    # Check for decimals
    import re
    if re.search(r"P:\d+\.", content):
        print("FAILURE: Found decimal in Protein")
    else:
        print("SUCCESS: No decimal in Protein")

    if re.search(r"C:\d+\.", content):
        print("FAILURE: Found decimal in Carbs")
    else:
        print("SUCCESS: No decimal in Carbs")

if __name__ == "__main__":
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()
        try:
            verify(page)
        except Exception as e:
            print(f"Error: {e}")
        finally:
            browser.close()
