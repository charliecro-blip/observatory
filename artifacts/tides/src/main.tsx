import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import "./index.css";
import { installGlobalErrorReporting } from "./lib/errorReport";
import { installSessionInterceptor } from "./lib/session";

// Before the first render, so a crash during boot is still reported.
installGlobalErrorReporting();
// And before the first fetch, so no /api request ever leaves without the
// session credential the server now requires of claimed accounts.
installSessionInterceptor();

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
