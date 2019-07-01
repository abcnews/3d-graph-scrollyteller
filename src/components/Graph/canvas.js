import {
  Scene,
  PerspectiveCamera,
  CircleGeometry,
  Line,
  WebGLRenderer,
  MeshBasicMaterial,
  LineBasicMaterial,
  Vector3,
  Mesh,
  Geometry
} from "three";

import { easePoly } from "d3-ease";

import { OrbitControls } from "../../lib/OrbitControls";

import {
  forceSimulation,
  forceLink,
  forceManyBody,
  forceCenter,
  forceX,
  forceY,
  forceZ,
  forceCollide
} from "d3-force-3d";

export default class Canvas {
  constructor(nodes, edges, panels, opts = {}) {
    opts = Object.assign(
      {},
      {
        width: window.innerWidth,
        height: window.innerHeight,
        pixelRatio: window.devicePixelRatio
      },
      opts
    );

    const { width, height, pixelRatio } = opts;

    // THREE instances
    this.scene = new Scene();
    this.camera = new PerspectiveCamera(75, width / height, 0.1, 1000);
    this.renderer = new WebGLRenderer();

    // this.controls = new OrbitControls(camera, renderer.domElement);
    this.setSize(width, height);
    this.renderer.setPixelRatio(pixelRatio);

    // Force layout
    this.simulation = forceSimulation(nodes, 3)
      .force("link", forceLink(edges).distance(30))
      .force("charge", forceManyBody().strength(-100))
      // .force("center", forceCenter())
      .force("x", forceX())
      .force("y", forceY())
      .force("z", forceZ())
      .force("collide", forceCollide(10))
      .stop();

    nodes.forEach(node => {
      const geometry = new CircleGeometry(5, 32);
      const material = new MeshBasicMaterial({
        color: 0xffff00,
        depthTest: false,
        transparent: true,
        opacity: 0.2
      });
      const circle = new Mesh(geometry, material);

      circle.renderOrder = 1;
      circle.translateX(node.x);
      circle.translateY(node.y);
      circle.translateZ(node.z);

      this.scene.add(circle);

      node.obj = circle;
      node.material = material;
      node.geometry = geometry;
    });

    edges.forEach(edge => {
      const geometry = new Geometry();
      const material = new LineBasicMaterial({
        color: 0x00ff00,
        linewidth: 100,
        transparent: true,
        depthTest: false
      });

      geometry.vertices.push(
        new Vector3(edge.source.x, edge.source.y, edge.source.z),
        new Vector3(edge.target.x, edge.target.y, edge.target.z)
      );

      const line = new Line(geometry, material);

      line.renderOrder = 0;

      this.scene.add(line);

      edge.obj = line;
      edge.material = material;
      edge.geometry = geometry;
    });

    this.nodes = nodes;
    this.edges = edges;
    this.panels = panels;

    this.loop = this.start();
  }

