m=['a','e','i','o','u']
while True:
    a=input()
    if a=="end":
        quit()
    else:
        ff=True
        f=False
        for b in range(len(a)):
            if a[b] in m:
                f=True
            if b>=1:
                if a[b]==a[b-1] and a[b]!='e' and a[b]!='o':
                    print("<" +a+ "> is not acceptable.")
                    ff=False
                    break
            if b>=2:
                if (a[b-2] in m and a[b-1] in m and a[b] in m) or (a[b-2] not in m and a[b-1] not in m and a[b] not in m):
                    print("<" +a+ "> is not acceptable.")
                    ff=False
                    break
        if ff==True and f==True:
            print("<" +a+ "> is acceptable.")
        elif ff==True:
            print("<" + a + "> is not acceptable.")