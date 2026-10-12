import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import { UserAuthProvider } from "./components/UserAuthProvider";
import "./styles.css";

const isAdminRoute = window.location.pathname.replace(/\/+$/, "") === "/admin";
const app = <App />;

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    {isAdminRoute ? app : <UserAuthProvider>{app}</UserAuthProvider>}
  </React.StrictMode>,
);
