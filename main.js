import { DemoProvider, LocalFaitProvider } from "./AIProvider.js";
const aiProvider = new DemoProvider();
aiProvider.connect();
import * as THREE from 'three';
import { VRMLoaderPlugin, VRMUtils } from '@pixiv/three-vrm';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

// Configuration
const AVATAR_URL = '/assets/Fait.vrm.glb';
const LIGHTING_PRESETS = {
    'hot': { main: 0xffaa00, rim: 0xff3366 },
    'cool': { main: 0x00ccff, rim: 0x0066ff },
    'amber': { main: 0xffcc99, rim: 0xff5500 }
};

// Represents the physical smartphone object in the scene
class VirtualPhone {
    constructor(scene) {
        this.group = new THREE.Group();
        
        // Phone body
        const bodyGeo = new THREE.BoxGeometry(0.08, 0.16, 0.01);
        const bodyMat = new THREE.MeshStandardMaterial({ color: 0x222222, roughness: 0.8 });
        this.mesh = new THREE.Mesh(bodyGeo, bodyMat);
        this.group.add(this.mesh);

        // Screen
        const screenGeo = new THREE.BoxGeometry(0.07, 0.15, 0.011);
        const screenMat = new THREE.MeshBasicMaterial({ color: 0x050505 });
        this.screen = new THREE.Mesh(screenGeo, screenMat);
        this.group.add(this.screen);

        // Camera attachment point (selfie cam faces out from screen)
        this.cameraPoint = new THREE.Object3D();
        this.cameraPoint.position.set(0, 0.07, 0.006);
        this.cameraPoint.rotation.y = Math.PI; // Look away from screen
        this.group.add(this.cameraPoint);

        scene.add(this.group);
        this.state = 'FREE'; 
    }

    attachToHand(handNode) {
        handNode.add(this.group);
        // Position the phone in the hand
        this.group.position.set(0.0, 0.04, 0.05);
        // Rotate so screen faces roughly towards avatar's face when arm is raised
        this.group.rotation.set(Math.PI / 2, 0, Math.PI / 4); 
        this.state = 'HANDHELD';
    }

    attachToWorld(scene, position, lookAtTarget) {
        scene.add(this.group);
        this.group.position.copy(position);
        if (lookAtTarget) {
            this.group.lookAt(lookAtTarget);
            this.group.rotateY(Math.PI); // Screen faces target
        }
        this.state = 'PLACED';
    }
}

// Handles the logic for automatically adjusting the arm or the phone
// to frame the avatar based on the selected mode.
class FramingController {
    constructor(vrm, phone, camera) {
        this.vrm = vrm;
        this.phone = phone;
        this.camera = camera;
        this.mode = 'SELFIE';
        
        // Smoothing targets for rudimentary procedural arm manipulation
        this.targetUpperZ = 0;
        this.targetUpperY = 0;
        this.targetLowerY = 0;
        
        this.currentUpperZ = 0;
        this.currentUpperY = 0;
        this.currentLowerY = 0;
    }

    setMode(mode, scene) {
        this.mode = mode;
        if (!this.vrm) return;

        const rightHand = this.vrm.humanoid.getNormalizedBoneNode('rightHand');
        const head = this.vrm.humanoid.getNormalizedBoneNode('head');

        const rightUpperArm = this.vrm.humanoid.getNormalizedBoneNode('rightUpperArm');
        const rightLowerArm = this.vrm.humanoid.getNormalizedBoneNode('rightLowerArm');
        if (rightUpperArm && rightLowerArm) {
            this.currentUpperZ = rightUpperArm.rotation.z;
            this.currentUpperY = rightUpperArm.rotation.y;
            this.currentLowerY = rightLowerArm.rotation.y;
        }

        switch(mode) {
            case 'HANDHELD':
            case 'SELFIE':
            case 'FULL_BODY':
                this.phone.attachToHand(rightHand);
                this.targetUpperZ = mode === 'FULL_BODY' ? 0.2 : 0.5;
                this.targetUpperY = mode === 'FULL_BODY' ? -0.5 : -1.0;
                this.targetLowerY = mode === 'FULL_BODY' ? -0.2 : -1.5;
                break;
            case 'LOCKED':
            case 'TRIPOD':
            case 'FOLLOW':
                const headPos = new THREE.Vector3();
                head.getWorldPosition(headPos);
                const placePos = headPos.clone();
                placePos.z += (mode === 'TRIPOD' ? 1.0 : 1.5);
                placePos.y -= 0.2;
                this.phone.attachToWorld(scene, placePos, headPos);
                break;
            case 'FREE':
                const currentPos = new THREE.Vector3();
                this.phone.group.getWorldPosition(currentPos);
                this.phone.attachToWorld(scene, currentPos);
                break;
        }
    }

    getScreenSpacePosition(worldPos) {
        const projected = worldPos.clone().project(this.camera);
        return {
            x: projected.x, 
            y: projected.y, 
            z: projected.z  
        };
    }

