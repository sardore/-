import sys
d=0
input = sys.stdin.readline
a=0
for _ in range(int(input())):
    a=0
    b=list(input())
    for c in b:
        if c=="(":
            a+=1
        elif c==")":
            if a<=0:
                print("NO")
                d=1
                break
            a-=1
    if d==1:
        d=0
        continue
    if a==0:
        print("YES")
    else:
        print("NO")