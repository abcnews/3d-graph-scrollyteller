import {
  Box3,
  Scene,
  PerspectiveCamera,
  Line,
  WebGLRenderer,
  LineBasicMaterial,
  Vector3,
  Vector2,
  Mesh,
  Geometry,
  AxesHelper,
  SpriteMaterial,
  TextureLoader,
  Sprite,
  Color,
  Raycaster,
  Box3Helper
} from "three";

import { easePoly } from "d3-ease";

import { getKeyframePanels, getProgressBetween } from "./utils";

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
} from "../../lib/d3Force3d"; // changed from "d3-force-3d" to enable es5 transpilation

import { MeshLine, MeshLineMaterial } from "three.meshline";
import styles from "./styles.scss";

const spriteTexture = new TextureLoader().load(require("./sprite.png"));
const OUTLINE_COLOR = 0xffffff;
const DEFAULT_COLOR = 0xffffff;
const DISABLED_COLOR = 0x4a505b;

const colours = {
  red: 0xcb4c48,
  blue: 0x03809c,
  purple: 0x7b68c9
};

export default class Canvas {
  constructor(nodes, edges, panels, opts = {}) {
    this.opts = Object.assign(
      {},
      {
        width: window.innerWidth,
        height: window.innerHeight,
        pixelRatio: window.devicePixelRatio,
        minOpacity: 0,
        visibilityThreshold: 0.1,
        nodeRadius: 5
      },
      opts
    );

    const { width, height, pixelRatio } = this.opts;
    // Batch multiple render calls (eg. from hover events)
    this.needsRender = false;

    this.isOrbital = false;
    this.isExplore = false;

    // THREE instances
    this.scene = new Scene();
    this.scene.background = new Color(0x5f6b7a);
    this.camera = new PerspectiveCamera(75, width / height, 0.1, 1000);
    this.renderer = new WebGLRenderer({ antialias: false });

    // Trying OrbitControls
    this.controls = new OrbitControls(this.camera, this.renderer.domElement);

    this.controls.autoRotate = true;
    this.controls.enabled = false;
    this.controls.autoRotateSpeed = 1;
    this.controls.enableZoom = true;

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

    //
    // CREATE CIRCLES
    //
    nodes.forEach(node => {
      const circleMaterial = new SpriteMaterial({
        map: spriteTexture,
        color: DEFAULT_COLOR,
        depthTest: false
      });
      const outlineMaterial = new SpriteMaterial({
        map: spriteTexture,
        color: OUTLINE_COLOR,
        depthTest: false
      });

      const circle = new Sprite(circleMaterial);
      const outline = new Sprite(outlineMaterial);

      outline.renderOrder = 9;
      outline.scale.setScalar(this.opts.nodeRadius * 1.2);
      this.scene.add(outline);

      circle.renderOrder = 10;
      circle.scale.setScalar(this.opts.nodeRadius);
      this.scene.add(circle);

      // Put them on the node object so we can access them on re-renders
      node.obj = circle;
      node.outline = outline;

      // Labels
      const label = document.createElement("div");
      label.className = styles.label;
      document.querySelector("#relativeParent").appendChild(label);
      label.innerText = node.shortLabel || node.label;
      node.labelElement = label;
    });

    // Using css max-width leaves width as max-width
    // This uses a trick to fit the bounds snug to the wrapped text
    //  TODO: is there any reason to do this outside the nodes.forEach above?
    let d = document.querySelectorAll("." + styles.label),
      i,
      w,
      labelWidth,
      labelHeight;

    for (i = 0; i < d.length; i++) {
      labelWidth = d[i].offsetWidth;
      labelHeight = d[i].offsetHeight;

      for (w = labelWidth; w; w--) {
        d[i].style.width = w + "px";
        if (d[i].offsetHeight !== labelHeight) break;
      }

      if (w < d[i].scrollWidth) {
        d[i].style.width = d[i].style.maxWidth = d[i].scrollWidth + "px";
      } else {
        d[i].style.width = w + 1 + "px";
      }
    }

    //
    // CREATE LINES
    //
    edges.forEach(edge => {
      const resolution = new Vector2(
        width * this.opts.pixelRatio,
        height * this.opts.pixelRatio
      );

      const material = new MeshLineMaterial({
        lineWidth: 8,
        sizeAttenuation: 0,
        color: 0xffffff,
        opacity: 1,
        transparent: true,
        resolution: resolution,
        near: this.camera.near,
        far: this.camera.far,
        depthWrite: false
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
    this.raycaster = new Raycaster();
    this.mouse = new Vector2();

    window.addEventListener("mousemove", e => {
      e.preventDefault();
      this.mouse.x = (e.clientX / window.innerWidth) * 2 - 1;
      this.mouse.y = -(e.clientY / window.innerHeight) * 2 + 1;
    });

    this.loop = this.start();
  }

  start() {
    let rafRef;
    let lastProgress = null;

    // Work out which panel is the current one
    const fold = window.innerHeight * 0.8;

    const panels = this.panels.map(p => {
      const reducer = opacityReducer(p.config);
      return {
        ...p,
        element: p.nodes[0].parentElement,
        bearing: this.bearingFromConfig(p.config),
        nodeVisibilities: this.nodes.map((n, i) => {
          return n.groups.reduce(reducer, this.opts.minOpacity);
        }),
        nodeColours: this.nodes.map((n, i) => {
          const isHighlighted = []
            .concat(p.config.show)
            .some(code => code === labelToCode(n.label));

          const visibility = n.groups.reduce(reducer, this.opts.minOpacity);

          const innerColor = isHighlighted
            ? colours[n.highlightColor] || DEFAULT_COLOR
            : DEFAULT_COLOR;

          const res = {
            isHighlighted,
            inner: new Color(DISABLED_COLOR).lerp(
              new Color(innerColor),
              visibility
            ),
            outer: new Color(DISABLED_COLOR).lerp(
              new Color(OUTLINE_COLOR),
              visibility
            )
          };
          return res;
        })
      };
    });

    const panelSeparation = getPanelSeparation(
      panels[0].element,
      panels[1].element
    );

    const loop = () => {
      const { nodes, edges, renderer, camera, simulation } = this;

      // Check for hovers
      // TODO: remember previous intersects to more accurately detect mouseout
      this.raycaster.setFromCamera(this.mouse, this.camera);
      const intersections = this.raycaster
        .intersectObjects(nodes.map(n => n.obj))
        .map(o => o.object);
      if (intersections.length > 0) this.needsRender = true;

      const [prevPanel, nextPanel] = getKeyframePanels(panels, fold);

      const progress = getProgressBetween(
        prevPanel,
        nextPanel,
        fold,
        panelSeparation
      );

      this.needsRender =
        this.needsRender ||
        lastProgress !== progress ||
        simulation.alpha() > simulation.alphaMin() ||
        this.isOrbital ||
        this.isExplore;

      // By here we must know if a re-render is required.
      if (this.needsRender === false) {
        rafRef = requestAnimationFrame(loop);
        return;
      }

      this.needsRender = false;

      if (simulation.alpha() > simulation.alphaMin()) {
        simulation.tick();
        panels.forEach(p => {
          p.bearing = this.bearingFromConfig(p.config);
        });
      }

      lastProgress = progress;

      // Modify nodes
      nodes.forEach((n, i) => {
        //
        // Interpolate stuff
        //

        // Figure out visibility
        const prevVisibility = prevPanel ? prevPanel.nodeVisibilities[i] : 0;
        const nextVisibility = nextPanel ? nextPanel.nodeVisibilities[i] : 0;

        // Lerp the visibbility
        n.visibility =
          prevVisibility +
          (nextVisibility - prevVisibility) * easePoly(progress, 4);

        n.isVisible = n.visibility > this.opts.visibilityThreshold;

        // Figure the color
        const defaultColours = {
          isHighlighted: false,
          highlight: DEFAULT_COLOR,
          outline: OUTLINE_COLOR
        };
        const prevColors = prevPanel
          ? prevPanel.nodeColours[i]
          : Object.assign({}, defaultColours);
        const nextColors = nextPanel
          ? nextPanel.nodeColours[i]
          : Object.assign({}, defaultColours);

        n.outerColor = new Color(prevColors.outer).lerp(
          new Color(nextColors.outer),
          progress
        );

        n.innerColor = new Color(prevColors.inner).lerp(
          new Color(nextColors.inner),
          progress
        );

        const isHighlighted =
          prevColors.isHighlighted || nextColors.isHighlighted;

        //
        // Update stuff
        //

        // Move the sprite
        n.obj.position.set(n.x, n.y, n.z);
        n.outline.position.set(n.x, n.y, n.z);

        // Labels
        this.updateNodeLabel(n);

        // Node colours
        n.outline.material.color = n.outerColor;
        n.obj.material.color = n.innerColor;

        // Inner circle is hidden unless being highlighted
        n.obj.material.opacity = isHighlighted ? 1 : 0;

        // Render order for foregrounding of activated nodes
        if (n.visibility > this.opts.visibilityThreshold) {
          n.obj.renderOrder = 10;
          n.outline.renderOrder = 9;
        } else {
          n.obj.renderOrder = 5;
          n.outline.renderOrder = 4;
        }

        // Perform hover if this node is being intersected
        if (
          intersections.length > 0 &&
          n.isVisible &&
          intersections.includes(n.obj)
        ) {
          n.obj.material.color = new Color(
            colours[n.highlightColor] || 0xffffff
          );
          n.obj.material.opacity = 1;
        }
      });

      // Update the edges
      edges.forEach(e => {
        // Reposition

        e.geometry.vertices[0].set(e.source.x, e.source.y, e.source.z);
        e.geometry.vertices[1].set(e.target.x, e.target.y, e.target.z);
        e.line.setGeometry(e.geometry);

        // Highlight
        if (e.target.visibility > 0 && e.source.visibility > 0) {
          if (e.target.visibility > e.source.visibility) {
            e.material.color = e.source.outline.material.color;
          } else {
            e.material.color = e.target.outline.material.color;
          }
          e.obj.renderOrder = 6;
        } else {
          e.obj.material.color.setHex(DISABLED_COLOR);
          e.obj.renderOrder = 0;
        }
      });

      // console.log("autoBearing", autoBearing.origin);

      const prevBearing = prevPanel
        ? prevPanel.bearing
        : this.bearingFromConfig();
      const nextBearing = nextPanel
        ? nextPanel.bearing
        : this.bearingFromConfig();
      const displayBearing = lerpedBearing(prevBearing, nextBearing, progress);

      if (this.helper) {
        this.scene.remove(this.helper);
      }
      if (this.showOriginHelper) {
        this.helper = new Box3Helper(nextBearing.bounds, 0xffff00);
        this.scene.add(this.helper);
      }

      if (this.isOrbital === false && this.isExplore === false) {
        this.positionCamera(displayBearing);
      } else {
        this.controls.update();
      }
      rafRef = requestAnimationFrame(loop);
      renderer.render(this.scene, this.camera);
      this.needsRender = false;
      if (typeof this.onRenderCallback === "function") {
        this.onRenderCallback({
          camera: { position: this.camera.position },
          bearing:
            this.isOrbital || this.isExplore
              ? this.bearingFromControls()
              : displayBearing
        });
      }
    };

    loop.stop = () => {
      cancelAnimationFrame(rafRef);
    };

    loop();

    return loop;
  }

  updateNodeLabel(n) {
    // Only update the position if the label is actually visible
    if (n.isVisible) {
      const position = n.obj.position.clone();
      position.y = position.y - this.opts.nodeRadius * 1.2;
      const screenPosition = worldToScreen(position, this.camera);

      n.labelElement.style.setProperty(
        "-ms-transform",
        `translateX(${screenPosition.x}px) translateX(-50%) translateY(${
          screenPosition.y
        }px)`
      );

      n.labelElement.style.setProperty(
        "transform",
        `translate(calc(${screenPosition.x}px - 50%), ${screenPosition.y}px)`
      );

      n.labelElement.style.setProperty(
        "background-color",
        `rgba(${n.innerColor.r * 255}, ${n.innerColor.g * 255}, ${n.innerColor
          .b * 255}, 0.3)`
      );
    }

    n.labelElement.style.setProperty(
      "opacity",
      n.visibility > this.opts.visibilityThreshold ? n.visibility : 0
    );
  }

  positionCamera(bearing) {
    const { camera } = this;
    const { angle, elevation, origin, distance } = bearing;

    const theta = deg2rad(angle);
    const phi = deg2rad(elevation);

    const x = origin.x + Math.sin(theta) * Math.sin(phi) * distance;
    const y = origin.y + Math.cos(phi) * distance;
    const z = origin.z + Math.cos(theta) * Math.sin(phi) * distance;

    camera.position.x = x;
    camera.position.y = y;
    camera.position.z = z;

    camera.lookAt(origin);

    this.controls.setTarget(origin);
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
    const { nodes, edges, scene, renderer, controls } = this;
    controls.dispose();
    nodes.forEach(n => {
      n.obj.material.dispose();
      n.outline.material.dispose();
    });
    edges.forEach(e => {
      e.material.dispose();
      e.geometry.dispose();
    });
    scene.dispose();
    renderer.dispose();

    // Remove event listeners
    // TODO: mousemove event setup in constructor.
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

  bearingFromControls() {
    return {
      origin: this.controls.target,
      angle: rad2deg(this.controls.getAzimuthalAngle()),
      elevation: rad2deg(this.controls.getPolarAngle()),
      distance: this.controls.getRadius()
    };
  }

  bearingFromConfig(config) {
    if (!config || !config.func)
      return {
        origin: { x: 0, y: 0, z: 0 },
        angle: 0,
        elevation: 30,
        distance: 500
      };

    const { nodeRadius } = this.opts;

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

    // Make sure there's something to use for the origin.
    if (nodes.length === 0) {
      nodes.push(...this.nodes);
    }

    const bounds = new Box3();
    const dims = new Vector3();
    bounds.setFromPoints(nodes.map(n => n.point));
    bounds.getSize(dims);

    const width = Math.max(dims.x, nodeRadius * 7);
    const height = Math.max(dims.y, nodeRadius * 7);
    const depth = Math.max(dims.z, nodeRadius * 7);

    const getPhi = (height, depth, width) =>
      (Math.PI / 2) * Math.pow(Math.E, (-2 * (depth + width)) / height);
    const phi = getPhi(height, depth, width);

    const getTheta = (depth, width) =>
      (Math.PI / 2) * Math.pow(Math.E, -depth / width);

    const theta = getTheta(depth, width);

    const radius = Math.max(
      width / Math.atan(Math.PI / 5),
      depth / Math.atan(Math.PI / 5),
      height / Math.atan(Math.PI / 5)
    );

    const center = new Vector3();
    bounds.getCenter(center);

    const defaults = {
      origin: center,
      angle: rad2deg(theta),
      elevation: rad2deg(phi),
      distance: radius
    };

    const { origin, angle, elevation, distance, x, y, z } = config;
    const node =
      this.nodes.find(
        (node, idx) =>
          idx === +origin || node.label === origin || node.shortLabel === origin
      ) || {};

    return {
      origin: {
        x: x || node.x || defaults.origin.x,
        y: y || node.y || defaults.origin.y,
        z: z || node.z || defaults.origin.z
      },
      angle: this.parseConfNumbber(angle) || defaults.angle,
      elevation: this.parseConfNumbber(elevation) || defaults.elevation,
      distance: +distance || defaults.distance,
      bounds
    };
  }

  parseConfNumbber(str) {
    if (!str) return str;
    const components = `${str}`.split("m");
    if (components.length === 2) {
      return +components[1] * -1;
    }
    return +components[0];
  }

  toggleAxesHelper() {
    if (this.axesHelper) {
      this.scene.remove(this.axesHelper);
      this.axesHelper = null;
    } else {
      this.axesHelper = new AxesHelper(5000);
      this.scene.add(this.axesHelper);
    }
    this.needsRender = true;
  }

  toggleOriginHelper() {
    this.showOriginHelper = !this.showOriginHelper;
    this.needsRender = true;
  }

  toggleOrbitalMode() {
    this.isExplore = false; // Only one mode ad a time
    this.isOrbital = !this.isOrbital;
    this.controls.enabled = false;
    this.controls.autoRotate = this.isOrbital;
    this.needsRender = true;
    return this.isOrbital;
  }

  toggleExploreMode() {
    this.isOrbital = false;
    this.isExplore = !this.isExplore;
    this.controls.enabled = this.isExplore;
    this.controls.autoRotate = !this.isExplore;
    this.needsRender = true;
    return this.isExplore;
  }

  // Set a callback function to call on every render.
  onRender(fn) {
    this.onRenderCallback = fn;
  }
}

function lerpedOpacity(a, b, pct) {
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
    elevation: a.elevation + (b.elevation - a.elevation) * pct,
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

function worldToScreen(vector3, camera) {
  camera.updateMatrixWorld();

  let v = vector3.clone();
  v.project(camera);

  // TODO: This needs to be a class function because it should use the viz height/width rather than window
  v.x = ((v.x + 1) * window.innerWidth) / 2;
  v.y = (-(v.y - 1) * window.innerHeight) / 2;
  v.z = camera.position.distanceTo(vector3);

  return v;
}

function labelToCode(label) {
  return label.toLowerCase().replace(/[^a-z]+/g, "");
}

function deg2rad(deg) {
  return deg * (Math.PI / 180);
}

function rad2deg(rad) {
  return rad * (180 / Math.PI);
}

function hexToRgb(hex) {
  // Expand shorthand form (e.g. "03F") to full form (e.g. "0033FF")
  var shorthandRegex = /^#?([a-f\d])([a-f\d])([a-f\d])$/i;
  hex = hex.replace(shorthandRegex, function(m, r, g, b) {
    return r + r + g + g + b + b;
  });

  var result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result
    ? {
        r: parseInt(result[1], 16),
        g: parseInt(result[2], 16),
        b: parseInt(result[3], 16)
      }
    : null;
}
