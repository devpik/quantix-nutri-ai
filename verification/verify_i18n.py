from playwright.sync_api import sync_playwright
import time

def verify_i18n():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        context = browser.new_context(
            viewport={'width': 375, 'height': 812},
            locale='en-US'
        )
        page = context.new_page()

        page.add_init_script("""
            localStorage.setItem('quantix_ultimate_v2_api_key', 'dummy_key');
            localStorage.setItem('onboarding_done', 'true');
            const profile = {
                name: "Test User",
                weight: 70,
                height: 170,
                age: 30,
                target: 2000,
                onboardingDone: true
            };
            localStorage.setItem('quantix_db_profile', JSON.stringify(profile));
        """)

        page.goto("http://localhost:8080/index.html")
        page.wait_for_selector("#app-container")

        # Wait a bit for I18n to apply
        time.sleep(2)

        page.screenshot(path="verification/en_us.png")
        print("Captured en_us.png")
        browser.close()

if __name__ == "__main__":
    verify_i18n()
