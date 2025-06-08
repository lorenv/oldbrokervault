import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";

// Add global error handlers to catch all errors
window.addEventListener('error', (event) => {
  console.error('=== GLOBAL ERROR HANDLER ===');
  console.error('Error:', event.error);
  console.error('Message:', event.message);
  console.error('Filename:', event.filename);
  console.error('Line:', event.lineno);
  console.error('Column:', event.colno);
  console.error('=============================');
});

window.addEventListener('unhandledrejection', (event) => {
  console.error('=== UNHANDLED PROMISE REJECTION ===');
  console.error('Reason:', event.reason);
  console.error('Promise:', event.promise);
  console.error('===================================');
});

createRoot(document.getElementById("root")!).render(<App />);
