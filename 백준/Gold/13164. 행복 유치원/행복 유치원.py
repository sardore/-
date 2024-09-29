n,k=map(int,input().split())
a=list(map(int,input().split()))
b=[]
e=0
for c in range(n-1):
    b.append(a[c+1]-a[c])
b.sort()
for d in range(n-k): # 가장 큰 차이 k개를 무시
    e+=b[d]
print(e)