# #ADASayembara - Shoot & Win Queue System

A production-ready queue management system built with React and Supabase for the Shoot & Win event.

## Features

### Core Functionality
- ✅ Real-time queue management with Supabase
- ✅ User queue joining with ticket assignment
- ✅ Admin controls for queue advancement
- ✅ Live notifications (sound + browser notifications)
- ✅ QR code generation for easy access

### Production-Ready Features (Implemented)

#### 1. Environment Variables ✅
- All sensitive credentials stored in `.env` file
- No hardcoded API keys or passwords

#### 2. Error Handling ✅
- React Error Boundary for graceful error recovery
- Try-catch blocks on all async operations
- User-friendly error messages
- Console logging for debugging

#### 3. Authentication ✅
- Password-protected admin controls
- Session-based authentication
- No unauthorized queue manipulation

#### 4. Database Schema with RLS ✅
- Properly structured Supabase tables
- Row Level Security (RLS) policies
- Public read access, authenticated write access
- Rate limiting table for abuse prevention

#### 5. Real-time Subscriptions ✅
- Replaced polling with Supabase Realtime
- Automatic queue updates across all clients
- Connection status monitoring
- Automatic reconnection handling

#### 6. Input Validation & Rate Limiting ✅
- Name validation (2-50 characters, alphanumeric)
- Client-side rate limiting (3 attempts/minute)
- Sanitized inputs to prevent XSS
- Server-side validation via database constraints

## Setup Instructions

### 1. Prerequisites
- Node.js 18+ installed
- Supabase account (free tier works)

### 2. Supabase Setup

1. Create a new project at [supabase.com](https://supabase.com)

2. Run the SQL schema from `supabase-schema.sql` in your Supabase SQL editor:
   - Go to SQL Editor in Supabase dashboard
   - Copy the entire contents of `supabase-schema.sql`
   - Execute the query

3. Get your credentials:
   - Go to Settings > API
   - Copy your Project URL
   - Copy your anon/public key

### 3. Local Setup

1. Install dependencies:
```bash
npm install
```

2. Create `.env` file:
```bash
cp .env.example .env
```

3. Edit `.env` with your credentials:
```env
REACT_APP_SUPABASE_URL=https://xxxxx.supabase.co
REACT_APP_SUPABASE_ANON_KEY=your_anon_key_here
REACT_APP_ADMIN_PASSWORD=your_secure_password_here
```

4. Start development server:
```bash
npm run dev
```

### 4. Production Build

```bash
npm run build
```

The production build will be in the `dist/` folder.

## Deployment

### Vercel (Recommended)
1. Install Vercel CLI: `npm i -g vercel`
2. Run: `vercel`
3. Add environment variables in Vercel dashboard

### Netlify
1. Install Netlify CLI: `npm i -g netlify-cli`
2. Run: `netlify deploy --prod`
3. Add environment variables in Netlify dashboard

### Other Platforms
- Upload the `dist/` folder
- Set environment variables in platform settings
- Ensure proper routing for SPA

## Security Features

### Authentication
- Admin controls require password authentication
- Password stored in environment variable (not in code)
- Session-based auth for admin actions

### Database Security
- Row Level Security (RLS) enabled on all tables
- Public can only read and insert queue entries
- Updates/deletes require authentication
- Rate limiting table to track abuse

### Input Validation
- Name length: 2-50 characters
- Alphanumeric + basic punctuation only
- XSS prevention through validation
- Client-side rate limiting (3/min)

### Rate Limiting
- Join queue: 3 attempts per minute
- Prevents spam and abuse
- Configurable limits

## File Structure

```
├── Home-production.js      # Main production-ready component
├── Home.js                  # Original file (for reference)
├── main.jsx                 # Entry point
├── index.html               # HTML template
├── package.json             # Dependencies
├── vite.config.js          # Build configuration
├── supabase-schema.sql     # Database schema
├── .env.example            # Environment template
├── .env                    # Your credentials (gitignored)
└── README.md               # This file
```

## Database Schema

### queue_entries
- `id` (UUID): Primary key
- `ticket` (INTEGER): Queue number
- `name` (TEXT): User name (1-100 chars)
- `status` (TEXT): 'waiting', 'current', or 'completed'
- `created_at` (TIMESTAMP): Entry creation time
- `updated_at` (TIMESTAMP): Last update time

### system_state
- `id` (INTEGER): Always 1
- `current_queue` (INTEGER): Current queue number
- `updated_at` (TIMESTAMP): Last update time

### admin_users
- `id` (UUID): Primary key
- `username` (TEXT): Admin username
- `password_hash` (TEXT): Hashed password
- `created_at` (TIMESTAMP): Creation time

### rate_limit
- `id` (UUID): Primary key
- `ip_address` (TEXT): Client IP
- `action` (TEXT): Action type
- `created_at` (TIMESTAMP): Attempt time

## Usage

### For Attendees
1. Open the queue system URL
2. Enter your name
3. Click "Get Queue Number"
4. Wait for your turn (notifications enabled)

### For Admins
1. Click "Show" on Admin Controls
2. Enter admin password
3. Use "Next Queue" to advance
4. Use "Show QR Code" for easy sharing
5. Use "Reset Queue" to start over

## Troubleshooting

### "Demo Mode" displayed
- Check your `.env` file exists
- Verify Supabase credentials are correct
- Restart the dev server

### Connection issues
- Check Supabase project is active
- Verify RLS policies are set up correctly
- Check browser console for errors

### Admin controls not working
- Verify admin password in `.env`
- Check authentication is successful
- Look for errors in console

## Support

For issues or questions, contact:
- Ilsa (SGA)
- Victor
- Ashraf

## License

Private - Event use only
