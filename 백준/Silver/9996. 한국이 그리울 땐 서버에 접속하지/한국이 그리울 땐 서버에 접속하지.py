n=int(input())
a=list(input().split("*"))
for _ in range(n):
    b=input()
    if b.startswith(a[0]) and b.endswith(a[1]) and len(b)>=len(a[0]+a[1]):
        print("DA")
        continue
    print("NE")