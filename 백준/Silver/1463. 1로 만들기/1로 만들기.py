x=int(input())
if x==1:
    print(0)
    exit()
a=[0]*(x+1)
for b in range(2,x+1):
    a[b]=a[b-1]+1
    if b%2==0:
        a[b]=min(a[b],a[b//2]+1)
    if b%3==0:
        a[b]=min(a[b],a[b//3]+1)
print(a[b])