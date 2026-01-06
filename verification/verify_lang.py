from playwright.sync_api import sync_playwright
import json

def verify_language_toggle():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        context = browser.new_context()
        page = context.new_page()

        # Go to app to set localstorage (must be on same origin)
        page.goto("http://localhost:8080/index.html")

        # Inject LocalStorage with PREFIX
        # CONFIG.dbPrefix is "quantix_ultimate_v2_"
        page.evaluate("""() => {
            const prefix = "quantix_ultimate_v2_";
            localStorage.setItem(prefix + 'api_key', 'dummy_key_for_test');
            localStorage.setItem('quantix_ultimate_v2_api_key', 'dummy_key_for_test'); // Direct key used in app.js

            const profile = {
                onboardingDone: true,
                name: 'Test User',
                weight: 70,
                height: 170,
                age: 30,
                target: 2000,
                notificationsEnabled: false
            };
            localStorage.setItem(prefix + 'profile', JSON.stringify(profile));

            localStorage.setItem('quantix_lang', 'pt-BR');
        }""")

        # Reload to apply changes
        page.reload()

        # Wait for app to load (increased timeout)
        try:
            page.wait_for_selector(".glass-panel", timeout=5000)
        except:
            print("Timed out waiting for .glass-panel. Checking for overlays...")
            if page.locator("#onboarding-overlay").is_visible():
                print("Onboarding overlay is visible! LocalStorage injection failed or key is wrong.")
            if page.locator("#modal-apikey").is_visible():
                print("API Key modal is visible! Key check failed.")
            browser.close()
            return

        # Check if button exists
        btn = page.locator("#btn-lang-toggle")
        if not btn.is_visible():
            print("Button not visible!")
            browser.close()
            return

        initial_text = btn.inner_text()
        print(f"Initial text: {initial_text}")

        if initial_text != '🇧🇷':
             print(f"WARNING: Initial text expected 🇧🇷 but got {initial_text}")

        # Screenshot before toggle
        page.screenshot(path="verification/before_toggle.png")

        # Click toggle
        btn.click()

        # Wait a bit for UI update
        page.wait_for_timeout(500)

        # Check text after toggle (Should be 🇺🇸)
        new_text = btn.inner_text()
        print(f"New text: {new_text}")

        # Screenshot after toggle
        page.screenshot(path="verification/after_toggle.png")

        # Verify text changed
        if new_text == '🇺🇸':
            print("SUCCESS: Language toggled to US.")
        else:
            print(f"FAILURE: Language text is {new_text}, expected 🇺🇸.")

        # Toggle back
        btn.click()
        page.wait_for_timeout(500)
        final_text = btn.inner_text()
        print(f"Final text: {final_text}")

        if final_text == '🇧🇷':
             print("SUCCESS: Language toggled back to BR.")
        else:
             print(f"FAILURE: Language text is {final_text}, expected 🇧🇷.")

        browser.close()

if __name__ == "__main__":
    verify_language_toggle()
