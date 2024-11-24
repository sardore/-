n,k=map(int,input().split())
a=[[0,False],[1,False]]
d=[]
for i in range(2,n+1):
    a.append([i,True])
for b in a:
    if b[1]:
        for c in range(b[0],n+1,b[0]):
            if a[c][1]==True:
                a[c][1]=False
                e=a[c][0]
                d.append(e)
                if len(d)==k:
                    print(e)
                    quit()