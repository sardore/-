from itertools import product
import sys
 
N, K = map(int, input().split())
k_list = list(map(int, input().split()))
 
flag = 0
k_list.sort(reverse=True)
length = len(str(N))
 
while not flag:
    result = list(product(k_list, repeat=length))
 
    for i in result:
        temp = ''.join(map(str, i))
        if N >= int(temp):
            print(temp)
            flag = 1
            break
    length -= 1
