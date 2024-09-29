n=int(input())
k=int(input())
a=sorted(list(map(int,input().split())))
b=[]
e=0
for c in range(n-1):
    b.append(a[c+1]-a[c])
b.sort()
for d in range(n-k): # 가장 작은 차이 k개를 무시
    e+=b[-(n-1-d)]
print(e)