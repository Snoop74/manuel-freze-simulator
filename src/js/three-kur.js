// ── three.js kurulumu: kütüphane npm'den paketlenir (CDN yok, internetsiz çalışır). Modüller şimdilik global THREE'yi kullanır;
// r128'in eski examples/js eklentileri gibi OrbitControls ve RoomEnvironment de THREE'nin üstüne konur.
import * as T from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';

window.THREE = { ...T, OrbitControls, RoomEnvironment };
