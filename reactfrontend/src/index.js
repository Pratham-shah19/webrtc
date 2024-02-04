import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import AppWithContext from './App';

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    <AppWithContext />
  </React.StrictMode>
);

