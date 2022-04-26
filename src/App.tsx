import { useState } from 'react';
import "mirada";
import './App.scss';
import { Intro } from './components/Intro';
import { Scanner } from './components/Scanner';

function App() {
  const [showIntro, setShowIntro] = useState(true);

  return (
    <div className="App">
      {
        showIntro &&
        <Intro onClickStart={() => setShowIntro(false)} />
      }
      {
        !showIntro &&
        <Scanner />
      }
    </div>
  );
}

export default App;
