import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import NetDiag from "./LanProbeTest.jsx";

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <NetDiag />
  </StrictMode>
);
