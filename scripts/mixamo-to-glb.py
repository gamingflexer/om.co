"""Merge Mixamo FBX exports into one GLB for the homepage avatar.

Usage (Blender 3.x/4.x, from the repo root):

  blender -b -P scripts/mixamo-to-glb.py -- <character_idle.fbx> <wave.fbx> [more clips...] -o public/models/om.glb

Then compress it for phones (3.0 MB -> 1.7 MB; the hero loads it with
three's MeshoptDecoder): dedup the shared normal map, shrink the
eyelash-only and shoe textures, meshopt the geometry and animation.

  g() { pnpm dlx @gltf-transform/cli@4.1.1 "$@"; }
  g dedup public/models/om.glb /tmp/a.glb
  g resize /tmp/a.glb /tmp/b.glb --pattern "Remy_Body_Diffuse-Remy_Body_Opacity" --width 512 --height 512
  g resize /tmp/b.glb /tmp/c.glb --pattern "Remy_Shoes_*" --width 512 --height 512
  g meshopt /tmp/c.glb public/models/om.glb --level medium

Download from Mixamo:
  1. Pick a character, pick the "Idle" animation, Download: FBX Binary, With Skin, 30 fps.
  2. Pick "Waving" (or any wave), Download: FBX Binary, Without Skin, 30 fps.
The first file must be the one WITH skin; the rest are clips retargeted by
bone name onto that rig. Clips are named after their file names (lowercased,
spaces → underscores), so idle.fbx → "idle", waving.fbx → "waving". The hero
scene plays "idle" in a loop and any clip whose name contains "wav" as the
wave.
"""
import os
import sys

import bpy

argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
out = "public/models/om.glb"
files = []
i = 0
while i < len(argv):
    if argv[i] == "-o":
        out = argv[i + 1]
        i += 2
    else:
        files.append(argv[i])
        i += 1
if not files:
    print(__doc__)
    sys.exit(1)

bpy.ops.wm.read_factory_settings(use_empty=True)


def clip_name(path):
    return os.path.splitext(os.path.basename(path))[0].lower().replace(" ", "_").replace("-", "_")


def import_fbx(path):
    before = set(bpy.data.objects)
    if hasattr(bpy.ops.wm, "fbx_import"):  # Blender 4.5+/5 native importer
        bpy.ops.wm.fbx_import(filepath=path)
    else:
        bpy.ops.import_scene.fbx(filepath=path, automatic_bone_orientation=False, ignore_leaf_bones=True)
    return [o for o in bpy.data.objects if o not in before]


# Character (with skin) and its first clip.
objs = import_fbx(files[0])
rig = next(o for o in objs if o.type == "ARMATURE")
rig.name = "Armature"
if rig.animation_data and rig.animation_data.action:
    rig.animation_data.action.name = clip_name(files[0])
    rig.animation_data.action.use_fake_user = True

# Extra clips: import, steal the action, delete the imported rig.
for path in files[1:]:
    extra = import_fbx(path)
    erig = next((o for o in extra if o.type == "ARMATURE"), None)
    if erig and erig.animation_data and erig.animation_data.action:
        act = erig.animation_data.action
        act.name = clip_name(path)
        act.use_fake_user = True
    for o in extra:
        bpy.data.objects.remove(o, do_unlink=True)

# Mixamo exports in centimetres; the site expects metres, feet at y = 0.
# The scale stays on the armature node (not applied): the clips' hip
# location keys are in centimetres too, and applying the scale to the bones
# would leave those keys 100x too large.
# Different importers land Mixamo rigs at different sizes (the native
# Blender 5 importer gives 2x centimetres), so measure and normalise to
# TARGET_HEIGHT metres instead of assuming 0.01.
TARGET_HEIGHT = float(os.environ.get("TARGET_HEIGHT", "1.8"))
bpy.context.view_layer.update()
zs = []
for o in bpy.data.objects:
    if o.type == "MESH" and (o.parent == rig or o.find_armature() == rig):
        for c in o.bound_box:
            zs.append((o.matrix_world @ __import__("mathutils").Vector(c)).z)
height = (max(zs) - min(zs)) if zs else 180.0
scale = TARGET_HEIGHT / height
rig.scale = (scale, scale, scale)
rig.location = (0, 0, 0)
print("rig height", height, "-> scale", scale)

# Push every action onto NLA tracks so the glTF exporter writes them all.
rig.animation_data_create()
rig.animation_data.action = None
for act in bpy.data.actions:
    track = rig.animation_data.nla_tracks.new()
    track.name = act.name
    strip = track.strips.new(act.name, int(act.frame_range[0]), act)
    strip.name = act.name

# Textures. Mixamo ships 2K/4K PNG specular/gloss/normal/diffuse sets that
# add up to >30 MB; the page needs a few MB. Keep diffuse (+opacity) and
# normal maps, drop specular/gloss (glTF is metallic/roughness anyway),
# downscale to MAX_TEX and let the exporter write WebP.
MAX_TEX = int(os.environ.get("MAX_TEX", "1024"))
for mat in bpy.data.materials:
    if not mat.use_nodes:
        continue
    nodes = mat.node_tree.nodes
    for node in list(nodes):
        if node.type == "TEX_IMAGE" and node.image and any(k in node.image.name.lower() for k in ("specular", "gloss", "roughness", "metal")):
            nodes.remove(node)
    for node in nodes:
        if node.type == "BSDF_PRINCIPLED":
            node.inputs["Metallic"].default_value = 0.0
            node.inputs["Roughness"].default_value = 0.65
            node.inputs["Specular IOR Level"].default_value = 0.35 if "Specular IOR Level" in node.inputs else None
for img in bpy.data.images:
    if img.users == 0 or not img.has_data:
        continue
    w, h = img.size
    if max(w, h) > MAX_TEX:
        f = MAX_TEX / max(w, h)
        img.scale(max(1, int(w * f)), max(1, int(h * f)))

os.makedirs(os.path.dirname(out) or ".", exist_ok=True)
bpy.ops.object.select_all(action="SELECT")
bpy.ops.export_scene.gltf(
    filepath=out,
    export_format="GLB",
    export_apply=True,
    export_animations=True,
    export_animation_mode="ACTIONS",
    export_nla_strips=True,
    export_skins=True,
    export_yup=True,
    export_image_format="WEBP",
    export_image_quality=82,
    export_draco_mesh_compression_enable=False,
)
print("wrote", out, "clips:", [a.name for a in bpy.data.actions])
