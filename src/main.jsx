import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.jsx';
import './index.css';

// Create the root element and render the App. Using React 18's
// createRoot API allows for concurrent rendering and improved
// performance.  The CSS import applies global styles and basic
// typography.
const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
