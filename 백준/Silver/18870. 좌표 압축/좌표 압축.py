input()
a=list(map(int,input().split()))
n=sorted(set(a))
d={}
for i in range(len(n)):
    d[n[i]]=i
for i in a:
    print(d[i],end=' ')