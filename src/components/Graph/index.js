import React, { useRef, useEffect, useState } from "react";
import { render } from "react-dom";
import PropTypes from "prop-types";
import styles from "./styles.scss";
import Canvas from "./canvas";

const Graph = ({ nodes, edges, panels }) => {
  const domNode = useRef();
  const canvas = useRef();

  console.info("Graph re-render");

  const toggleOrbital = () => {
    if (!isOrbital) setIsOrbital(true);
    else setIsOrbital(false);
  };

  useEffect(() => {
    console.info("Creating canvas");
    const scrollyConf = panels[0].config;
    const config = {};
    [
      "width",
      "height",
      "pixelRatio",
      "minOpacity",
      "visibilityThreshold",
      "nodeRadius",
      "edgeDistance",
      "chargeStrength"
    ].reduce((config, option) => {
      const key = option.toLowerCase();
      if (scrollyConf[key]) config[option] = scrollyConf[key];
      return config;
    }, {});

    canvas.current = new Canvas(nodes, edges, panels, config);

    return () => canvas.current.dispose();
  }, [nodes, edges, canvas]);

  useEffect(() => {
    domNode.current.appendChild(canvas.current.getRenderer().domElement);
    console.info("DOM node changed");

    if (process.env.NODE_ENV === "development") {
      import("../GraphDebugPanel").then(module => {
        const GraphDebugPanel = module.default;
        const node = document.createElement("div");
        document.body.appendChild(node);
        render(<GraphDebugPanel canvas={canvas.current} />, node);
      });
    }
  }, [domNode.current, canvas]);

  useEffect(() => {
    const resize = () => {
      canvas.current.setSize(window.innerWidth, window.innerHeight);
    };
    window.addEventListener("resize", resize);
    return () => window.removeEventListener("resize", resize);
  });

  return (
    <div id="relativeParent" style={{ position: "relative" }} ref={domNode} />
  );
};

Graph.propTypes = {
  nodes: PropTypes.array.isRequired,
  edges: PropTypes.array.isRequired,
  panels: PropTypes.array.isRequired
};

export default Graph;
