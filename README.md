## CreateHQ Labs - Finance Ops Dashboard

Internal finance operations platform for managing invoice intake, finance review workflows, master data approvals, notifications, and user management.

## Features 

- Role-based access control
- Invoice intake workflow
- Finance review and approval process
- PI (Proforma Invoice) tracking
- Product reimbursement handling
- Master data review and approval
- Notification center
- User management
- Dashboard analytics and operational insights
- Dark / Light theme support

## Roles

### Employee
- Submit invoices
- Track submission status
- View notifications
- Manage resubmissions

### Finance
- Review submissions
- Update finance workflow statuses
- Manage invoice and debit numbers
- Approve master data requests
- Manage employees

### Admin
- Full platform access
- User and role management
- Finance administration

## Tech Stack

- Next.js
- TypeScript
- Tailwind CSS
- Supabase
- PostgreSQL
- shadcn/ui

## Development

Install dependencies:

```bash
npm install
````

Run locally:

```bash
npm run dev
```

Build:

```bash
npm run build
```

Lint:

```bash
npm run lint
```

## Environment Variables

Create a `.env.local` file and configure:

```env
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
```

## Project Status

Active internal product under development.

Current version includes:

* Finance workflow management
* Master data review system
* Notification system
* User management foundation
* Reimbursement workflow support
* Dashboard UI improvements



Internal Use Only


