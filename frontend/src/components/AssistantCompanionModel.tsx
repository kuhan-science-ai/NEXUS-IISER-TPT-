import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { VRM, VRMHumanBoneName, VRMLoaderPlugin } from '@pixiv/three-vrm';

/** Renders the selected VRM only while its companion is enabled. */
export default function AssistantCompanionModel({ onError, idleMotionClass }: { onError: () => void; idleMotionClass: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [modelLoaded, setModelLoaded] = useState(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    let stopped = false;
    let frame = 0;
    let companion: VRM | null = null;
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(28, 1, 0.05, 100);
    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true, powerPreference: 'low-power' });
    } catch {
      onError();
      return;
    }
    renderer.setClearColor(0x000000, 0);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    scene.add(new THREE.HemisphereLight(0xffffff, 0x51465a, 2.0));
    const keyLight = new THREE.DirectionalLight(0xffffff, 2.2);
    keyLight.position.set(-2, 4, 5);
    scene.add(keyLight);

    const resize = () => {
      const width = Math.max(1, canvas.clientWidth);
      const height = Math.max(1, canvas.clientHeight);
      renderer.setSize(width, height, false);
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
    };
    const observer = new ResizeObserver(resize);
    observer.observe(canvas);
    resize();

    const loader = new GLTFLoader();
    loader.register(parser => new VRMLoaderPlugin(parser));
    loader.load('/assistants/waifu-2/waifu-2.vrm', gltf => {
      if (stopped) return;
      companion = gltf.userData.vrm as VRM | undefined || null;
      if (!companion) { onError(); return; }
      // The VRM's neutral arm pose is a T-pose; lower both upper arms into an A-pose.
      const leftUpperArm = companion.humanoid.getNormalizedBoneNode(VRMHumanBoneName.LeftUpperArm);
      const rightUpperArm = companion.humanoid.getNormalizedBoneNode(VRMHumanBoneName.RightUpperArm);
      if (leftUpperArm) leftUpperArm.rotation.z = -0.72;
      if (rightUpperArm) rightUpperArm.rotation.z = 0.72;
      const avatar = companion.scene;
      avatar.rotation.y = Math.PI;
      scene.add(avatar);
      const bounds = new THREE.Box3().setFromObject(avatar);
      const size = bounds.getSize(new THREE.Vector3());
      const center = bounds.getCenter(new THREE.Vector3());
      const height = Math.max(size.y, 1.2);
      const distance = Math.max(height / (2 * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2))) * 1.1, size.x * 1.65, 2.1);
      camera.position.set(center.x, center.y + height * 0.015, center.z + distance);
      camera.lookAt(center.x, center.y, center.z);
      resize();
      setModelLoaded(true);
    }, undefined, onError);

    const clock = new THREE.Clock();
    const render = () => {
      if (stopped) return;
      frame = requestAnimationFrame(render);
      const delta = clock.getDelta();
      const elapsed = clock.elapsedTime;
      if (companion) {
        companion.scene.position.y = Math.sin(elapsed * 1.1) * 0.025;
        companion.scene.rotation.y = Math.PI + Math.sin(elapsed * 0.55) * 0.055;
        companion.update(delta);
        // Keep the resting arms lowered after VRM updates so the model returns to its A-pose.
        const leftUpperArm = companion.humanoid.getNormalizedBoneNode(VRMHumanBoneName.LeftUpperArm);
        const rightUpperArm = companion.humanoid.getNormalizedBoneNode(VRMHumanBoneName.RightUpperArm);
        if (leftUpperArm) leftUpperArm.rotation.z = -0.72;
        if (rightUpperArm) rightUpperArm.rotation.z = 0.72;
      }
      renderer.render(scene, camera);
    };
    render();

    return () => {
      stopped = true;
      cancelAnimationFrame(frame);
      observer.disconnect();
      if (companion) {
        scene.remove(companion.scene);
        companion.scene.traverse(object => {
          const mesh = object as THREE.Mesh;
          if (!mesh.isMesh) return;
          mesh.geometry.dispose();
          const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
          materials.forEach(material => material.dispose());
        });
      }
      renderer.dispose();
      renderer.forceContextLoss();
    };
  }, [onError]);

  return <>
    {!modelLoaded && <img className={`nexus-assistant-companion-fallback ${idleMotionClass}`} src="/assistants/waifu-2/idle.webp" alt="" />}
    <canvas ref={canvasRef} className={`nexus-assistant-companion-model ${idleMotionClass}`} aria-hidden="true" />
  </>;
}
