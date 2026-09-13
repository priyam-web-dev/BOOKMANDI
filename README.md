# BookMandi Real V1
This is a real full-stack local ecommerce foundation.

## Run
1. Install Node.js 20+
2. Copy `.env.example` to `.env`
3. Set `ADMIN_PASSWORD` to your own password.
4. `npm install`
5. `npm run dev`

Store: http://localhost:5173
Admin: http://localhost:5173/admin

## Razorpay
Put the Razorpay Key ID and Secret in `.env`. The server creates Razorpay Orders and verifies the returned signature server-side. Never expose the secret key in React.

## Data
For this starter, products/orders persist in `server/data.json`. Before public launch, move this to PostgreSQL/Supabase, add proper admin sessions, rate limiting, validation, webhooks, inventory locking, shipping/returns logic, and production hosting.

## Important
The current demo has no real book inventory images or sourcing integration. Replace demo product records with verified inventory before taking customer orders.
