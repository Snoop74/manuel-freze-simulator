# Blender'dan oyuna yerleşim: freze-sahne.glb'yi Blender'a aktarıp eşyaları taşıdıktan sonra
# Scripting sekmesinde bu dosyayı açıp çalıştırın (Alt+P). Masaüstüne freze-yerlesim.json yazar;
# oyunda Geliştirici paneli → "Yerleşimi yükle (JSON)" ile denenir, kalıcı olması için dosya Claude'a verilir.
#
# Eksenler: glTF Y yukarı, Blender Z yukarı. Oyun (mm, Y yukarı): x = X·1000, y = Z·1000, z = −Y·1000; dönüş ry = Blender Z dönüşü.
# Yalnızca adı "kimlik#sıra" biçimindeki nesneler (hazır modellerin kökleri) yazılır.
import bpy, json, os, re

esyalar = []
for o in bpy.data.objects:
    ad = re.sub(r'\.\d{3}$', '', o.name)                   # Blender'ın eklediği .001 sonekini at
    if not re.fullmatch(r'[\w-]+#\d+', ad):
        continue
    t = o.matrix_world.translation
    rz = o.matrix_world.to_euler('XYZ').z
    esyalar.append({'ad': ad, 'x': round(t.x * 1000, 1), 'y': round(t.z * 1000, 1), 'z': round(-t.y * 1000, 1), 'ry': round(rz, 3)})

yol = os.path.join(os.path.expanduser('~'), 'Desktop', 'freze-yerlesim.json')
with open(yol, 'w', encoding='utf-8') as f:
    json.dump(esyalar, f, ensure_ascii=False, indent=1)
print(f'{len(esyalar)} eşya yazıldı: {yol}')