    update(delta) {
        if (!this.vrm) return;

        const head = this.vrm.humanoid.getNormalizedBoneNode('head');
        const rightUpperArm = this.vrm.humanoid.getNormalizedBoneNode('rightUpperArm');
        const rightLowerArm = this.vrm.humanoid.getNormalizedBoneNode('rightLowerArm');
        const hips = this.vrm.humanoid.getNormalizedBoneNode('hips');
        
        if (!head || !rightUpperArm || !rightLowerArm) return;

        const headPos = new THREE.Vector3();
        head.getWorldPosition(headPos);

        const hipsPos = new THREE.Vector3();
        if (hips) hips.getWorldPosition(hipsPos);

        // Update camera matrices for screen-space calculations
        this.camera.updateMatrixWorld();
        this.camera.updateProjectionMatrix();

        // Procedural framing logic
        if (this.mode === 'SELFIE' || this.mode === 'FULL_BODY') {
            const screenHead = this.getScreenSpacePosition(headPos);
            const dist = headPos.distanceTo(this.camera.position);

            if (this.mode === 'SELFIE') {
                const errorX = screenHead.x - 0.0;
                const errorY = screenHead.y - 0.3;
                
                this.targetUpperY -= errorX * delta * 1.5; 
                this.targetUpperZ += errorY * delta * 1.5;

                if (dist > 0.7) this.targetLowerY -= delta * 1.0; 
                if (dist < 0.5) this.targetLowerY += delta * 1.0; 
            } else {
                const screenHips = this.getScreenSpacePosition(hipsPos);
                const errorX = screenHips.x - 0.0;
                const errorY = screenHead.y - 0.6;
                
                this.targetUpperY -= errorX * delta * 1.5;
                this.targetUpperZ += errorY * delta * 1.5;
                
                this.targetLowerY = THREE.MathUtils.lerp(this.targetLowerY, 0, delta);
            }

            this.targetUpperZ = THREE.MathUtils.clamp(this.targetUpperZ, -0.5, 1.5);
            this.targetUpperY = THREE.MathUtils.clamp(this.targetUpperY, -1.5, 0.5);
            this.targetLowerY = THREE.MathUtils.clamp(this.targetLowerY, -2.5, 0.0);

            this.currentUpperZ = THREE.MathUtils.lerp(this.currentUpperZ, this.targetUpperZ, delta * 3);
            this.currentUpperY = THREE.MathUtils.lerp(this.currentUpperY, this.targetUpperY, delta * 3);
            this.currentLowerY = THREE.MathUtils.lerp(this.currentLowerY, this.targetLowerY, delta * 3);

            rightUpperArm.rotation.z = this.currentUpperZ;
            rightUpperArm.rotation.y = this.currentUpperY;
            rightLowerArm.rotation.y = this.currentLowerY;
            
        } else if (this.mode === 'FOLLOW' && this.phone.state === 'PLACED') {
            const screenHead = this.getScreenSpacePosition(headPos);
            const targetY = 0.2;
            const errorX = screenHead.x;
            const errorY = screenHead.y - targetY;
            
            if (Math.abs(errorX) > 0.1 || Math.abs(errorY) > 0.1) {
                const lookTarget = headPos.clone().setY(headPos.y - (errorY * 0.5));
                const currentRot = this.phone.group.quaternion.clone();
                
                this.phone.group.lookAt(lookTarget);
                this.phone.group.rotateY(Math.PI); 
                const targetRot = this.phone.group.quaternion.clone();
                
                this.phone.group.quaternion.copy(currentRot);
                this.phone.group.quaternion.slerp(targetRot, delta * 2);
            }
        }
    }
}

class PrivateStreamScene {
    constructor() {
        this.container = document.getElementById('canvas-container');
        this.scene = new THREE.Scene();
        // Vertical FOV, selfie-like
        this.camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 100);
        this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
        this.clock = new THREE.Clock();
        
        this.vrm = null;
        this.currentAnimation = null;
        
