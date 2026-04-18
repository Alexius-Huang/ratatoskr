import { Sidebar } from './components/Sidebar';
import { MainPane } from './components/MainPane';

function App() {
  return (
    <div className="flex h-screen w-screen bg-nord-0 text-nord-6">
      <Sidebar />
      <MainPane />
    </div>
  );
}

export default App;
