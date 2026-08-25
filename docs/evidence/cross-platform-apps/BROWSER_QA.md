# Browser QA

Verdict: PASS after one responsive security-control fix.

- Environment: local Vite app at `http://127.0.0.1:1420/`; Codex in-app browser; 1280×820 desktop and 390×844 mobile overrides.
- Flow: app loads → finance draft fields are completed → save is clicked → new queue row, amount/count and local-only notice render.
- Page identity: URL and `Nalanda Public School ERP` title matched.
- Meaningful render: logo/brand, navigation, safety banner, summary cards, form and queue were present.
- Framework overlay: absent.
- Console: zero relevant errors or warnings before and after interaction.
- Interaction: synthetic expense draft `Synthetic transport register`, ₹325.50 produced a fourth queue row and the exact not-server-posted notice.
- Responsive: document width equalled viewport width; no horizontal overflow. The initial mobile layout hid the manual lock control, so a fifth bottom-navigation `Lock` action was added and retested.
- Lock/unlock: mobile `Lock` rendered the branded `Welcome back` screen; a synthetic preview PIN restored the browser-only workspace. The installed app now enforces 8–12 digits and is separately covered by Stronghold/native tests, not this browser preview.
- Remaining visual boundary: actual Windows WebView2, Android WebView and iOS WKWebView rendering awaits private CI/emulator or separately approved physical-device QA.
