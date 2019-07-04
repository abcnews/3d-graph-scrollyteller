import {
  Box3,
  Scene,
  PerspectiveCamera,
  CircleGeometry,
  Line,
  WebGLRenderer,
  MeshBasicMaterial,
  LineBasicMaterial,
  Vector3,
  Vector2,
  Mesh,
  Geometry,
  AxesHelper,
  Texture,
  LinearFilter,
  TextureLoader,
  SpriteMaterial,
  Sprite,
  Color
} from "three";
import { Interaction } from "three.interaction";

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

import { MeshLine, MeshLineMaterial } from "three.meshline";

export default class Canvas {
  constructor(nodes, edges, panels, opts = {}) {
    this.opts = Object.assign(
      {},
      {
        width: window.innerWidth,
        height: window.innerHeight,
        pixelRatio: window.devicePixelRatio,
        visibilityThreshold: 0,
        minOpacity: 0,
        nodeRadius: 5
      },
      opts
    );

    const { width, height, pixelRatio } = this.opts;

    // const resolution =

    // Batch multiple render calls (eg. from hover events)
    this.needsRender = false;

    // THREE instances
    this.scene = new Scene();
    this.scene.background = new Color(0x5f6b7a);
    this.camera = new PerspectiveCamera(75, width / height, 0.1, 1000);
    this.renderer = new WebGLRenderer();

    // For some reason Interaction is applied via a constructor
    new Interaction(this.renderer, this.scene, this.camera);

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
      // TODO: the actual textures should be power of 2 sized (eg. 256x256 to help with mipmaps)
      const spriteTexture = new TextureLoader().load(require("./sprite.jpg"));
      const spriteMaterial = new SpriteMaterial({
        map: spriteTexture,
        color: 0xffffff
      });

      const spriteHoverTexture = new TextureLoader().load(
        require("./sprite-hover.jpg")
      );
      const spriteHoverMaterial = new SpriteMaterial({
        map: spriteHoverTexture,
        color: 0xffffff
      });

      const sprite = new Sprite(spriteMaterial);

      sprite.on("mouseover", e => {
        // TODO: actually disply some kind of highlight and
        //      text box for the hovered data
        sprite.material = spriteHoverMaterial;

        const mouseEvent = e.data.originalEvent;

        console.log("mouse:", mouseEvent.clientX, mouseEvent.clientY);
        console.log(node.label, "-", node.type);

        // Batch render calls
        this.needsRender = true;
      });

      sprite.on("mouseout", e => {
        // TODO: actually disply some kind of highlight and
        //      text box for the hovered data
        sprite.material = spriteMaterial;
        // Batch render callss
        this.needsRender = true;
      });

      sprite.renderOrder = 1;
      // sprite.translateX(node.x);
      // sprite.translateY(node.y);
      // sprite.translateZ(node.z);
      sprite.scale.setScalar(40); // TODO: scale will depend on the actual texture

      this.scene.add(sprite);

      node.obj = sprite;
      node.material = spriteMaterial;

      // Labels
      const labelSprite = makeTextSprite(node.label);
      node.labelSprite = labelSprite;
      node.obj.add(labelSprite);
    });

    edges.forEach(edge => {
      const resolution = new Vector2(
        width * this.opts.pixelRatio,
        height * this.opts.pixelRatio
      );

      const material = new MeshLineMaterial({
        lineWidth: 3,
        sizeAttenuation: 0,
        color: 0xffffff,
        opacity: 1,
        transparent: true,
        resolution: resolution,
        near: this.camera.near,
        far: this.camera.far
      });

      const geometry = new Geometry();
      geometry.vertices.push(
        new Vector3(edge.source.x, edge.source.y, edge.source.z),
        new Vector3(edge.target.x, edge.target.y, edge.target.z)
      );
      const line = new MeshLine();
      line.setGeometry(geometry);

      const lineMesh = new Mesh(line.geometry, material);

      lineMesh.renderOrder = 0;

      this.scene.add(lineMesh);

      edge.obj = lineMesh;
      edge.material = material;
      edge.geometry = geometry;
      edge.line = line;
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
      element: p.nodes[0].parentElement,
      bearing: this.bearingFromConfig(p.config)
    }));

    const panelSeparation = getPanelSeparation(
      panels[0].element,
      panels[1].element
    );

    const loop = () => {
      const { nodes, edges, renderer, camera, simulation } = this;

      const panelsAboveTheFold = panels.filter(panel => {
        if (!panel.element) return false;
        const box = panel.element.getBoundingClientRect();
        return box.height !== 0 && box.top < fold;
      });

      const nextPanelIndex = panelsAboveTheFold.length - 1;
      const nextPanel = panelsAboveTheFold[nextPanelIndex] || panels[0];
      const prevPanel = panels[nextPanelIndex - 1];

      const nextPanelBounds = nextPanel.element.getBoundingClientRect();

      const progress =
        Math.ceil(fold + nextPanelBounds.height - nextPanelBounds.bottom) /
        (panelSeparation + nextPanelBounds.height);

      // Don't re-render on every frame, you fool.
      if (
        this.needsRender === false &&
        lastProgress === progress &&
        simulation.alpha() <= simulation.alphaMin()
      ) {
        rafRef = requestAnimationFrame(loop);
        return;
      }

      if (simulation.alpha() > simulation.alphaMin()) {
        simulation.tick();
        panels.forEach(p => {
          p.bearing = this.bearingFromConfig(p.config);
        });
      }

      lastProgress = progress;

      // Modify nodes
      nodes.forEach(n => {
        // Move the sprite
        n.obj.position.set(n.x, n.y, n.z);
        n.labelSprite.position.set(0, this.opts.nodeRadius * 1.1, 0);

        // Figure out visibility
        const previousOpacity = n.groups.reduce(
          opacityReducer(prevPanel ? prevPanel.config : {}),
          this.opts.minOpacity
        );

        const targetOpacity = n.groups.reduce(
          opacityReducer(nextPanel.config),
          this.opts.minOpacity
        );

        const displayOpacity = lerpedOpacity(
          previousOpacity,
          targetOpacity,
          progress
        );

        n.isVisible = displayOpacity > this.opts.visibilityThreshold;

        // Set opacity
        n.material.opacity = displayOpacity;
        n.labelSprite.material.opacity =
          displayOpacity > this.opts.visibilityThreshold ? displayOpacity : 0;
      });

      // Update the edges
      edges.forEach(e => {
        // Reposition

        e.geometry.vertices[0].set(e.source.x, e.source.y, e.source.z);
        e.geometry.vertices[1].set(e.target.x, e.target.y, e.target.z);
        e.line.setGeometry(e.geometry);

        // Highlight
        // console.log("e.source.material.opacity", e.source.material.opacity);
        e.material.opacity = Math.min(
          e.source.material.opacity,
          e.target.material.opacity
        );
      });

      // console.log("autoBearing", autoBearing.origin);

      const prevBearing = prevPanel
        ? prevPanel.bearing
        : this.bearingFromConfig();
      const nextBearing = nextPanel.bearing;
      const displayBearing = lerpedBearing(prevBearing, nextBearing, progress);

      this.positionCamera(displayBearing);
      renderer.render(this.scene, this.camera);
      if (typeof this.onRenderCallback === "function") {
        this.onRenderCallback({
          camera: { position: this.camera.position },
          bearing: displayBearing
        });
      }
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
    const { angle, origin, distance, phi } = bearing;
    const rad = (angle * Math.PI) / 180;
    camera.position.x = origin.x + Math.cos(rad) * distance;
    camera.position.z = origin.z + Math.sin(rad) * distance;
    camera.position.y = origin.y + Math.sin(rad) * Math.sin(phi) * distance;
    camera.lookAt(origin);
  }

  stop() {
    console.info("Stop");
    this.loop && this.loop.stop();
  }

  setSize(width, height) {
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
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
    if (!config)
      return {
        origin: { x: 0, y: 0, z: 0 },
        angle: 0,
        phi: 0.523599, // 30deg
        distance: 500
      };

    const bounds = new Box3();
    const nodes = this.nodes
      .map(n => {
        const { x, y, z } = n;
        const opacity = n.groups.reduce(
          opacityReducer(config),
          this.opts.minOpacity
        );

        return {
          point: new Vector3(x, y, z),
          isVisible: opacity > this.opts.visibilityThreshold
        };
      })
      .filter(n => n.isVisible);

    nodes.forEach(n => bounds.expandByPoint(n.point));

    const dims = new Vector3();
    bounds.getSize(dims);
    const width = dims.x || 1;
    const height = dims.y || 1;
    const depth = dims.z || 1;

    const phi =
      (-Math.PI / 2) * Math.pow(Math.E, -height / (2 * (depth + width)));
    // console.log("phi", phi);
    // console.log("dims", dims);
    const theta = (-Math.PI / 2) * Math.pow(Math.E, -depth / width);

    const radius = Math.max(
      width / Math.atan(Math.PI / 5),
      depth / Math.atan(Math.PI / 5),
      height / Math.atan(Math.PI / 5)
    );

    const center = new Vector3();
    bounds.getCenter(center);
    const defaults = {
      origin: center,
      angle: theta * (180 / Math.PI),
      phi,
      distance: radius
    };

    const { origin, angle, distance, x, y, z } = config;
    const node = this.nodes.find(
      (node, idx) => idx === +origin || node.label === origin
    ) || { x: 0, y: 0, z: 0 };

    return {
      origin: {
        x: x || node.x || defaults.origin.x || 0,
        y: y || node.y || defaults.origin.y || 0,
        z: z || node.z || defaults.origin.z || 0
      },
      angle: +angle || defaults.angle || 0,
      phi: +phi || defaults.phi || 0,
      distance: +distance || defaults.distance || 500
    };
  }

  toggleAxesHelper() {
    if (this.axesHelper) {
      this.scene.remove(this.axesHelper);
      this.axesHelper = null;
    } else {
      this.axesHelper = new AxesHelper(5000);
      this.scene.add(this.axesHelper);
    }
  }

  onRender(fn) {
    this.onRenderCallback = fn;
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
    phi: a.phi + (b.phi - a.phi) * pct,
    distance: a.distance + (b.distance - a.distance) * pct
  };
}

