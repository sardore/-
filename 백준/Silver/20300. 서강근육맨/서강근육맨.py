b=int(input())
a=sorted(list(map(int,input().split())))
d=0
if b%2==0:
    for c in range(b//2):
        d = max(d,a[c]+a[b-1-c])
else:
    m=a[-1]
    d=m
    for c in range(b//2):
        d=max(d,a[c]+a[b-2-c])
print(d)