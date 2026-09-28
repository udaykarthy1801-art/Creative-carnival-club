# Creative Carnival — real visitor registration

The existing event page now sends registrations to Express, which validates and commits them to MySQL before returning success. The purple/gold design, supplied artwork, fixed translucent background, favicon, eight registration fields, event details, and print confirmation are preserved. The original `index (3).html` form and its approved `index (4).html` design revision were the starting point.

## Project files

```text
creative-carnival/
  public/
    index.html                   Existing event page, connected to the API
    admin.html                   Sign-in and protected registration tools
    assets/creative-carnival.jpg  Original supplied image
    assets/favicon.svg           Matching browser tab icon
    css/style.css                Extracted existing styles + API states
    css/admin.css                Responsive administration styles
    js/app.js                    Real submission, loading/errors, confirmation
    js/admin.js                  Sign-in, search, filters, detail, delete, CSV
  server/
    app.js                       Database checks, startup, graceful shutdown
    createApp.js                 Express middleware, routes, static files
    config/{env,db}.js            Validated environment and mysql2 pool
    controllers/                 Registration and admin operations
    routes/                      Registration and protected admin routes
    middleware/adminAuth.js      Database sessions and CSRF checks
    lib/                         Validation, password hashing, CSV helpers
  database/schema.sql
  scripts/{setup-db,hash-password}.js
  test/{unit,integration}.test.js
  .env.example
  .gitignore
  package.json
  package-lock.json
```

## Requirements and installation

