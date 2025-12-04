# Mekong Fish Dashboard

A comprehensive fish tracking and monitoring system for the Mekong River, built with Next.js 15 and Firebase.

## Features

- **User Authentication** - Role-based access control (Admin/Regular User)
- **Fishing Records Management** - Complete CRUD operations for fishing data
- **Fish Species Database** - Import and manage fish species information
- **Interactive Maps** - Google Maps integration for fishing spots and analysis
- **Water Level Monitoring** - Real-time data from Mekong and RID stations
- **Water Quality Tracking** - Monitor water quality metrics
- **Knowledge Base** - Fishing wisdom and educational articles
- **Analytics Dashboard** - Charts and statistics with Recharts
- **Landing Page** - Public-facing page with real-time statistics

## Tech Stack

- **Frontend**: Next.js 15 (App Router), Material-UI, Recharts
- **Backend**: Firebase (Authentication, Firestore)
- **Maps**: Google Maps API
- **Forms**: React Hook Form
- **Deployment**: Firebase App Hosting

## Getting Started

### Prerequisites

- Node.js 20.18.0 or higher
- Firebase project with Firestore enabled
- Google Maps API key

### Installation

1. Clone the repository:
```bash
git clone https://github.com/sunksun/mekong-fish-dashboard.git
cd mekong-fish-dashboard
```

2. Install dependencies:
```bash
npm install
```

3. Create a `.env.local` file with your Firebase and Google Maps credentials:
```env
NEXT_PUBLIC_FIREBASE_API_KEY=your_api_key
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your_auth_domain
NEXT_PUBLIC_FIREBASE_PROJECT_ID=your_project_id
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=your_storage_bucket
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
NEXT_PUBLIC_FIREBASE_APP_ID=your_app_id
NEXT_PUBLIC_GOOGLE_MAPS_API_KEY=your_maps_api_key
```

4. Run the development server:
```bash
npm run dev
```

5. Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

### Creating an Admin User

Run the admin setup script:
```bash
node src/lib/seed-admin.js
```

This will create an admin user with credentials:
- Email: admin@example.com
- Password: Admin123!

## Project Structure

```
src/
├── app/
│   ├── (auth)/           # Authentication pages
│   ├── (dashboard)/      # Protected dashboard pages
│   ├── api/              # API routes
│   └── landing/          # Public landing page
├── components/           # Reusable components
├── contexts/            # React contexts (Auth)
├── lib/                 # Firebase config and utilities
└── types/               # Type definitions
```

## Deployment

See [DEPLOYMENT.md](DEPLOYMENT.md) for detailed deployment instructions to Firebase App Hosting.

Quick deploy:
```bash
npm run build
npm run deploy
```

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial
- [Firebase Documentation](https://firebase.google.com/docs) - Firebase guides and API reference
- [Material-UI Documentation](https://mui.com/) - UI component library

## License

This project is licensed under the MIT License.
