import Link from 'next/link';

export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-primary p-4">
      <div className="flex-grow flex flex-col justify-center items-center w-full space-y-6 p-4 sm:p-6 md:p-8 bg-white rounded-xl m-5 sm:m-10 md:m-20 lg:m-20 
                    max-h-[calc(100vh-40px)] sm:max-h-[calc(100vh-80px)] md:max-h-[calc(100vh-160px)]
                    max-w-[calc(100vw-40px)] sm:max-w-[calc(100vw-80px)] md:max-w-[calc(100vw-160px)]">
        <div className="text-center">
          <h1 className="text-4xl sm:text-5xl md:text-6xl font-medium text-black mb-2 font-heading">Impostor</h1>
        </div>
        
        <div className="flex flex-col items-center space-y-4 mb-6 sm:mb-8 md:mb-12 w-full max-w-xs">
          <Link
            href="/create"
            className="w-full sm:w-64 flex items-center justify-center px-4 py-3 border border-transparent text-base font-medium rounded-md text-white bg-primary hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary"
          >
            Create a Game
          </Link>
          
          <Link
            href="/join"
            className="w-full sm:w-64 flex items-center justify-center px-4 py-3 border border-primary text-base font-medium rounded-md text-primary bg-white hover:bg-primary/5 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary"
          >
            Join a Game
          </Link>
        </div>
        
        <div className="text-center w-full max-w-lg mt-4 sm:mt-6 md:mt-8 px-2">
          <h2 className="text-lg font-medium text-black mb-2">How to Play</h2>
          <ol className="text-sm text-gray-600 text-left list-decimal pl-5 space-y-1">
            <li>One player is secretly chosen to be the imposter.</li>
            <li>Everyone gets a question. The imposter gets a slightly different version.</li>
            <li>All players write a short answer to their question.</li>
            <li>Answers are shown with each player&apos;s name.</li>
            <li>Everyone discusses and votes on who they think the imposter is.</li>
            <li>If the group guesses correctly, they win. If not, the imposter wins.</li>
          </ol>
        </div>
      </div>
    </main>
  );
}
