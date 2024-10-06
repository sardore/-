a=int(input())
b=list(map(int,input().split()))
j=a
s=a
jj=0
ss=0
for c in range(len(b)):
    jjj=j//b[c]
    j-=b[c]*jjj
    jj+=jjj
    if c>2:
        if b[c-3]<b[c-2]<b[c-1]<b[c]:
            s+=ss*b[c]
            ss=0
        elif b[c-3]>b[c-2]>b[c-1]>b[c]:
            sss=s//b[c]
            s-=b[c]*sss
            ss+=sss
ssss=s+ss*b[-1]
jjjj=j+jj*b[-1]
if ssss>jjjj:
    print("TIMING")
elif jjjj>ssss:
    print("BNP")
else:
    print("SAMESAME")