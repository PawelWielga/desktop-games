import React from "react";
import ReactDOM from "react-dom/client";
import { StrictMode } from "react";
import App from "./App";
import { restoreGitHubPagesSpaRoute } from "./routing/githubPagesSpa";
import "./styles/base.css";
import "./index.css";
import "./styles/responsive.css";

restoreGitHubPagesSpaRoute();

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <StrictMode>
    <App />
  </StrictMode>
);
