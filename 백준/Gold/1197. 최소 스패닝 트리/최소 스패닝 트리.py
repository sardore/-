import sys
sys.setrecursionlimit(10000)
v,e=map(int,input().split())
def onion_root(a,b):
    a=find_root(a)
    b=find_root(b)
    if a<b:
        root[b]=a
    else:
        root[a]=b
def find_root(x):
    if root[x]!=x:
        root[x]=find_root(root[x])
    return root[x]
tree=[]
for _ in range(e):
    a,b,w=map(int,input().split())
    tree.append((w,a,b))
tree.sort()#가중치 기준으로 절렬
root=[i for i in range(v+1)]
r=0
for w,a,b in tree:
    if find_root(a)!=find_root(b):
        onion_root(a,b)
        r+=w
print(r)