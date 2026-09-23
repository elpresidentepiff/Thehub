import pdfplumber, math, json
import sys
PDF=sys.argv[1] if len(sys.argv)>1 else 'assets/plan/source/rev-b.pdf'
pdf=pdfplumber.open(PDF); p=pdf.pages[0]

segs=[]   # (x0,y0,x1,y1,kind)
# Use 'pts' for both lines and curves: they are top-origin (y down, as displayed).
# l['y0']/l['y1'] are bottom-origin PDF space. Mixing the two mirrored every wall
# vertically against the furniture until 2026-09-23.
for l in p.lines:
    (ax,ay),(bx,by)=l['pts'][0],l['pts'][-1]
    segs.append((ax,ay,bx,by,'line'))
for c in p.curves:
    pts=c['pts']
    for a,b in zip(pts,pts[1:]):
        segs.append((a[0],a[1],b[0],b[1],'curve'))

def L(s): return math.hypot(s[2]-s[0],s[3]-s[1])
def A(s): return math.degrees(math.atan2(s[3]-s[1],s[2]-s[0]))%180

import collections
buckets=collections.Counter()
for s in segs:
    if L(s)>=40: buckets[round(A(s))]+=1
print('long-seg angle families:', buckets.most_common(16))
print('total segs', len(segs), 'lines', len(p.lines), 'curve-segs', len(segs)-len(p.lines))

# length histogram of LINE objects only (curves are mostly text outlines)
ln=sorted(L(s) for s in segs if s[4]=='line')
import statistics
for q in (0.5,0.7,0.8,0.85,0.9,0.95,0.98,0.99,1.0):
    print(' q%.2f = %.1f'%(q, ln[min(int(len(ln)*q), len(ln)-1)]))
json.dump([[round(v,3) for v in s[:4]]+[s[4]] for s in segs], open('segs_raw.json','w'))
print('dumped segs_raw.json')
