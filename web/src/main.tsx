import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { AtlasSideRail } from "./HeatMapChrome";
import { LocaleProvider } from "./locale";
import { MicroloanDesk } from "./MicroloanDesk";
import { CanvasThemeProvider } from "./shims/cursor-canvas";
import "./index.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <CanvasThemeProvider>
      <LocaleProvider>
        <AtlasSideRail>
          <MicroloanDesk />
        </AtlasSideRail>
      </LocaleProvider>
    </CanvasThemeProvider>
  </StrictMode>,
);
