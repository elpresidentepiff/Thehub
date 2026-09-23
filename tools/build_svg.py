import json, math
segs=json.load(open('segs_raw.json'))
PPM=56.69

def ln(s): return math.hypot(s[2]-s[0],s[3]-s[1])

# drop the title block / sheet furniture: keep only the drawing body
body=[s for s in segs if 150<min(s[0],s[2]) and max(s[0],s[2])<2050 and 330<min(s[1],s[3]) and max(s[1],s[3])<1450]
xs=[v for s in body for v in (s[0],s[2])]; ys=[v for s in body for v in (s[1],s[3])]
minx,maxx,miny,maxy=min(xs),max(xs),min(ys),max(ys)
Wm,Hm=(maxx-minx)/PPM,(maxy-miny)/PPM
print('drawing body: %d segs, extent %.2f m x %.2f m'%(len(body),Wm,Hm))

def cls(s):
    l=ln(s)
    if l>=150: return 'structure'
    if l>=45:  return 'partition'
    return 'detail'

groups={'structure':[],'partition':[],'detail':[]}
for s in body:
    x0=(s[0]-minx)/PPM; y0=(s[1]-miny)/PPM
    x1=(s[2]-minx)/PPM; y1=(s[3]-miny)/PPM
    groups[cls(s)].append('M%.4f %.4fL%.4f %.4f'%(x0,y0,x1,y1))

style={'structure':('#111',0.055),'partition':('#444',0.030),'detail':('#b9b9b9',0.018)}
out=['<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 %.4f %.4f" width="%.0f" height="%.0f">'%(Wm,Hm,Wm*40,Hm*40)]
out.append('<!-- Lloyds Wharf Unit 4, Second Floor. Units = METRES. Source: Proposed Plans Rev B. Scale 1:50 @A1 (56.69pt/m) -->')
out.append('<rect width="%.4f" height="%.4f" fill="#fff"/>'%(Wm,Hm))
for k in ('detail','partition','structure'):
    c,w=style[k]
    out.append('<g id="%s" fill="none" stroke="%s" stroke-width="%.3f" stroke-linecap="round"><path d="%s"/></g>'%(k,c,w,''.join(groups[k])))
out.append('</svg>')
open('floor_unit4_l2.svg','w').write('\n'.join(out))
json.dump({'source':'Proposed Plans Unit 4 Lloyds Wharf Rev B.pdf','sheet':'A1 2384x1684pt','scale':'1:50','pt_per_metre':PPM,
 'units':'metres','extent_m':{'w':round(Wm,3),'h':round(Hm,3)},
 'pdf_origin_pt':{'x':round(minx,2),'y':round(miny,2)},
 'grid_angles_deg':[9,81,171],'segment_counts':{k:len(v) for k,v in groups.items()},
 'note':'y increases downward, matching PDF raw y (display-correct for this file)'}, open('plan_meta.json','w'), indent=1)
print('counts', {k:len(v) for k,v in groups.items()})
print('-> floor_unit4_l2.svg  +  plan_meta.json')
