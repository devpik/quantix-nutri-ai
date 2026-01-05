from playwright.sync_api import sync_playwright, expect
import time

def verify_analytics(page):
    # Set viewport
    page.set_viewport_size({"width": 375, "height": 812})

    # 1. Load the app
    page.goto("http://localhost:8080/index.html")

    # Wait for app initialization
    page.wait_for_selector("#app-container")
    time.sleep(1)

    # Handle API Key Modal if present
    try:
        # Check if modal is visible (it has z-[70] and active class usually added by JS, or just check visibility)
        # The log said it intercepts pointer events, so it is definitely there.
        # Fill API Key
        page.fill("#inp-apikey", "fake-api-key-for-testing")
        # Click Save
        page.click("button:has-text('Salvar e Iniciar')")

        # Wait for modal to disappear (it usually removes 'active' class or hides)
        # We can wait for it to be detached or hidden
        page.locator("#modal-apikey").wait_for(state="hidden", timeout=5000)
    except Exception as e:
        print(f"Modal handling skipped or failed: {e}")

    time.sleep(1)

    # Handle Onboarding Overlay if present
    if page.locator("#onboarding-overlay").is_visible():
        print("Handling onboarding...")
        page.fill("#onb-name", "Tester")
        page.fill("#onb-weight", "70")
        page.fill("#onb-height", "175")
        page.fill("#onb-age", "30")
        page.click("button:has-text('Começar Jornada')")
        time.sleep(1)

    # 2. Switch to Analytics Tab
    analytics_btn = page.get_by_text("Análise")
    analytics_btn.click()

    # Wait for tab to be visible
    page.wait_for_selector("#tab-analytics", state="visible")
    time.sleep(1)

    # 3. Verify Elements

    # Check "Média Horária de Fome" chart
    expect(page.locator("#chart-hourly")).to_be_visible()

    # Check Weight Projection
    expect(page.locator("#proj-weight")).to_be_visible()

    # Check Macro Evolution Chart (New)
    expect(page.locator("#chart-macro-evolution")).to_be_visible()

    # 4. Take Screenshot
    page.screenshot(path="verification/analytics_dashboard.png")

if __name__ == "__main__":
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()
        try:
            verify_analytics(page)
            print("Verification script ran successfully.")
        except Exception as e:
            print(f"Verification failed: {e}")
            page.screenshot(path="verification/error_screenshot.png")
        finally:
            browser.close()
