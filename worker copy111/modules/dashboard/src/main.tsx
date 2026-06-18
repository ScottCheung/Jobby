import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';

const containerId = 'bot-dashboard-root';
let container = document.getElementById(containerId);
if (container) {
  container.remove();
}

container = document.createElement('div');
container.id = containerId;
document.body.appendChild(container);

const root = ReactDOM.createRoot(container);
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
