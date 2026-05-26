import * as THREE from 'three';
import { VRMLoaderPlugin, VRMUtils } from '@pixiv/three-vrm';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

// Configuration
const AVATAR_URL = './assets/avatar.vrm';
const LIGHTING_PRESETS = {
    'hot': { main: 0xffaa00, rim: 0xff3366 },
    'cool': { main: 0x00ccff, rim: 0x0066ff },
    'amber': { main: 0xffcc99, rim: 0xff5500 }
};

class PrivateStreamScene {
    constructor() {
        this.container = document.getElementById('canvas-container');
        this.scene = new THREE.Scene();
        this.camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 100);
        this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
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
        this.setupCamera();
        this.loadAvatar();
        this.setupInputListener();
        
        window.addEventListener('resize', () => this.onWindowResize());
        this.animate();
    }

    setupLighting(preset) {
        // Main Key Light
        const keyLight = new THREE.DirectionalLight(preset.main, 1.5);
        keyLight.position.set(2, 2, 5);
        this.scene.add(keyLight);

        // Rim Light for cinematic separation
        const rimLight = new THREE.DirectionalLight(preset.rim, 1);
        rimLight.position.set(-2, 1, -3);
        this.scene.add(rimLight);

        // Ambient fill
        const ambient = new THREE.AmbientLight(0xffffff, 0.5);
        this.scene.add(ambient);
    }

    setupCamera() {
        // Position for "Portrait" cam view
        this.camera.position.set(0, 1.2, 4); 
        this.camera.lookAt(0, 1.2, 0);
    }

    async loadAvatar() {
        const loader = new GLTFLoader();
        loader.register((parser) => new VRMLoaderPlugin(parser));

        try {
            const gltf = await loader.loadAsync(AVATAR_URL);
            this.vrm = gltf.userData.vrm;
            
            VRMUtils.rotateVRM0(this.vrm); // Fixes older VRM rotations
            this.scene.add(this.vrm.scene);

            // Center the avatar
            this.vrm.scene.position.set(0, -0.5, 0);

            // Auto-play idle animation if available
            if (this.vrm.animationLoader.clips.length > 0) {
                this.playAnimation(this.vrm.animationLoader.clips[0]);
            }
        } catch (error) {
            console.error("Error loading VRM:", error);
            this.logChat("System", "Avatar load failed. Ensure avatar.vrm exists in assets/");
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

    setupInputListener() {
        const input = document.getElementById('user-input');
        const btn = document.getElementById('send-btn');

        const handleInput = () => {
            const text = input.value.trim().toLowerCase();
            if (!text) return;

            this.logChat("You", text);
            
            // Command Logic
            if (text.startsWith('/')) {
                const cmd = text.slice(1);
                this.executeCommand(cmd);
            } else {
                // Regular chat simulation
                this.logChat("System", "Message sent.");
            }
            input.value = '';
        };

        btn.addEventListener('click', handleInput);
        input.addEventListener('keypress', (e) => { if (e.key === 'Enter') handleInput(); });
    }

    executeCommand(cmd) {
        // Simple mapping of text commands to animations
        // In a real game, you would map specific VRM animation clips
        const animations = this.vrm?.animationLoader?.clips || [];
        
        let targetClip = null;

        switch(cmd) {
            case 'dance':
                // Find a clip named "Dance" or fallback to index 1
                targetClip = animations.find(c => c.name.toLowerCase().includes('dance')) || animations[1];
                this.logChat("System", "Playing: Dance Routine 💃");
                break;
            case 'wave':
                targetClip = animations.find(c => c.name.toLowerCase().includes('wave')) || animations[0];
                this.logChat("System", "Playing: Wave 👋");
                break;
            case 'light hot':
                this.setupLighting(LIGHTING_PRESETS['hot']);
                this.logChat("System", "Lighting: Hot 🔥");
                return;
            case 'light cool':
                this.setupLighting(LIGHTING_PRESETS['cool']);
                this.logChat("System
                             