- Node.js 22 or newer; this project was tested with Node.js 24.14.0. Download the LTS installer from [nodejs.org](https://nodejs.org/en/download), then reopen the terminal and check `node --version` and `npm --version`.
- MySQL 8.4 LTS; tested with 8.4.11. Install [MySQL Community Server](https://dev.mysql.com/downloads/mysql/8.4.html), set a strong root password, and start the MySQL service. On Windows, the service name depends on your installation. A portable local instance was provisioned separately on the original development computer; see its local setup notes.
- A modern browser. The site is served by Express, not by opening the HTML file directly.

From this project directory:

```powershell
npm ci
Copy-Item .env.example .env
```

On macOS/Linux, use `cp .env.example .env` for the second command. Do not overwrite a configured `.env`. `npm ci` installs exactly the dependency versions in the lockfile. If the official npm registry is unavailable, retry after connectivity is restored; a registry mirror was used during development due to intermittent TLS failures.

## Database setup

Run the bundled SQL using the MySQL client. These commands work in Windows PowerShell without shell input redirection:

```powershell
mysql -u root -p
```

At the MySQL prompt, supply the absolute path to this project's schema (use forward slashes on Windows):

```sql
SOURCE C:/path/to/creative-carnival/database/schema.sql;

CREATE USER 'carnival_app'@'localhost' IDENTIFIED BY 'REPLACE_WITH_A_STRONG_UNIQUE_DB_PASSWORD';
GRANT SELECT, INSERT, UPDATE, DELETE ON creative_carnival.* TO 'carnival_app'@'localhost';
EXIT;
```

Alternatively, temporarily configure a database account with schema-creation privileges in `.env` and run `npm run db:setup`, then switch `.env` to the limited application account. The runtime application never creates tables and does not need DDL privileges. `schema.sql` is repeatable for a fresh database but is not a migration tool for future schema changes.

The schema creates `creative_carnival`, the `registrations` table, and `admin_sessions`, using InnoDB, utf8mb4, constraints and indexes. MySQL must bind to localhost or a private database network. Do not open port 3306 to the public internet.

## Environment configuration

Edit `.env` with your actual local settings:

```dotenv
NODE_ENV=development
HOST=127.0.0.1
PORT=5000
DB_HOST=127.0.0.1
DB_PORT=3306
DB_USER=carnival_app
DB_PASSWORD=YOUR_DATABASE_PASSWORD
DB_NAME=creative_carnival
DB_CONNECTION_LIMIT=10
ADMIN_USERNAME=admin
ADMIN_PASSWORD_HASH=
SESSION_HOURS=8
ALLOWED_ORIGINS=http://localhost:5000,http://127.0.0.1:5000
COOKIE_SECURE=false
TRUST_PROXY=
REGISTRATION_RATE_LIMIT=60
REGISTRATION_RATE_WINDOW_MINUTES=15
```

Choose your administrator password locally:

```powershell
npm run admin:setup
```

The prompt hides the input and saves only a salted scrypt hash to `.env`. Use 12–256 characters. `npm run admin:password` prints just a hash if you prefer to configure it manually. There is no default admin password. Development mode allows registration with admin access disabled until a hash is configured; production refuses to start without one. Restart the server after changing credentials. To revoke existing admin sessions immediately, run `DELETE FROM admin_sessions;` as an authorized database administrator.

## Start and open

```powershell
npm start
```

For automatic Node.js restarts while editing:

```powershell
npm run dev
```

- Event website: <http://localhost:5000>
- Admin sign-in: <http://localhost:5000/admin.html>
- Health check: <http://localhost:5000/api/health>

The backend verifies MySQL and both tables at startup. If the database is unavailable or the schema is missing, it logs a concise server-side error and does not start accepting registrations.

## Visitor flow

Select **Register Now**, complete the form, and submit. The button becomes **Registering...** and is disabled during the request. Only a successful database commit reveals the confirmation and its `CCMD-2026-000001` style ID. All eight visitor fields are included; the registration ID and event details print with the confirmation. An optional blank message is displayed as a dash.

Every input is validated again on the server. Emails are trimmed and lowercased. Mobile numbers require exactly ten digits. Names allow Unicode and ordinary punctuation. Database queries use placeholders; submitted text is rendered with `textContent`.

Duplicate policy: the same mobile **and** email combination cannot register twice. Either contact can be shared with a different combination, allowing typical family/group registrations. A unique database constraint enforces this under concurrent requests. People sharing both contacts need a distinct email or mobile combination. Deleted records can register again.

Registration IDs use MySQL's internal auto-increment value. Numbers can have gaps after failed/duplicate requests or deletion; this is expected. IDs are updated inside the same transaction as insertion and are never based on `COUNT(*)`. Six digits are the minimum padding, so values remain unique above 999,999 registrations.

If a network interruption occurs after MySQL commits but before the browser receives the reply, the browser cannot confirm success. Retrying can return 409; an administrator can find the saved registration. There is no fake fallback, localStorage database, or automatic success on error.

## API

All API responses containing registration data use `Cache-Control: no-store`. Errors contain a safe message rather than SQL, stack traces, or credentials.

- `GET /api/health` — 200 with service/database health, or 503 when MySQL is unavailable.
- `POST /api/registrations` — 201 with `success`, `registrationId`, `visitor`, and a private `lookupToken`; 400 for validation, 409 for duplicates, 429 for rate limiting, 503 for database failure.
- `GET /api/registrations/:registrationId` — requires `Authorization: Bearer <lookupToken>` from the creation response. Returns only visitor-facing fields; 401 if no token, 404 if the ID/token pair is unknown. Predictable registration IDs alone never expose personal details. The event form doesn't persist this token; API clients should retain it securely if lookup is needed. Administrators have their own protected lookup.
- `POST /api/admin/login` — JSON `username` and `password`; sets an HttpOnly, SameSite=Strict session cookie and returns `csrfToken`.
- `GET /api/admin/session` — verifies the cookie and returns the session's CSRF token.
- `DELETE /api/admin/session` — sign out; requires cookie and `X-CSRF-Token`.
- `GET /api/admin/registrations` — requires admin cookie; `q`, `visitorType`, `purpose`, `sort=newest|oldest`, `page`, `limit` (max 100).
- `GET /api/admin/registrations/:id` — detail by internal numeric ID, authorized admin only.
- `DELETE /api/admin/registrations/:id` — permanent deletion; requires admin cookie and `X-CSRF-Token`.
- `GET /api/admin/registrations/export.csv` — admin-only export of all rows matching the same filters, capped at 10,000 per export. Narrow filters for larger datasets. Formula-like cells are neutralized for spreadsheet safety.

Use PowerShell to test an actual registration (this intentionally stores a record):

```powershell
$body = @{
  fullName = 'Test Visitor'
  mobile = '9876543210'
  email = 'visitor@example.com'
  visitorType = 'College Student'
  college = 'Test College'
  purpose = 'Project Exhibition'
  reference = 'Faculty'
  message = 'API test'
} | ConvertTo-Json
$saved = Invoke-RestMethod http://localhost:5000/api/registrations -Method Post -ContentType 'application/json' -Body $body
$saved.registrationId
Invoke-RestMethod ("http://localhost:5000/api/registrations/" + $saved.registrationId) -Headers @{Authorization = "Bearer " + $saved.lookupToken}
Invoke-RestMethod http://localhost:5000/api/health
```

Verify persistence from the MySQL prompt:

```sql
USE creative_carnival;
SELECT registration_id, full_name, mobile, email, created_at
FROM registrations ORDER BY id DESC LIMIT 5;
```

Delete test records through the authorized dashboard when finished. Do not paste private lookup tokens or production credentials into shared logs.

## Administration

The publicly reachable admin HTML is only a sign-in interface. Every data, detail, export and delete endpoint requires a valid server-side session stored in MySQL. The browser keeps the CSRF token in memory; the session token is an HttpOnly cookie. Tokens are stored as hashes in the database, and passwords are verified against scrypt hashes.

After signing in, search by name, mobile or registration ID, filter visitor type and purpose, sort by registration date, view details, export CSV, or delete a record after confirmation. Sessions expire after the configured period. Deletion is permanent: this project does not provide an undo/recycle bin.

## Automated tests

```powershell
npm test
```

These cover normalization, validation, original dropdown options, query filtering, CSV formula protection, and password hashing.

The integration suite requires a **separate real MySQL database** named `creative_carnival_test`. Create the same two tables there by running a copy of `database/schema.sql` with only its database name changed to `creative_carnival_test`. Grant the application user SELECT, INSERT, UPDATE and DELETE on that test database. It must never point at a production database.

```powershell
$env:TEST_DATABASE_NAME='creative_carnival_test'
npm run test:integration
Remove-Item Env:TEST_DATABASE_NAME
```

The suite starts its own Express server and creates/removes uniquely marked test records. It refuses other test database names. Without `TEST_DATABASE_NAME`, it explicitly reports skipped, not a successful database test. See `TEST-RESULTS.md` for the checks performed on this computer, including actual browser and outage tests.

## Production deployment notes and remaining infrastructure

This is a working local application with real database storage; it has not been deployed to public hosting. Before public launch:

1. Configure your MySQL host and a least-privilege application account, run the schema, and establish tested encrypted backups and a retention/deletion policy for visitor data.
2. Use an HTTPS reverse proxy and set `NODE_ENV=production`, `COOKIE_SECURE=true`, and exact HTTPS `ALLOWED_ORIGINS`. Keep Express bound to a private interface. If your proxy is on this host, `TRUST_PROXY=loopback` is suitable; otherwise trust only your actual proxy addresses. Never trust arbitrary forwarded headers.
3. Set a strong administrator password with `npm run admin:setup`; protect `.env` and server filesystem access. Use `DB_SSL_CA` for verified TLS when connecting to a remote MySQL server. Local development uses a loopback-only database connection.
4. Run Node and MySQL under your platform's service/process manager with automatic restart, monitoring and health checks. Local launch helpers are development conveniences, not production service management.
5. Registration and sign-in rate limits are in-memory and per process. Use a shared limiter store or proxy limits before running multiple workers/instances. Defaults permit 60 registration attempts per IP per 15 minutes; tune for an event network where many visitors share one IP.
6. This project has one configured admin account, no MFA, no password reset flow, and no email/SMS confirmation. Add an identity provider and stronger audit controls if your deployment needs multiple staff roles or regulated administration. Console logs contain IDs/event codes, not submitted visitor bodies or passwords.
7. Only `public/` is served. Never publish `.env`, local runtime files, node_modules, test database files, or database backups. Use `npm ci --omit=dev` for reproducible deployment and review dependency advisories routinely.

The project uses Express, mysql2, dotenv, cors, helmet, express-rate-limit, and validator. No frontend framework or UI library was added.
