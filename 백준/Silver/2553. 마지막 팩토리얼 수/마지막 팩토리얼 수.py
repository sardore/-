n=int(input())
a=1
for b in range(1,n+1):
    a*=b
    if b==n:
        a = list(str(a))
        for c in range(-1,-9999,-1):
            if int(a[c])!=0:
                a = int(a[c])
                break
print(a)