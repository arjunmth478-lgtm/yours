# Shopnix — Cloudflare full-stack store

Includes storefront, responsive blue/pink styling, logo/banner SVGs, product search/category filters, wishlist/cart, customer email/password login, admin panel, product/category management, WhatsApp/Telegram contact settings, visitor page-view counter, and JSON backup/export.

## Deploy without manually setting environment variables
1. Install Node.js LTS: https://nodejs.org
2. Extract this ZIP and open PowerShell in the `shopnix-cloudflare` folder.
3. Run: `powershell -ExecutionPolicy Bypass -File .\setup-and-deploy.ps1`
4. Complete the Cloudflare browser login. The script automatically creates/finds the D1 database, updates its ID in `wrangler.toml`, applies SQL migrations, and deploys.

No custom environment variables are required by this project. Cloudflare login is still required because only the account owner can authorize creation of a database and deployment.

## Admin
Email: `arjunmth2007@gmail.com`
Password: see `ADMIN_PASSWORD` at the top of `src/worker.js`.

**Security:** keep the repository private. Before accepting real customers, change the admin password and use a production-grade password hashing strategy. Do not publish credentials in a public repository.

## Important scope notes
- Google OAuth button is a placeholder until OAuth credentials and callback configuration are supplied.
- WhatsApp opens a prefilled order message; Telegram opens the configured chat and the customer may need to paste the order summary.
- The visitor counter counts page visits, not unique people.
- Checkout currently opens the selected messaging app; it does not store a formal order record or reserve/decrement stock in the database.
- Deployment must be run in your own Cloudflare account. This ZIP is not already live-hosted.
