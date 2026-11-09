from PIL import Image, ImageDraw
import os

# Load source image
src_path = "bee quuen logo.png"
img = Image.open(src_path).convert("RGBA")

# Crop tightly to non-empty content
bbox = img.getbbox()
content = img.crop(bbox)

# Create a square centered version with nice padding (e.g. 70% of canvas)
# Background color for legacy icons
BG_COLOR = (11, 15, 25, 255) # Dark luxury navy/black #0B0F19

def create_square_icon(size, is_round=False, bg=BG_COLOR):
    # Base image
    out = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    draw = ImageDraw.Draw(out)
    
    # Draw background
    if is_round:
        draw.ellipse([(0, 0), (size - 1, size - 1)], fill=bg)
    else:
        # Subtle rounded rect or square
        r = int(size * 0.2)
        draw.rounded_rectangle([(0, 0), (size - 1, size - 1)], radius=r, fill=bg)
        
    # Scale content to fit nicely (say ~68% of the square)
    target_content_size = int(size * 0.68)
    cw, ch = content.size
    ratio = min(target_content_size / cw, target_content_size / ch)
    new_w, new_h = max(1, int(cw * ratio)), max(1, int(ch * ratio))
    scaled_content = content.resize((new_w, new_h), Image.Resampling.LANCZOS)
    
    # Paste centered
    offset_x = (size - new_w) // 2
    offset_y = (size - new_h) // 2
    out.paste(scaled_content, (offset_x, offset_y), scaled_content)
    return out

def create_adaptive_foreground(size):
    # Adaptive icon foreground has 108dp size, content within 66dp-72dp center safe zone
    out = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    target_content_size = int(size * 0.58) # Safe zone
    cw, ch = content.size
    ratio = min(target_content_size / cw, target_content_size / ch)
    new_w, new_h = max(1, int(cw * ratio)), max(1, int(ch * ratio))
    scaled_content = content.resize((new_w, new_h), Image.Resampling.LANCZOS)
    
    offset_x = (size - new_w) // 2
    offset_y = (size - new_h) // 2
    out.paste(scaled_content, (offset_x, offset_y), scaled_content)
    return out

densities = {
    'mipmap-mdpi': (48, 108),
    'mipmap-hdpi': (72, 162),
    'mipmap-xhdpi': (96, 216),
    'mipmap-xxhdpi': (144, 324),
    'mipmap-xxxhdpi': (192, 432),
}

res_dir = "android/app/src/main/res"

for folder, (icon_size, fg_size) in densities.items():
    folder_path = os.path.join(res_dir, folder)
    os.makedirs(folder_path, exist_ok=True)
    
    # 1. ic_launcher.png
    launcher = create_square_icon(icon_size, is_round=False)
    launcher.save(os.path.join(folder_path, "ic_launcher.png"))
    
    # 2. ic_launcher_round.png
    launcher_round = create_square_icon(icon_size, is_round=True)
    launcher_round.save(os.path.join(folder_path, "ic_launcher_round.png"))
    
    # 3. ic_launcher_foreground.png
    fg = create_adaptive_foreground(fg_size)
    fg.save(os.path.join(folder_path, "ic_launcher_foreground.png"))
    
    print(f"Generated icons for {folder}: {icon_size}x{icon_size}, fg: {fg_size}x{fg_size}")

