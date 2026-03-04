import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import LanProbeTest from "./LanProbeTest.jsx";

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <LanProbeTest />
  </StrictMode>
);
