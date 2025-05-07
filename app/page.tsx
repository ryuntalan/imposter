import Link from 'next/link';

export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-4 bg-gray-100">
      <div className="max-w-md w-full space-y-8 p-8 bg-white rounded-xl shadow-lg">
        <div className="text-center">
          <h1 className="text-4xl font-extrabold text-indigo-600 mb-2">Impostor</h1>
          <p className="text-gray-600 text-xl mb-6">A multiplayer party game</p>
        </div>
        
        <div className="space-y-4">
          <Link
            href="/create"
            className="w-full flex items-center justify-center px-4 py-3 border border-transparent text-base font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
          >
            Create a Game
          </Link>
          
          <Link
            href="/join"
            className="w-full flex items-center justify-center px-4 py-3 border border-indigo-600 text-base font-medium rounded-md text-indigo-600 bg-white hover:bg-indigo-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
          >
            Join a Game
          </Link>
        </div>
        
        <div className="mt-6 text-center">
          <p className="text-sm text-indigo-700 font-medium">Gather your friends and find the impostor!</p>
        </div>
      </div>
    </main>
  );
}
