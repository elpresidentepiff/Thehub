import json,sys
from PIL import Image, ImageDraw
segs=json.load(open('segs_raw.json'))
x0,y0,x1,y1,S,out = float(sys.argv[1]),float(sys.argv[2]),float(sys.argv[3]),float(sys.argv[4]),float(sys.argv[5]),sys.argv[6]
W,H=int((x1-x0)*S),int((y1-y0)*S)
img=Image.new('RGB',(W,H),'white'); d=ImageDraw.Draw(img)
for s in segs:
    d.line([(s[0]-x0)*S,(s[1]-y0)*S,(s[2]-x0)*S,(s[3]-y0)*S], fill='black', width=1)
img.save(out); print(out,W,H)
