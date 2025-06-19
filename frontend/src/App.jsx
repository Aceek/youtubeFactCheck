import HomePage from './pages/HomePage';

function App() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-blue-900/50 to-gray-900 text-white font-sans">
      <header className="py-6 bg-black/30 backdrop-blur-lg shadow-lg border-b border-cyan-400/20">
        <div className="container mx-auto px-4 text-center">
          <h1 className="text-4xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-fuchsia-500 animate-pulse">
            FactCheckTube
          </h1>
          <p className="text-lg text-cyan-200/80 mt-1">
            Votre copilote pour la vérité sur YouTube
          </p>
        </div>
      </header>
      <main className="container mx-auto px-4 lg:px-8 py-12">
        <HomePage />
      </main>
      <footer className="text-center p-6 text-gray-400 text-sm mt-auto">
        <p>Développé avec ❤️ pour un web plus éclairé.</p>
      </footer>
    </div>
  );
}

export default App;