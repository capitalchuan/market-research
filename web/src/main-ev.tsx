import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { CanvasThemeProvider } from "./shims/cursor-canvas";
import EvAssetPortfolio from "../../ev-asset-portfolio-model.canvas.tsx";
import "./index.css";

document.title = "组合测算 · EV 资产组合";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <CanvasThemeProvider>
      <EvAssetPortfolio />
    </CanvasThemeProvider>
  </StrictMode>,
);
