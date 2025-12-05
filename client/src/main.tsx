import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";
import { setupGlobalErrorHandlers } from "./lib/error-reporter";

// Set up global error handlers for uncaught errors and unhandled rejections
setupGlobalErrorHandlers();

createRoot(document.getElementById("root")!).render(<App />);
