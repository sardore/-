input()
drinks=list(map(int,input().split()))
m=max(drinks)
s=sum(drinks)-m
print(s/2+m)