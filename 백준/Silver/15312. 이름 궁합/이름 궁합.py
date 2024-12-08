c=[3, 2, 1, 2, 3, 3, 2, 3, 3, 2, 2, 1, 2, 2, 1, 2, 2, 2, 1, 2, 1, 1, 1, 2, 2, 1]
def roto(d):
    return c[ord(d)-65]
a=list(map(roto,list(input())))
b=list(map(roto,list(input())))
ab=[]
for e in range(len(a)):
    ab.append(a[e])
    ab.append(b[e])
bc=[]#신규담당
while True:
    if len(ab)==2:
        break
    for e in range(len(ab)-1):
        bc.append((ab[e]+ab[e+1])%10)
    ab=bc
    bc=[]
print(str(ab[0])+str(ab[1]))