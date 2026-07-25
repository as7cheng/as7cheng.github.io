import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import PhotographyPage from "./pages/PhotographyPage";
import "./photography.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <PhotographyPage />
  </StrictMode>,
);
