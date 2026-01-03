from playwright.sync_api import sync_playwright
import time
import json

def verify_simplify():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        context = browser.new_context()
        page = context.new_page()

        # Planner data
        planner_data = [
            {
                "day": "Segunda-feira",
                "meals": {
                    "breakfast": { "desc": "Complex Meal", "estimated_cals": 500 },
                    "lunch": { "desc": "Lunch Meal", "estimated_cals": 700 },
                    "snack": { "desc": "Snack Meal", "estimated_cals": 200 },
                    "dinner": { "desc": "Dinner Meal", "estimated_cals": 600 }
                }
            }
        ]

        # Profile data
        profile_data = {
            "name": "Test User",
            "credits": 10,
            "target": 2000,
            "onboardingDone": True,
            "notificationsEnabled": False,
            "apiUsage": {"totalTokens": 0, "totalRequests": 0}
        }

        # Navigate to app
        page.goto("http://localhost:8080")

        # Prepare data for local storage
        planner_json = json.dumps(planner_data)
        profile_json = json.dumps(profile_data)

        # Use existing key prefix from memory/config if known, but default likely works or I can check config.
        # js/config.js is not read yet but js/app.js uses CONFIG.dbPrefix in importData.
        # Assuming no prefix for now based on previous interactions, or keys like 'profile' used directly in api.js.
        # In api.js: DB.set('planner', ...) so key is likely just 'planner' or handled by DB wrapper.
        # js/data/database.js usually handles prefix.
        # Let's read js/config.js and js/data/database.js to be sure.

        # But wait, I can just try to overwrite the wrapper or assume standard.
        # Let's try to set it via the wrapper if I can access it from window?
        # App exposes App, Planner, etc. DB is imported in App.
        # But DB might not be exposed to window.

        # However, typically simple apps use direct keys or simple prefix.
        # api.js uses DB.set('planner', ...).

        # Let's try to set directly with 'quantix_ultimate_v2_planner' or similar if I can find the prefix.
        # Looking at memory: "API keys are managed ... using the key quantix_ultimate_v2_api_key".
        # So prefix is likely 'quantix_ultimate_v2_'.

        prefix = 'quantix_ultimate_v2_'

        page.evaluate(f"""() => {{
            localStorage.setItem('{prefix}planner', JSON.stringify({planner_json}));
            localStorage.setItem('{prefix}profile', JSON.stringify({profile_json}));
            localStorage.setItem('{prefix}api_key', 'test_key');
        }}""")

        page.reload()

        # Go to Planner tab
        # App.js: switchTab('planner')
        # There should be a nav item or I can call App.switchTab('planner')
        try:
            page.evaluate("App.switchTab('planner')")

            # Wait for container
            page.wait_for_selector("#planner-container", state="visible", timeout=5000)

            # Click to expand day
            page.click("h4:text('Segunda-feira')")

            # Wait for meal
            page.wait_for_selector("text=Complex Meal", state="visible", timeout=2000)

            # Check button
            simplify_btn = page.locator('button[title="Simplificar (Dia Corrido)"]')
            if simplify_btn.count() > 0:
                print("Simplify button found")
                simplify_btn.first.scroll_into_view_if_needed()
                page.screenshot(path="verification/simplify_button.png")
            else:
                print("Simplify button NOT found")
                page.screenshot(path="verification/simplify_button_missing.png")

        except Exception as e:
            print(f"Error: {e}")
            page.screenshot(path="verification/error.png")

        browser.close()

if __name__ == "__main__":
    verify_simplify()
