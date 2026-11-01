# Blender'dan oyuna yerleşim: freze-sahne.glb'yi Blender'a aktarıp eşyaları taşıdıktan sonra
# Scripting sekmesinde bu dosyayı açıp çalıştırın (Alt+P). Masaüstüne freze-yerlesim.json yazar;
# oyunda Geliştirici paneli → "Yerleşimi yükle (JSON)" ile denenir, kalıcı olması için dosya Claude'a verilir.
#
# Görünüşte tıklanan nesne çoğu zaman modelin kökü değil içindeki mesh'tir; bu yüzden her model için kökün altındaki
# en büyük mesh'in (ref) dünya dönüşümü yazılır, oyun kökü ona göre yeniden kurar. Hangi düzeyi taşıdığınızın önemi yok
# (yalnızca modelin bir parçasını ayrı taşıdıysanız en büyük parça esas alınır).
#
# Eksenler: glTF/oyun Y yukarı (oyun mm), Blender Z yukarı (metre). İçe aktarma (x, y, z) → (x, −z, y) çevirir;
# oyunun dünya dönüşümü = 1000 · A⁻¹ · M_blender · A (A: oyun → Blender eksen çevirisi). Satır sıralı 16 sayı.
import bpy, json, os, re
from mathutils import Matrix

A = Matrix(((1, 0, 0, 0), (0, 0, -1, 0), (0, 1, 0, 0), (0, 0, 0, 1)))   # oyun (Y yukarı) → Blender (Z yukarı)
C = Matrix.Scale(1000, 4) @ A.inverted()                                   # Blender dünya (m) → oyun dünya (mm)
temiz = lambda ad: re.sub(r'\.\d{3}$', '', ad)                             # Blender'ın eklediği .001 soneki

def meshler(o):
    for c in o.children:
        if c.type == 'MESH': yield c
        yield from meshler(c)

esyalar = []
for o in bpy.data.objects:
    ad = temiz(o.name)
    if not re.fullmatch(r'[\w-]+#\d+', ad):
        continue
    ms = list(meshler(o)) + ([o] if o.type == 'MESH' else [])
    if not ms:
        continue
    ref = max(ms, key=lambda m: len(m.data.vertices))
    M = C @ ref.matrix_world @ A
    t = o.matrix_world.translation
    esyalar.append({'ad': ad, 'ref': temiz(ref.name), 'm': [round(M[i][j], 5) for i in range(4) for j in range(4)],
                    'x': round(t.x * 1000, 1), 'y': round(t.z * 1000, 1), 'z': round(-t.y * 1000, 1), 'ry': round(o.matrix_world.to_euler('XYZ').z, 3)})

yol = os.path.join(os.path.expanduser('~'), 'Desktop', 'freze-yerlesim.json')
with open(yol, 'w', encoding='utf-8') as f:
    json.dump(esyalar, f, ensure_ascii=False, indent=1)
print(f'{len(esyalar)} eşya yazıldı: {yol}')
