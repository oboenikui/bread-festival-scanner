import React from 'react';
import { render, screen } from '@testing-library/react';
import App from './App';

let initializeResulver = (value: void) => { };
const initializeProimse = new Promise((resolve) => initializeResulver = resolve);

(global as { [key: string]: any })["Module"] = {
  onRuntimeInitialized: initializeResulver,
};
(global as { [key: string]: any })["cv"] = require("../public/opencv");

test('renders learn react link', () => {
  render(<App />);
  // const linkElement = screen.getByText(/learn react/i);
  // expect(linkElement).toBeInTheDocument();
});
