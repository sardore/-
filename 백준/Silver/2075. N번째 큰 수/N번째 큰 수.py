import sys
input = sys.stdin.readline

n = int(input())
arr = []
for _ in range(n):
    arr += list(map(int,input().split()))
    arr = sorted(arr,reverse=True)[:n]
print(arr[-1])