  start() {
    let rafRef;
    let lastProgress = null;

    // Work out which panel is the current one
    const fold = window.innerHeight * 0.8;

    const panels = this.panels.map(p => ({
      ...p,
      element: p.nodes[0].parentElement
    }));

    const panelSeparation = getPanelSeparation(
      panels[0].element,
      panels[1].element
    );

    const loop = () => {
      const { nodes, edges, renderer, camera, simulation } = this;
      // TODO: replace this abomination with the proper scroll checking from Odyssey/Scrollyteller

      const panelsAboveTheFold = panels.filter(panel => {
        if (!panel.element) return false;
        const box = panel.element.getBoundingClientRect();
        return box.height !== 0 && box.top < fold;
      });

      const targetPanelIndex = panelsAboveTheFold.length - 1;
      const targetPanel = panelsAboveTheFold[targetPanelIndex] || panels[0];

      const previousPanel = panels[targetPanelIndex - 1];

      const targetBearing = this.bearingFromConfig(targetPanel.config);
      const previousBearing = this.bearingFromConfig(
        previousPanel && previousPanel.config
      );

      const targetVisibility = this.visibilityFromConfig(targetPanel.config);
      const previousVisibility = this.visibilityFromConfig(
        previousPanel && previousPanel.config
      );

      const targetPanelBox = targetPanel.element.getBoundingClientRect();
      const pixelsAboveFold = Math.ceil(
        fold + targetPanelBox.height - targetPanelBox.bottom
      );

      const progress =
        pixelsAboveFold / (panelSeparation + targetPanelBox.height);

      const displayBearing = lerpedBearing(
        previousBearing,
        targetBearing,
        progress
      );

      // console.log("displayOpacity", displayOpacity);

      // Don't re-render on every frame, you fool.
      if (
        lastProgress === progress &&
        simulation.alpha() <= simulation.alphaMin()
      ) {
        rafRef = requestAnimationFrame(loop);
        return;
      }

      if (simulation.alpha() > simulation.alphaMin()) {
        simulation.tick();
      }

      lastProgress = progress;

      // node1.material.opacity = 1 - progress;
      // node2.material.opacity = progress;

      // Modify nodes
      nodes.forEach(n => {
        // Make sure the nodes face the camera
        n.obj.lookAt(camera.position);

        // Move it
        n.obj.position.set(n.x, n.y, n.z);

        // Figure out visibility
        const previousOpacity = previousPanel
          ? n.groups.includes(previousPanel.config.highlight)
            ? previousVisibility.highlightpct
            : previousVisibility.lowlightpct
          : 0;

        const targetOpacity = n.groups.includes(targetPanel.config.highlight)
          ? targetVisibility.highlightpct
          : targetVisibility.lowlightpct;

        const displayOpacity = lerpedOpacity(
          previousOpacity,
          targetOpacity,
          progress
        );

        // Set highlight flag
        n.highlight = n.groups.includes(targetPanel.config.highlight);

        // Highlight
        n.material.opacity = displayOpacity;
      });

      // Update the edges
      edges.forEach(e => {
        // Reposition
        e.geometry.vertices = [
          new Vector3(e.source.x, e.source.y, e.source.z),
          new Vector3(e.target.x, e.target.y, e.target.z)
        ];
        e.geometry.verticesNeedUpdate = true;

        // Highlight
        // console.log("e.source.material.opacity", e.source.material.opacity);
        e.material.opacity = Math.min(
          e.source.material.opacity,
          e.target.material.opacity
        );
      });

      this.positionCamera(displayBearing);
      renderer.render(this.scene, this.camera);
      rafRef = requestAnimationFrame(loop);
    };

    loop.stop = () => {
      cancelAnimationFrame(rafRef);
    };

    loop();

    return loop;
  }

  positionCamera(bearing) {
    const { camera } = this;
    const { angle, origin, distance } = bearing;
    const rad = (angle * Math.PI) / 180;

    camera.position.x = origin.x + Math.cos(rad) * distance;
    camera.position.z = origin.z + Math.sin(rad) * distance;
    camera.position.y = origin.y + distance / 2;
    camera.lookAt(origin);
  }

  stop() {
    console.info("Stop");
    this.loop && this.loop.stop();
  }

  setSize(width, height) {
    this.camera.aspect = width / height;
    this.renderer.setSize(width, height);
  }

  setPanels(panels) {
    this.panels = panels;
  }

  getRenderer() {
    return this.renderer;
  }

  dispose() {
    this.stop();
    console.info("Dispose");
    const { nodes, edges, scene, renderer } = this;
    nodes.forEach(n => {
      n.material.dispose();
      n.geometry.dispose();
    });
    edges.forEach(e => {
      e.material.dispose();
      e.geometry.dispose();
    });
    scene.dispose();
    renderer.dispose();
  }

  visibilityFromConfig(config) {
    const c = Object.assign(
      {
        lowlightpct: 20,
        highlightpct: 100
      },
      config
    );
    return {
      lowlightpct: c.lowlightpct / 100,
      highlightpct: c.highlightpct / 100
    };
  }

  bearingFromConfig(config) {
    if (!config) {
      return {
        origin: { x: 0, y: 0, z: 0 },
        angle: 0,
        distance: 500
      };
    }

    const { origin, angle, distance, x, y, z } = config;
    const node = this.nodes.find(
      (node, idx) => idx === +origin || node.label === origin
    ) || { x: 0, y: 0, z: 0 };

    return {
      origin: { x: x || node.x || 0, y: y || node.y || 0, z: z || node.z || 0 },
      angle: +angle || 0,
      distance: +distance || 500
    };
  }
}

function lerpedOpacity(a, b, pct) {
  // console.log("a,b,pct", a, b, pct);

  return a + (b - a) * easePoly(pct, 4);
}

function lerpedBearing(a, b, pct) {
  return {
    origin: new Vector3(
      a.origin.x + (b.origin.x - a.origin.x) * pct,
      a.origin.y + (b.origin.y - a.origin.y) * pct,
      a.origin.z + (b.origin.z - a.origin.z) * pct
    ),
    angle: a.angle + (b.angle - a.angle) * pct,
    distance: a.distance + (b.distance - a.distance) * pct
  };
}

function getPanelSeparation(a, b) {
  // Panel separation so we can later calculate the percentage for tween accurately
  const aBox = a.getBoundingClientRect();
  const bBox = b.getBoundingClientRect();

  // In case there is only one panel estimate the separation
  return bBox.top - aBox.bottom;
}
