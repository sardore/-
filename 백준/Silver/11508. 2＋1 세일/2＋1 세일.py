milks=[]
n=int(input())
for _ in range(n):
    milks.append(int(input()))
milks.sort()
milks.reverse()
m=sum(milks)
for a in range(n//3):
    m-=milks[a*3+2]
print(m)