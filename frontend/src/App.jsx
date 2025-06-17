import HomePage from './pages/HomePage';

function App() {
  return (
    <div className="min-h-screen bg-gray-900 text-white font-sans">
      <header className="py-4 bg-gray-800/50 backdrop-blur-sm border-b border-gray-700">
        <div className="container mx-auto px-4">
          <h1 className="text-2xl font-bold text-cyan-400">FactCheckTube</h1>
          <p className="text-sm text-gray-400">Analyse et vérification des faits des vidéos YouTube</p>
        </div>
      </header>
      <main className="mx-auto px-4 lg:px-8 py-8">
        <HomePage />
      </main>
       <footer className="text-center p-4 text-gray-500 text-xs mt-auto">
        <p>Développé avec passion. Données fournies à titre indicatif.</p>
      </footer>
    </div>
  );
}

export default App;