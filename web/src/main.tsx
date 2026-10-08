import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { AtlasSideRail } from "./HeatMapChrome";
import { MicroloanDesk } from "./MicroloanDesk";
import { CanvasThemeProvider } from "./shims/cursor-canvas";
import "./index.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <CanvasThemeProvider>
      <AtlasSideRail>
        <MicroloanDesk />
      </AtlasSideRail>
    </CanvasThemeProvider>
  </StrictMode>,
);
