s=[]
for _ in range(int(input())):
    s.append(int(input()))
s.sort(reverse=True)
b=0
for a in range(len(s)):
    b+=max(0,s[a]-a)
print(b)