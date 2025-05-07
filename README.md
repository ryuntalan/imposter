# Impostor - Multiplayer Party Game

A real-time multiplayer party game built with Next.js and Supabase.

## Features

- Create game rooms and invite friends via shareable link
- Join existing game rooms using a 6-character room code
- Real-time updates for player lists and game state
- Role assignment (host, player, impostor)

## Tech Stack

- **Frontend**: Next.js with TypeScript and Tailwind CSS
- **Backend**: Supabase (Postgres, Auth, Realtime)

## Prerequisites

- Node.js 18+ and npm
- A Supabase account and project

## Setup

1. **Clone the repository**

```bash
git clone <repository-url>
cd impostor
```

2. **Install dependencies**

```bash
npm install
```

3. **Set up Supabase**

- Create a new Supabase project at https://supabase.io
- Go to Project Settings > API and copy the URL and anon key
- Create a `.env.local` file in the project root with the following content:

```
NEXT_PUBLIC_SUPABASE_URL=your-supabase-url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-supabase-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-supabase-service-role-key
```

4. **Set up the database schema**

- In your Supabase project, go to the SQL Editor
- Create a new query and paste the contents of `supabase/schema.sql`
- Run the query to create the tables and functions

## Development

Run the development server:

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

## Game Flow

1. The host creates a new game room
2. Players join the room using the room code
3. The host starts the game
4. Players are assigned roles (most are regular players, one is the impostor)
5. Players interact and try to identify the impostor

## Future Enhancements

- In-game chat
- Voting system to identify the impostor
- Custom game themes and categories
- Game history and statistics

## License

MIT
