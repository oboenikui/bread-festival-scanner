import { useEffect, useState } from 'react';
import "mirada";
import './App.scss';
import { Intro } from './components/Intro';
import { Scanner } from './components/Scanner';

function App() {
  const [showIntro, setShowIntro] = useState(true);

  useEffect(() => {
    const html = document.querySelector("html");
    if (html === null) {
      return;
    }
    html!.style.height = "100%"
    const percentHeight = html.offsetHeight;

    html.style.height = "100vh"
    const vhHeight = html.offsetHeight;
    const addressBarHeight = vhHeight - percentHeight;
    document.documentElement.style.setProperty('--address-bar-height', `${addressBarHeight}px`);

  }, [])

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