function opacityReducer(config) {
  return (max, g) => Math.max(max, +config[g] / 100 || 0);
}

function getPanelSeparation(a, b) {
  // Panel separation so we can later calculate the percentage for tween accurately
  const aBox = a.getBoundingClientRect();
  const bBox = b.getBoundingClientRect();

  // In case there is only one panel estimate the separation
  return bBox.top - aBox.bottom;
}

// https://bocoup.com/blog/learning-three-js-with-real-world-challenges-that-have-already-been-solved
function makeTextSprite(message, opts) {
  const parameters = opts || {};
  const fontface = parameters.fontface || "Helvetica";
  const fontsize = parameters.fontsize || 100;
  const canvas = document.createElement("canvas");
  const context = canvas.getContext("2d");
  context.font = fontsize + "px " + fontface;

  // get size data (height depends only on font size)
  const width = context.measureText(message).width;
  const height = fontsize;
  const padding = fontsize * 0.2;

  canvas.height = height + padding * 2;
  canvas.width = width + padding * 2;

  context.font = fontsize + "px " + fontface;

  context.fillStyle = "rgba(255,255,255,0.3)";
  roundRect(
    context,
    0,
    0,
    width + padding * 2,
    height + padding * 2,
    padding * 2
  );

  // text color
  context.lineWidth = fontsize / 10;
  context.strokeStyle = "rgba(0,0,0,0.3)";
  context.strokeText(message, padding, fontsize);
  context.fillStyle = "rgba(255, 255, 255, 1.0)";
  context.fillText(message, padding, fontsize);

  // canvas contents will be used for a texture
  const texture = new Texture(canvas);
  texture.minFilter = LinearFilter;
  texture.needsUpdate = true;

  const spriteMaterial = new SpriteMaterial({
    map: texture
  });
  const sprite = new Sprite(spriteMaterial);
  sprite.center.set(0.5, 0);
  const scale = 30;
  sprite.scale.set(scale, scale * (height / width), 1);
  return sprite;
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
}
