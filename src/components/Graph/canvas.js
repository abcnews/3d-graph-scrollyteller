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

import * as THREE from "three";

import { OrbitControls } from "../../lib/OrbitControls";

import {
  forceSimulation,
  forceLink,
  forceManyBody,
  forceCenter,
  forceCollide
} from "d3-force-3d";

export default class Canvas {
  constructor(nodes, edges, opts = {}) {
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
      .force("charge", forceManyBody().strength(-30))
      .force("center", forceCenter())
      .force("colide", forceCollide(10))
      .stop();

    nodes.forEach(node => {
      const geometry = new CircleGeometry(5, 32);
      const material = new MeshBasicMaterial({ color: 0xffff00 });
      const circle = new Mesh(geometry, material);

      material.transparent = true;
      material.opacity = 0.2;

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
        linewidth: 100
      });

      geometry.vertices.push(
        new Vector3(edge.source.x, edge.source.y, edge.source.z),
        new Vector3(edge.target.x, edge.target.y, edge.target.z)
      );

      const line = new Line(geometry, material);

      this.scene.add(line);

      edge.obj = line;
      edge.material = material;
      edge.geometry = geometry;
    });

    this.nodes = nodes;
    this.edges = edges;

    this.animate();
  }

  animate() {
    let rafRef;
    let lastScrollPct = null;

    const node1 = this.nodes[Math.floor(this.nodes.length * Math.random())];
    const node2 = this.nodes[Math.floor(this.nodes.length * Math.random())];

    const initialBearing = {
      origin: node1.obj.position,
      angle: 180,
      distance: 500
    };
    const targetBearing = {
      origin: node2.obj.position,
      angle: 20,
      distance: 200
    };

    const loop = () => {
      const { nodes, edges, renderer, camera, simulation } = this;
      // TODO: replace this abomination with the proper scroll checking from Odyssey/Scrollyteller
      const scrollPercent =
        window.scrollY /
        (document.documentElement.scrollHeight - window.innerHeight);

      // Don't re-render on every frame, you fool.
      if (
        lastScrollPct === scrollPercent &&
        simulation.alpha() <= simulation.alphaMin()
      ) {
        rafRef = requestAnimationFrame(loop);
        return;
      }

      if (simulation.alpha() > simulation.alphaMin()) {
        simulation.tick();
      }

      lastScrollPct = scrollPercent;

      // Calculate our lerped bearing
      const bearing = {
        origin: new Vector3(
          initialBearing.origin.x +
            (targetBearing.origin.x - initialBearing.origin.x) * scrollPercent,
          initialBearing.origin.y +
            (targetBearing.origin.y - initialBearing.origin.y) * scrollPercent,
          initialBearing.origin.z +
            (targetBearing.origin.z - initialBearing.origin.z) * scrollPercent
        ),
        angle:
          initialBearing.angle +
          (targetBearing.angle - initialBearing.angle) * scrollPercent,
        distance:
          initialBearing.distance +
          (targetBearing.distance - initialBearing.distance) * scrollPercent
      };

      const rad = (bearing.angle * Math.PI) / 180;
      const distance = bearing.distance;

      node1.material.opacity = 1 - scrollPercent;
      node2.material.opacity = scrollPercent;

      camera.position.x = bearing.origin.x + Math.cos(rad) * distance;
      camera.position.z = bearing.origin.z + Math.sin(rad) * distance;
      camera.position.y = bearing.origin.y + distance / 2;
      camera.lookAt(bearing.origin);

      // Make sure the nodes face the camera
      nodes.forEach(n => {
        n.obj.lookAt(camera.position);
        n.obj.position.set(n.x, n.y, n.z);
      });

      edges.forEach(e => {
        e.geometry.vertices = [
          new Vector3(e.source.x, e.source.y, e.source.z),
          new Vector3(e.target.x, e.target.y, e.target.z)
        ];
        e.geometry.verticesNeedUpdate = true;
      });

      renderer.render(this.scene, this.camera);
      rafRef = requestAnimationFrame(loop);
    };

    loop.stop = () => {
      cancelAnimationFrame(rafRef);
    };

    loop();

    return loop;
  }

  setSize(width, height) {
    this.camera.aspect = width / height;
    this.renderer.setSize(width, height);
  }

  getRenderer() {
    return this.renderer;
  }

  dispose() {
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
}
