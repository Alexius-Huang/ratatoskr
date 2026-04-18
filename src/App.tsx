import { Sidebar } from './components/Sidebar';
import { MainPane } from './components/MainPane';

function App() {
  return (
    <div className="flex h-screen w-screen bg-white text-gray-900">
      <Sidebar />
      <MainPane />
    </div>
  );
}

export default App;
