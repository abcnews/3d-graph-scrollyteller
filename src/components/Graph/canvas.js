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
  Raycaster
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

import { MeshLine, MeshLineMaterial } from "three.meshline";
import styles from './styles.scss';

const spriteTexture = new TextureLoader().load(require('./sprite.png'));
const OUTLINE_COLOR = 0xffffff;
const DEFAULT_COLOR = 0xffffff;
const DISABLED_COLOR = 0x4a505b;


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
    this.controls = new OrbitControls( this.camera, this.renderer.domElement );

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
      const circleMaterial = new SpriteMaterial({ map: spriteTexture, color: DEFAULT_COLOR, depthTest: false });
      const outlineMaterial = new SpriteMaterial({ map: spriteTexture, color: OUTLINE_COLOR, depthTest: false });

      const circle = new Sprite(circleMaterial);
      const outline = new Sprite(outlineMaterial);

      node.whenHovering = () => {
        // TODO: actually disply some kind of highlight
        circle.material.color = new Color(0x00ff00);
      };

      outline.renderOrder = 9;
      outline.scale.setScalar(12);
      this.scene.add(outline);

      circle.renderOrder = 10;
      circle.scale.setScalar(10);
      this.scene.add(circle);

      // Put them on the node object so we can access them on re-renders
      node.obj = circle;
      node.outline = outline;
      node.material = circleMaterial;

      // Labels
      const label = document.createElement('div');
      label.className = styles.label;
      document.querySelector('#relativeParent').appendChild(label);
      label.innerText = node.label;
      node.labelElement = label;
    });

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

    this.raycaster = new Raycaster()
    this.mouse = new Vector2();
    window.addEventListener('mousemove', e => {
      e.preventDefault();
      this.mouse.x = (e.clientX / window.innerWidth) * 2 - 1;
      this.mouse.y = - (e.clientY / window.innerHeight) * 2 + 1;
    });

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

      // Check for hovers
      // TODO: remember previous intersects to more accurately detect mouseout
      this.raycaster.setFromCamera(this.mouse, this.camera);
      const intersections = this.raycaster.intersectObjects(nodes.map(n => n.obj)).map(o => o.object);

      if (intersections.length > 0) this.needsRender = true;

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

      // Don't re-render on every frame, unless you're auto-rotating...
      if (
        this.needsRender === false &&
        lastProgress === progress &&
        simulation.alpha() <= simulation.alphaMin()
      ) {
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
      nodes.forEach(n => {
        // Move the sprite
        n.obj.position.set(n.x, n.y, n.z);
        n.outline.position.set(n.x, n.y, n.z);

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

        // Only update the position if the label is actually visible
        if (n.isVisible) {
          const screenPosition = worldToScreen(n.obj.position, this.camera);
          n.labelElement.style.setProperty('transform', `translate(calc(${screenPosition.x}px - 50%), ${screenPosition.y + 8 + Math.abs(screenPosition.z / 13)}px)`);
        }
        n.labelElement.style.setProperty(
          "opacity",
          displayOpacity > this.opts.visibilityThreshold
            ? displayOpacity
            : 0
        );

        // Set colors
        // TODO: replace DEFAULT_COLOR with some kind of color from the marker
        //    if you want to do special highlighting
        let lineColor = new Color(DISABLED_COLOR).lerp(new Color(DEFAULT_COLOR), displayOpacity);
        n.progress = displayOpacity;
        n.obj.material.color = lineColor;
        n.outline.material.color = lineColor;
        if (displayOpacity > 0.5) {
          n.obj.renderOrder = 10;
          n.outline.renderOrder = 9;
        } else {
          n.obj.renderOrder = 5;
          n.outline.renderOrder = 4;
        }

        // Perform hover if this node is being intersected
        if (intersections.length > 0 && n.isVisible && intersections.includes(n.obj)) {
          n.whenHovering && n.whenHovering();
        }
      });

      // Update the edges
      edges.forEach(e => {
        // Reposition

        e.geometry.vertices[0].set(e.source.x, e.source.y, e.source.z);
        e.geometry.vertices[1].set(e.target.x, e.target.y, e.target.z);
        e.line.setGeometry(e.geometry);

        // Highlight
        if (e.target.progress > 0 && e.source.progress > 0) {
          if (e.target.progress > e.source.progress) {
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
      const nextBearing = nextPanel.bearing;
      const displayBearing = lerpedBearing(
        prevBearing,
        nextBearing,
        progress
      );

      if (this.isOrbital === false && this.isExplore === false) {
        this.positionCamera(displayBearing);

        if (typeof this.onRenderCallback === "function") {
          this.onRenderCallback({
            camera: { position: this.camera.position },
            bearing: displayBearing
          });
        }
      }
      rafRef = requestAnimationFrame(loop);
      this.controls.update();
      renderer.render(this.scene, this.camera);
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

  toggleOrbitalMode() {
    this.isExplore = false; // Only one mode ad a time
    this.isOrbital = !this.isOrbital;
    this.controls.enabled = false;
    this.controls.autoRotate = !this.isOrbital;
    return this.isOrbital;
  }

  toggleExploreMode() {
    this.isOrbital = false;
    this.isExplore = !this.isExplore;
    this.controls.enabled = this.isExplore;
    this.controls.autoRotate = !this.isExplore;
    return this.isExplore;
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

function worldToScreen(vector3, camera) {
  camera.updateMatrixWorld();

  let v = vector3.clone();
  v.project(camera);

  v.x = (v.x + 1) * window.innerWidth / 2;
  v.y = - (v.y - 1) * window.innerHeight / 2;
  v.z = camera.position.distanceTo(vector3);
  
  return v;
}
