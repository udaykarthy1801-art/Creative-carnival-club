# Verification — 24 September 2026

Environment: Windows, Node.js 24.14.0, MySQL Community Server 8.4.11, headless Google Chrome through Playwright. Integration and browser fixtures used a separate real `creative_carnival_test` database. No mock database or localStorage was used. Test visitor records were removed after verification.

- **7 unit tests passed:** trimming/email normalization, invalid types/lengths/required fields, every original visitor/purpose option, restricted lookup IDs and safe data projections, escaped admin queries, CSV formula protection, salted scrypt password verification.
- **9 integration scenarios passed** (10 reported tests including the parent): health/static files/security headers, actual committed MySQL rows, validation/duplicate rejection, concurrent duplicate requests, private lookup, request size/JSON/origin restrictions, authenticated admin search/export/detail, CSRF-protected deletion and logout, rate limiting.
- **Browser flow passed:** localhost:5000 loads; valid form → Express → MySQL → confirmation; registration ID and all fields displayed; duplicate submission shows an error and hides stale success; print action invoked and print styling verified.
- **Real outages tested:** Express was stopped and the browser showed failure, re-enabled the submit button, and did not show success. MySQL was then shut down while Express remained up; submission again showed failure. Both services restarted, and the committed record was still present in MySQL.
- **Admin browser flow passed:** login, name/ID search, filtered results, CSV download, details dialog, confirmed deletion, logout. Unauthenticated API access was rejected.
- **Responsive checks passed:** visitor and administrator pages at 1920, 1440, 1024, 768, 600, 480, 390, and 360 pixels. No horizontal overflow; original image loaded; fixed background stayed fixed during scrolling.
- **Browser diagnostics:** no uncaught JavaScript errors or Content Security Policy violations.
- **Dependency audit:** npm audit reported 0 known vulnerabilities across the installed dependency tree at verification time. This is not a guarantee against future advisories.

Testing limits: checked in Chrome on Windows, not on physical iOS/Android devices or every browser. Public HTTPS hosting, multi-instance scaling, managed database backups, and operational monitoring have not been provisioned. These deployment tasks are documented in README.md.
