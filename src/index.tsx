import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import './App.scss';
import "mirada";
import { Intro } from './components/Intro';
import { Scanner } from './components/Scanner';
import reportWebVitals from './reportWebVitals';
import { createHashRouter, RouterProvider } from 'react-router-dom';
// import { Debug } from './components/Debug';

const router = createHashRouter([
  {
    path: "/",
    element: <Intro />,
  },
  {
    path: "/scanner",
    element: <Scanner />
  },
  // {
  //   path: "/debug",
  //   element: <Debug />
  // },
]);

function setupHeight() {
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
}
setupHeight();

const root = ReactDOM.createRoot(
  document.getElementById('root') as HTMLElement
);
root.render(
  <React.StrictMode>
    <div className='App'>
      <RouterProvider router={router} />
    </div>
  </React.StrictMode>
);

// If you want to start measuring performance in your app, pass a function
// to log results (for example: reportWebVitals(console.log))
// or send to an analytics endpoint. Learn more: https://bit.ly/CRA-vitals
reportWebVitals();
