"""Compose labelled review sheets from actual WebGL frames; never paints models."""
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont
import json, sys, zipfile
root=Path(sys.argv[1])
font='/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf'
def face(size): return ImageFont.truetype(font,size)
def board(name,title,subtitle,panels,columns=3):
    w,h,gap=800,545,22
    rows=(len(panels)+columns-1)//columns
    im=Image.new('RGB',(columns*w+(columns+1)*gap,165+rows*(h+gap)+60),'#111921');d=ImageDraw.Draw(im)
    d.text((gap,25),title,font=face(45),fill='#edf2ed');d.text((gap,91),subtitle,font=face(23),fill='#a7bbc6')
    for i,(file,label,crop) in enumerate(panels):
        source=Image.open(root/file).convert('RGB')
        if crop: source=source.crop(crop)
        source.thumbnail((w,h-53),Image.Resampling.LANCZOS)
        x=gap+(i%columns)*(w+gap);y=165+(i//columns)*(h+gap)
        d.rectangle((x,y,x+w,y+h),fill='#202e38')
        im.paste(source,(x+(w-source.width)//2,y+(h-53-source.height)//2))
        d.text((x+18,y+h-39),label,font=face(23),fill='#eff3ee')
    d.text((gap,im.height-43),'BARD  /  Actual production models and rig  /  09 OCT 2026',font=face(21),fill='#a7bbc6')
    out=root/name;im.save(out);Image.open(out).verify();return out
ids=[('aurora-trail-rifle','Aurora trail rifle'),('mossback-scout-rifle','Mossback scout rifle'),('warden-spark-carbine','Warden spark carbine')]
board('Bard-guns-held-review.png','Guns: shape, grip and material pass','Cropped gameplay renders. Complete frames are included in the review archive.',[(f'desktop-first-{i}-carry.png',n+' / first person',(350,300,1200,800)) for i,n in ids]+[(f'desktop-third-{i}-aim.png',n+' / third person',(180,100,1050,730)) for i,n in ids])
board('Bard-bow-draw-review.png','Bow: ready, draw and release','The string, arrow and drawing hand share one animated nock position.',[(f'desktop-{mode}-bow-{pose}.png',f'{mode.title()} person / {label}',None) for mode in ['first','third'] for pose,label in [('ready','Ready'),('half-draw','Half draw'),('full-draw','Full draw'),('released','Released')]],4)
if (root/'phone-first-bow-full-draw.png').exists():
    board('Bard-mobile-held-review.png','Held items on a phone viewport','Actual mobile quality tier at 640 x 420. Scopes use a reduced capture budget.',[(f'phone-first-{i}-carry.png',n+' / carry',None) for i,n in ids]+[(f'phone-first-{i}-aim.png',n+' / aim',None) for i,n in ids]+[('phone-first-bow-full-draw.png','Bow / first person full draw',None),('phone-third-bow-full-draw.png','Bow / third person full draw',None),('phone-first-bow-released.png','Bow / release',None)],3)
files=sorted(root.glob('*.png'))+sorted(root.glob('*.json'))
for file in files:
    if file.suffix=='.png': Image.open(file).verify()
zip_path=root.parent/'Bard-armament-pass-review.zip'
with zipfile.ZipFile(zip_path,'w',zipfile.ZIP_DEFLATED,compresslevel=6) as z:
    for file in files:z.write(file,file.name)
with zipfile.ZipFile(zip_path) as z: assert z.testzip() is None
print(json.dumps({'files':len(files),'archive':str(zip_path),'bytes':zip_path.stat().st_size}))