        this.init();
    }

    init() {
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.renderer.setPixelRatio(window.devicePixelRatio);
        this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
        this.container.appendChild(this.renderer.domElement);

        this.setupLighting(LIGHTING_PRESETS['hot']);
        
        // Initialize Phone & Controllers
        this.phone = new VirtualPhone(this.scene);
        
        // Attach user view to the phone's camera point
        this.phone.cameraPoint.add(this.camera);
        this.camera.position.set(0,0,0);
        this.camera.rotation.set(0,0,0);

        this.framingController = new FramingController(null, this.phone);

        // Orbit controls for FREE mode / testing
        this.orbitControls = new OrbitControls(this.camera, this.renderer.domElement);
        this.orbitControls.enabled = false;

        this.loadAvatar();
        this.setupInputListener();
        this.setupUI();
        
        window.addEventListener('resize', () => this.onWindowResize());
        this.animate();
    }

    setupLighting(preset) {
        // Remove old lights
        this.scene.children = this.scene.children.filter(c => !c.isLight);

        const keyLight = new THREE.DirectionalLight(preset.main, 1.5);
        keyLight.position.set(2, 2, 5);
        this.scene.add(keyLight);

        const rimLight = new THREE.DirectionalLight(preset.rim, 1);
        rimLight.position.set(-2, 1, -3);
        this.scene.add(rimLight);

        const ambient = new THREE.AmbientLight(0xffffff, 0.5);
        this.scene.add(ambient);
    }

    async loadAvatar() {
        const loader = new GLTFLoader();
        loader.register((parser) => new VRMLoaderPlugin(parser));

        try {
            // Provide a reliable fallback if the local assets/avatar.vrm is missing.
            const gltf = await loader.loadAsync(AVATAR_URL);
            
            this.vrm = gltf.userData.vrm;
            VRMUtils.rotateVRM0(this.vrm); 
            this.scene.add(this.vrm.scene);

            this.vrm.scene.position.set(0, 0, 0); // Ground zero

            this.framingController.vrm = this.vrm;
            
            // Initialize mode
            const modeSelect = document.getElementById('camera-mode');
            this.framingController.setMode(modeSelect.value, this.scene);

            if (this.vrm.animationLoader && this.vrm.animationLoader.clips.length > 0) {
                this.playAnimation(this.vrm.animationLoader.clips[0]);
            }
        } catch (error) {
            console.error("Error loading VRM:", error);
            this.logChat("System", "Avatar load failed.");
        }
    }

    playAnimation(clip) {
        if (this.vrm && this.vrm.animationMixer) {
            if (this.currentAnimation) {
                this.currentAnimation.fadeOut(0.5);
            }
            this.currentAnimation = this.vrm.animationMixer.clipAction(clip);
            this.currentAnimation.reset().fadeIn(0.5).play();
        }
    }

    logChat(sender, text) {
        const feed = document.getElementById('chat-feed');
        const msg = document.createElement('div');
        msg.className = 'message';
        msg.innerHTML = `<strong>${sender}:</strong> <span class="${text.startsWith('/') ? 'command' : ''}">${text}</span>`;
        feed.appendChild(msg);
        feed.scrollTop = feed.scrollHeight;
    }

    setupInputListener() {
        const input = document.getElementById('user-input');
        const btn = document.getElementById('send-btn');

        const handleInput = () => {
            const text = input.value.trim();
            if (!text) return;

            this.logChat("You", text);
            
            if (text.startsWith('/')) {
                this.executeCommand(text.slice(1).toLowerCase());
            } else {
                this.logChat("System", "Message sent.");
            }
            input.value = '';
        };

        btn.addEventListener('click', handleInput);
        input.addEventListener('keypress', (e) => { if (e.key === 'Enter') handleInput(); });
    }

    setupUI() {
        const modeSelect = document.getElementById('camera-mode');
        modeSelect.addEventListener('change', (e) => {
            const mode = e.target.value;
            this.logChat("System", `Camera Mode: ${mode}`);
            this.framingController.setMode(mode, this.scene);
            
            // Toggle orbit controls
            if (mode === 'FREE') {
                this.orbitControls.enabled = true;
                // Detach camera from phone for completely free testing
                this.scene.add(this.camera);
            } else {
                this.orbitControls.enabled = false;
                this.phone.cameraPoint.add(this.camera);
                this.camera.position.set(0,0,0);
                this.camera.rotation.set(0,0,0);
            }
        });
    }

    executeCommand(cmd) {
        const animations = this.vrm?.animationLoader?.clips || [];
        let targetClip = null;

        switch(cmd) {
            case 'dance':
                targetClip = animations.find(c => c.name.toLowerCase().includes('dance')) || animations[1];
                this.logChat("System", "Playing: Dance Routine 💃");
                if (targetClip) this.playAnimation(targetClip);
                break;
            case 'wave':
                targetClip = animations.find(c => c.name.toLowerCase().includes('wave')) || animations[0];
                this.logChat("System", "Playing: Wave 👋");
                if (targetClip) this.playAnimation(targetClip);
                break;
            case 'light hot':
                this.setupLighting(LIGHTING_PRESETS['hot']);
                this.logChat("System", "Lighting: Hot 🔥");
                break;
            case 'light cool':
                this.setupLighting(LIGHTING_PRESETS['cool']);
                this.logChat("System", "Lighting: Cool 🧊");
                break;
        }
    }

    onWindowResize() {
        this.camera.aspect = window.innerWidth / window.innerHeight;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(window.innerWidth, window.innerHeight);
    }

    animate() {
        requestAnimationFrame(() => this.animate());
        const delta = this.clock.getDelta();
        
        if (this.vrm) {
            if (this.vrm.animationMixer) {
                this.vrm.animationMixer.update(delta);
            }
            this.vrm.update(delta);
            
            // FramingController overrides arm bones for handheld modes and animates phone for placed modes
            this.framingController.update(delta);
        }

        if (this.orbitControls.enabled) {
            this.orbitControls.update();
        }

        this.renderer.render(this.scene, this.camera);
    }
}

// Start
new PrivateStreamScene();
