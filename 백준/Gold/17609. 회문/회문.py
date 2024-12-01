def wo(a):
    return a == a[::-1]

for _ in range(int(input())):
    c=input()
    d=[]
    a,b=0,len(c)-1
    while True:
        if b<=a:
            print(0)
            break
        if c[a]!=c[b]:
            d=c[a:b]
            if wo(d):
                print(1)
                break
            d=c[a+1:b+1]
            if wo(d):
                print(1)
                break
            print(2)
            break
        a+=1
        b-=1