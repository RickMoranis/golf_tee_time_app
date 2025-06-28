import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App'; // We will create this file next

// 1. Find the div with the id 'root' in our public/index.html file.
const container = document.getElementById('root');

// 2. Create a "root" for our React application to live inside that container.
const root = ReactDOM.createRoot(container);

// 3. Render our main <App /> component inside the root.
//    React.StrictMode is a helper that checks for potential problems in the app.
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
