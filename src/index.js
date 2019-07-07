import React from "react";
import { render } from "react-dom";
import App from "./components/App";
import { spanify } from "spanify"

spanify(); // Convert CoreMedia anchor-spans into span tags

const PROJECT_NAME = "3d-graph-scrollyteller";
const root = document.querySelector(`[data-${PROJECT_NAME}-root]`);

import { loadOdysseyScrollyteller } from "@abcnews/scrollyteller";

const scrollyData = loadOdysseyScrollyteller(
  "", // If set to eg. "one" use #scrollytellerNAMEone in CoreMedia
  "u-full", // Class to apply to mount point u-full makes it full width in Odyssey
  "mark" // Name of marker in CoreMedia eg. for "point" use #point default: #mark
);

function init() {
  render(
    <App
      panels={scrollyData.panels}
      projectName={PROJECT_NAME}
      data={root.dataset.url}
    />,
    scrollyData.mountNode
  );
}

init();

if (module.hot) {
  module.hot.accept("./components/App", () => {
    try {
      init();
    } catch (err) {
      import("./components/ErrorBox").then(exports => {
        const ErrorBox = exports.default;
        render(<ErrorBox error={err} />, root);
      });
    }
  });
}

if (process.env.NODE_ENV === "development") {
  import("./lib/stats");
  console.debug(`[${PROJECT_NAME}] public path: ${__webpack_public_path__}`);
}
