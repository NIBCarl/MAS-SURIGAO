# MAS-AMICUS Attendance System

An offline-first attendance tracking system for MAS-AMICUS religious organization.

## Features

- **🔐 Role-Based Access**: Admin, Secretary, and Member roles
- **📱 QR Code Check-in**: Fast QR scanning for attendance
- **📴 Offline-First**: Works without internet, syncs when reconnected
- **📊 Real-time Stats**: Live attendance counters and punctuality tracking
- **🎨 Beautiful UI**: Gold/Blue color scheme, mobile-first design

## Tech Stack

- **Framework**: Next.js 15 with App Router
- **Language**: TypeScript
- **Styling**: Tailwind CSS + shadcn/ui
- **Database**: Supabase PostgreSQL + Dexie.js (IndexedDB for offline)
- **Auth**: Supabase Auth
- **PWA**: next-pwa for offline support
- **QR**: qrcode.react + @zxing/browser

## Getting Started

### 1. Environment Setup

Copy the environment file and fill in your Supabase credentials:

```bash
cp .env.local.example .env.local
```

Edit `.env.local` with your Supabase project URL and anon key:
```
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
```

### 2. Supabase Setup

1. Create a new project at [supabase.com](https://supabase.com)
2. Go to the SQL Editor
3. Copy the contents of `supabase/schema.sql`
4. Run the SQL to create tables, indexes, and RLS policies

### 3. Install Dependencies

```bash
npm install
```

### 4. Run Development Server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

## User Roles

### Admin
- Full system access
- View analytics and reports
- Export data to CSV
- Manage members and events

### Secretary
- Check-in members via QR scan
- Manual search and check-in
- Register new members
- View attendance lists

### Member
- View personal QR code
- Download/share QR code
- View attendance stats
- Track punctuality

## Offline Features

The app is designed to work entirely offline:

1. **Local Database**: Uses IndexedDB via Dexie.js to store all data locally
2. **Sync Queue**: All changes are queued and synced automatically when online
3. **Background Sync**: Service Worker handles sync even when app is closed
4. **Conflict Resolution**: Smart merging when multiple devices check in the same person

## Project Structure

```
my-app/
├── app/                    # Next.js App Router
│   ├── admin/             # Admin dashboard
│   ├── secretary/         # Secretary check-in hub
│   ├── member/            # Member QR and stats
│   ├── auth/              # Login page
│   └── api/               # API routes
├── components/
│   ├── ui/                # shadcn/ui components
│   └── shared/            # Shared components
├── hooks/                 # React hooks
│   ├── useAuth.ts         # Authentication
│   ├── useSync.ts         # Sync engine
│   └── useOnlineStatus.ts # Online/offline detection
├── lib/                   # Utilities and configs
│   ├── db/                # Dexie.js database
│   ├── sync/              # Sync engine
│   ├── supabase.ts        # Supabase client
│   └── utils/             # Helper functions
├── types/                 # TypeScript types
└── supabase/
    └── schema.sql         # Database schema
```

## Deployment

### Vercel (Recommended)

1. Push your code to GitHub
2. Connect your repository to Vercel
3. Add environment variables in Vercel dashboard
4. Deploy!

### Other Platforms

The app can be deployed to any platform that supports Next.js:
- Netlify
- Railway
- DigitalOcean
- AWS

## PWA Installation

The app is a Progressive Web App (PWA) and can be installed on mobile devices:

### iOS (Safari)
1. Open the app in Safari
2. Tap the Share button
3. Tap "Add to Home Screen"

### Android (Chrome)
1. Open the app in Chrome
2. Tap the menu (⋮)
3. Tap "Add to Home screen"

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Submit a pull request

## License

MIT License - feel free to use for your organization!

## Support

For questions or issues, please contact the MAS-AMICUS IT Committee.
