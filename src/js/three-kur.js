// ── three.js kurulumu: kütüphane npm'den paketlenir (CDN yok, internetsiz çalışır). Modüller şimdilik global THREE'yi kullanır;
// r128'in eski examples/js eklentileri gibi OrbitControls, RoomEnvironment, RGBELoader (HDRI) ve GLTFLoader (hazır modeller) de THREE'nin üstüne konur.
import * as T from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { RGBELoader } from 'three/examples/jsm/loaders/RGBELoader.js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

window.THREE = { ...T, OrbitControls, RoomEnvironment, RGBELoader, GLTFLoader };
